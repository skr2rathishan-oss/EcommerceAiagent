import { cacheService } from "../../cache/cacheService.mjs";
import UserProfile from "../../database/UserProfile.mjs";
import UserInsights from "../../database/UserInsights.mjs";
import ProductInteraction from "../../database/ProductInteraction.mjs";
import RecommendationCache from "../../database/RecommendationCache.mjs";
import logger from "../../utils/logger.mjs";

const CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const getRecCacheKey = (sessionId) => `velora:reccache:${sessionId}`;

// Request Deduplication Lock Map
const activeGenerations = new Map();

/**
 * Retrieves the precomputed recommendation profile for the given sessionId from cache.
 * Returns null if not found.
 * 
 * @param {string} sessionId 
 * @returns {Promise<Object|null>}
 */
export async function getCachedRecommendations(sessionId) {
  try {
    const key = getRecCacheKey(sessionId);
    const cached = await cacheService.get(key);
    if (cached) {
      return cached;
    }

    // Fallback to MongoDB on cache miss
    const dbCached = await RecommendationCache.findOne({ sessionId }).lean().exec();
    if (dbCached && dbCached.recommendationProfile) {
      // Repopulate Cache in background
      cacheService.set(key, dbCached.recommendationProfile, CACHE_TTL_SECONDS).catch(err => {
        logger.error("Failed to repopulate Cache from MongoDB backup", { sessionId, error: err.message });
      });
      return dbCached.recommendationProfile;
    }

    return null;
  } catch (err) {
    logger.error("Failed to read recommendation cache", { sessionId, error: err.message });
    return null;
  }
}

/**
 * Precomputes and builds a recommendation profile from the current state of UserProfile,
 * UserInsights, and ProductInteractions.
 * 
 * @param {string} sessionId 
 * @returns {Promise<Object|null>}
 */
export async function generateRecommendationProfile(sessionId) {
  try {
    const [profile, insights, interactions] = await Promise.all([
      UserProfile.findOne({ sessionId }).lean().exec(),
      UserInsights.findOne({ sessionId }).lean().exec(),
      ProductInteraction.find({ sessionId }).lean().exec()
    ]);

    if (!profile && !insights && (!interactions || interactions.length === 0)) {
      return null;
    }

    // 1. Build topCategories
    const topCategoriesSet = new Set();
    if (profile?.favoriteCategories) {
      profile.favoriteCategories.forEach(c => topCategoriesSet.add(c));
    }
    if (insights?.topCategories) {
      insights.topCategories.forEach(c => topCategoriesSet.add(c));
    }
    const topCategories = Array.from(topCategoriesSet);

    // 2. Build affinityScores
    const affinityScores = {};
    if (interactions && interactions.length > 0) {
      for (const inter of interactions) {
        if (!inter.category) continue;
        const normalizedCat = inter.category.trim().toLowerCase().replace(/\s+/g, "_");
        if (!affinityScores[normalizedCat]) {
          affinityScores[normalizedCat] = { view: 0, purchase: 0 };
        }
        if (inter.action === "purchase") {
          affinityScores[normalizedCat].purchase += 1;
        } else {
          affinityScores[normalizedCat].view += 1;
        }
      }
    }
    // Merge from profile.interactionScores flat values if not already populated
    if (profile?.interactionScores) {
      for (const [cat, val] of Object.entries(profile.interactionScores)) {
        const normalizedCat = cat.trim().toLowerCase().replace(/\s+/g, "_");
        if (!affinityScores[normalizedCat]) {
          if (typeof val === 'object' && val !== null) {
            affinityScores[normalizedCat] = {
              view: val.view || 0,
              purchase: val.purchase || 0
            };
          } else if (typeof val === 'number') {
            affinityScores[normalizedCat] = {
              view: val,
              purchase: 0
            };
          }
        }
      }
    }

    // 3. Build preferredBudget
    let preferredBudget = null;
    if (profile?.averageBudget != null) {
      preferredBudget = profile.averageBudget;
    } else if (insights?.averageBudget != null) {
      preferredBudget = insights.averageBudget;
    }

    // 4. Build preferredOccasions
    const preferredOccasionsSet = new Set();
    if (profile?.favoriteOccasions) {
      profile.favoriteOccasions.forEach(o => preferredOccasionsSet.add(o));
    }
    if (insights?.topOccasion) {
      preferredOccasionsSet.add(insights.topOccasion);
    }
    const preferredOccasions = Array.from(preferredOccasionsSet).filter(Boolean);

    // 5. Build preferredRecipients
    const preferredRecipientsSet = new Set();
    if (profile?.favoriteRecipients) {
      profile.favoriteRecipients.forEach(r => preferredRecipientsSet.add(r));
    }
    if (insights?.topRecipient) {
      preferredRecipientsSet.add(insights.topRecipient);
    }
    const preferredRecipients = Array.from(preferredRecipientsSet).filter(Boolean);

    return {
      topCategories,
      affinityScores,
      preferredBudget,
      preferredOccasions,
      preferredRecipients
    };
  } catch (err) {
    logger.error("Failed to generate recommendation profile", { sessionId, error: err.message });
    return null;
  }
}

/**
 * Regenerates the recommendation profile and updates the cache with a 24-hour TTL.
 * Implement request deduplication to prevent N+1 database queries.
 * 
 * @param {string} sessionId 
 * @returns {Promise<Object|null>}
 */
export async function refreshRecommendationCache(sessionId) {
  // Check if there is already an active generation promise running for this session
  if (activeGenerations.has(sessionId)) {
    logger.info("Deduplicating recommendation cache generation request", { sessionId });
    return activeGenerations.get(sessionId);
  }

  const generationPromise = (async () => {
    try {
      const profile = await generateRecommendationProfile(sessionId);
      if (!profile) return null;

      const key = getRecCacheKey(sessionId);
      await cacheService.set(key, profile, CACHE_TTL_SECONDS);

      // Write to MongoDB for persistent backup
      const expiresAt = new Date(Date.now() + CACHE_TTL_SECONDS * 1000);
      await RecommendationCache.findOneAndUpdate(
        { sessionId },
        { recommendationProfile: profile, expiresAt, generatedAt: new Date() },
        { upsert: true, new: true }
      ).exec();

      // Structured Log for Cache Refresh
      logger.info("Recommendation cache refreshed successfully", { sessionId });

      return { recommendationProfile: profile };
    } catch (err) {
      logger.error("Failed to refresh recommendation cache", { sessionId, error: err.message });
      return null;
    }
  })();

  // Track the running promise in the lock map
  activeGenerations.set(sessionId, generationPromise);

  // Clean up lock when promise resolves/rejects
  generationPromise.finally(() => {
    activeGenerations.delete(sessionId);
  });

  return generationPromise;
}

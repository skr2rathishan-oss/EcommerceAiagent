import RecommendationCache from "../database/RecommendationCache.mjs";
import UserProfile from "../database/UserProfile.mjs";
import UserInsights from "../database/UserInsights.mjs";
import ProductInteraction from "../database/ProductInteraction.mjs";

/**
 * Retrieves the precomputed recommendation profile for the given sessionId from cache.
 * Returns null if not found or expired.
 * 
 * @param {string} sessionId 
 * @returns {Promise<Object|null>}
 */
export async function getCachedRecommendations(sessionId) {
  try {
    const cached = await RecommendationCache.findOne({ sessionId }).lean().exec();
    if (!cached) return null;
    return cached.recommendationProfile || null;
  } catch (err) {
    console.error(`[RecommendationCache] Failed to get cache for session ${sessionId}:`, err);
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
    console.error(`[RecommendationCache] Failed to generate profile for session ${sessionId}:`, err);
    return null;
  }
}

/**
 * Regenerates the recommendation profile and updates the cache with a 24-hour TTL.
 * 
 * @param {string} sessionId 
 * @returns {Promise<Object|null>}
 */
export async function refreshRecommendationCache(sessionId) {
  try {
    const profile = await generateRecommendationProfile(sessionId);
    if (!profile) return null;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const cachedDoc = await RecommendationCache.findOneAndUpdate(
      { sessionId },
      {
        $set: {
          recommendationProfile: profile,
          generatedAt: now,
          expiresAt: expiresAt
        }
      },
      { upsert: true, new: true }
    );

    // Structured Log for Cache Refresh
    console.log(JSON.stringify({
      event: "cacheRefresh",
      sessionId,
      timestamp: now.toISOString()
    }));

    return cachedDoc;
  } catch (err) {
    console.error(`[RecommendationCache] Failed to refresh cache for session ${sessionId}:`, err);
    return null;
  }
}

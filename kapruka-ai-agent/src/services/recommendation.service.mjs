import UserProfile from "../database/UserProfile.mjs";
import MemorySummary from "../database/MemorySummary.mjs";
import { getCachedRecommendations, refreshRecommendationCache } from "./recommendationCache.service.mjs";
import { explainRecommendation } from "./recommendationExplanation.service.mjs";
import logger from "../utils/logger.mjs";

/**
 * Retrieves a combined recommendation profile for the given session.
 * Includes favorite categories, interaction scores, average budget, etc.
 * Returns null if the profile cannot be built.
 */
export async function getUserRecommendationProfile(sessionId) {
  const start = Date.now();
  try {
    // 1. Try cache (Fast Path)
    const cachedProfile = await getCachedRecommendations(sessionId);
    if (cachedProfile) {
      const elapsed = Date.now() - start;
      logger.info("Recommendation cache hit", {
        event: "cacheHit",
        sessionId,
        durationMs: elapsed
      });
      // Map cached schema keys to recommendation scoring expected format
      return {
        favoriteCategories: cachedProfile.topCategories || [],
        interactionScores: cachedProfile.affinityScores || {},
        averageBudget: cachedProfile.preferredBudget,
        favoriteRecipients: cachedProfile.preferredRecipients || [],
        favoriteOccasions: cachedProfile.preferredOccasions || []
      };
    }

    // 2. Cache Miss: Log and generate profile normally (Fail Safe)
    logger.info("Recommendation cache miss", {
      event: "cacheMiss",
      sessionId
    });

    const [profile, memory] = await Promise.all([
      UserProfile.findOne({ sessionId }).lean().exec(),
      MemorySummary.findOne({ sessionId }, { currentSummary: 0 }).lean().exec()
    ]);
    if (!profile) return null;

    const normalProfile = {
      favoriteCategories: profile.favoriteCategories || [],
      interactionScores: profile.interactionScores || {},
      averageBudget: profile.averageBudget,
      favoriteRecipients: profile.favoriteRecipients || [],
      favoriteOccasions: profile.favoriteOccasions || []
    };

    // Asynchronously trigger refresh to populate cache for future requests
    refreshRecommendationCache(sessionId).catch(err => {
      logger.error(`[Background Cache Refresh Error] Failed to refresh recommendation cache for session ${sessionId}:`, err);
    });

    return normalProfile;
  } catch (err) {
    logger.error(`[Recommendation] Failed to build profile for ${sessionId}:`, err);
    return null;
  }
}

// Scoring weights (can be tweaked)
const WEIGHTS = {
  categoryAffinity: 20,
  viewScore: 10,
  purchaseScore: 20,
  budgetMatch: 15,
  occasionMatch: 10
};

/**
 * Calculates category affinity score for a product.
 */
function calculateCategoryAffinity(product, profile) {
  if (!product?.category) return 0;
  const match = profile.favoriteCategories.includes(product.category);
  return match ? WEIGHTS.categoryAffinity : 0;
}

/**
 * Calculates a numeric score for a product based on the user's profile.
 */
export function calculateRecommendationScore(product, profile) {
  let score = 0;
  // Category affinity
  score += calculateCategoryAffinity(product, profile);

  // Interaction scores
  const cat = product.category;
  if (cat && profile.interactionScores[cat]) {
    const { view = 0, purchase = 0 } = profile.interactionScores[cat];
    if (view) score += WEIGHTS.viewScore * Math.log1p(view);
    if (purchase) score += WEIGHTS.purchaseScore * Math.log1p(purchase);
  }

  // Budget match
  if (profile.averageBudget != null && product.price != null) {
    if (product.price <= profile.averageBudget) {
      score += WEIGHTS.budgetMatch;
    }
  }

  // Occasion match (if product has an occasion field)
  if (product.occasion && profile.favoriteOccasions.includes(product.occasion)) {
    score += WEIGHTS.occasionMatch;
  }

  return score;
}

/**
 * Ranks an array of product objects for the given session.
 * Falls back to the original order if profile generation fails.
 */
export async function rankProducts(products, sessionId) {
  const profile = await getUserRecommendationProfile(sessionId);
  if (!profile) {
    logger.warn(`[Recommendation] No profile for session ${sessionId}, returning unranked results.`);
    return products;
  }
  const scored = products.map(p => ({ ...p, _score: calculateRecommendationScore(p, profile) }));
  scored.sort((a, b) => b._score - a._score);
  
  const ranked = scored.map(({ _score, ...rest }) => rest);

  // Attach explanation reasons to each product asynchronously (Fail Safe)
  const explainedProducts = await Promise.all(ranked.map(async (product) => {
    try {
      const explanation = await explainRecommendation(product, sessionId);
      return { ...product, explanation };
    } catch (err) {
      logger.error(`[Recommendation Integration Error] Failed to generate reasons for product ${product.id || product.name}:`, err);
      return product;
    }
  }));

  return explainedProducts;
}

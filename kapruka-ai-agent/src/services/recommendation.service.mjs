import UserProfile from "../database/UserProfile.mjs";
import MemorySummary from "../database/MemorySummary.mjs";

/**
 * Retrieves a combined recommendation profile for the given session.
 * Includes favorite categories, interaction scores, average budget, etc.
 * Returns null if the profile cannot be built.
 */
export async function getUserRecommendationProfile(sessionId) {
  try {
    const [profile, memory] = await Promise.all([
      UserProfile.findOne({ sessionId }).lean().exec(),
      MemorySummary.findOne({ sessionId }, { currentSummary: 0 }).lean().exec()
    ]);
    if (!profile) return null;
    return {
      favoriteCategories: profile.favoriteCategories || [],
      interactionScores: profile.interactionScores || {},
      averageBudget: profile.averageBudget,
      favoriteRecipients: profile.favoriteRecipients || [],
      favoriteOccasions: profile.favoriteOccasions || []
    };
  } catch (err) {
    console.error(`[Recommendation] Failed to build profile for ${sessionId}:`, err);
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
    console.warn(`[Recommendation] No profile for session ${sessionId}, returning unranked results.`);
    return products;
  }
  const scored = products.map(p => ({ ...p, _score: calculateRecommendationScore(p, profile) }));
  scored.sort((a, b) => b._score - a._score);
  // Remove temporary score field before returning
  return scored.map(({ _score, ...rest }) => rest);
}

import { getCachedRecommendations, generateRecommendationProfile } from "../commerce/recommendationCache.service.mjs";
import logger from "../../utils/logger.mjs";

/**
 * Generates explanation reasons (up to 3) for a given product and user profile.
 * 
 * @param {Object} product 
 * @param {Object} profile 
 * @returns {string[]}
 */
export function generateRecommendationReasons(product, profile) {
  const reasons = [];
  if (!product || !profile) return reasons;

  const rawCat = product.category || "";
  const cat = rawCat.trim().toLowerCase().replace(/\s+/g, "_");

  // 1. Gifting occasion preference
  if (product.occasion && profile.preferredOccasions && profile.preferredOccasions.includes(product.occasion)) {
    reasons.push(`Fits ${product.occasion.toLowerCase()} gifting preferences`);
  }

  // 2. Gifting recipient preference
  if (product.recipient && profile.preferredRecipients && profile.preferredRecipients.includes(product.recipient)) {
    reasons.push(`Matches gifting preferences for ${product.recipient.toLowerCase()}`);
  }

  // 3. Affinity purchase/view counts
  if (cat && profile.affinityScores && profile.affinityScores[cat]) {
    const scores = profile.affinityScores[cat];
    const categoryLabel = product.category ? product.category.toLowerCase() : "this category";
    if (scores.purchase > 0) {
      reasons.push(`Frequently purchased ${categoryLabel}`);
    } else if (scores.view > 0) {
      reasons.push(`Frequently viewed ${categoryLabel}`);
    }
  }

  // 4. Matches typical budget range
  if (profile.preferredBudget != null && product.price != null) {
    if (product.price <= profile.preferredBudget) {
      reasons.push("Matches your typical budget range");
    }
  }

  // 5. Strong category affinity
  if (product.category && profile.topCategories && profile.topCategories.includes(product.category)) {
    reasons.push("Strong category affinity detected");
  }

  return reasons.slice(0, 3); // Maximum of 3 reasons per product
}

/**
 * Formulates explanations for a product recommendation.
 * Returns empty array on failure or if no reasons found.
 * 
 * @param {Object} product 
 * @param {string} sessionId 
 * @returns {Promise<string[]>}
 */
export async function explainRecommendation(product, sessionId) {
  try {
    // 1. Fetch cached recommendation profile
    let profile = await getCachedRecommendations(sessionId);
    
    // 2. Fail Safe Fallback: if cache missing, generate on the fly
    if (!profile) {
      profile = await generateRecommendationProfile(sessionId);
    }
    
    if (!profile) return [];

    const reasons = generateRecommendationReasons(product, profile);

    // 3. Structured Log (Do not log user content / profile data)
    logger.info("Recommendation explanation generated", {
      sessionId
    });

    return reasons;
  } catch (err) {
    logger.error(`[RecommendationExplanation] Failed to explain recommendation for session ${sessionId}:`, err);
    return [];
  }
}

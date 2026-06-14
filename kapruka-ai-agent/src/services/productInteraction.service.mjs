import ProductInteraction from "../database/ProductInteraction.mjs";
import UserProfile from "../database/UserProfile.mjs";
import { generateUserInsights } from "./insights.service.mjs";
import { refreshRecommendationCache } from "./recommendationCache.service.mjs";

/**
 * Maps actions to their respective weight scores.
 * @param {string} action 
 * @returns {number}
 */
function getActionScore(action) {
  const scores = {
    view: 1,
    details: 3,
    add_to_cart: 5,
    purchase: 10
  };
  return scores[action] || 0;
}

/**
 * Normalizes category names to standard lowercase keys.
 * @param {string} category 
 * @returns {string}
 */
function normalizeCategory(category) {
  if (!category) return "general";
  return category.trim().toLowerCase().replace(/\s+/g, "_");
}

/**
 * Saves a product interaction to the database and kicks off profile updates asynchronously.
 * @param {string} sessionId 
 * @param {string} productId 
 * @param {string} productName 
 * @param {string} category 
 * @param {string} action 
 */
export async function trackInteraction(sessionId, productId, productName, category, action) {
  // Lightweight Logging: sessionId, action, productId.
  console.log(`[Interaction Track] sessionId: ${sessionId} | action: ${action} | productId: ${productId}`);

  try {
    const interaction = new ProductInteraction({
      sessionId,
      productId,
      productName,
      category: category || "General",
      action,
      timestamp: new Date()
    });
    await interaction.save();

    // Phase 5: Trigger insights generation on purchase events (background, non-blocking)
    if (action === "purchase") {
      generateUserInsights(sessionId).catch(err => {
        console.error(`[Background Insights Error] Insights generation on purchase failed for session ${sessionId}:`, err);
      });
      refreshRecommendationCache(sessionId).catch(err => {
        console.error(`[Background Cache Refresh Error] Failed to refresh recommendation cache on purchase for session ${sessionId}:`, err);
      });
    }

    // Trigger score updates in user profile asynchronously
    if (category) {
      updateInteractionScores(sessionId, category, action).catch(err => {
        console.error(`[Background Profile Update Error] Failed to update scores for session ${sessionId}:`, err);
      });
    }
  } catch (error) {
    // Fail Safe Behavior: Log error, continue normal flow.
    console.error(`[Interaction Tracking Error] Failed to save interaction for session ${sessionId}:`, error);
  }
}

/**
 * Updates the user's category interaction scores incrementally.
 * @param {string} sessionId 
 * @param {string} category 
 * @param {string} action 
 */
export async function updateInteractionScores(sessionId, category, action) {
  if (!category) return;
  const scoreChange = getActionScore(action);
  if (scoreChange === 0) return;

  const normalizedCategory = normalizeCategory(category);

  try {
    await UserProfile.findOneAndUpdate(
      { sessionId },
      { $inc: { [`interactionScores.${normalizedCategory}`]: scoreChange } },
      { upsert: true, new: true }
    );

    // Trigger cache refresh on significant interaction score changes (scoreChange >= 3)
    if (scoreChange >= 3) {
      refreshRecommendationCache(sessionId).catch(err => {
        console.error(`[Background Cache Refresh Error] Failed to refresh recommendation cache on significant score change for session ${sessionId}:`, err);
      });
    }
  } catch (error) {
    console.error(`[Interaction Score Update Error] Failed to update score for session ${sessionId}:`, error);
  }
}

/**
 * Retrieves all stored interactions for a user.
 * @param {string} sessionId 
 * @returns {Promise<Array>}
 */
export async function getUserInteractions(sessionId) {
  try {
    return await ProductInteraction.find({ sessionId }).sort({ timestamp: -1 }).lean().exec();
  } catch (error) {
    console.error(`[Interaction Service Error] Failed to get interactions for session ${sessionId}:`, error);
    return [];
  }
}

/**
 * Retrieves category score mappings from the user profile.
 * @param {string} sessionId 
 * @returns {Promise<Object>}
 */
export async function getCategoryScores(sessionId) {
  try {
    const profile = await UserProfile.findOne({ sessionId }).lean().exec();
    return profile?.interactionScores || {};
  } catch (error) {
    console.error(`[Interaction Service Error] Failed to get category scores for session ${sessionId}:`, error);
    return {};
  }
}

/**
 * Behavior Analytics Helper: Returns user's top categories sorted by score descending.
 * @param {string} sessionId 
 * @returns {Promise<Array>}
 */
export async function getTopCategories(sessionId) {
  try {
    const profile = await UserProfile.findOne({ sessionId }).lean().exec();
    if (!profile || !profile.interactionScores) return [];

    return Object.entries(profile.interactionScores)
      .map(([category, score]) => ({ category, score }))
      .sort((a, b) => b.score - a.score);
  } catch (error) {
    console.error(`[Analytics Error] Failed to get top categories for session ${sessionId}:`, error);
    return [];
  }
}

/**
 * Behavior Analytics Helper: Returns user's most viewed products sorted by count descending.
 * @param {string} sessionId 
 * @returns {Promise<Array>}
 */
export async function getMostViewedProducts(sessionId) {
  try {
    return await ProductInteraction.aggregate([
      { $match: { sessionId, action: "view" } },
      { $group: { 
          _id: "$productId", 
          productName: { $first: "$productName" }, 
          count: { $sum: 1 } 
        } 
      },
      { $sort: { count: -1 } }
    ]).exec();
  } catch (error) {
    console.error(`[Analytics Error] Failed to get most viewed products for session ${sessionId}:`, error);
    return [];
  }
}

/**
 * Behavior Analytics Helper: Returns user's most purchased products sorted by count descending.
 * @param {string} sessionId 
 * @returns {Promise<Array>}
 */
export async function getMostPurchasedProducts(sessionId) {
  try {
    return await ProductInteraction.aggregate([
      { $match: { sessionId, action: "purchase" } },
      { $group: { 
          _id: "$productId", 
          productName: { $first: "$productName" }, 
          count: { $sum: 1 } 
        } 
      },
      { $sort: { count: -1 } }
    ]).exec();
  } catch (error) {
    console.error(`[Analytics Error] Failed to get most purchased products for session ${sessionId}:`, error);
    return [];
  }
}

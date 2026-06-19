// src/memory/memoryStore.mjs
// MongoDB-backed session memory with smart field merging

import UserProfile from "../database/UserProfile.mjs";
import MemorySummary from "../database/MemorySummary.mjs";
import logger from "../utils/logger.mjs";

function mergeArrays(existing = [], incoming = []) {
  const set = new Set([...existing, ...incoming].map(s => String(s).trim()).filter(Boolean));
  return Array.from(set);
}

function mergeBudget(existing, incoming) {
  if (incoming === null || incoming === undefined) return existing;
  if (existing === null || existing === undefined) return incoming;
  // Keep the most recently stated budget (incoming wins)
  return incoming;
}

/**
 * Merge extracted memory entities into the user's MongoDB profile.
 * @param {string} sessionId
 * @param {Object} extracted - From memoryExtractor
 */
export async function mergeToProfile(sessionId, extracted) {
  if (!extracted) return;

  try {
    const update = {};

    if (extracted.recipients?.length)
      update["$addToSet"] = { ...(update["$addToSet"] || {}), favoriteRecipients: { $each: extracted.recipients } };

    if (extracted.occasions?.length)
      update["$addToSet"] = { ...(update["$addToSet"] || {}), favoriteOccasions: { $each: extracted.occasions } };

    if (extracted.categories?.length)
      update["$addToSet"] = { ...(update["$addToSet"] || {}), favoriteCategories: { $each: extracted.categories } };

    if (extracted.budget !== null && extracted.budget !== undefined)
      update["$set"] = { ...(update["$set"] || {}), averageBudget: extracted.budget };

    if (Object.keys(update).length === 0) return;

    await UserProfile.findOneAndUpdate(
      { sessionId },
      update,
      { new: true, upsert: true }
    );
  } catch (err) {
    logger.error(`[MemoryStore] mergeToProfile failed for session ${sessionId}: ${err.message}`);
  }
}

/**
 * Get the full user profile from MongoDB.
 * @param {string} sessionId
 * @returns {Promise<Object|null>}
 */
export async function getProfile(sessionId) {
  try {
    return await UserProfile.findOne({ sessionId }).lean();
  } catch (err) {
    logger.error(`[MemoryStore] getProfile failed: ${err.message}`);
    return null;
  }
}

/**
 * Get the current memory summary for context injection.
 * @param {string} sessionId
 * @returns {Promise<string>}
 */
export async function getMemorySummaryText(sessionId) {
  try {
    const doc = await MemorySummary.findOne({ sessionId }, { currentSummary: 1 }).lean();
    return doc?.currentSummary || "";
  } catch (err) {
    return "";
  }
}

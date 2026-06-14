import MemorySummary from "../database/MemorySummary.mjs";
import UserProfile from "../database/UserProfile.mjs";
import { getConversation } from "./conversation.service.mjs";
import { generateSummaryWithNemotron } from "./llm.service.mjs";

/**
 * Retrieves the memory summary for a sessionId.
 * @param {string} sessionId
 * @returns {Promise<Object|null>}
 */
export async function getMemorySummary(sessionId) {
  try {
    return await MemorySummary.findOne({ sessionId });
  } catch (error) {
    console.error(`[Memory Service Error] Failed to get memory summary for session ${sessionId}:`, error);
    return null;
  }
}

/**
 * Updates memory summary for a sessionId and performs a rolling 3-version rotation.
 * @param {string} sessionId
 * @param {string} summary - The new summary string.
 * @returns {Promise<Object|null>}
 */
export async function updateMemorySummary(sessionId, summary) {
  try {
    let doc = await MemorySummary.findOne({ sessionId });
    if (!doc) {
      doc = new MemorySummary({
        sessionId,
        currentSummary: summary,
        previousSummary: "",
        olderSummary: "",
        version: 1
      });
    } else {
      doc.olderSummary = doc.previousSummary || "";
      doc.previousSummary = doc.currentSummary || "";
      doc.currentSummary = summary;
      doc.version += 1;
    }
    return await doc.save();
  } catch (error) {
    console.error(`[Memory Service Error] Failed to update memory summary for session ${sessionId}:`, error);
    return null;
  }
}

/**
 * Retrieves the user profile for a sessionId.
 * @param {string} sessionId
 * @returns {Promise<Object|null>}
 */
export async function getUserProfile(sessionId) {
  try {
    return await UserProfile.findOne({ sessionId });
  } catch (error) {
    console.error(`[Memory Service Error] Failed to get user profile for session ${sessionId}:`, error);
    return null;
  }
}

/**
 * Updates (merges/sets) the user profile for a sessionId.
 * @param {string} sessionId
 * @param {Object} profile - Profile fields to set.
 * @returns {Promise<Object|null>}
 */
export async function updateUserProfile(sessionId, profile) {
  try {
    const updated = await UserProfile.findOneAndUpdate(
      { sessionId },
      { $set: profile },
      { new: true, upsert: true }
    );
    return updated;
  } catch (error) {
    console.error(`[Memory Service Error] Failed to update user profile for session ${sessionId}:`, error);
    return null;
  }
}

/**
 * Helper to parse a JSON string from LLM response (robust parsing).
 */
function extractJson(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (err) {
        console.error("Failed to parse matched JSON substring:", err);
      }
    }
    throw e;
  }
}

/**
 * Merges two arrays, deduplicating items.
 */
function mergeArrays(existing = [], incoming = []) {
  const set = new Set([...existing, ...incoming].map(s => s.trim()).filter(Boolean));
  return Array.from(set);
}

/**
 * Merges running budget averages.
 */
function mergeBudget(existingBudget, incomingBudget) {
  if (incomingBudget === null || incomingBudget === undefined) return existingBudget;
  if (existingBudget === null || existingBudget === undefined) return incomingBudget;
  return Math.round((existingBudget + incomingBudget) / 2);
}

/**
 * Runs the summarization task in the background.
 * Logs structured progress.
 */
async function runBackgroundSummarization(sessionId, messageCount, summaryDoc) {
  const startTime = new Date().toISOString();
  console.log(JSON.stringify({
    sessionId,
    messageCount,
    summarizationStarted: startTime
  }));

  try {
    // 1. Fetch conversation messages
    const convo = await getConversation(sessionId);
    if (!convo || !convo.messages || convo.messages.length === 0) {
      console.warn(`[Memory Summarizer] No messages found to summarize for session ${sessionId}`);
      return;
    }

    // 2. Call Nemotron for insights
    const rawContent = await generateSummaryWithNemotron(convo.messages);
    const insights = extractJson(rawContent);

    const newSummary = insights.summary || "";
    const favoriteCategories = Array.isArray(insights.favoriteCategories) ? insights.favoriteCategories : [];
    const favoriteRecipients = Array.isArray(insights.favoriteRecipients) ? insights.favoriteRecipients : [];
    const favoriteOccasions = Array.isArray(insights.favoriteOccasions) ? insights.favoriteOccasions : [];
    const deliveryCities = Array.isArray(insights.deliveryCities) ? insights.deliveryCities : [];
    const averageBudget = typeof insights.averageBudget === "number" ? insights.averageBudget : null;

    // 3. Update MemorySummary and rotate
    let newVersion = 1;
    if (!summaryDoc) {
      summaryDoc = new MemorySummary({
        sessionId,
        currentSummary: newSummary,
        previousSummary: "",
        olderSummary: "",
        version: 1,
        lastSummarizedMessageCount: messageCount
      });
    } else {
      summaryDoc.olderSummary = summaryDoc.previousSummary || "";
      summaryDoc.previousSummary = summaryDoc.currentSummary || "";
      summaryDoc.currentSummary = newSummary;
      summaryDoc.version += 1;
      summaryDoc.lastSummarizedMessageCount = messageCount;
      newVersion = summaryDoc.version;
    }
    await summaryDoc.save();

    // 4. Update UserProfile
    let profileDoc = await UserProfile.findOne({ sessionId });
    if (!profileDoc) {
      profileDoc = new UserProfile({
        sessionId,
        favoriteCategories,
        favoriteRecipients,
        favoriteOccasions,
        deliveryCities,
        averageBudget,
        interactionScores: {}
      });
    } else {
      profileDoc.favoriteCategories = mergeArrays(profileDoc.favoriteCategories, favoriteCategories);
      profileDoc.favoriteRecipients = mergeArrays(profileDoc.favoriteRecipients, favoriteRecipients);
      profileDoc.favoriteOccasions = mergeArrays(profileDoc.favoriteOccasions, favoriteOccasions);
      profileDoc.deliveryCities = mergeArrays(profileDoc.deliveryCities, deliveryCities);
      profileDoc.averageBudget = mergeBudget(profileDoc.averageBudget, averageBudget);
    }
    await profileDoc.save();

    const completionTime = new Date().toISOString();
    console.log(JSON.stringify({
      sessionId,
      messageCount,
      summarizationCompleted: completionTime,
      summaryVersion: newVersion
    }));
  } catch (err) {
    console.error(`[Background Summarizer Error] Processing failed for session ${sessionId}:`, err);
  }
}

/**
 * Non-blocking trigger called by the controller flow.
 * Checks if thresholds have been crossed and spawns background worker.
 *
 * @param {string} sessionId
 * @param {number} messageCount
 */
export async function checkAndTriggerSummarization(sessionId, messageCount) {
  try {
    let summaryDoc = await MemorySummary.findOne({ sessionId });
    const lastSummarizedMessageCount = summaryDoc ? summaryDoc.lastSummarizedMessageCount : 0;

    // Trigger condition: messageCount >= 50 AND we have crossed a multiple of 50 since the last summarization
    const currentWindow = Math.floor(messageCount / 50);
    const lastWindow = Math.floor(lastSummarizedMessageCount / 50);

    if (messageCount >= 50 && currentWindow > lastWindow) {
      // Trigger background processing asynchronously without awaiting it
      runBackgroundSummarization(sessionId, messageCount, summaryDoc).catch(err => {
        console.error(`[Background Summarizer Error] Execution failed for session ${sessionId}:`, err);
      });
    }
  } catch (error) {
    console.error(`[Memory Service Error] Failed during check for session ${sessionId}:`, error);
  }
}

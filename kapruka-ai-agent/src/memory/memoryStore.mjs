// src/memory/memoryStore.mjs
// MongoDB-backed session memory with smart field merging

import UserProfile from "../database/UserProfile.mjs";
import MemorySummary from "../database/MemorySummary.mjs";
import DeliverySession from "../database/DeliverySession.mjs";
import ConversationState from "../database/ConversationState.mjs";
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

/**
 * Get or create a DeliverySession.
 * @param {string} sessionId 
 */
export async function getDeliverySession(sessionId) {
  try {
    let session = await DeliverySession.findOne({ sessionId }).lean();
    if (!session) {
      session = await DeliverySession.create({ sessionId });
    }
    return session;
  } catch (err) {
    logger.error(`[MemoryStore] getDeliverySession failed: ${err.message}`);
    return null;
  }
}

/**
 * Update DeliverySession with optimistic concurrency control via session_version.
 * @param {string} sessionId 
 * @param {Object} updates 
 * @param {number} currentVersion 
 */
function flattenObject(ob, prefix = '', result = null) {
  result = result || {};
  for (const i in ob) {
    if (ob.hasOwnProperty(i)) {
      if ((typeof ob[i]) === 'object' && ob[i] !== null && !Array.isArray(ob[i]) && !(ob[i] instanceof Date)) {
        flattenObject(ob[i], prefix + i + '.', result);
      } else {
        result[prefix + i] = ob[i];
      }
    }
  }
  return result;
}

export async function updateDeliverySession(sessionId, updates, currentVersion) {
  try {
    // Priority 3: Use flattenObject to perform deep-merging via MongoDB dot notation.
    const flatUpdates = flattenObject(updates);
    const updatePayload = {
      $set: flatUpdates,
      $inc: { session_version: 1 }
    };
    
    // Only update if the version matches
    const updated = await DeliverySession.findOneAndUpdate(
      { sessionId, session_version: currentVersion },
      updatePayload,
      { new: true }
    );
    
    if (!updated) {
      logger.warn(`[MemoryStore] updateDeliverySession failed for ${sessionId} due to version mismatch or not found. Provided version: ${currentVersion}`);
      return null; // Indicates concurrency conflict
    }

    // Auto-propagate state to ConversationState
    if (updates.state) {
      const stageMap = {
        WAITING_FOR_ADDRESS:              "delivery_address",
        WAITING_FOR_ADDRESS_CONFIRMATION: "delivery_address",
        WAITING_FOR_DATE:                 "delivery_date",
        WAITING_FOR_CONTACT_NAME:         "contact_information",
        WAITING_FOR_CONTACT_PHONE:        "contact_information",
        WAITING_FOR_CONFIRMATION:         "order_summary",
        WAITING_FOR_RECOVERY_CHOICE:      "interrupted",
        WAITING_FOR_CANCEL_CHOICE:        "interrupted",
        CREATING_ORDER:                   "payment",
        PAYMENT_PENDING:                  "payment",
        COMPLETED:                        "completed",
        CANCELLED:                        "cancelled"
      };
      const step = stageMap[updates.state] || "delivery_address";
      const flowStatus = (updates.state === "COMPLETED") ? "completed"
                       : (updates.state === "CANCELLED") ? "cancelled"
                       : "active";

      await ConversationState.findOneAndUpdate(
        { sessionId },
        {
          $set: {
            activeFlow: {
              type: "delivery",
              status: flowStatus,
              currentStep: step
            },
            active_delivery_session: (flowStatus === "active") ? sessionId : null,
            currentWorkflow: (flowStatus === "active") ? "delivery" : "idle",
            "workflowContext.currentWorkflow": (flowStatus === "active") ? "delivery" : "idle",
            "workflowContext.waitingForPhoneNumber": updates.state === "WAITING_FOR_CONTACT_PHONE",
            "workflowContext.awaitingConfirmation": ["WAITING_FOR_CONFIRMATION", "WAITING_FOR_FINAL_ORDER_CONFIRMATION"].includes(updates.state),
            "workflowContext.waitingForDelivery": ["WAITING_FOR_ADDRESS", "WAITING_FOR_ADDRESS_CONFIRMATION", "WAITING_FOR_DATE", "WAITING_FOR_CONTACT_NAME", "WAITING_FOR_CONTACT_PHONE"].includes(updates.state),
            "workflowContext.waitingForPayment": updates.state === "PAYMENT_PENDING"
          }
        },
        { upsert: true }
      );
    }
    
    return updated;
  } catch (err) {
    logger.error(`[MemoryStore] updateDeliverySession failed: ${err.message}`);
    return null;
  }
}

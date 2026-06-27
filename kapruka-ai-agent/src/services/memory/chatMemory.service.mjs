import { cacheService } from "../../cache/cacheService.mjs";
import Conversation from "../../database/Conversation.mjs";
import { memoryManager } from "../memory/memoryManager.service.mjs";
import { clearConversationMessages } from "./conversation.service.mjs";
import logger from "../../utils/logger.mjs";

const CACHE_TTL = 24 * 60 * 60; // 24 hours in seconds
const MAX_HISTORY = 20;

const getCacheKey = (sessionId) => `velora:sessions:${sessionId}`;

/**
 * Retrieves the full conversation history for a session.
 * Rebuilds cache from MongoDB if cache is missing.
 *
 * @param {string} sessionId
 * @param {Date|string} lastResetAt
 * @returns {Promise<Array<{role: string, content: string, timestamp: Date}>>}
 */
export const getConversation = async (sessionId, lastResetAt = null) => {
  const key = getCacheKey(sessionId);
  
  try {
    // 1. Try cache load
    let messages = await cacheService.get(key);
    if (!messages) {
      // 2. Cache miss: load from MongoDB
      logger.info("Chat memory cache miss, loading from MongoDB", { sessionId });
      const doc = await Conversation.findOne({ sessionId }).lean().exec();
      
      if (doc && doc.messages) {
        // Rebuild structure
        messages = doc.messages.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp
        }));
        
        // Save back to cache
        await cacheService.set(key, messages, CACHE_TTL);
      } else {
        messages = [];
      }
    }

    if (lastResetAt) {
      const resetTime = new Date(lastResetAt).getTime();
      return messages.filter(m => !m.timestamp || new Date(m.timestamp).getTime() > resetTime);
    }

    return messages;
  } catch (error) {
    logger.error("Failed to load conversation memory", { sessionId, error: error.message });
    return [];
  }
};

/**
 * Appends a single message to the session's conversation history.
 *
 * @param {string} sessionId
 * @param {"user" | "assistant"} role
 * @param {string} content
 */
export const addMessage = async (sessionId, role, content) => {
  const key = getCacheKey(sessionId);
  try {
    const history = await getConversation(sessionId);
    history.push({ role, content, timestamp: new Date() });
    
    const limitedHistory = memoryManager.enforceHistoryLimit(history);
    
    await cacheService.set(key, limitedHistory, CACHE_TTL);
  } catch (error) {
    logger.error("Failed to append message to cache", { sessionId, error: error.message });
  }
};

/**
 * Clears the conversation history for a session from cache.
 *
 * @param {string} sessionId
 */
export const clearConversation = async (sessionId) => {
  const key = getCacheKey(sessionId);
  try {
    await cacheService.del(key);
  } catch (error) {
    logger.error("Failed to clear session cache", { sessionId, error: error.message });
  }
};

/**
 * Returns only the most recent MAX_HISTORY messages for a session.
 * Use this when building the messages array sent to the LLM.
 *
 * @param {string} sessionId
 * @param {Date|string} lastResetAt
 * @returns {Promise<Array<{role: string, content: string}>>}
 */
export const getRecentHistory = async (sessionId, lastResetAt = null) => {
  const history = await getConversation(sessionId, lastResetAt);
  return history.slice(-MAX_HISTORY);
};

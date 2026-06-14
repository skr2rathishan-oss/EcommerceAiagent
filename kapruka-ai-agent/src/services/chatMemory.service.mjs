import { redisService } from "./redis.service.mjs";
import Conversation from "../database/Conversation.mjs";
import { memoryManager } from "./memoryManager.service.mjs";
import logger from "../utils/logger.mjs";

const CACHE_TTL = 24 * 60 * 60; // 24 hours in seconds
const MAX_HISTORY = 20;

const getCacheKey = (sessionId) => `velora:sessions:${sessionId}`;

/**
 * Retrieves the full conversation history for a session.
 * Rebuilds cache from MongoDB if cache is missing.
 *
 * @param {string} sessionId
 * @returns {Promise<Array<{role: string, content: string}>>}
 */
export const getConversation = async (sessionId) => {
  const key = getCacheKey(sessionId);
  
  try {
    // 1. Try cache load
    const cached = await redisService.get(key);
    if (cached) {
      return cached;
    }

    // 2. Cache miss: load from MongoDB
    logger.info("Chat memory cache miss, loading from MongoDB", { sessionId });
    const doc = await Conversation.findOne({ sessionId }).lean().exec();
    
    if (doc && doc.messages) {
      // Rebuild structure
      const messages = doc.messages.map(m => ({
        role: m.role,
        content: m.content
      }));
      
      // Save back to cache
      await redisService.set(key, messages, CACHE_TTL);
      return messages;
    }

    // No existing conversation
    return [];
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
    history.push({ role, content });
    
    const limitedHistory = memoryManager.enforceHistoryLimit(history);
    
    await redisService.set(key, limitedHistory, CACHE_TTL);
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
    await redisService.del(key);
  } catch (error) {
    logger.error("Failed to clear session cache", { sessionId, error: error.message });
  }
};

/**
 * Returns only the most recent MAX_HISTORY messages for a session.
 * Use this when building the messages array sent to the LLM.
 *
 * @param {string} sessionId
 * @returns {Promise<Array<{role: string, content: string}>>}
 */
export const getRecentHistory = async (sessionId) => {
  const history = await getConversation(sessionId);
  return history.slice(-MAX_HISTORY);
};

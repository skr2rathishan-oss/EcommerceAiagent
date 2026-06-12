/**
 * chatMemory.service.mjs
 *
 * In-memory conversation history store.
 * Stores messages per sessionId as an array of OpenAI-format objects:
 *   [{ role: "user" | "assistant", content: "..." }, ...]
 *
 * No persistence — history resets on server restart.
 */

/** @type {Map<string, Array<{role: string, content: string}>>} */
const conversations = new Map();

/** Maximum number of messages sent to the LLM per turn */
const MAX_HISTORY = 20;

/**
 * Returns the full conversation history for a session.
 * Creates an empty history if none exists yet.
 * @param {string} sessionId
 * @returns {Array<{role: string, content: string}>}
 */
export const getConversation = (sessionId) => {
  if (!conversations.has(sessionId)) {
    conversations.set(sessionId, []);
  }
  return conversations.get(sessionId);
};

/**
 * Appends a single message to the session's conversation history.
 * @param {string} sessionId
 * @param {"user" | "assistant"} role
 * @param {string} content
 */
export const addMessage = (sessionId, role, content) => {
  const history = getConversation(sessionId);
  history.push({ role, content });
};

/**
 * Clears the conversation history for a session.
 * @param {string} sessionId
 */
export const clearConversation = (sessionId) => {
  conversations.delete(sessionId);
};

/**
 * Returns only the most recent MAX_HISTORY messages for a session.
 * Use this when building the messages array sent to the LLM.
 * @param {string} sessionId
 * @returns {Array<{role: string, content: string}>}
 */
export const getRecentHistory = (sessionId) => {
  const history = getConversation(sessionId);
  return history.slice(-MAX_HISTORY);
};

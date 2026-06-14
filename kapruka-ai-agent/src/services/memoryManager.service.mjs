import logger from "../utils/logger.mjs";

const MAX_CONVERSATION_HISTORY = 40; // Max messages per session in memory

export const memoryManager = {
  /**
   * Enforces limits on conversation history size to prevent memory bloat and context token overflow.
   *
   * @param {Array} messages - Message array
   * @returns {Array} Trimmed message array
   */
  enforceHistoryLimit: (messages) => {
    if (!Array.isArray(messages)) return [];
    if (messages.length <= MAX_CONVERSATION_HISTORY) {
      return messages;
    }
    logger.info("Enforcing history limit on conversation", {
      originalLength: messages.length,
      maxLength: MAX_CONVERSATION_HISTORY
    });
    // Keep the first system/context prompt if applicable, or just keep the last N messages
    return messages.slice(-MAX_CONVERSATION_HISTORY);
  }
};

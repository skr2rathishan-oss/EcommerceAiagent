import Conversation from "../../database/Conversation.mjs";

/**
 * Saves a message to the conversation history in MongoDB.
 * Uses upsert behavior to create a new conversation if it does not exist,
 * or appends the message to the existing one.
 *
 * If MongoDB fails, it logs the error and returns null without throwing.
 *
 * @param {string} sessionId
 * @param {"user" | "assistant" | "system"} role
 * @param {string} content
 * @returns {Promise<Object|null>} The updated or created Conversation document, or null if error.
 */
export async function saveMessage(sessionId, role, content) {
  try {
    const newMessage = {
      role,
      content,
      timestamp: new Date()
    };

    const updatedConversation = await Conversation.findOneAndUpdate(
      { sessionId },
      { $push: { messages: newMessage } },
      { new: true, upsert: true }
    );

    return updatedConversation;
  } catch (error) {
    console.error(`[Conversation Service Error] Failed to save message for session "${sessionId}":`, error);
    return null;
  }
}

/**
 * Retrieves the most recent `limit` messages for a session.
 *
 * If MongoDB fails, it logs the error and returns an empty array.
 *
 * @param {string} sessionId
 * @param {number} limit
 * @returns {Promise<Array<Object>>} Array of recent message objects.
 */
export async function getRecentMessages(sessionId, limit = 20) {
  try {
    const conversation = await Conversation.findOne({ sessionId });
    if (!conversation || !conversation.messages) {
      return [];
    }
    return conversation.messages.slice(-limit);
  } catch (error) {
    console.error(`[Conversation Service Error] Failed to retrieve recent messages for session "${sessionId}":`, error);
    return [];
  }
}

/**
 * Retrieves the full conversation document for a session.
 *
 * If MongoDB fails, it logs the error and returns null.
 *
 * @param {string} sessionId
 * @returns {Promise<Object|null>} The Conversation document, or null if not found/error.
 */
export async function getConversation(sessionId) {
  try {
    return await Conversation.findOne({ sessionId });
  } catch (error) {
    console.error(`[Conversation Service Error] Failed to get conversation for session "${sessionId}":`, error);
    return null;
  }
}

/**
 * Clears the conversation history for a session from MongoDB.
 *
 * @param {string} sessionId
 * @returns {Promise<boolean>}
 */
export async function clearConversationMessages(sessionId) {
  try {
    await Conversation.deleteOne({ sessionId });
    return true;
  } catch (error) {
    console.error(`[Conversation Service Error] Failed to clear conversation messages for session "${sessionId}":`, error);
    return false;
  }
}

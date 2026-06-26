import ConversationState from "../../database/ConversationState.mjs";
import ShoppingContext from "../../database/ShoppingContext.mjs";
import DeliverySession from "../../database/DeliverySession.mjs";
import logger from "../../utils/logger.mjs";

export async function loadConversationState(sessionId) {
  try {
    let state = await ConversationState.findOne({ sessionId }).lean();
    if (!state) {
      state = await ConversationState.create({ sessionId });
      state = state.toObject();
    }
    return state;
  } catch (err) {
    logger.error(`[ConversationState] loadConversationState failed: ${err.message}`);
    return null;
  }
}

export async function saveConversationState(sessionId, updates) {
  try {
    const updated = await ConversationState.findOneAndUpdate(
      { sessionId },
      { $set: updates },
      { new: true, upsert: true }
    );
    return updated?.toObject() || null;
  } catch (err) {
    logger.error(`[ConversationState] saveConversationState failed: ${err.message}`);
    return null;
  }
}

export async function getActiveDelivery(sessionId) {
  try {
    const state = await loadConversationState(sessionId);
    if (!state || !state.active_delivery_session) return null;
    return await DeliverySession.findOne({ sessionId: state.active_delivery_session }).lean();
  } catch (err) {
    logger.error(`[ConversationState] getActiveDelivery failed: ${err.message}`);
    return null;
  }
}

export async function getPendingOrder(sessionId) {
  try {
    const state = await loadConversationState(sessionId);
    if (!state) return null;
    return state.pending_order;
  } catch (err) {
    logger.error(`[ConversationState] getPendingOrder failed: ${err.message}`);
    return null;
  }
}

export async function getShoppingContexts(sessionId) {
  try {
    return await ShoppingContext.find({ sessionId }).lean();
  } catch (err) {
    logger.error(`[ConversationState] getShoppingContexts failed: ${err.message}`);
    return [];
  }
}

export async function setActiveShoppingContext(sessionId, contextId) {
  try {
    const state = await loadConversationState(sessionId);
    const paused = new Set(state.paused_contexts || []);
    paused.delete(contextId);
    if (state.active_shopping_context && state.active_shopping_context !== contextId) {
      paused.add(state.active_shopping_context);
    }
    return await saveConversationState(sessionId, {
      active_shopping_context: contextId,
      paused_contexts: Array.from(paused)
    });
  } catch (err) {
    logger.error(`[ConversationState] setActiveShoppingContext failed: ${err.message}`);
    return null;
  }
}

export async function setPendingOrder(sessionId, orderId) {
  return await saveConversationState(sessionId, { pending_order: orderId });
}

export async function clearPendingOrder(sessionId) {
  return await saveConversationState(sessionId, { pending_order: null });
}

export async function clearConversationState(sessionId) {
  try {
    return await saveConversationState(sessionId, {
      active_delivery_session: null,
      pending_order: null,
      active_shopping_context: null,
      paused_contexts: []
    });
  } catch (err) {
    logger.error(`[ConversationState] clearConversationState failed: ${err.message}`);
    return null;
  }
}

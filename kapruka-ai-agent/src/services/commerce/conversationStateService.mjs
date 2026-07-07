import ConversationState from "../../database/ConversationState.mjs";
import ShoppingContext from "../../database/ShoppingContext.mjs";
import DeliverySession from "../../database/DeliverySession.mjs";
import logger from "../../utils/logger.mjs";

/**
 * Synchronizes legacy fields and new flow fields both ways to guarantee 100% backward compatibility.
 */
function syncLegacyFields(stateDoc, updates = {}) {
  // Ensure workflowContext exists
  if (!stateDoc.workflowContext) {
    stateDoc.workflowContext = {
      currentWorkflow: "idle",
      previousWorkflow: "idle",
      lastTransition: null,
      workflowStartedAt: new Date(),
      awaitingConfirmation: false,
      waitingForPhoneNumber: false,
      waitingForDelivery: false,
      waitingForPayment: false,
      resumeSearch: false,
      previousSearchQuery: null,
      canInterrupt: true,
      canResume: false,
      lastResetAt: null
    };
  }

  // 1. Inverse Sync: Legacy inputs update the new Flow state
  if (updates.active_delivery_session !== undefined) {
    if (updates.active_delivery_session) {
      stateDoc.activeFlow = {
        type: "delivery",
        status: "active",
        currentStep: stateDoc.activeFlow?.type === "delivery" ? stateDoc.activeFlow.currentStep : "waiting_address"
      };
    } else if (stateDoc.activeFlow?.type === "delivery") {
      stateDoc.activeFlow = {
        type: "general_chat",
        status: "active",
        currentStep: "browsing"
      };
    }
  }

  if (updates.active_shopping_context !== undefined) {
    if (updates.active_shopping_context) {
      const currentType = stateDoc.activeFlow?.type;
      const isAlreadyShopping = ["shopping", "product_search", "product_details", "product_recommendation"].includes(currentType);
      stateDoc.activeFlow = {
        type: isAlreadyShopping ? currentType : "shopping",
        status: "active",
        currentStep: isAlreadyShopping ? stateDoc.activeFlow.currentStep : "searching"
      };
      if (!stateDoc.shopping) stateDoc.shopping = {};
      stateDoc.shopping.activeContextId = updates.active_shopping_context;
    } else if (["shopping", "product_search", "product_details", "product_recommendation"].includes(stateDoc.activeFlow?.type)) {
      stateDoc.activeFlow = {
        type: "general_chat",
        status: "active",
        currentStep: "browsing"
      };
    }
  }

  if (updates.pending_order !== undefined) {
    if (updates.pending_order) {
      if (!stateDoc.order) stateDoc.order = {};
      stateDoc.order.pendingOrderId = updates.pending_order;
      stateDoc.activeFlow = {
        type: "checkout",
        status: "active",
        currentStep: "payment_pending"
      };
    } else {
      if (stateDoc.order) {
        stateDoc.order.pendingOrderId = null;
      }
      if (stateDoc.activeFlow?.type === "checkout") {
        stateDoc.activeFlow = {
          type: "general_chat",
          status: "active",
          currentStep: "browsing"
        };
      }
    }
  }

  // 2. Forward Sync: Active flow state updates the legacy fields
  if (stateDoc.activeFlow && stateDoc.activeFlow.type === "delivery" && stateDoc.activeFlow.status === "active") {
    stateDoc.active_delivery_session = stateDoc.sessionId;
  } else {
    stateDoc.active_delivery_session = null;
  }

  if (stateDoc.activeFlow && ["shopping", "product_search", "product_details", "product_recommendation"].includes(stateDoc.activeFlow.type) && stateDoc.activeFlow.status === "active") {
    stateDoc.active_shopping_context = stateDoc.shopping?.activeContextId || null;
  } else {
    stateDoc.active_shopping_context = null;
  }

  stateDoc.pending_order = stateDoc.order?.pendingOrderId || null;

  // Sync current workflow from activeFlow after inverse sync completes
  if (stateDoc.activeFlow?.type) {
    stateDoc.workflowContext.currentWorkflow = stateDoc.activeFlow.type;
  }

  // Flatten workflowContext values onto root of stateDoc for validator and legacy compatibility
  const fieldsToSync = [
    "currentWorkflow",
    "previousWorkflow",
    "lastTransition",
    "workflowStartedAt",
    "awaitingConfirmation",
    "waitingForPhoneNumber",
    "waitingForDelivery",
    "waitingForPayment",
    "resumeSearch",
    "previousSearchQuery",
    "canInterrupt",
    "canResume"
  ];
  for (const field of fieldsToSync) {
    if (stateDoc.workflowContext[field] !== undefined) {
      stateDoc[field] = stateDoc.workflowContext[field];
    }
  }

  // Mark all Mixed fields modified to ensure mongoose saves them
  if (stateDoc && typeof stateDoc.markModified === "function") {
    stateDoc.markModified("activeFlow");
    stateDoc.markModified("pausedFlows");
    stateDoc.markModified("shopping");
    stateDoc.markModified("delivery");
    stateDoc.markModified("order");
    stateDoc.markModified("workflowContext");
  }
}

export async function loadConversationState(sessionId) {
  try {
    let state = await ConversationState.findOne({ sessionId }).lean();
    if (!state) {
      state = await ConversationState.create({ sessionId });
      state = state.toObject();
    }
    logger.info(`[MongoDB] LOADED conversation state for ${sessionId}. currentWorkflow: ${state.workflowContext?.currentWorkflow}, activeFlow: ${state.activeFlow?.type}`);
    return state;
  } catch (err) {
    logger.error(`[ConversationState] loadConversationState failed: ${err.message}`);
    return null;
  }
}

export async function saveConversationState(sessionId, updates) {
  try {
    let stateDoc = await ConversationState.findOne({ sessionId });
    if (!stateDoc) {
      stateDoc = new ConversationState({ sessionId });
    }

    // Apply updates
    for (const [key, val] of Object.entries(updates)) {
      stateDoc[key] = val;
    }

    // Sync legacy/flow structures
    syncLegacyFields(stateDoc, updates);

    logger.info(`[MongoDB] PRE-SAVE conversation state for ${sessionId}. currentWorkflow: ${stateDoc.workflowContext?.currentWorkflow}, activeFlow: ${stateDoc.activeFlow?.type}`);
    await stateDoc.save();
    return stateDoc.toObject();
  } catch (err) {
    logger.error(`[ConversationState] saveConversationState failed: ${err.message}`);
    return null;
  }
}

export async function transitionTo(sessionId, flowType, step, status = "active") {
  try {
    let stateDoc = await ConversationState.findOne({ sessionId });
    if (!stateDoc) {
      stateDoc = new ConversationState({ sessionId });
    }

    const currentFlowType = stateDoc.activeFlow?.type || "general_chat";
    const currentStatus = stateDoc.activeFlow?.status || "active";

    // If changing flows, and the current flow is active and not general_chat, pause it!
    if (flowType !== currentFlowType && currentFlowType !== "general_chat" && currentStatus === "active") {
      const pausedFlow = {
        type: currentFlowType,
        status: "paused",
        reason: "user_interruption",
        currentStep: stateDoc.activeFlow?.currentStep || "browsing",
        state: stateDoc[currentFlowType] || {}
      };
      
      stateDoc.pausedFlows = (stateDoc.pausedFlows || []).filter(f => f.type !== currentFlowType);
      stateDoc.pausedFlows.push(pausedFlow);
      
      if (stateDoc[currentFlowType]) {
        stateDoc[currentFlowType].status = "PAUSED";
      }
    }

    stateDoc.activeFlow = {
      type: flowType,
      status: status,
      currentStep: step
    };

    syncLegacyFields(stateDoc);

    logger.info(`[MongoDB] PRE-SAVE (transition) conversation state for ${sessionId}. currentWorkflow: ${stateDoc.workflowContext?.currentWorkflow}, activeFlow: ${stateDoc.activeFlow?.type}`);
    await stateDoc.save();
    return stateDoc.toObject();
  } catch (err) {
    logger.error(`[ConversationState] transitionTo failed for session ${sessionId}: ${err.message}`);
    return null;
  }
}

export async function pauseCurrentFlow(sessionId, reason = "user_interruption") {
  try {
    let stateDoc = await ConversationState.findOne({ sessionId });
    if (!stateDoc) return null;

    const currentFlowType = stateDoc.activeFlow?.type || "general_chat";
    const currentStatus = stateDoc.activeFlow?.status || "active";

    if (currentFlowType !== "general_chat" && currentStatus === "active") {
      const pausedFlow = {
        type: currentFlowType,
        status: "paused",
        reason: reason,
        currentStep: stateDoc.activeFlow?.currentStep || "browsing",
        state: stateDoc[currentFlowType] || {}
      };

      stateDoc.pausedFlows = (stateDoc.pausedFlows || []).filter(f => f.type !== currentFlowType);
      stateDoc.pausedFlows.push(pausedFlow);

      stateDoc.activeFlow = {
        type: "general_chat",
        status: "active",
        currentStep: "browsing"
      };

      syncLegacyFields(stateDoc);
      logger.info(`[MongoDB] PRE-SAVE (pause) conversation state for ${sessionId}. currentWorkflow: ${stateDoc.workflowContext?.currentWorkflow}, activeFlow: ${stateDoc.activeFlow?.type}`);
      await stateDoc.save();
    }
    return stateDoc.toObject();
  } catch (err) {
    logger.error(`[ConversationState] pauseCurrentFlow failed for session ${sessionId}: ${err.message}`);
    return null;
  }
}

export async function resumeFlow(sessionId, flowType) {
  try {
    let stateDoc = await ConversationState.findOne({ sessionId });
    if (!stateDoc) return null;

    const pausedFlowIndex = (stateDoc.pausedFlows || []).findIndex(f => f.type === flowType);
    if (pausedFlowIndex !== -1) {
      const pausedFlow = stateDoc.pausedFlows[pausedFlowIndex];
      
      // Remove from paused flows list
      stateDoc.pausedFlows.splice(pausedFlowIndex, 1);

      // Pause current active flow if it is active and not general_chat
      const currentFlowType = stateDoc.activeFlow?.type || "general_chat";
      const currentStatus = stateDoc.activeFlow?.status || "active";
      if (currentFlowType !== "general_chat" && currentStatus === "active") {
        const toPause = {
          type: currentFlowType,
          status: "paused",
          reason: "flow_resume",
          currentStep: stateDoc.activeFlow?.currentStep || "browsing",
          state: stateDoc[currentFlowType] || {}
        };
        stateDoc.pausedFlows = (stateDoc.pausedFlows || []).filter(f => f.type !== currentFlowType);
        stateDoc.pausedFlows.push(toPause);
      }

      // Restore active flow
      stateDoc.activeFlow = {
        type: flowType,
        status: "active",
        currentStep: pausedFlow.currentStep
      };

      // Restore specific state
      stateDoc[flowType] = pausedFlow.state || {};

      syncLegacyFields(stateDoc);
      logger.info(`[MongoDB] PRE-SAVE (resume) conversation state for ${sessionId}. currentWorkflow: ${stateDoc.workflowContext?.currentWorkflow}, activeFlow: ${stateDoc.activeFlow?.type}`);
      await stateDoc.save();
    }
    return stateDoc.toObject();
  } catch (err) {
    logger.error(`[ConversationState] resumeFlow failed for session ${sessionId}: ${err.message}`);
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
      paused_contexts: [],
      activeFlow: {
        type: "general_chat",
        status: "active",
        currentStep: "browsing"
      },
      pausedFlows: [],
      shopping: {},
      delivery: {},
      order: {},
      workflowContext: {
        currentWorkflow: "greeting",
        previousWorkflow: "idle",
        lastTransition: "idle_to_greeting",
        workflowStartedAt: new Date(),
        awaitingConfirmation: false,
        waitingForPhoneNumber: false,
        waitingForDelivery: false,
        waitingForPayment: false,
        resumeSearch: false,
        previousSearchQuery: "",
        canInterrupt: true,
        canResume: true,
        lastResetAt: new Date()
      }
    });
  } catch (err) {
    logger.error(`[ConversationState] clearConversationState failed: ${err.message}`);
    return null;
  }
}

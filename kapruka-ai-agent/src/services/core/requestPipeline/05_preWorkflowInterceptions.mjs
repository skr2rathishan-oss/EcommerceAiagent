import { selectResponse } from "../../../services/responseService.mjs";
import { saveMessage } from "../../../services/memory/conversation.service.mjs";
import { addMessage } from "../../../services/memory/chatMemory.service.mjs";
import { updateDeliverySession } from "../../../memory/memoryStore.mjs";
import { saveConversationState } from "../../../services/commerce/conversationStateService.mjs";
import { handleFinalOrderConfirmation } from "../../../services/commerce/deliveryFlowService.mjs";
import { getMemory, updateMemory } from "../../../agent/memoryManager.mjs";
import { logStepDone } from "../../../utils/velora.console.mjs";

export const executePreWorkflowInterceptions = async (reqBody, decision, contextData, sessionId) => {
  const { message } = reqBody;
  const { deliverySession, deliveryState, pendingOrder } = contextData;
  const lowerMsg = message ? message.toLowerCase().trim() : "";

  // ── Early Gift Planner Cancellation Check ──
  const giftPlannerCancelPhrases = ["cancel gift planner", "never mind", "stop planning", "cancel planner", "stop planner"];
  const isGiftPlannerCancel = giftPlannerCancelPhrases.some(phrase => lowerMsg.includes(phrase));
  const isGiftPlannerActive = contextData.userState?.activeFlow?.type === "gift_planner" || contextData.userState?.workflowContext?.currentWorkflow === "gift_planner";

  if (isGiftPlannerCancel && isGiftPlannerActive) {
    logStepDone("Interception", "PRE-WF: Gift Planner Cancellation");
    await saveConversationState(sessionId, { 
      shoppingMission: null,
      activeFlow: {
        type: "general_chat",
        status: "active",
        currentStep: "browsing"
      },
      workflowContext: {
        ...(contextData.userState?.workflowContext || {}),
        currentWorkflow: "idle",
        previousWorkflow: "gift_planner",
        lastTransition: "gift_planner_to_idle"
      }
    });

    const cancelText = "😊 No worries. I've cancelled your Gift Planner session and cleared your shopping mission. What would you like to do next?";
    return {
      earlyReturn: true,
      providerUsed: "response_library",
      pipelineStage: "Response Engine",
      responsePayload: { type: "text", text: cancelText },
      saveUserMessage: true
    };
  }

  // ── Early Cancellation Check ──
  const cancellationPhrases = ["cancel order", "don't place it", "never mind", "don't place", "cancel my order", "stop order", "cancel"];
  const isEarlyCancellation = cancellationPhrases.some(phrase => lowerMsg.includes(phrase));
  if (isEarlyCancellation && (pendingOrder || deliverySession)) {
    logStepDone("Interception", "PRE-WF: Order Cancellation");
    await saveConversationState(sessionId, { active_delivery_session: null, pending_order: null });
    if (deliverySession) {
      await updateDeliverySession(deliverySession.sessionId, { state: "CANCELLED" }, deliverySession.session_version);
    }
    
    // We don't save assistant message here because pipeline handles persistence or caller does.
    // Actually we need to return the early return object.
    const cancelText = "😊 No worries. I've cancelled your pending order. What would you like to do next?";
    return {
      earlyReturn: true,
      providerUsed: "delivery_state_machine",
      serviceResult: { status: "order_cancelled" },
      pipelineStage: "Commerce Engine",
      responsePayload: { type: "text", text: cancelText },
      saveUserMessage: true
    };
  }

  // ── Early Payment Pending / Creating Order Block ──
  if (deliverySession && (deliveryState === "CREATING_ORDER" || deliveryState === "PAYMENT_PENDING")) {
    logStepDone("Interception", `PRE-WF: Order Processing Block. State: ${deliveryState}`);
    let msgText = "";
    if (deliveryState === "PAYMENT_PENDING") {
      const blockDecision = {
        ...decision,
        module: "interruption",
        category: "payment_pending_block",
        response: { module: "interruption", category: "payment_pending_block" },
        llm_response: false
      };
      const blockRes = selectResponse(blockDecision, {}, sessionId);
      msgText = blockRes?.text || "";
    } else if (deliveryState === "CREATING_ORDER") {
      const blockDecision = {
        ...decision,
        module: "interruption",
        category: "order_creation_in_progress",
        response: { module: "interruption", category: "order_creation_in_progress" },
        llm_response: false
      };
      const blockRes = selectResponse(blockDecision, {}, sessionId);
      msgText = blockRes?.text || "";
    }
    return {
      earlyReturn: true,
      providerUsed: "response_library",
      pipelineStage: "Response Engine",
      responsePayload: { type: "text", text: msgText },
      saveUserMessage: true
    };
  }

  // ── Early Pending Order Confirmation ("Yes" / "Confirm") ──
  const isYesEarly = ["yes", "y", "hari", "ow", "yes machan", "confirm", "place the order", "place order", "confirm the order", "yes, place", "yes please", "ok", "okay"].some(
    word => lowerMsg === word || lowerMsg.startsWith(word + " ") || lowerMsg.endsWith(" " + word) || lowerMsg.includes("yes ") || lowerMsg.includes("confirm ") || lowerMsg.includes("place ")
  );
  if (pendingOrder && isYesEarly && deliverySession && (deliveryState === "WAITING_FOR_FINAL_ORDER_CONFIRMATION" || deliveryState === "WAITING_FOR_CONFIRMATION")) {
    logStepDone("Interception", "PRE-WF: Pending Order Confirmation");
    const memory = getMemory(sessionId);
    delete memory.hasRemindedPendingOrder;
    updateMemory(sessionId, memory);

    const serviceResult = await handleFinalOrderConfirmation(deliverySession, message, decision.language.code);
    if (serviceResult && serviceResult.status) {
      let textResponse = "";
      let prefix = "";
      if (serviceResult.prefixStatus) {
        const prefixDecision = {
          ...decision,
          module: serviceResult.prefixModule || "delivery",
          category: serviceResult.prefixStatus,
          response: { module: serviceResult.prefixModule || "delivery", category: serviceResult.prefixStatus },
          llm_response: false
        };
        const prefixRes = selectResponse(prefixDecision, serviceResult.prefixContext || {}, sessionId);
        prefix = prefixRes?.text ? prefixRes.text + "\n\n" : "";
      }

      const serviceDecision = {
        ...decision,
        module: serviceResult.module || "delivery",
        category: serviceResult.status,
        response: { module: serviceResult.module || "delivery", category: serviceResult.status },
        llm_response: false
      };
      const mainRes = selectResponse(serviceDecision, serviceResult.context || {}, sessionId);
      let mainText = mainRes?.text || "";

      let perishableWarning = "";
      if (serviceResult.perishableStatus) {
        const perishableDecision = {
          ...decision,
          module: serviceResult.perishableModule || "delivery",
          category: serviceResult.perishableStatus,
          response: { module: serviceResult.perishableModule || "delivery", category: serviceResult.perishableStatus },
          llm_response: false
        };
        const perishableRes = selectResponse(perishableDecision, serviceResult.perishableContext || {}, sessionId);
        perishableWarning = perishableRes?.text ? "\n\n" + perishableRes.text : "";
      }

      let nextPrompt = "";
      if (serviceResult.nextPromptStatus) {
        const nextDecision = {
          ...decision,
          module: serviceResult.nextPromptModule || "delivery",
          category: serviceResult.nextPromptStatus,
          response: { module: serviceResult.nextPromptModule || "delivery", category: serviceResult.nextPromptStatus },
          llm_response: false
        };
        const nextRes = selectResponse(nextDecision, serviceResult.nextPromptContext || {}, sessionId);
        nextPrompt = nextRes?.text ? "\n\n" + nextRes.text : "";
      }

      let detailsText = "";
      if (serviceResult.detailsText) {
        detailsText = "\n\n" + serviceResult.detailsText;
      }

      let confirmPrompt = "";
      if (serviceResult.confirmStatus) {
        const confirmDecision = {
          ...decision,
          module: serviceResult.confirmModule || "delivery",
          category: serviceResult.confirmStatus,
          response: { module: serviceResult.confirmModule || "delivery", category: serviceResult.confirmStatus },
          llm_response: false
        };
        const confirmRes = selectResponse(confirmDecision, serviceResult.confirmContext || {}, sessionId);
        confirmPrompt = confirmRes?.text ? "\n\n" + confirmRes.text : "";
      }

      let paymentPrompt = "";
      if (serviceResult.paymentStatus) {
        const paymentDecision = {
          ...decision,
          module: serviceResult.paymentModule || "delivery",
          category: serviceResult.paymentStatus,
          response: { module: serviceResult.paymentModule || "delivery", category: serviceResult.paymentStatus },
          llm_response: false
        };
        const paymentRes = selectResponse(paymentDecision, serviceResult.paymentContext || {}, sessionId);
        paymentPrompt = paymentRes?.text ? "\n\n" + paymentRes.text : "";
      }

      textResponse = prefix + mainText + perishableWarning + detailsText + confirmPrompt + nextPrompt + paymentPrompt;
      serviceResult.text = textResponse;
    }

    return {
      earlyReturn: true,
      providerUsed: "delivery_state_machine",
      serviceResult,
      pipelineStage: "Commerce Engine",
      responsePayload: serviceResult,
      saveUserMessage: true
    };
  }

  return { earlyReturn: false };
};
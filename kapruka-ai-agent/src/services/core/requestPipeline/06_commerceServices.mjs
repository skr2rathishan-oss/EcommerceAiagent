import { selectResponse } from "../../../services/responseService.mjs";
import { resumeFlow } from "../../../services/commerce/conversationStateService.mjs";
import { getDeliverySession } from "../../../memory/memoryStore.mjs";
import { logStepDone } from "../../../utils/velora.console.mjs";
import { getRecentHistory } from "../../../services/memory/chatMemory.service.mjs";
import { getShoppingContext, updateMemory } from "../../../agent/memoryManager.mjs";
import { chatWithLLM } from "../../../services/ai/llm.service.mjs";
import {
  handleAddressInput,
  handleAddressConfirmation,
  handleDateInput,
  handleRecoveryChoice,
  handleCancelOptions,
  handleCheckoutConfirmation,
  handleContactNameInput,
  handleContactPhoneInput,
  handleCancelChoice
} from "../../../services/commerce/deliveryFlowService.mjs";
import {
  resumeShoppingContext,
  pauseShoppingContext,
  createShoppingContext
} from "../../../services/commerce/shoppingContextService.mjs";
import { setActiveShoppingContext } from "../../../services/commerce/conversationStateService.mjs";
import { routeIntent } from "../../../agent/intentRouter.mjs";

const activeCollectingStates = [
  "WAITING_FOR_ADDRESS",
  "WAITING_FOR_ADDRESS_CONFIRMATION",
  "WAITING_FOR_DATE",
  "CHECKING_DELIVERY",
  "WAITING_FOR_RECOVERY_CHOICE",
  "WAITING_FOR_ALTERNATIVE_PRODUCT_SELECTION",
  "WAITING_FOR_CONFIRMATION",
  "WAITING_FOR_FINAL_ORDER_CONFIRMATION",
  "WAITING_FOR_CONTACT_NAME",
  "WAITING_FOR_CONTACT_PHONE",
  "WAITING_FOR_CANCEL_CHOICE"
];

export const executeCommerceServices = async (reqBody, decision, parsedIntent, contextData, workflowDecision, resolvedReference, sessionId) => {
  const { message, voiceMode } = reqBody;
  let { userState, memory, deliverySession, deliveryState, currentLang, pendingOrder } = contextData;
  const lowerMsg = message ? message.toLowerCase().trim() : "";

  // ── CSM Resume Flow Check using Workflow Engine ──
  const shouldResumeDelivery = workflowDecision.workflow === "delivery" && userState?.pausedFlows?.some(f => f.type === "delivery");
  if (shouldResumeDelivery) {
    logStepDone("Interception", "VCSM: Resuming Paused Delivery Flow via Workflow Engine");
    await resumeFlow(sessionId, "delivery");
    
    deliverySession = await getDeliverySession(sessionId);
    deliveryState = deliverySession?.state;

    let category = "continue_delivery_flow";
    let module = "delivery";
    if (deliveryState === "WAITING_FOR_ADDRESS") category = "ask_delivery_address";
    else if (deliveryState === "WAITING_FOR_DATE") category = "ask_delivery_date";
    else if (deliveryState === "WAITING_FOR_CONTACT_NAME") category = "ask_contact_name";
    else if (deliveryState === "WAITING_FOR_CONTACT_PHONE") category = "ask_contact_phone";
    else if (deliveryState === "WAITING_FOR_CONFIRMATION" || deliveryState === "WAITING_FOR_FINAL_ORDER_CONFIRMATION") category = "confirm_order";

    const resumeDecision = {
      ...decision,
      module,
      category,
      response: { module, category },
      llm_response: false
    };
    const resumeRes = selectResponse(resumeDecision, {}, sessionId);
    let promptText = "Welcome back! 😊 " + (resumeRes?.text || "");

    return {
      earlyReturn: true,
      providerUsed: "response_library",
      responsePayload: { type: "text", text: promptText },
      pipelineStage: "Response Engine"
    };
  }

  // ── Priority 2: Active Delivery Session & Delivery Protection ──
  if (deliverySession && activeCollectingStates.includes(deliveryState) && deliveryState !== "WAITING_FOR_FINAL_ORDER_CONFIRMATION") {
    if (parsedIntent.intent === "search_products" || parsedIntent.intent === "select_product" || parsedIntent.intent === "get_product_details") {
      logStepDone("Interception", "VCSM: Delivery Protection Triggered");
      const protectDecision = {
        ...decision,
        module: "interruption",
        category: "checkout_in_progress",
        response: { module: "interruption", category: "checkout_in_progress" },
        llm_response: false
      };
      const protectRes = selectResponse(protectDecision, {}, sessionId);
      const protectMsg = protectRes?.text ? "Almost done! " + protectRes.text : "";
      return {
        earlyReturn: true,
        providerUsed: "response_library",
        responsePayload: { type: "text", text: protectMsg },
        pipelineStage: "Response Engine"
      };
    }
  }

  // ── Small Talk Check during Delivery Flow ──
  if (deliverySession && activeCollectingStates.includes(deliveryState) && parsedIntent.intent === "general_chat") {
    logStepDone("Interception", "VCSM: Small Talk during Active Delivery");
    return {
      earlyReturn: true,
      isSmallTalkInDelivery: true,
      providerUsed: "gemini",
      pipelineStage: "Response Engine"
    };
  }
  
  // NOTE: Delivery Flow input routing has been moved to intentRouter (DELIVERY_FLOW_INPUT)

  // ── Priority 3 / 9 / 10 Choice: Shopping Context Resume Choice ──
  if (memory.waitingForResumeChoice && memory.resumableContextId) {
    // Return early return flag so orchestrator can handle it.
    return {
      earlyReturn: true,
      isResumeChoice: true
    };
  }

  // ── Priority 7: Pending Order Reminder Check ──
  let shouldAddReminder = false;
  let reminderText = "";
  if (pendingOrder && (parsedIntent.intent === "search_products" || parsedIntent.intent === "select_product" || parsedIntent.intent === "get_product_details")) {
    if (!memory.hasRemindedPendingOrder) {
      memory.hasRemindedPendingOrder = true;
      updateMemory(sessionId, memory);
      
      const pendingSession = await getDeliverySession(pendingOrder).catch(() => null);
      const pendingProduct = pendingSession?.selected_product?.product_name || "item";
      const reminderDecision = {
        ...decision,
        module: "order",
        category: "pending_order_reminder",
        response: { module: "order", category: "pending_order_reminder" },
        llm_response: false
      };
      const reminderRes = selectResponse(reminderDecision, { product_name: pendingProduct }, sessionId);
      reminderText = (reminderRes?.text || "") + "\n\n";
      shouldAddReminder = true;
    }
  }

  return {
    earlyReturn: false,
    shouldAddReminder,
    reminderText
  };
};
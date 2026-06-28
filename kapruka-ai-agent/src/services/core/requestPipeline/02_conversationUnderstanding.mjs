import { understandConversation, buildDecision } from "../../../services/responseService.mjs";
import { logStepStart } from "../../../utils/velora.console.mjs";

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

export const executeConversationUnderstanding = async (reqBody, contextData) => {
  const { message, voiceMode, intent: bodyIntent } = reqBody;
  const { deliveryState, userState, history, deliverySession } = contextData;

  logStepStart("Conversation Understanding");
  
  const culOutput = await understandConversation({
    message,
    deliveryState: deliveryState || null,
    conversationState: userState,
    history,
    voiceMode: !!voiceMode,
  });

  const decision = buildDecision(culOutput, deliveryState || null, userState, message);
  
  if (bodyIntent) {
    decision.intent.value = bodyIntent;
  }
  
  const currentLang = decision.language.code;

  // ── Delivery Flow Intent Override ──
  const lowerMsg = message ? message.toLowerCase().trim() : "";
  if (deliverySession && activeCollectingStates.includes(deliveryState) && decision.intent.value === "general_chat") {
    const isChoiceInput = ["a", "b", "c", "1", "2", "3", "yes", "no", "y", "n", "hari", "ow", "na", "epa", "confirm", "cancel", "edit"].some(
      opt => lowerMsg === opt || lowerMsg.startsWith(opt + " ") || lowerMsg.includes("use this") || lowerMsg.includes("start over")
    );

    let isFlowInput = false;
    if (
      deliveryState === "WAITING_FOR_ADDRESS_CONFIRMATION" || 
      deliveryState === "WAITING_FOR_RECOVERY_CHOICE" || 
      deliveryState === "WAITING_FOR_ALTERNATIVE_PRODUCT_SELECTION" || 
      deliveryState === "WAITING_FOR_CONFIRMATION" || 
      deliveryState === "WAITING_FOR_CANCEL_CHOICE"
    ) {
      if (isChoiceInput) {
        isFlowInput = true;
      }
    } else if (deliveryState === "WAITING_FOR_DATE") {
      const dateKeywords = ["today", "tomorrow", "next", "day after", "ada", "heta", "anidda", "indru", "naalai", "mon", "tue", "wed", "thu", "fri", "sat", "sun", "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
      const hasDateKeyword = dateKeywords.some(kw => lowerMsg.includes(kw));
      const hasDigits = /\\d+/.test(lowerMsg);
      if (hasDateKeyword || hasDigits || isChoiceInput) {
        isFlowInput = true;
      }
    } else if (deliveryState === "WAITING_FOR_CONTACT_PHONE") {
      const hasDigits = lowerMsg.replace(/[^0-9]/g, "").length >= 7;
      if (hasDigits || isChoiceInput) {
        isFlowInput = true;
      }
    } else if (deliveryState === "WAITING_FOR_CONTACT_NAME") {
      const wordCount = lowerMsg.split(/\\s+/).length;
      const isQuestion = lowerMsg.includes("?") || ["what", "how", "who", "why", "where", "can you", "hi", "hello"].some(q => lowerMsg.startsWith(q));
      if (wordCount <= 3 && !isQuestion) {
        isFlowInput = true;
      }
    } else if (deliveryState === "WAITING_FOR_ADDRESS") {
      const isQuestion = lowerMsg.includes("?") || ["what", "how", "who", "why", "where", "can you", "hi", "hello"].some(q => lowerMsg.startsWith(q));
      const wordCount = lowerMsg.split(/\\s+/).length;
      if (wordCount >= 2 && !isQuestion) {
        isFlowInput = true;
      }
    }

    if (isFlowInput) {
      decision.intent.value = "delivery_flow_input";
    }
  }

  return {
    decision,
    currentLang,
    culOutput
  };
};

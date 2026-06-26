/**
 * decisionBuilder.mjs
 *
 * Decision Builder for Velora AI Agent.
 * Connects the Conversation Understanding Layer output to the Response Engine
 * by producing a validated, standardized Decision Object.
 */

import logger from "../../utils/logger.mjs";

/**
 * Validates and normalizes the Decision Object to guarantee it has the expected schema.
 * If information is missing, missing values are left empty (e.g. empty strings).
 * Never throws exceptions.
 */
export function validateDecision(decision) {
  const defaultDecision = {
    language: {
      detected: "english",
      confidence: 0.95
    },
    intent: {
      value: "general_chat",
      confidence: 0.85
    },
    emotion: "neutral",
    conversation_stage: "browsing",
    active_flow: "general_chat",
    tool: {
      required: false,
      name: "none"
    },
    response: {
      module: "common",
      category: "small_talk"
    },
    variables: {
      city: "",
      delivery_date: "",
      product_name: "",
      phone_number: "",
      customer_name: "",
      recipient: "",
      occasion: "",
      brand: "",
      category: "",
      price: ""
    },
    llm_response: true
  };

  if (!decision || typeof decision !== "object") {
    return defaultDecision;
  }

  // 1. Language
  const language = {
    detected: decision.language?.detected || defaultDecision.language.detected,
    confidence: typeof decision.language?.confidence === "number" 
      ? decision.language.confidence 
      : defaultDecision.language.confidence
  };

  // 2. Intent
  const intent = {
    value: decision.intent?.value || (typeof decision.intent === "string" ? decision.intent : defaultDecision.intent.value),
    confidence: typeof decision.intent?.confidence === "number"
      ? decision.intent.confidence
      : (decision.intent === "general_chat" ? 0.85 : 0.95)
  };

  // 3. Emotion
  const emotion = decision.emotion || defaultDecision.emotion;

  // 4. Conversation Stage
  const conversation_stage = decision.conversation_stage || defaultDecision.conversation_stage;

  // 5. Active Flow
  const active_flow = decision.active_flow || defaultDecision.active_flow;

  // 6. Tool
  const tool = {
    required: typeof decision.tool?.required === "boolean"
      ? decision.tool.required
      : (decision.tool && decision.tool !== "none" ? true : defaultDecision.tool.required),
    name: decision.tool?.name || (typeof decision.tool === "string" ? decision.tool : defaultDecision.tool.name)
  };

  // 7. Response
  const response = {
    module: decision.response?.module || decision.module || defaultDecision.response.module,
    category: decision.response?.category || decision.category || defaultDecision.response.category
  };

  // 8. Variables
  const vars = decision.variables || {};
  const variables = {
    city: String(vars.city || vars.deliveryLocation || ""),
    delivery_date: String(vars.delivery_date || vars.deliveryDate || ""),
    product_name: String(vars.product_name || vars.productType || ""),
    phone_number: String(vars.phone_number || ""),
    customer_name: String(vars.customer_name || ""),
    recipient: String(vars.recipient || ""),
    occasion: String(vars.occasion || ""),
    brand: String(vars.brand || ""),
    category: String(vars.category || ""),
    price: String(vars.price || vars.budget || "")
  };

  // 9. LLM Response
  const llm_response = typeof decision.llm_response === "boolean"
    ? decision.llm_response
    : defaultDecision.llm_response;

  return {
    language,
    intent,
    emotion,
    conversation_stage,
    active_flow,
    tool,
    response,
    variables,
    llm_response
  };
}

/**
 * Builds the validated Decision Object from the Conversation Understanding Layer output.
 * 
 * @param {object} culOutput - Output from understandConversation()
 * @param {string|null} deliveryState - Current VCSM delivery state
 * @returns {object} Standardized & validated Decision Object
 */
export function buildDecision(culOutput, deliveryState, conversationState = null) {
  try {
    const rawIntent = culOutput.intent || "general_chat";
    let stage = culOutput.conversation_stage || "browsing";
    let active_flow = "general_chat";

    if (conversationState && conversationState.activeFlow) {
      active_flow = conversationState.activeFlow.type || active_flow;
      stage = conversationState.activeFlow.currentStep || stage;
    } else {
      // active_flow resolution
      if (rawIntent === "search_products" || rawIntent === "get_product_details") {
        active_flow = "shopping";
      } else if (rawIntent === "check_delivery" || stage === "delivery_address" || stage === "delivery_date" || stage === "contact_information") {
        active_flow = "delivery";
      } else if (rawIntent === "create_order" || stage === "order_summary") {
        active_flow = "checkout";
      } else if (stage === "payment") {
        active_flow = "payment";
      }

      // Interruption logic: If delivery is in progress, and user searches for products (shopping)
      if (deliveryState && active_flow === "shopping") {
        active_flow = "interrupted";
      } else if (deliveryState && active_flow === "delivery") {
        // If delivery is in progress and we are continuing delivery actions, mark as resuming
        active_flow = "resuming";
      }
    }

    const unvalidated = {
      ...culOutput,
      conversation_stage: stage,
      active_flow
    };

    return validateDecision(unvalidated);
  } catch (err) {
    logger.error("[DecisionBuilder] Error building decision:", err);
    return validateDecision(null);
  }
}

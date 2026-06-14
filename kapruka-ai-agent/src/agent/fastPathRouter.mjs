import { isSimpleConversation } from "../services/llm.service.mjs";

/**
 * Checks if a user's message is a complex reasoning or recommendation request.
 * 
 * @param {string} message 
 * @returns {boolean}
 */
export function isComplexQuery(message) {
  if (!message || typeof message !== "string") return false;
  const cleaned = message.toLowerCase();
  
  const complexKeywords = [
    "suggest",
    "recommend",
    "gift",
    "idea",
    "compare",
    "birthday",
    "anniversary",
    "present",
    "opinion",
    "advice",
    "planning",
    "what should i buy",
    "which one is better",
    "choose",
    "suit",
    "best"
  ];
  
  return complexKeywords.some(keyword => cleaned.includes(keyword));
}

/**
 * Determines whether the user request should bypass Qwen.
 * 
 * @param {string} intent 
 * @param {string} message 
 * @returns {boolean}
 */
export function shouldBypassQwen(intent, message) {
  if (intent === "general_chat") {
    return isSimpleConversation(message);
  }
  if (intent === "search_products") {
    return !isComplexQuery(message);
  }
  if (
    intent === "get_product_details" ||
    intent === "select_product" ||
    intent === "track_order" ||
    intent === "check_delivery"
  ) {
    return true;
  }
  return false;
}

/**
 * Gets the corresponding fast path type for logging.
 * 
 * @param {string} intent 
 * @param {string} message 
 * @returns {string|null}
 */
export function getFastPathType(intent, message = "") {
  if (intent === "general_chat" && isSimpleConversation(message)) {
    return "greeting";
  }
  if (intent === "search_products") {
    return "product_search";
  }
  if (intent === "get_product_details" || intent === "select_product") {
    return "product_details";
  }
  if (intent === "track_order") {
    return "order_tracking";
  }
  if (intent === "check_delivery") {
    return "delivery_check";
  }
  return null;
}

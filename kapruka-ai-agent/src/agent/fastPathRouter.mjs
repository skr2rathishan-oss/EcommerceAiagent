import { isSimpleConversation } from "../services/ai/llm.service.mjs";

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
    "best",
    "hospital",
    "sick",
    "unwell",
    "support",
    "sorry",
    "apology",
    "comfort",
    "get well",
    "love",
    "forgot",
    // Sinhala keywords
    "කියන්න",
    "යෝජනා",
    "හොඳම",
    "තෑග්ග",
    "තෑගි",
    "තෑග්ගක්",
    "උපන්දින",
    "බර්ත්ඩේ",
    "සනීප",
    "අසනීප",
    "රෝහල",
    "හොස්පිට්ල්",
    "සමාවෙන්න",
    "කණගාටුයි",
    "සොරි",
    "අමතක",
    // Tamil keywords
    "பரிந்துரை",
    "பரிசு",
    "அன்பளிப்பு",
    "பிறந்தநாள்",
    "பிறந்த நாள்",
    "சிறந்த",
    "ஹோஸ்பிட்டல்",
    "ஆஸ்பத்திரி",
    "உடம்பு",
    "உடல்நிலை",
    "மன்னிக்கவும்",
    "ஸாரி",
    "மறந்து"
  ];
  
  return complexKeywords.some(keyword => cleaned.includes(keyword));
}

/**
 * Determines whether the user request should bypass Qwen.
 * 
 * @param {string} intent 
 * @param {string} message 
 * @param {boolean} voiceMode
 * @returns {boolean}
 */
export function shouldBypassQwen(intent, message, voiceMode = false) {
  if (voiceMode) {
    return false; // Never bypass Qwen formatting in voice mode
  }
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

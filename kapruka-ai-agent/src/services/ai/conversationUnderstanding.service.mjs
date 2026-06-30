/**
 * conversationUnderstanding.service.mjs
 *
 * Centralized Conversation Understanding Layer (CUL) for Velora AI Agent.
 *
 * Runs a single Gemini 2.5 Flash API call to analyze language, intent, emotion,
 * stage, and variables, falling back to local heuristics on error.
 */

import { CONVERSATION_UNDERSTANDING_PROMPT } from "../../agent/conversationUnderstandingPrompt.mjs";
import { getIntentModel, callGeminiSingleTurn } from "./modelRouter.mjs";
import { normalizeText, isShortMessage, runHeuristicDetection, applyLanguagePreferenceStickiness } from "../../utils/language.utils.mjs";
import { EnglishDictionary, SINGlishDictionary, TANGlishDictionary, SinhalaDictionary, TamilDictionary } from "../../resources/language/index.mjs";
import { detectEmotion } from "../../ai/context/emotionDetector.mjs";
import { detectSituation } from "../../ai/context/situationDetector.mjs";
import { saveConversationState } from "../commerce/conversationStateService.mjs";
import logger from "../../utils/logger.mjs";

// ── Emotion mapper ────────────────────────────────────────────────────────────
const EMOTION_MAP = {
  romantic:     "excited",
  apologetic:   "worried",
  caring:       "thankful",
  celebration:  "happy",
  professional: "neutral",
  sympathy:     "disappointed",
  neutral:      "neutral",
};

function mapEmotion(rawEmotion) {
  return EMOTION_MAP[rawEmotion] || "neutral";
}

// ── Conversation Stage resolver ───────────────────────────────────────────────
function resolveConversationStage(intent, deliveryState) {
  if (deliveryState) {
    const stageMap = {
      WAITING_FOR_ADDRESS:              "delivery_address",
      WAITING_FOR_ADDRESS_CONFIRMATION: "delivery_address",
      WAITING_FOR_DATE:                 "delivery_date",
      WAITING_FOR_CONTACT_NAME:         "contact_information",
      WAITING_FOR_CONTACT_PHONE:        "contact_information",
      WAITING_FOR_CONFIRMATION:         "order_summary",
      WAITING_FOR_RECOVERY_CHOICE:      "interrupted",
      WAITING_FOR_CANCEL_CHOICE:        "interrupted",
      CREATING_ORDER:                   "payment",
      PAYMENT_PENDING:                  "payment",
    };
    if (stageMap[deliveryState]) return stageMap[deliveryState];
  }

  const intentStageMap = {
    search_products:           "searching",
    get_product_details:       "product_selected",
    check_delivery:            "delivery_address",
    create_order:              "order_summary",
    track_order:               "completed",
    general_chat:              "browsing",
    recovery_nearby_location:  "interrupted",
    recovery_alternative_date: "interrupted",
    recovery_similar_products: "interrupted",
  };
  return intentStageMap[intent] || "browsing";
}

// ── Tool decision resolver ────────────────────────────────────────────────────
function resolveToolDecision(intent) {
  const toolMap = {
    search_products:           "search_products",
    get_product_details:       "none",
    check_delivery:            "kapruka_check_delivery",
    create_order:              "kapruka_create_order",
    track_order:               "none",
    general_chat:              "none",
    recovery_nearby_location:  "kapruka_check_delivery",
    recovery_alternative_date: "kapruka_check_delivery",
    recovery_similar_products: "search_products",
  };
  return toolMap[intent] || "none";
}

// ── Response Library module + category resolver ───────────────────────────────
function resolveResponseLibrary(intent, conversationStage, emotion, situation) {
  // Greeting / small-talk detection
  if (intent === "general_chat") {
    if (situation === "general") {
      return { module: "common", category: "greeting", llm_response: false };
    }
    return { module: "common", category: "small_talk", llm_response: true };
  }

  // Shopping intents
  if (intent === "search_products") {
    return { module: "shopping", category: "search", llm_response: true };
  }
  if (intent === "get_product_details") {
    return { module: "shopping", category: "product_details", llm_response: true };
  }

  // Delivery intents
  if (intent === "check_delivery" || conversationStage === "delivery_address") {
    return { module: "delivery", category: "ask_delivery_address", llm_response: false };
  }
  if (conversationStage === "delivery_date") {
    return { module: "delivery", category: "address_confirmed", llm_response: false };
  }
  if (conversationStage === "contact_information") {
    return { module: "order", category: "ask_contact_name", llm_response: false };
  }

  // Order intents
  if (intent === "create_order") {
    return { module: "order", category: "payment", llm_response: false };
  }
  if (intent === "track_order") {
    return { module: "order", category: "order_confirmation", llm_response: true };
  }

  // Recovery intents
  if (intent.startsWith("recovery_")) {
    return { module: "recovery", category: "recovery", llm_response: true };
  }

  // Interrupted flow
  if (conversationStage === "interrupted") {
    return { module: "interruption", category: "interruption", llm_response: false };
  }

  // Default — LLM handles
  return { module: "common", category: "small_talk", llm_response: true };
}

// ── Heuristic Fallback Engine ──────────────────────────────────────────────────
function runLocalHeuristicFallback({ message, history, deliveryState, conversationState }) {
  logger.warn("[CUL] Gemini CUL failed or timed out. Running local heuristic fallback.");

  // 1. Language detection using heuristics
  const normalized = normalizeText(message);
  const heuristic = runHeuristicDetection(normalized);
  let langLabel = heuristic.language;
  let langConf = heuristic.confidence;

  if (langLabel === "sinhala") langLabel = "singlish";
  if (langLabel === "tamil") langLabel = "tanglish";

  let chat_subtype = "casual_chat";
  const lowerMsg = message ? message.toLowerCase().trim() : "";
  if (["hi", "hello", "hey", "good morning", "good evening"].some(p => lowerMsg.includes(p))) {
    chat_subtype = "greeting";
  }

  // Apply preferred language rules
  let preferredLanguage = conversationState?.preferredLanguage || "english";
  let consecutiveCount = conversationState?.consecutiveMessagesInSameLanguage || 0;
  const isShort = isShortMessage(normalized);

  if (!preferredLanguage || (preferredLanguage === "english" && consecutiveCount === 0)) {
    preferredLanguage = langLabel;
    consecutiveCount = 1;
  }

  if (langLabel !== preferredLanguage) {
    if (isShort) {
      langLabel = preferredLanguage;
      langConf = 0.95;
    } else {
      // Require 3 consecutive user messages in same language to switch
      const userHistory = history.filter(m => m.role === "user");
      const requiredConsecutive = 3;
      let matchesHistory = true;

      let previousUserMsgs = userHistory;
      if (userHistory.length > 0 && userHistory[userHistory.length - 1].content === message) {
        previousUserMsgs = userHistory.slice(0, -1);
      }

      const recentUserMsgs = previousUserMsgs.slice(-(requiredConsecutive - 1));

      if (recentUserMsgs.length === requiredConsecutive - 1) {
        for (const msg of recentUserMsgs) {
          const histNorm = normalizeText(msg.content);
          const histHeur = runHeuristicDetection(histNorm);
          const histLang = (histHeur.language === "sinhala" || histHeur.language === "sinhala_mix") ? "sinhala_mix" :
                           (histHeur.language === "tamil" || histHeur.language === "tamil_mix") ? "tamil_mix" :
                           "english";
          const targetLang = (langLabel === "sinhala" || langLabel === "sinhala_mix") ? "sinhala_mix" :
                             (langLabel === "tamil" || langLabel === "tamil_mix") ? "tamil_mix" :
                             "english";
          if (histLang !== targetLang) {
            matchesHistory = false;
            break;
          }
        }
      } else {
        matchesHistory = false;
      }

      if (matchesHistory) {
        preferredLanguage = langLabel;
        consecutiveCount = 1;
      } else {
        langLabel = preferredLanguage;
      }
    }
  } else {
    consecutiveCount = consecutiveCount + 1;
  }

  if (conversationState) {
    conversationState.preferredLanguage = preferredLanguage;
    conversationState.consecutiveMessagesInSameLanguage = consecutiveCount;
    conversationState.lastDetectedLanguage = langLabel;
    conversationState.languageConfidence = langConf;
  }

  // 2. Intent detection using rule-based pattern matching
  let intent = "general_chat";

  const orderNumberMatch = message ? message.match(/\b((?:VPAY|VIMP|KAP-)[A-Z0-9-]+)\b/i) : null;
  const extractedOrderNumber = orderNumberMatch ? orderNumberMatch[1].toUpperCase() : null;

  const hasTrackingKeywords = message ? [
    "track", "status", "where is my", "where is order", "check my order", "check order", "where's my order"
  ].some(kw => lowerMsg.includes(kw)) : false;

  if (extractedOrderNumber || hasTrackingKeywords) {
    intent = "track_order";
  } else if (["buy", "order", "checkout", "purchase", "place order", "place the order"].some(p => lowerMsg.includes(p))) {
    intent = "create_order";
  } else if (["deliver", "ship", "eta", "arrival", "post", "city"].some(p => lowerMsg.includes(p))) {
    intent = "check_delivery";
  } else if (["detail", "spec", "more about", "tell me more"].some(p => lowerMsg.includes(p))) {
    intent = "get_product_details";
  } else if (["show", "cake", "laptop", "gift", "find", "flower", "chocolate", "compare"].some(p => lowerMsg.includes(p))) {
    intent = "search_products";
  }

  const emotionResult = detectEmotion(message);
  const situationResult = detectSituation(message);

  const variables = {
    city: null,
    delivery_date: null,
    product_name: null,
    phone_number: null,
    customer_name: null,
    recipient: null,
    occasion: null,
    brand: null,
    category: null,
    price: null,
    orderNumber: extractedOrderNumber
  };

  const cities = ["colombo", "jaffna", "kandy", "galle", "matara", "batticaloa", "kurunegala", "negombo"];
  for (const c of cities) {
    if (lowerMsg.includes(c)) {
      variables.city = c.charAt(0).toUpperCase() + c.slice(1);
      break;
    }
  }

  const phoneMatch = message.match(/(?:07\d{8})|(?:\+947\d{8})/);
  if (phoneMatch) {
    variables.phone_number = phoneMatch[0];
  }

  const recipients = ["girlfriend", "boyfriend", "wife", "husband", "mother", "father", "mom", "dad", "friend", "sister", "brother"];
  for (const r of recipients) {
    if (lowerMsg.includes(r)) {
      variables.recipient = r;
      break;
    }
  }

  const occasions = ["birthday", "anniversary", "graduation", "wedding", "christmas", "valentine"];
  for (const o of occasions) {
    if (lowerMsg.includes(o)) {
      variables.occasion = o;
      break;
    }
  }

  const cats = ["cake", "flower", "laptop", "phone", "toy", "perfume", "watch"];
  for (const cat of cats) {
    if (lowerMsg.includes(cat)) {
      variables.category = cat;
      variables.product_name = cat;
      break;
    }
  }

  const priceMatch = lowerMsg.match(/(?:under|below|less than)\s*(\d+)/);
  if (priceMatch) {
    variables.price = priceMatch[1];
  }

  return {
    language: {
      detected: langLabel,
      confidence: langConf,
    },
    intent: {
      value: intent,
      chat_subtype: intent === "general_chat" ? chat_subtype : null,
      confidence: 0.7
    },
    emotion: mapEmotion(emotionResult.emotion),
    conversationStage: resolveConversationStage(intent, deliveryState),
    variables,
    analysisConfidence: 0.6
  };
}

// ── Main CUL Function ─────────────────────────────────────────────────────────

export async function understandConversation({
  message          = "",
  deliveryState    = null,
  conversationState = null,
  history          = [],
  voiceMode        = false,
}) {
  let result = null;
  let isFallback = false;

  const currentPreferredLanguage = conversationState?.preferredLanguage || "english";
  const consecutiveCount = conversationState?.consecutiveMessagesInSameLanguage || 0;
  const activeFlow = conversationState?.activeFlow?.type || "none";
  const currentStep = conversationState?.activeFlow?.currentStep || "none";
  const deliverySessionState = deliveryState || "none";

  const stateContext = {
    preferredLanguage: currentPreferredLanguage,
    consecutiveMessagesInSameLanguage: consecutiveCount,
    activeFlow,
    currentStep,
    deliverySessionState,
  };

  const languageResources = {
    tanglish: TANGlishDictionary.greetings,
    singlish: SINGlishDictionary.greetings,
    english: EnglishDictionary.greetings
  };

  const userPrompt = `Language Resources (Heuristics):\n${JSON.stringify(languageResources, null, 2)}\n\nConversation State:\n${JSON.stringify(stateContext, null, 2)}\n\nMessage History:\n${JSON.stringify(history.slice(-6), null, 2)}\n\nLatest User Message: "${message}"`;

  try {
    const { client: activeClient, model } = getIntentModel();
    const raw = await callGeminiSingleTurn(activeClient, model, CONVERSATION_UNDERSTANDING_PROMPT, userPrompt, {
      temperature: 0,
      maxOutputTokens: 1500,
      responseMimeType: "application/json"
    });

    // Priority Fix: Stronger JSON parsing fallback
    const match = raw.match(/\{[\s\S]*\}/);
    let clean = raw.trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
    
    if (match) {
        clean = match[0];
    }
    
    // Repair common trailing comma / missing brace issues
    if (clean.endsWith(",")) {
        clean = clean.slice(0, -1) + "\n}";
    }

    result = JSON.parse(clean);
  } catch (err) {
    logger.error("[CUL] Gemini CUL execution failed or invalid JSON:", err);
    result = runLocalHeuristicFallback({ message, history, deliveryState, conversationState });
    isFallback = true;
  }

  // Ensure language detected field matches
  let langLabel = result.language?.detected || "english";
  let langConf = result.language?.confidence || 0.95;

  if (langLabel === "sinhala") langLabel = "singlish";
  if (langLabel === "tamil") langLabel = "tanglish";

  // Run the stateful stickiness checks on top of Gemini's/fallback detection
  if (!isFallback) {
    const stickinessResult = applyLanguagePreferenceStickiness(langLabel, langConf, message, history, conversationState);
    langLabel = stickinessResult.language;
    langConf = stickinessResult.confidence;
  }

  const langCode = (langLabel === "singlish") ? "si" :
                   (langLabel === "tanglish") ? "ta" : "en";

  // Resolve and lock conversational style (Friendly, Professional, Romantic, Sympathy)
  let personalityState = conversationState?.personalityState || "friendly";
  const normalizedLower = message ? message.toLowerCase().trim() : "";
  
  if (["machan", "mams", "dei", "da", "bro", "buddy", "super", "gethu", "baba"].some(w => normalizedLower.includes(w))) {
    personalityState = "friendly";
  } else if (["please", "kindly", "dear", "sir", "madam", "could you"].some(w => normalizedLower.includes(w))) {
    // If we are already friendly, we stick to it, otherwise we can use professional
    if (personalityState !== "friendly" && personalityState !== "romantic") {
      personalityState = "professional";
    }
  } else if (["love", "romantic", "wife", "girlfriend", "valantine", "sweetheart"].some(w => normalizedLower.includes(w))) {
    personalityState = "romantic";
  }

  // Persist updated language and personality fields to state DB
  if (conversationState && conversationState.sessionId) {
    try {
      conversationState.personalityState = personalityState;
      await saveConversationState(conversationState.sessionId, {
        preferredLanguage: conversationState.preferredLanguage,
        consecutiveMessagesInSameLanguage: conversationState.consecutiveMessagesInSameLanguage,
        lastDetectedLanguage: conversationState.lastDetectedLanguage,
        languageConfidence: conversationState.languageConfidence,
        personalityState: personalityState
      });
    } catch (err) {
      // Non-fatal logging
    }
  }

  const orderNumberMatch = message ? message.match(/\b((?:VPAY|VIMP|KAP-)[A-Z0-9-]+)\b/i) : null;
  const extractedOrderNumber = orderNumberMatch ? orderNumberMatch[1].toUpperCase() : null;

  const lowerMsg = message ? message.toLowerCase().trim() : "";
  const hasTrackingKeywords = message ? [
    "track", "status", "where is my", "where is order", "check my order", "check order", "where's my order"
  ].some(kw => lowerMsg.includes(kw)) : false;

  let intent = result.intent?.value || "general_chat";
  if (extractedOrderNumber || hasTrackingKeywords) {
    intent = "track_order";
  }

  const chat_subtype = result.intent?.chat_subtype || null;
  const emotion = result.emotion || "neutral";

  let conversationStage = result.conversationStage || "browsing";
  if (conversationState && conversationState.activeFlow) {
    conversationStage = conversationState.activeFlow.currentStep || conversationStage;
  }

  const tool = resolveToolDecision(intent);
  const situation = result.variables?.situation || "general";
  const { module, category, llm_response } = resolveResponseLibrary(intent, conversationStage, emotion, situation);
  
  if (intent === "general_chat" && chat_subtype) {
      // Ensure the Response Engine knows what sub-type to log and handle
      // This is passed back in _raw for workflow/response checks
  }

  const vars = result.variables || {};
  const variables = {
    city: String(vars.city || ""),
    delivery_date: String(vars.delivery_date || vars.deliveryDate || ""),
    product_name: String(vars.product_name || vars.productType || ""),
    phone_number: String(vars.phone_number || ""),
    customer_name: String(vars.customer_name || ""),
    recipient: String(vars.recipient || ""),
    occasion: String(vars.occasion || ""),
    brand: String(vars.brand || ""),
    category: String(vars.category || ""),
    price: String(vars.price || ""),
    orderNumber: String(vars.orderNumber || vars.order_number || extractedOrderNumber || "")
  };

  return {
    language: {
      detected: langLabel,
      code: langCode,
      confidence: langConf,
      reason: isFallback ? "heuristic_fallback" : "gemini_2.5_flash"
    },
    intent,
    chat_subtype,
    emotion,
    conversation_stage: conversationStage,
    tool,
    module,
    category,
    variables,
    llm_response: true,
    _raw: {
      emotionLabel: emotion,
      situation,
      urgency: vars.urgency || "normal"
    }
  };
}

// src/memory/contextEngine.mjs
// Relevance-scored memory context builder for AI prompt injection

import { getProfile, getMemorySummaryText } from "./memoryStore.mjs";
import logger from "../utils/logger.mjs";

const SHOPPING_INTENTS = new Set([
  "product_search", "gift_recommendation", "category_search",
  "product_filtering", "budget_queries", "delivery_queries",
  "recommendation_requests", "search_products", "get_product_details",
  "check_delivery", "create_order"
]);

/**
 * Whether memory should be injected for this intent.
 */
export function shouldUseMemory(intent) {
  if (!intent) return false;
  return SHOPPING_INTENTS.has(intent.trim().toLowerCase());
}

/**
 * Refined intent classification from raw message text.
 */
export function getMessageIntent(message, detectedIntent) {
  if (!message || typeof message !== "string") return detectedIntent || "general_chat";
  const t = message.trim().toLowerCase();

  if (["hi", "hello", "hey", "good morning", "good evening", "good night", "yo"].some(x => t.startsWith(x) || t === x))
    return "greetings";
  if (["thank", "thanks", "ty"].some(x => t.includes(x))) return "thank_you";
  if (["bye", "goodbye", "see you", "farewell"].some(x => t.includes(x))) return "farewell";
  if (["who are you", "what can you do", "help"].some(x => t.includes(x))) return "small_talk";
  if (["gift", "present", "surprise", "for my"].some(x => t.includes(x))) return "gift_recommendation";
  if (["search", "find", "show", "list", "buy", "purchase", "order", "get"].some(x => t.includes(x))) return "product_search";
  if (["category", "categories", "type of", "kind of"].some(x => t.includes(x))) return "category_search";
  if (["filter", "sort", "brand", "color", "size"].some(x => t.includes(x))) return "product_filtering";
  if (["budget", "price", "cost", "cheap", "expensive", "under", "lkr", "rs"].some(x => t.includes(x))) return "budget_queries";
  if (["deliver", "shipping", "send to", "colombo", "kandy"].some(x => t.includes(x))) return "delivery_queries";
  if (["recommend", "suggest", "popular", "best", "top"].some(x => t.includes(x))) return "recommendation_requests";

  if (detectedIntent) {
    if (detectedIntent === "search_products") return "product_search";
    if (detectedIntent === "check_delivery") return "delivery_queries";
    if (detectedIntent === "get_product_details") return "product_search";
    return detectedIntent;
  }
  return "general_chat";
}

function capitalize(str) {
  if (!str) return "";
  return str.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/**
 * Build a focused, token-efficient context string for the AI prompt.
 * Only injects fields relevant to the current intent.
 *
 * @param {string} sessionId
 * @param {string} intent - Classified intent type
 * @returns {Promise<string>} - Context block (max ~800 chars)
 */
export async function buildPersonalizedContext(sessionId, intent = "product_search") {
  try {
    const [profile, summaryText] = await Promise.all([
      getProfile(sessionId),
      getMemorySummaryText(sessionId)
    ]);

    const lines = [];

    if (profile) {
      const profileLines = [];

      // Always include these for shopping intents
      if (profile.favoriteCategories?.length)
        profileLines.push(`* Favorite Categories: ${profile.favoriteCategories.map(capitalize).join(", ")}`);
      if (profile.averageBudget != null)
        profileLines.push(`* Budget: Rs. ${profile.averageBudget} LKR`);

      // Include recipient/occasion for gift/recommendation intents
      const isGiftIntent = ["gift_recommendation", "recommendation_requests", "product_search"].includes(intent);
      if (isGiftIntent) {
        if (profile.favoriteRecipients?.length)
          profileLines.push(`* Recipient: ${profile.favoriteRecipients.map(capitalize).join(", ")}`);
        if (profile.favoriteOccasions?.length)
          profileLines.push(`* Occasion: ${profile.favoriteOccasions.map(capitalize).join(", ")}`);
      }

      // Include delivery cities for delivery intents
      if (intent === "delivery_queries" && profile.deliveryCities?.length)
        profileLines.push(`* Delivery Cities: ${profile.deliveryCities.map(capitalize).join(", ")}`);

      if (profileLines.length) {
        lines.push("User Profile:");
        lines.push(...profileLines);
      }
    }

    if (summaryText) {
      if (lines.length) lines.push("");
      lines.push("Memory Summary:");
      lines.push(summaryText);
    }

    if (!lines.length) return "";

    const ctx = lines.join("\n");
    // Safety cap at ~800 chars (~200 tokens)
    return ctx.length > 800 ? ctx.slice(0, 800) + "..." : ctx;
  } catch (err) {
    logger.error(`[ContextEngine] buildPersonalizedContext failed for ${sessionId}: ${err.message}`);
    return "";
  }
}

import UserProfile from "../../database/UserProfile.mjs";
import MemorySummary from "../../database/MemorySummary.mjs";

/**
 * Checks if the intent is shopping-related and memory-enabled.
 * @param {string} intent
 * @returns {boolean}
 */
export function shouldUseMemory(intent) {
  if (!intent) return false;
  
  const useMemoryIntents = [
    "product_search",
    "gift_recommendation",
    "category_search",
    "product_filtering",
    "budget_queries",
    "delivery_queries",
    "recommendation_requests",
    "search_products",
    "get_product_details",
    "check_delivery",
    "create_order"
  ];
  
  return useMemoryIntents.includes(intent.trim().toLowerCase());
}

/**
 * Maps/refines the intent from the user message if needed.
 * @param {string} message 
 * @param {string} detectedIntent 
 * @returns {string}
 */
export function getMessageIntent(message, detectedIntent) {
  if (!message || typeof message !== "string") return detectedIntent || "general_chat";
  
  const cleaned = message.trim().toLowerCase();
  
  // Check for greetings/farewells/thanks/small talk first
  if (["hi", "hello", "hey", "good morning", "good evening", "good night", "yo", "greeting"].some(x => cleaned.startsWith(x) || cleaned === x)) {
    return "greetings";
  }
  if (["thank", "thanks", "ty"].some(x => cleaned.includes(x))) {
    return "thank_you";
  }
  if (["bye", "goodbye", "see you", "farewell"].some(x => cleaned.includes(x))) {
    return "farewell";
  }
  if (["who are you", "what can you do", "help"].some(x => cleaned.includes(x))) {
    return "small_talk";
  }
  
  // Check for shopping intents
  if (["gift", "present", "surprise", "for my"].some(x => cleaned.includes(x))) {
    return "gift_recommendation";
  }
  if (["search", "find", "show", "list", "buy", "purchase", "order", "get"].some(x => cleaned.includes(x))) {
    return "product_search";
  }
  if (["category", "categories", "type of", "kind of"].some(x => cleaned.includes(x))) {
    return "category_search";
  }
  if (["filter", "sort", "brand", "color", "size"].some(x => cleaned.includes(x))) {
    return "product_filtering";
  }
  if (["budget", "price", "cost", "cheap", "expensive", "under", "lkr", "rs"].some(x => cleaned.includes(x))) {
    return "budget_queries";
  }
  if (["deliver", "shipping", "send to", "colombo", "kandy"].some(x => cleaned.includes(x))) {
    return "delivery_queries";
  }
  if (["recommend", "suggest", "popular", "best", "top"].some(x => cleaned.includes(x))) {
    return "recommendation_requests";
  }
  
  // Default fallbacks for system intents
  if (detectedIntent) {
    if (detectedIntent === "search_products") return "product_search";
    if (detectedIntent === "check_delivery") return "delivery_queries";
    if (detectedIntent === "get_product_details") return "product_search";
    return detectedIntent;
  }
  
  return "general_chat";
}

/**
 * Capitalizes words in a string.
 * @param {string} str 
 * @returns {string}
 */
function capitalize(str) {
  if (!str) return "";
  return str.split(" ").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

/**
 * Builds a compact context block under 250 tokens from user profile and current memory summary.
 * @param {string} sessionId
 * @returns {Promise<string>}
 */
export async function buildPersonalizedContext(sessionId) {
  try {
    // Limit reads: 1 UserProfile read, 1 MemorySummary read (excluding other summaries via projection)
    const [profile, summaryDoc] = await Promise.all([
      UserProfile.findOne({ sessionId }).lean().exec(),
      MemorySummary.findOne({ sessionId }, { currentSummary: 1 }).lean().exec()
    ]);

    let lines = [];

    if (profile) {
      const profileLines = [];
      if (profile.favoriteCategories && profile.favoriteCategories.length > 0) {
        const cats = profile.favoriteCategories.map(c => capitalize(c)).join(", ");
        profileLines.push(`* Favorite Categories: ${cats}`);
      }
      if (profile.averageBudget !== null && profile.averageBudget !== undefined) {
        profileLines.push(`* Average Budget: ${profile.averageBudget} LKR`);
      }
      if (profile.favoriteRecipients && profile.favoriteRecipients.length > 0) {
        const recs = profile.favoriteRecipients.map(r => capitalize(r)).join(", ");
        profileLines.push(`* Preferred Recipient: ${recs}`);
      }
      if (profile.favoriteOccasions && profile.favoriteOccasions.length > 0) {
        const occs = profile.favoriteOccasions.map(o => capitalize(o)).join(", ");
        profileLines.push(`* Preferred Occasion: ${occs}`);
      }

      if (profileLines.length > 0) {
        lines.push("User Profile:");
        lines.push(...profileLines);
      }
    }

    if (summaryDoc && summaryDoc.currentSummary) {
      if (lines.length > 0) {
        lines.push(""); // separation line
      }
      lines.push("Memory Summary:");
      lines.push(summaryDoc.currentSummary);
    }

    if (lines.length === 0) {
      return "";
    }

    const context = lines.join("\n");
    
    // Strict safety check for length. 250 tokens is roughly 1000 characters.
    if (context.length > 1000) {
      return context.slice(0, 1000) + "...";
    }
    
    return context;
  } catch (error) {
    // Fail Safe Behavior: Never block user requests, never throw visible errors.
    console.error(`[Context Builder Error] Failed to build context for session ${sessionId}:`, error);
    return "";
  }
}

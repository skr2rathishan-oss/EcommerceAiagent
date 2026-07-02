import logger from "../../utils/logger.mjs";
import { GREETINGS_BLACKLIST, STOP_WORDS, SUPPORTED_CATEGORIES } from "./giftPlannerKnowledge.mjs";
import { normalizeCategoryAndBrand, isSupportedCategory } from "./giftPlannerNormalizer.mjs";

function isMeaningfulCandidate(candidate = "") {
  const trimmed = String(candidate || "").trim();
  if (!trimmed) return false;

  const words = trimmed.split(/\s+/);
  if (words.length > 3) return false;

  const lower = trimmed.toLowerCase();
  const hasStopWord = words.some((word) => STOP_WORDS.has(word.toLowerCase()));

  return !hasStopWord;
}

/**
 * State-aware fallback mission item extraction from raw message text.
 *
 * @param {string} message       - The user message.
 * @param {Array}  currentItems  - Existing mission items.
 * @param {object} plannerContext - { currentStep, occasion, recipient, budget }.
 * @returns {Array} Mission items list.
 */
export function extractMissionItemsFallback(message = "", currentItems = [], plannerContext = {}) {
  const list = [...currentItems];

  // ── STATE GATE: Only parse categories when collecting categories ──
  const step = plannerContext.currentStep || "";
  if (step && step !== "Collecting Categories" && step !== "Ready") {
    logger.info(
      `[GiftPlanner] Fallback parser skipped\n` +
      `  Current Collection Step: ${step}\n` +
      `  Decision: Ignored (not collecting categories)`
    );
    return list;
  }

  const addOrMergeItem = (candidate) => {
    if (!candidate) return;
    const lowerCandidate = candidate.trim().toLowerCase();
    if (GREETINGS_BLACKLIST.has(lowerCandidate)) return;

    const { category, brand } = normalizeCategoryAndBrand(candidate);

    // Only accept recognized, supported categories
    if (!category || !isSupportedCategory(category)) {
      logger.info(
        `[GiftPlanner] Fallback candidate rejected\n` +
        `  Candidate: "${candidate}"\n` +
        `  Resolved Category: ${category || "(null)"}\n` +
        `  Decision: Ignored (not a supported category)`
      );
      return;
    }

    // Must not match occasion or recipient
    if (plannerContext.occasion && category.toLowerCase() === plannerContext.occasion.toLowerCase()) return;
    if (plannerContext.recipient && category.toLowerCase() === plannerContext.recipient.toLowerCase()) return;

    const existingIndex = list.findIndex((item) => item.category === category);

    if (existingIndex !== -1) {
      if (brand && !list[existingIndex].brand) {
        list[existingIndex].brand = brand;
      }
    } else {
      list.push({
        id: `item_${Math.random().toString(36).substring(2, 9)}`,
        category,
        brand,
        budget: null,
        status: "pending",
        selectedProduct: null,
        searchCompleted: false,
        searchResults: []
      });
    }
  };

  const lowerMsg = String(message || "").toLowerCase();

  const addMatch = lowerMsg.match(/\badd\s+([^,\.\n]+)/i);
  if (addMatch) {
    let candidate = addMatch[1].trim();
    const prepMatch = candidate.match(/^(.+?)\s+\b(?:to|into|for|on|in|with)\b/i);
    if (prepMatch) {
      candidate = prepMatch[1].trim();
    }

    if (candidate) {
      if (candidate.includes(" and ")) {
        candidate.split(" and ").forEach(addOrMergeItem);
      } else {
        addOrMergeItem(candidate);
      }
    }
    return list;
  }

  const parts = String(message || "").split(/[.,\n]/);
  parts.forEach((part) => {
    const cleanPart = part.trim();
    if (!cleanPart || !isMeaningfulCandidate(cleanPart)) return;
    addOrMergeItem(cleanPart);
  });

  return list;
}

export function extractWithFallback(message = "", culVars = {}, currentItems = [], plannerContext = {}) {
  const lowerMsg = String(message || "").toLowerCase();

  const hasStructuredValues = Boolean(
    (culVars?.occasion && culVars.occasion !== "null") ||
    (culVars?.recipient && culVars.recipient !== "null") ||
    (culVars?.price && culVars.price !== "null") ||
    (culVars?.budget && culVars.budget !== "null") ||
    (culVars?.category && culVars.category !== "null")
  );

  if (hasStructuredValues) {
    logger.info("[GiftPlanner] CUL provided structured values; fallback parser skipped");
    return null;
  }

  const fallbackItems = extractMissionItemsFallback(message, currentItems, plannerContext);
  const fallbackMessage = lowerMsg.includes("gift") || lowerMsg.includes("buy") || lowerMsg.includes("need") || lowerMsg.includes("want") || fallbackItems.length > 0;

  if (!fallbackMessage) {
    return null;
  }

  return { missionItems: fallbackItems };
}

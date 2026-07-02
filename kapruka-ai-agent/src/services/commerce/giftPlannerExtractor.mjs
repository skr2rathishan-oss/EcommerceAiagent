/**
 * giftPlannerExtractor.mjs
 *
 * STATE-AWARE extraction layer for the Gift Planner.
 * Accepts a lightweight plannerContext to determine which collection phase is active.
 * Categories are ONLY extracted when the planner is actually collecting categories.
 *
 * plannerContext shape:
 *   {
 *     currentStep: string,     // e.g. "Collecting Occasion", "Collecting Categories", "Ready"
 *     occasion:    string|null,
 *     recipient:   string|null,
 *     budget:      number|null
 *   }
 */

import logger from "../../utils/logger.mjs";
import { OCCASION_ALIASES, RECIPIENT_ALIASES, SUPPORTED_CATEGORIES } from "./giftPlannerKnowledge.mjs";
import {
  normalizeBudgetAndCurrency,
  normalizeCategoryAndBrand as normalizeCategoryAndBrandCore,
  normalizeOccasion,
  normalizeRecipient,
  isSupportedCategory
} from "./giftPlannerNormalizer.mjs";
import { extractMissionItemsFallback } from "./giftPlannerFallback.mjs";

// ── Helpers ────────────────────────────────────────────────────────────

function getCulValue(culVars = {}, key) {
  const value = culVars?.[key];
  if (!value || value === "null") return null;
  return String(value);
}

/**
 * Determine whether the planner is currently in the "Collecting Categories" phase.
 * Categories are allowed ONLY when occasion, recipient, and budget are all present.
 */
function isCollectingCategories(ctx) {
  if (!ctx) return false;

  // Explicit step-based check (preferred)
  if (ctx.currentStep === "Collecting Categories" || ctx.currentStep === "Ready") {
    return true;
  }

  // Fallback: infer from field presence
  return Boolean(ctx.occasion && ctx.recipient && ctx.budget);
}

/**
 * Build a structured log entry for extraction decisions.
 */
function logExtractionDecision({ currentStep, culValue, fieldName, decision, reason }) {
  logger.info(
    `[GiftPlanner] Extraction Decision\n` +
    `  Current Collection Step: ${currentStep || "Unknown"}\n` +
    `  ${fieldName}: ${culValue || "(empty)"}\n` +
    `  Decision: ${decision}${reason ? ` (${reason})` : ""}`
  );
}

// ── Core extraction functions ──────────────────────────────────────────

export function normalizeCategoryAndBrand(candidate = "") {
  return normalizeCategoryAndBrandCore(candidate);
}

export function extractOccasion(message = "", culVars = {}) {
  const culOccasion = getCulValue(culVars, "occasion");
  if (culOccasion) {
    return normalizeOccasion(culOccasion);
  }

  const lowerMsg = String(message || "").toLowerCase();
  for (const [key, value] of Object.entries(OCCASION_ALIASES)) {
    if (lowerMsg.includes(key)) {
      return value;
    }
  }

  return null;
}

export function extractRecipient(message = "", culVars = {}) {
  const culRecipient = getCulValue(culVars, "recipient");
  if (culRecipient) {
    return normalizeRecipient(culRecipient);
  }

  const lowerMsg = String(message || "").toLowerCase();
  for (const [key, value] of Object.entries(RECIPIENT_ALIASES)) {
    if (new RegExp(`\\b${key}\\b`, "i").test(lowerMsg)) {
      return value;
    }
  }

  return null;
}

export function extractBudgetAndCurrency(message = "", culVars = {}) {
  return normalizeBudgetAndCurrency(message, culVars);
}

// ── Mission Item Merging (with validation) ─────────────────────────────

/**
 * Validates and merges a candidate category into the mission items list.
 * Rejects the candidate if:
 *   - category is null (not a known category)
 *   - category is not in SUPPORTED_CATEGORIES
 *   - category matches the current occasion or recipient
 *   - category is already present in the list (duplicate)
 *
 * @param {Array} list       - Current mission items list (mutated in place).
 * @param {string} candidate - Raw candidate text.
 * @param {object} ctx       - plannerContext with occasion/recipient.
 * @returns {Array} The (possibly updated) list.
 */
export function mergeMissionItem(list, candidate, ctx = {}) {
  if (!candidate) return list;

  const lowerCandidate = candidate.trim().toLowerCase();

  // Greeting guard
  if (["hi", "hello", "hey", "hola", "namaste", "vanakkam"].includes(lowerCandidate)) {
    return list;
  }

  const { category, brand } = normalizeCategoryAndBrandCore(candidate);

  // Gate 1: category must be recognized
  if (!category) {
    logExtractionDecision({
      currentStep: ctx.currentStep,
      culValue: candidate,
      fieldName: "CUL Category",
      decision: "Ignored",
      reason: "not a recognized category"
    });
    return list;
  }

  // Gate 2: must be in SUPPORTED_CATEGORIES allowlist
  if (!isSupportedCategory(category)) {
    logExtractionDecision({
      currentStep: ctx.currentStep,
      culValue: candidate,
      fieldName: "CUL Category",
      decision: "Ignored",
      reason: `"${category}" is not in SUPPORTED_CATEGORIES`
    });
    return list;
  }

  // Gate 3: must not match occasion
  if (ctx.occasion && category.toLowerCase() === ctx.occasion.toLowerCase()) {
    logExtractionDecision({
      currentStep: ctx.currentStep,
      culValue: candidate,
      fieldName: "CUL Category",
      decision: "Ignored",
      reason: "identical to occasion"
    });
    return list;
  }

  // Gate 4: must not match recipient
  if (ctx.recipient && category.toLowerCase() === ctx.recipient.toLowerCase()) {
    logExtractionDecision({
      currentStep: ctx.currentStep,
      culValue: candidate,
      fieldName: "CUL Category",
      decision: "Ignored",
      reason: "identical to recipient"
    });
    return list;
  }

  // Gate 5: no duplicates
  const existingIndex = list.findIndex((item) => item.category === category);
  if (existingIndex !== -1) {
    if (brand && !list[existingIndex].brand) {
      list[existingIndex].brand = brand;
    }
    return list;
  }

  // All gates passed — add the item
  logExtractionDecision({
    currentStep: ctx.currentStep,
    culValue: candidate,
    fieldName: "CUL Category",
    decision: "Accepted",
    reason: null
  });

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

  return list;
}

// ── State-Aware Mission Item Extraction ────────────────────────────────

/**
 * Extract mission items from message/CUL — but ONLY when the planner
 * is in the category-collection phase.
 *
 * @param {string} message      - User message.
 * @param {Array}  currentItems - Existing mission items.
 * @param {object} culVars      - CUL extracted variables.
 * @param {object} plannerContext - { currentStep, occasion, recipient, budget }.
 * @returns {Array} Mission items list.
 */
export function extractMissionItems(message = "", currentItems = [], culVars = {}, plannerContext = {}) {
  const list = [...currentItems];

  // ── STATE GATE: Do NOT extract categories while collecting occasion/recipient/budget ──
  if (!isCollectingCategories(plannerContext)) {
    const culCategory = getCulValue(culVars, "category");
    const culProductName = getCulValue(culVars, "product_name");

    if (culCategory || culProductName) {
      logExtractionDecision({
        currentStep: plannerContext.currentStep || "Pre-Category",
        culValue: culCategory || culProductName,
        fieldName: "CUL Category",
        decision: "Ignored",
        reason: "not collecting categories yet"
      });
    }

    return list;
  }

  // ── We are in category collection phase — proceed with extraction ──

  const culCategory = getCulValue(culVars, "category");
  if (culCategory) {
    mergeMissionItem(list, culCategory, plannerContext);
    return list;
  }

  const culProductName = getCulValue(culVars, "product_name");
  if (culProductName) {
    mergeMissionItem(list, culProductName, plannerContext);
    return list;
  }

  // Fallback parsing — also state-aware
  return extractMissionItemsFallback(message, list, plannerContext);
}

// ── Main Orchestrator ──────────────────────────────────────────────────

/**
 * Extract all Gift Planner fields from the current message/CUL.
 *
 * @param {string} message       - User message.
 * @param {object} culVars       - CUL extracted variables.
 * @param {Array}  currentItems  - Existing mission items.
 * @param {object} plannerContext - Lightweight context: { currentStep, occasion, recipient, budget }.
 *                                  If omitted, a context is inferred from the extracted fields.
 * @returns {object} { occasion, recipient, budget, currency, missionItems }
 */
export function extractGiftPlannerData(message = "", culVars = {}, currentItems = [], plannerContext = null) {
  const occasion = extractOccasion(message, culVars);
  const recipient = extractRecipient(message, culVars);
  const { budget, currency } = extractBudgetAndCurrency(message, culVars);

  // Build or refine plannerContext so extractMissionItems can gate properly
  const ctx = plannerContext || inferPlannerContext({ occasion, recipient, budget, currentItems });

  const missionItems = extractMissionItems(message, currentItems, culVars, ctx);

  return {
    occasion,
    recipient,
    budget,
    currency,
    missionItems
  };
}

/**
 * Infer a plannerContext from the fields we have extracted so far.
 * This is the fallback when the caller does not pass an explicit context.
 */
function inferPlannerContext({ occasion, recipient, budget, currentItems }) {
  let currentStep;

  if (!occasion) {
    currentStep = "Collecting Occasion";
  } else if (!recipient) {
    currentStep = "Collecting Recipient";
  } else if (!budget) {
    currentStep = "Collecting Budget";
  } else if (!currentItems || currentItems.length === 0) {
    currentStep = "Collecting Categories";
  } else {
    currentStep = "Ready";
  }

  return { currentStep, occasion, recipient, budget };
}

// ── Replacement / Modification Handling ────────────────────────────────

export function checkAndHandleReplacement(message = "", mission = {}) {
  const lower = String(message || "").toLowerCase();
  const items = mission.missionItems || [];

  if (lower.includes("budget") || lower.includes("price") || lower.includes("increase") || lower.includes("change")) {
    const { budget: newBudget } = extractBudgetAndCurrency(message, {});
    if (newBudget && newBudget !== mission.budget) {
      logger.info(`[GiftPlanner] Successfully updated budget from ${mission.budget} to ${newBudget}`);
      mission.budget = newBudget;
      mission.remainingBudget = newBudget;
      items.forEach((item) => {
        item.budget = null;
      });
      return true;
    }
  }

  if (items.length === 0) return false;

  if (lower.includes("remove") || lower.includes("delete") || lower.includes("discard")) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const catLower = String(item.category).toLowerCase();
      if (
        lower.includes(catLower) ||
        (catLower === "phone" && (lower.includes("mobile") || lower.includes("cellphone") || lower.includes("phone"))) ||
        (catLower === "jewellery" && (lower.includes("jewelry") || lower.includes("necklace") || lower.includes("jewellery"))) ||
        (catLower.includes("dress") && lower.includes("dress")) ||
        (catLower === "personal care" && (lower.includes("earbuds") || lower.includes("personal")))
      ) {
        logger.info(`[GiftPlanner] Successfully removed mission item: ${item.category}`);
        mission.missionItems.splice(i, 1);
        return true;
      }
    }
  }

  const replaceKeywords = ["replace", "change", "show more", "reset", "different"];
  const hasReplace = replaceKeywords.some((keyword) => lower.includes(keyword));

  if (hasReplace) {
    for (const item of items) {
      const catLower = String(item.category).toLowerCase();
      if (
        lower.includes(catLower) ||
        (catLower === "phone" && (lower.includes("mobile") || lower.includes("cellphone"))) ||
        (catLower === "jewellery" && (lower.includes("jewelry") || lower.includes("necklace"))) ||
        (catLower === "personal care" && (lower.includes("earbuds") || lower.includes("personal"))) ||
        (catLower === "silk dress" && lower.includes("dress"))
      ) {
        item.selectedProduct = null;
        item.searchCompleted = false;
        item.status = "pending";
        item.searchResults = [];
        item.recommendedProducts = [];
        logger.info(`[GiftPlanner] Successfully reset mission item category for replacement: ${item.category}`);
        return true;
      }
    }
  }

  return false;
}

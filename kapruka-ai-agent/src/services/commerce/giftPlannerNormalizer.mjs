import { CATEGORY_ALIASES, CATEGORY_PATTERNS, CURRENCY_ALIASES, OCCASION_ALIASES, RECIPIENT_ALIASES, BRAND_ALIASES, SUPPORTED_CATEGORIES } from "./giftPlannerKnowledge.mjs";

function normalizeTokens(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Check whether a normalized category string is in the SUPPORTED_CATEGORIES allowlist.
 * @param {string} category - The normalized category name (e.g. "Phone", "Jewellery").
 * @returns {boolean}
 */
export function isSupportedCategory(category) {
  if (!category) return false;
  return SUPPORTED_CATEGORIES.has(category);
}

/**
 * Attempt to normalize a candidate string into a known shopping category.
 * Returns the canonical category name if recognized, or NULL if the candidate
 * does not match any known alias or pattern. Never invents categories.
 *
 * @param {string} candidate - Raw user/CUL input (e.g. "cellphone", "jewellery").
 * @returns {string|null} Canonical category name or null.
 */
export function normalizeCategory(candidate = "") {
  const normalized = normalizeTokens(candidate);
  if (!normalized) return null;

  // 1. Direct alias lookup
  const direct = CATEGORY_ALIASES[normalized];
  if (direct) return direct;

  // 2. Pattern-based lookup
  for (const { pattern, category } of CATEGORY_PATTERNS) {
    if (pattern.test(normalized)) return category;
  }

  // 3. Unknown text — return null instead of inventing a category
  return null;
}

export function normalizeBrand(candidate = "") {
  const normalized = normalizeTokens(candidate);
  if (!normalized) return null;

  for (const alias of BRAND_ALIASES) {
    if (normalized.includes(alias)) {
      return alias.charAt(0).toUpperCase() + alias.slice(1);
    }
  }

  return null;
}

export function normalizeCategoryAndBrand(candidate = "") {
  const category = normalizeCategory(candidate);
  const brand = normalizeBrand(candidate);
  return { category, brand };
}

export function normalizeOccasion(value = "") {
  const normalized = normalizeTokens(value);
  if (!normalized) return null;

  const direct = OCCASION_ALIASES[normalized];
  if (direct) return direct;

  return String(value)
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function normalizeRecipient(value = "") {
  const normalized = normalizeTokens(value);
  if (!normalized) return null;

  const direct = RECIPIENT_ALIASES[normalized];
  if (direct) return direct;

  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

export function normalizeBudgetAndCurrency(message = "", culVars = {}) {
  let budget = null;
  let currency = "LKR";

  const culBudget = culVars.price || culVars.budget;
  if (culBudget && culBudget !== "null") {
    const parsed = parseFloat(String(culBudget).replace(/[^0-9.]/g, ""));
    if (!Number.isNaN(parsed)) {
      budget = parsed;
    }
  }

  const lowerMsg = message.toLowerCase().replace(/,/g, "");
  const currencyMatch = lowerMsg.match(/\b(?:usd|\$)\b/);
  if (currencyMatch) {
    currency = "USD";
  } else {
    const currencyAlias = Object.entries(CURRENCY_ALIASES).find(([alias]) => lowerMsg.includes(alias));
    if (currencyAlias) {
      currency = currencyAlias[1];
    }
  }

  if (budget === null) {
    const patterns = [
      /\b(?:budget|price|under|below|around|limit|max)\s*(?:is)?\s*(\d+)\b/i,
      /\b(?:lkr|rs|usd|\$)\s*(\d+)\b/i,
      /\b(\d+)\s*(?:lkr|rs|usd|rupees|dollars)\b/i
    ];

    for (const pattern of patterns) {
      const match = lowerMsg.match(pattern);
      if (match) {
        budget = parseFloat(match[1]);
        break;
      }
    }
  }

  if (budget === null) {
    const standalones = lowerMsg.match(/\b\d+\b/g);
    if (standalones) {
      for (const value of standalones) {
        const parsed = parseFloat(value);
        if (parsed >= 100) {
          budget = parsed;
          break;
        }
      }
    }
  }

  return { budget, currency };
}

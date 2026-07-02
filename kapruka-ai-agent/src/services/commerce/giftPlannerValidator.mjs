/**
 * giftPlannerValidator.mjs
 *
 * Dedicated Mission Validator for the Gift Planner.
 * Handles validation and standardizes Shopping Mission status values and steps.
 */

import { buildReferenceIndex } from "../../agent/reference/01_selectionMemory.mjs";

// 1. Standardized Shopping Mission status enums/constants
export const MISSION_STATUS = Object.freeze({
  CREATED: "CREATED",
  COLLECTING_INFORMATION: "COLLECTING_INFORMATION",
  READY_FOR_SEARCH: "READY_FOR_SEARCH",
  SEARCHING: "SEARCHING",
  SELECTING_PRODUCTS: "SELECTING_PRODUCTS",
  READY_FOR_CHECKOUT: "READY_FOR_CHECKOUT",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED"
});

/**
 * Validates a Shopping Mission object and returns ready flag, missing fields, and the next step.
 * 
 * @param {object} mission - The Shopping Mission object
 * @returns {object} { ready: boolean, missingFields: string[], nextStep: string }
 */
export function validateShoppingMission(mission = {}) {
  const missingFields = [];
  
  if (!mission.occasion) {
    missingFields.push("occasion");
  }
  if (!mission.recipient) {
    missingFields.push("recipient");
  }
  if (!mission.budget || isNaN(parseFloat(mission.budget))) {
    missingFields.push("budget");
  }
  
  const items = mission.missionItems || [];
  if (items.length === 0) {
    missingFields.push("missionItems");
  }

  const ready = missingFields.length === 0;

  // Progression step mapping:
  let nextStep = "Ready";
  if (missingFields.includes("occasion")) {
    nextStep = "Collecting Occasion";
  } else if (missingFields.includes("recipient")) {
    nextStep = "Collecting Recipient";
  } else if (missingFields.includes("budget")) {
    nextStep = "Collecting Budget";
  } else if (missingFields.includes("missionItems")) {
    nextStep = "Collecting Categories";
  }

  return {
    ready,
    missingFields,
    nextStep
  };
}

/**
 * Validates search results using Reference Index and active item metadata.
 * Keeps a single source of truth for categories, brands, and search terms.
 * 
 * @param {Array} products - Returned products array
 * @param {Object} activeItem - Active Shopping Mission item
 * @returns {Array} List of validated matching products
 */
export function verifyProductsMatchCategory(products = [], activeItem = {}) {
  if (!Array.isArray(products) || products.length === 0) return [];
  if (!activeItem || !activeItem.category) return products;

  const targetCategory = activeItem.category.toLowerCase().trim();
  const targetBrand = activeItem.brand ? activeItem.brand.toLowerCase().trim() : null;

  // Build the Reference Index on the products as our single source of truth
  const refIndex = buildReferenceIndex(products);

  return products.filter((product, idx) => {
    const indexed = refIndex.products[idx];
    if (!indexed) return false;

    // Direct category inclusion
    const catMatch = indexed.category.includes(targetCategory) || targetCategory.includes(indexed.category);

    // Term match check
    const termMatch = indexed.searchableTerms.includes(targetCategory);

    // If targetBrand is specified, check brand matching (optional/relaxed filter)
    let brandMatch = true;
    if (targetBrand) {
      brandMatch = indexed.brand.includes(targetBrand) || targetBrand.includes(indexed.brand) || indexed.searchableTerms.includes(targetBrand);
    }

    if (catMatch || termMatch) {
      return brandMatch;
    }

    // Fallback: check synonyms/plurals using the Reference Index categories index
    if (refIndex.categories[targetCategory]?.includes(idx)) {
      return brandMatch;
    }

    // Standard synonym & word pluralization rules
    if (targetCategory === "phone" || targetCategory === "mobile" || targetCategory === "smartphone" || targetCategory === "cellphone") {
      if (indexed.category.includes("phone") || indexed.category.includes("mobile") || indexed.searchableTerms.includes("phone") || indexed.searchableTerms.includes("mobile") || indexed.searchableTerms.includes("iphone") || indexed.searchableTerms.includes("samsung")) return brandMatch;
    }
    if (targetCategory === "watch" || targetCategory === "watches") {
      if (indexed.category.includes("watch") || indexed.searchableTerms.includes("watch") || indexed.searchableTerms.includes("casio") || indexed.searchableTerms.includes("g-shock") || indexed.searchableTerms.includes("rolex")) return brandMatch;
    }
    if (targetCategory === "shirt" || targetCategory === "shirts" || targetCategory === "clothes" || targetCategory === "clothing" || targetCategory === "dress" || targetCategory === "silk dress") {
      if (indexed.category.includes("shirt") || indexed.category.includes("apparel") || indexed.category.includes("fashion") || indexed.category.includes("dress") || indexed.searchableTerms.includes("shirt") || indexed.searchableTerms.includes("dress") || indexed.searchableTerms.includes("clothing") || indexed.category.includes("clothing")) return brandMatch;
    }
    if (targetCategory === "shoes" || targetCategory === "shoe" || targetCategory === "footwear") {
      if (indexed.category.includes("shoe") || indexed.category.includes("footwear") || indexed.searchableTerms.includes("shoe") || indexed.searchableTerms.includes("sneaker")) return brandMatch;
    }
    if (targetCategory === "flowers" || targetCategory === "flower" || targetCategory === "bouquet" || targetCategory === "blossom") {
      if (indexed.category.includes("flower") || indexed.category.includes("bouquet") || indexed.searchableTerms.includes("flower") || indexed.searchableTerms.includes("rose") || indexed.searchableTerms.includes("bouquet") || indexed.searchableTerms.includes("blossom")) return brandMatch;
    }
    if (targetCategory === "perfume" || targetCategory === "perfumes" || targetCategory === "fragrance") {
      if (indexed.category.includes("perfume") || indexed.category.includes("fragrance") || indexed.searchableTerms.includes("perfume") || indexed.searchableTerms.includes("cologne") || indexed.searchableTerms.includes("fragrance")) return brandMatch;
    }
    if (targetCategory === "cake" || targetCategory === "cakes") {
      if (indexed.category.includes("cake") || indexed.category.includes("gateau") || indexed.searchableTerms.includes("cake") || indexed.searchableTerms.includes("gateau")) return brandMatch;
    }
    if (targetCategory === "jewellery" || targetCategory === "jewelry" || targetCategory === "necklace" || targetCategory === "gold") {
      if (indexed.category.includes("jewel") || indexed.category.includes("necklace") || indexed.searchableTerms.includes("jewel") || indexed.searchableTerms.includes("gold") || indexed.searchableTerms.includes("pendant")) return brandMatch;
    }
    if (targetCategory === "chocolate" || targetCategory === "chocolates") {
      if (indexed.category.includes("chocolate") || indexed.searchableTerms.includes("chocolate") || indexed.searchableTerms.includes("cadbury") || indexed.searchableTerms.includes("toblerone")) return brandMatch;
    }
    if (targetCategory === "personal care" || targetCategory === "earbuds") {
      if (indexed.category.includes("care") || indexed.searchableTerms.includes("earbud") || indexed.searchableTerms.includes("buds") || indexed.searchableTerms.includes("care")) return brandMatch;
    }

    return false;
  });
}

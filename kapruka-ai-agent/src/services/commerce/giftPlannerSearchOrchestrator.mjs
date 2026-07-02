/**
 * giftPlannerSearchOrchestrator.mjs
 *
 * Dedicated Gift Planner Search Orchestrator.
 * Responsible for Budget Allocation, clean Search Query Building, Guided Sequential Search,
 * Price/Brand Filtering with Graceful Constraint Relaxation, Product Ranking,
 * and Reference Memory Registration.
 */

import { searchProducts } from "../integration/mcp.service.mjs";
import { rememberSearchResults } from "../../agent/reference/05_referenceManager.mjs";
import { validateShoppingMission, MISSION_STATUS, verifyProductsMatchCategory } from "./giftPlannerValidator.mjs";
import logger from "../../utils/logger.mjs";

// Typical category weight pricing on Kapruka (in LKR)
const TYPICAL_PRICING_MAP = {
  "Phone": 150000,
  "Watch": 25000,
  "Shirt": 8000,
  "Shoes": 15000,
  "Flowers": 8000,
  "Perfume": 20000,
  "Cake": 6000,
  "Jewellery": 30000,
  "Chocolate": 5000
};
const DEFAULT_PRICE_WEIGHT = 10000;

/**
 * AI Budget Planner: Distributes unallocated total budget proportionally across remaining mission items.
 * 
 * @param {object} mission - The Shopping Mission object
 * @returns {object} Updated Shopping Mission
 */
export function allocateMissionBudgets(mission = {}) {
  const totalBudget = parseFloat(mission.budget);
  if (isNaN(totalBudget) || totalBudget <= 0) return mission;

  const items = mission.missionItems || [];
  if (items.length === 0) return mission;

  // 1. Calculate unallocated budget
  let allocatedSum = 0;
  const unallocatedItems = [];

  items.forEach(item => {
    const b = parseFloat(item.budget);
    if (!isNaN(b) && b > 0) {
      allocatedSum += b;
    } else {
      unallocatedItems.push(item);
    }
  });

  const remainingToAllocate = Math.max(0, totalBudget - allocatedSum);

  // 2. Proportionally distribute remaining total budget to unallocated items
  if (unallocatedItems.length > 0) {
    if (remainingToAllocate > 0) {
      // Get sum of weights
      const totalWeight = unallocatedItems.reduce((sum, item) => {
        const weight = TYPICAL_PRICING_MAP[item.category] || DEFAULT_PRICE_WEIGHT;
        return sum + weight;
      }, 0);

      unallocatedItems.forEach(item => {
        const weight = TYPICAL_PRICING_MAP[item.category] || DEFAULT_PRICE_WEIGHT;
        const ratio = totalWeight > 0 ? weight / totalWeight : 1 / unallocatedItems.length;
        // Allocate and round to nearest LKR
        item.budget = Math.round(ratio * remainingToAllocate);
      });
    } else {
      // Total budget is already exhausted or zero, allocate 0 to remaining
      unallocatedItems.forEach(item => {
        item.budget = 0;
      });
    }
  }

  return mission;
}

/**
 * Clean search query builder for a mission item.
 */
export function buildSearchQuery(item = {}) {
  const brandPart = item.brand ? `${item.brand} ` : "";
  return `${brandPart}${item.category}`.trim();
}

/**
 * Filter products based on budget and brand.
 * Gracefully relaxes constraints if zero matches occur.
 */
export function filterProducts(products = [], budget = null, brand = null) {
  if (!Array.isArray(products) || products.length === 0) return [];

  // Helper to safely extract price
  const getPrice = (p) => {
    if (typeof p.price === "object" && p.price && p.price.amount !== undefined) {
      return parseFloat(p.price.amount);
    }
    return parseFloat(p.price || p.salePrice || 0);
  };

  const getBrand = (p) => String(p.brand || "").toLowerCase().trim();
  const targetBrandLower = brand ? String(brand).toLowerCase().trim() : null;

  // 1. Try Strict Filter (Price <= Budget AND Brand match if specified)
  let filtered = products.filter(p => {
    const priceVal = getPrice(p);
    const priceOk = budget ? priceVal <= budget : true;
    const brandOk = targetBrandLower ? getBrand(p).includes(targetBrandLower) : true;
    return priceOk && brandOk;
  });

  // 2. Fallback: Relax price constraint by 30% if zero matches
  if (filtered.length === 0 && budget) {
    const relaxedBudget = budget * 1.3;
    filtered = products.filter(p => {
      const priceVal = getPrice(p);
      const priceOk = priceVal <= relaxedBudget;
      const brandOk = targetBrandLower ? getBrand(p).includes(targetBrandLower) : true;
      return priceOk && brandOk;
    });
  }

  // 3. Fallback: Relax brand constraint (Price <= relaxedBudget, drop brand)
  if (filtered.length === 0 && budget) {
    const relaxedBudget = budget * 1.3;
    filtered = products.filter(p => {
      const priceVal = getPrice(p);
      return priceVal <= relaxedBudget;
    });
  }

  // 4. Last resort: Return original unfiltered search list if still empty
  if (filtered.length === 0) {
    filtered = products;
  }

  return filtered;
}

/**
 * Scores and ranks returned products based on budget proximity and specifications.
 */
export function rankProducts(products = [], budget = null, brand = null) {
  if (!Array.isArray(products) || products.length === 0) return [];

  const getPrice = (p) => {
    if (typeof p.price === "object" && p.price && p.price.amount !== undefined) {
      return parseFloat(p.price.amount);
    }
    return parseFloat(p.price || p.salePrice || 0);
  };

  const scoredProducts = products.map(p => {
    const priceVal = getPrice(p);
    let score = 0;

    // A. Budget scoring
    if (budget && priceVal > 0) {
      if (priceVal <= budget) {
        // High score if price is close to budget (ideal value-for-money fit)
        score += 1.0 - (budget - priceVal) / budget;
      } else {
        // Penalize heavily if price exceeds budget
        score += Math.max(-2.0, 1.0 - (priceVal - budget) / budget * 2.0);
      }
    } else {
      score += 0.5; // Neutral
    }

    // B. Brand scoring
    if (brand && p.brand) {
      const pBrand = String(p.brand).toLowerCase();
      const targetBrand = String(brand).toLowerCase();
      if (pBrand.includes(targetBrand) || targetBrand.includes(pBrand)) {
        score += 0.5;
      }
    }

    // C. Description length/quality scoring
    if (p.description && p.description.length > 50) {
      score += 0.1;
    }

    return { product: p, score };
  });

  // Sort descending by score
  scoredProducts.sort((a, b) => b.score - a.score);

  return scoredProducts.map(sp => sp.product);
}

/**
 * Orchestrates a guided, single-item sequential search for the active Shopping Mission.
 * 
 * @param {string} sessionId - The conversation session ID
 * @param {object} mission - The Shopping Mission object
 * @returns {Promise<object>} The updated mission item searched, or null if no items needed search
 */
export async function orchestrateSequentialSearch(sessionId, mission = {}) {
  // 1. Validate Mission Readiness
  const validation = validateShoppingMission(mission);
  if (!validation.ready) {
    logger.info(`\n[GiftPlanner Search]\nSkipped search\nReason: Mission not READY_FOR_SEARCH\n`);
    return null;
  }

  // 2. Find the first unselected item
  const items = mission.missionItems || [];
  const activeItem = items.find(item => !item.selectedProduct);

  if (!activeItem) {
    // If all items are already selected, update status and exit
    logger.info(`\n[GiftPlanner Search]\nSkipped search\nReason: All items already selected\n`);
    mission.status = MISSION_STATUS.READY_FOR_CHECKOUT;
    return null;
  }

  // If the active item has already been searched, wait for selection
  if (activeItem.searchCompleted) {
    logger.info(`\n[GiftPlanner Search]\nSkipped search\nReason: Active item already searched\n`);
    mission.status = MISSION_STATUS.SELECTING_PRODUCTS;
    return null;
  }

  const query = buildSearchQuery(activeItem);

  logger.info(`\n[GiftPlanner Search]
Mission Status: ${mission.status}
Validation Ready: ${validation.ready}
Current Item: ${activeItem.category}
Budget: ${activeItem.budget} LKR
Search Query: "${query}"
Calling searchProducts...`);

  mission.status = MISSION_STATUS.SEARCHING;

  // 3. Build search query and run independent MCP search
  let rawResults = [];
  try {
    rawResults = await searchProducts(query);
  } catch (err) {
    logger.error(`[GiftPlannerSearch] MCP search failed for query "${query}": ${err.message}`);
    rawResults = [];
  }

  // 4. Filter and Rank products
  const filtered = filterProducts(rawResults, activeItem.budget, activeItem.brand);
  // Verify returned products match the active category using Reference Index and activeItem metadata
  const verified = verifyProductsMatchCategory(filtered, activeItem);
  const ranked = rankProducts(verified, activeItem.budget, activeItem.brand);

  // 5. Update the mission item state
  activeItem.searchResults = verified;
  activeItem.recommendedProducts = ranked.slice(0, 10); // Store top 10 as recommended
  activeItem.searchCompleted = true;
  activeItem.status = "completed";
  activeItem.lastSearchedAt = Date.now();

  // 6. Integrate with the existing Reference Engine / Selection Memory
  // This allows the user to immediately ask questions about these results (e.g. "Show the phones")
  if (verified.length > 0) {
    rememberSearchResults(sessionId, verified);
  }

  // 7. Check if there are any remaining unselected pending search items, if not switch mission status
  const nextPending = items.find(item => !item.selectedProduct && !item.searchCompleted);
  if (!nextPending) {
    mission.status = MISSION_STATUS.SELECTING_PRODUCTS;
  }

  logger.info(`\n[GiftPlanner Search]
Products Returned: ${rawResults.length} found, ${verified.length} verified matching
Mission Updated: status transitioned to ${mission.status}\n`);

  return activeItem;
}

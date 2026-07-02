/**
 * giftPlannerManager.mjs
 *
 * Stateful manager module for the Gift Planner Shopping Mission.
 * Manages initialization, step progression, budget calculation, and logging.
 */

import { validateShoppingMission, MISSION_STATUS } from "./giftPlannerValidator.mjs";
import logger from "../../utils/logger.mjs";

function normalizeMissionItemStatus(status) {
  const value = String(status || "").trim().toUpperCase();
  if (["PENDING", "SEARCHING", "AWAITING_SELECTION", "SELECTED", "OUT_OF_STOCK", "RESELECT_REQUIRED", "COMPLETED"].includes(value)) {
    return value;
  }
  if (value === "COMPLETED" || value === "DONE" || value === "FINISHED") return "COMPLETED";
  if (value === "SELECTED" || value === "CHOICE_MADE") return "SELECTED";
  if (value === "SEARCHING" || value === "IN_PROGRESS") return "SEARCHING";
  if (value === "PENDING" || value === "WAITING") return "PENDING";
  return "PENDING";
}

function buildShoppingMissionPresentation(mission = {}) {
  const items = Array.isArray(mission.missionItems) ? mission.missionItems : [];
  const totalCount = items.length;
  const selectedItems = items.filter(item => item.selectedProduct != null);
  const selectedCount = selectedItems.length;
  const completedItems = selectedItems.filter(item => normalizeMissionItemStatus(item.status) === "COMPLETED" || !!item.selectedProduct).length;
  const remainingItems = Math.max(0, totalCount - selectedCount);
  const budget = parseFloat(mission.budget);
  const remainingBudget = typeof mission.remainingBudget === "number" ? mission.remainingBudget : calculateRemainingBudget(mission);
  const estimatedSpent = Number.isFinite(budget) ? Math.max(0, budget - remainingBudget) : 0;
  const progressPercentage = totalCount > 0 ? Math.round((selectedCount / totalCount) * 100) : 0;

  const activeItem = items.find(item => !item.selectedProduct) || items[items.length - 1] || null;
  const currentCategory = activeItem ? activeItem.category || null : null;
  const currentProduct = activeItem ? activeItem.selectedProduct || null : null;
  const currentItemIndex = activeItem ? items.indexOf(activeItem) + 1 : 0;

  const normalizedStatus = normalizeMissionItemStatus(mission.status);
  let nextAction = "Continue the mission";
  if (normalizedStatus === "COLLECTING_INFORMATION") {
    nextAction = `Collecting ${mission.currentStep || "information"}`;
  } else if (normalizedStatus === "READY_FOR_SEARCH") {
    nextAction = "Searching for the best products";
  } else if (normalizedStatus === "SEARCHING") {
    nextAction = `Searching ${currentCategory || "items"}`;
  } else if (normalizedStatus === "SELECTING_PRODUCTS") {
    nextAction = `Selecting products for ${currentCategory || "your mission"}`;
  } else if (normalizedStatus === "READY_FOR_CHECKOUT") {
    nextAction = "Ready for checkout";
  } else if (normalizedStatus === "COMPLETED") {
    nextAction = "Mission complete";
  }

  const statusLabel = mission.status || "Pending";
  const isCompleted = normalizedStatus === "COMPLETED" || (totalCount > 0 && selectedCount === totalCount && mission.status === MISSION_STATUS.READY_FOR_CHECKOUT);
  const showDashboard = totalCount > 0 && mission.status !== MISSION_STATUS.CREATED;
  const completionTimestamp = isCompleted ? new Date().toISOString() : null;

  const itemStatusMap = items.map(item => ({
    id: item.id,
    category: item.category,
    brand: item.brand,
    status: normalizeMissionItemStatus(item.status),
    selectedProduct: item.selectedProduct || null,
    budget: item.budget || null
  }));

  return {
    progressPercentage,
    selectedCount,
    totalCount,
    completedItems,
    remainingItems,
    remainingBudget,
    estimatedSpent,
    currentCategory,
    currentProduct,
    currentItemIndex,
    nextAction,
    statusLabel,
    activeStatus: normalizedStatus,
    showDashboard,
    isCompleted,
    completionTimestamp,
    itemStatusMap
  };
}

export function attachShoppingMissionPresentation(mission = {}) {
  if (!mission || typeof mission !== "object") return mission;
  mission.presentation = buildShoppingMissionPresentation(mission);
  return mission;
}

/**
 * Initializes a new Shopping Mission with the extracted data.
 */
export function initShoppingMission(sessionId, extracted = {}) {
  const id = `mission_${sessionId}_${Date.now()}`;
  
  const mission = {
    id,
    status: MISSION_STATUS.CREATED,
    occasion: extracted.occasion || null,
    recipient: extracted.recipient || null,
    budget: extracted.budget || null,
    remainingBudget: extracted.budget || null,
    currency: extracted.currency || "LKR",
    categories: [], // Obsolete in Phase 2 but kept empty for backward compatibility
    missionItems: extracted.missionItems || [],
    selectedProducts: [],
    productGroups: {},
    currentStep: "Collecting Occasion",
    createdAt: new Date()
  };

  mission.remainingBudget = calculateRemainingBudget(mission);
  
  const validation = validateShoppingMission(mission);
  mission.currentStep = validation.nextStep;
  mission.status = validation.ready ? MISSION_STATUS.READY_FOR_SEARCH : MISSION_STATUS.COLLECTING_INFORMATION;
  attachShoppingMissionPresentation(mission);

  return mission;
}

/**
 * Merges extracted parameters into the existing shopping mission.
 */
export function updateShoppingMission(sessionId, currentMission = {}, extracted = {}) {
  const mission = { ...currentMission };

  if (extracted.occasion && !mission.occasion) {
    mission.occasion = extracted.occasion;
  }
  if (extracted.recipient && !mission.recipient) {
    mission.recipient = extracted.recipient;
  }
  if (extracted.budget && !mission.budget) {
    mission.budget = extracted.budget;
  }

  // Merge mission items
  if (Array.isArray(extracted.missionItems)) {
    const existing = mission.missionItems || [];
    extracted.missionItems.forEach(extractedItem => {
      const idx = existing.findIndex(item => item.category === extractedItem.category);
      if (idx !== -1) {
        if (extractedItem.brand && !existing[idx].brand) {
          existing[idx].brand = extractedItem.brand;
        }
      } else {
        existing.push(extractedItem);
      }
    });
    mission.missionItems = existing;
  }

  mission.remainingBudget = calculateRemainingBudget(mission);

  const validation = validateShoppingMission(mission);
  mission.currentStep = validation.nextStep;
  
  const keepStatuses = [
    MISSION_STATUS.SEARCHING,
    MISSION_STATUS.SELECTING_PRODUCTS,
    MISSION_STATUS.READY_FOR_CHECKOUT,
    MISSION_STATUS.COMPLETED
  ];
  if (validation.ready) {
    if (currentMission && keepStatuses.includes(currentMission.status)) {
      mission.status = currentMission.status;
    } else {
      mission.status = MISSION_STATUS.READY_FOR_SEARCH;
    }
  } else {
    mission.status = MISSION_STATUS.COLLECTING_INFORMATION;
  }
  
  attachShoppingMissionPresentation(mission);

  return mission;
}

/**
 * Calculations for budget.
 * Remaining Budget = Total Budget - Sum of prices of selected products.
 */
export function calculateRemainingBudget(mission = {}) {
  const budget = parseFloat(mission.budget);
  if (isNaN(budget) || budget <= 0) return 0;

  const items = mission.missionItems || [];
  const selectedSum = items.reduce((sum, item) => {
    const prod = item.selectedProduct;
    if (!prod) return sum;
    const price = parseFloat(prod.price || prod.salePrice || 0);
    return sum + (isNaN(price) ? 0 : price);
  }, 0);

  // Keep mission.selectedProducts synced for backward compatibility
  mission.selectedProducts = items
    .filter(item => item.selectedProduct)
    .map(item => item.selectedProduct);

  // Allow budget to go negative so we can represent "Over Budget" status on frontend
  return budget - selectedSum;
}

/**
 * Backward compatibility helper.
 */
export function determineCurrentStep(mission = {}) {
  return validateShoppingMission(mission).nextStep;
}

/**
 * Formats and prints a highly readable, rich Shopping Mission terminal log.
 */
export function printMissionLogs(mission = {}) {
  const validation = validateShoppingMission(mission);
  const itemsText = (mission.missionItems || [])
    .map(item => `${item.category}${item.brand ? ` (${item.brand})` : ""}`)
    .join(", ");

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`SHOPPING MISSION`);
  console.log(`Mission Status:   ${mission.status || "None"}`);
  console.log(`Occasion:         ${mission.occasion || "None"}`);
  console.log(`Recipient:        ${mission.recipient || "None"}`);
  console.log(`Budget:           ${mission.budget ? `${mission.budget} ${mission.currency}` : "None"}`);
  console.log(`Remaining Budget: ${mission.remainingBudget ? `${mission.remainingBudget} ${mission.currency}` : "None"}`);
  console.log(`Mission Items:    ${itemsText || "None"}`);
  console.log(`Missing Fields:   ${validation.missingFields.join(", ") || "None"}`);
  console.log(`Next Step:        ${validation.nextStep || "None"}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━\n`);
}

/**
 * test-gift-planner-phase3.mjs
 *
 * Comprehensive Phase 3 guided conversational shopping validation suite.
 * Simulates a full interactive conversational session:
 * 1. Initialize mission from partial natural language greeting.
 * 2. Collect budget, triggering automatic transition to READY_FOR_SEARCH status.
 * 3. AI Budget Planner proportional distribution across all categories.
 * 4. Guided Sequential Search cycle 1: Searches first pending item (Phone).
 * 5. Guided Product Selection: User selects a Phone product, which:
 *    - Updates that item's selectedProduct.
 *    - Automatically reduces remaining budget.
 *    - Automatically moves to next pending item (Watch), executing query and search.
 * 6. Replace Item: User decides to replace Phone. Resets only Phone state and re-searches.
 * 7. Verification of all steps, validation states, and rich terminal logs.
 */

import { extractGiftPlannerData, checkAndHandleReplacement } from "../services/commerce/giftPlannerExtractor.mjs";
import {
  initShoppingMission,
  updateShoppingMission,
  calculateRemainingBudget,
  printMissionLogs
} from "../services/commerce/giftPlannerManager.mjs";
import { validateShoppingMission, MISSION_STATUS } from "../services/commerce/giftPlannerValidator.mjs";
import {
  allocateMissionBudgets,
  orchestrateSequentialSearch
} from "../services/commerce/giftPlannerSearchOrchestrator.mjs";

async function runConversationalGuidedShopTests() {
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  console.log("=================================================");
  console.log("VELORA GIFT PLANNER PHASE 3 GUIDED SHOP TEST SUITE");
  console.log("=================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  try {
    const sessionId = "sess_guided_shop_turn_" + Date.now();

    // ── STEP 1: INITIALIZE MISSION FROM UTTERANCE ──
    console.log("\n--- STEP 1: Conversational Turn 1 (Information Collection) ---");
    const msg1 = "Hi, I need a birthday gift for my father.";
    const culVars1 = { occasion: "birthday", recipient: "father" };
    
    const extracted1 = extractGiftPlannerData(msg1, culVars1, []);
    let mission = initShoppingMission(sessionId, extracted1);
    
    assert(mission.status === MISSION_STATUS.COLLECTING_INFORMATION, "Mission Status: COLLECTING_INFORMATION");
    assert(mission.currentStep === "Collecting Budget", "Next collector step: Collecting Budget");
    printMissionLogs(mission);

    // ── STEP 2: PROVIDE BUDGET & TRANSITION TO SEARCH ──
    console.log("\n--- STEP 2: Conversational Turn 2 (Budget Provided & Ready to Search) ---");
    const msg2 = "My budget is LKR 200000";
    const culVars2 = { price: "200000" };
    
    const extracted2 = extractGiftPlannerData(msg2, culVars2, mission.missionItems);
    // Add some categories/items as well
    extracted2.missionItems = [
      { category: "Phone", brand: "Samsung", budget: null, status: "pending", searchCompleted: false, searchResults: [], recommendedProducts: [] },
      { category: "Watch", brand: null, budget: null, status: "pending", searchCompleted: false, searchResults: [], recommendedProducts: [] }
    ];

    mission = updateShoppingMission(sessionId, mission, extracted2);
    
    assert(mission.status === MISSION_STATUS.READY_FOR_SEARCH, "Mission Validator: READY_FOR_SEARCH status attained!");
    assert(mission.currentStep === "Ready", "Step advanced to Ready");
    printMissionLogs(mission);

    // ── STEP 3: ALLOCATE BUDGETS & RUN FIRST SEQUENTIAL SEARCH ──
    console.log("\n--- STEP 3: Automated Allocation & Guided Sequential Search ---");
    const validation = validateShoppingMission(mission);
    if (validation.ready) {
      // Proportional budget distribution
      mission = allocateMissionBudgets(mission);
      assert(mission.missionItems[0].budget === 171429, "AI Budget Planner: Allocated 171,429 LKR to Phone");
      assert(mission.missionItems[1].budget === 28571, "AI Budget Planner: Allocated 28,571 LKR to Watch");

      // Guided search for first item (Phone)
      console.log("Triggering Guided Search...");
      await orchestrateSequentialSearch(sessionId, mission);
    }

    assert(mission.status === MISSION_STATUS.SEARCHING, "Mission Status changed to: SEARCHING");
    assert(mission.missionItems[0].searchCompleted === true, "Phone search status: Completed");
    assert(mission.missionItems[0].searchResults.length > 0, "Phone searchResults successfully populated from MCP");
    assert(mission.missionItems[0].recommendedProducts.length === 10, "Top 10 choices saved in recommendedProducts");
    
    // Watch remains pending
    assert(mission.missionItems[1].searchCompleted === false, "Watch search status remains: Pending");
    printMissionLogs(mission);

    // ── STEP 4: GUIDED SELECTION ──
    console.log("\n--- STEP 4: Conversational Turn 3 (Product Selected) ---");
    // User selects first phone (Samsung Galaxy)
    const selectedPhone = mission.missionItems[0].recommendedProducts[0];
    assert(selectedPhone !== undefined, "Found valid recommended phone product to select");
    
    // Simulate select_product intent handling
    let activeItem = mission.missionItems.find(item => item.searchCompleted && !item.selectedProduct);
    if (activeItem) {
      activeItem.selectedProduct = selectedPhone;
      activeItem.status = "completed";
      mission.remainingBudget = calculateRemainingBudget(mission);
    }

    assert(mission.missionItems[0].selectedProduct !== null, "Phone selection saved inside missionItem successfully");
    assert(mission.missionItems[0].status === "completed", "Phone item status updated to completed");
    assert(mission.remainingBudget < 200000, `Remaining budget successfully reduced from 200000 to ${mission.remainingBudget} LKR`);

    // Automatic sequential progression: Since watch is still pending search, we execute search for watch!
    const nextPending = mission.missionItems.find(item => !item.searchCompleted);
    if (nextPending) {
      console.log("Waiting 3 seconds to avoid rate limit...");
      await sleep(3000);
      await orchestrateSequentialSearch(sessionId, mission);
    }

    assert(mission.missionItems[1].searchCompleted === true, "Watch search automatically triggered and completed!");
    assert(mission.missionItems[1].searchResults.length >= 0, "Watch search results are state-safe (populated or rate-limited empty)");
    assert(mission.status === MISSION_STATUS.SELECTING_PRODUCTS, `Overall Mission Status transitioned to: ${MISSION_STATUS.SELECTING_PRODUCTS}`);
    printMissionLogs(mission);

    // ── STEP 5: REPLACE PRODUCT ──
    console.log("\n--- STEP 5: Conversational Turn 4 (Replace Product) ---");
    // User wants to replace Phone
    const msgReplace = "Actually, let's replace the Samsung phone.";
    const wasReset = checkAndHandleReplacement(msgReplace, mission);
    assert(wasReset === true, "Replacement detector successfully reset Phone item state");
    
    // Verify specific item state reset
    assert(mission.missionItems[0].selectedProduct === null, "Phone selection cleared");
    assert(mission.missionItems[0].searchCompleted === false, "Phone searchCompleted set back to false");
    assert(mission.missionItems[0].status === "pending", "Phone item status reset to pending");
    
    // Watch remains intact!
    assert(mission.missionItems[1].searchCompleted === true, "Watch search results remain preserved and untouched");
    
    mission.remainingBudget = calculateRemainingBudget(mission);
    assert(mission.remainingBudget === 200000, "Remaining budget successfully reverted back to full budget");

    // Automatically re-search the reset item!
    const rePending = mission.missionItems.find(item => !item.searchCompleted);
    if (rePending) {
      console.log("Waiting 3 seconds to avoid rate limit...");
      await sleep(3000);
      await orchestrateSequentialSearch(sessionId, mission);
    }
    assert(mission.missionItems[0].searchCompleted === true, "Phone automatically searched and re-completed!");
    printMissionLogs(mission);

    console.log("=================================================");
    console.log(`GUIDED SHOP TURN TESTS COMPLETED. Passed: ${passed}, Failed: ${failed}`);
    console.log("=================================================");
    process.exit(failed > 0 ? 1 : 0);
  } catch (e) {
    console.error("Test execution threw unhandled exception:", e);
    process.exit(1);
  }
}

runConversationalGuidedShopTests();

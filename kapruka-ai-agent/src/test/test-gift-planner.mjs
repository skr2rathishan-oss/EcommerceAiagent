/**
 * test-gift-planner.mjs
 *
 * Full Phase 2 verification suite for the Gift Planner workflow.
 * Validates AI Budget Allocation, clean Search Query Builder, Product Filtering
 * with Graceful Constraint Relaxation, Product Ranker scoring, Reference Engine Memory registry,
 * and Guided Sequential Search step-by-step progress.
 */

import { extractGiftPlannerData, normalizeCategoryAndBrand } from "../services/commerce/giftPlannerExtractor.mjs";
import {
  initShoppingMission,
  updateShoppingMission,
  calculateRemainingBudget,
  printMissionLogs
} from "../services/commerce/giftPlannerManager.mjs";
import { validateShoppingMission, MISSION_STATUS } from "../services/commerce/giftPlannerValidator.mjs";
import {
  allocateMissionBudgets,
  buildSearchQuery,
  filterProducts,
  rankProducts,
  orchestrateSequentialSearch
} from "../services/commerce/giftPlannerSearchOrchestrator.mjs";
import { getSelection } from "../agent/reference/01_selectionMemory.mjs";

async function runGiftPlannerTests() {
  console.log("=================================================");
  console.log("VELORA GIFT PLANNER PHASE 2 VERIFICATION SUITE");
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
    const sessionId = "test_sess_gift_planner_p2_" + Date.now();

    // ── TEST 1: CATEGORY NORMALIZATION & BRAND EXTRACTION ──
    console.log("\n--- TEST 1: Category Normalization & Brand Extraction ---");
    const norm1 = normalizeCategoryAndBrand("Samsung Phone");
    assert(norm1.category === "Phone" && norm1.brand === "Samsung", "Samsung Phone normalized to Phone (Samsung)");

    const norm2 = normalizeCategoryAndBrand("Smartphone");
    assert(norm2.category === "Phone" && norm2.brand === null, "Smartphone normalized to Phone");

    const norm3 = normalizeCategoryAndBrand("cellphone");
    assert(norm3.category === "Phone" && norm3.brand === null, "cellphone normalized to Phone");

    const norm4 = normalizeCategoryAndBrand("Office Shirt");
    assert(norm4.category === "Shirt" && norm4.brand === "Office", "Office Shirt normalized to Shirt (Office)");

    const norm5 = normalizeCategoryAndBrand("Gflock Silk Dress");
    assert(norm5.category === "Silk Dress" && norm5.brand === "Gflock", "Gflock Silk Dress normalized correctly");

    // ── TEST 2: AI BUDGET PLANNER (PROPORTIONAL ALLOCATION) ──
    console.log("\n--- TEST 2: AI Budget Planner Allocation ---");
    const extracted = {
      occasion: "Birthday",
      recipient: "Father",
      budget: 200000,
      currency: "LKR",
      missionItems: [
        { category: "Phone", brand: "Samsung", budget: null, status: "pending", searchCompleted: false, searchResults: [], recommendedProducts: [] },
        { category: "Watch", brand: null, budget: null, status: "pending", searchCompleted: false, searchResults: [], recommendedProducts: [] }
      ]
    };

    let mission = initShoppingMission(sessionId, extracted);
    assert(mission.missionItems[0].budget === null, "Initial budget is null");

    // Execute allocation
    mission = allocateMissionBudgets(mission);
    
    // Sum weights: Phone (150000) + Watch (25000) = 175000
    // Phone allocation: 150000 / 175000 * 200000 = 171429
    // Watch allocation: 25000 / 175000 * 200000 = 28571
    assert(mission.missionItems[0].budget === 171429, `Phone proportionally allocated: ${mission.missionItems[0].budget} LKR`);
    assert(mission.missionItems[1].budget === 28571, `Watch proportionally allocated: ${mission.missionItems[1].budget} LKR`);

    // Verify partial updates keep already specified budgets
    mission.missionItems[0].budget = 150000; // manually set Phone budget
    mission.missionItems[1].budget = null; // reset Watch
    mission = allocateMissionBudgets(mission);
    assert(mission.missionItems[0].budget === 150000, "Manually set Phone budget is preserved");
    assert(mission.missionItems[1].budget === 50000, `Remaining budget proportionally allocated to Watch: ${mission.missionItems[1].budget} LKR`);

    // ── TEST 3: SEARCH QUERY BUILDER ──
    console.log("\n--- TEST 3: Search Query Builder ---");
    const q1 = buildSearchQuery(mission.missionItems[0]);
    assert(q1 === "Samsung Phone", `Clean query generated: "${q1}"`);

    const q2 = buildSearchQuery(mission.missionItems[1]);
    assert(q2 === "Watch", `Clean query generated: "${q2}"`);

    // ── TEST 4: PRODUCT FILTERING & GRACEFUL PRICE RELAXATION ──
    console.log("\n--- TEST 4: Product Filtering & Constraint Relaxation ---");
    const mockMcpProducts = [
      { id: "p1", name: "G-Shock Sport Watch", price: 15000, brand: "Casio" },
      { id: "p2", name: "Premium Casio Watch", price: 25000, brand: "Casio" },
      { id: "p3", name: "Luxury Rolex Watch", price: 50000, brand: "Rolex" }
    ];

    // Case A: Strict filter (Budget: 20000, no brand preference)
    const filteredA = filterProducts(mockMcpProducts, 20000, null);
    assert(filteredA.length === 1 && filteredA[0].id === "p1", "Strict filter: returns only G-Shock (15000 <= 20000)");

    // Case B: No matches -> Graceful price relaxation (+30%)
    // Budget: 20000, but only products above 20000 exist. Let's filter Casio (25000) under budget 20000.
    // 20000 * 1.3 = 26000. Casio (25000) should match under relaxed price limits!
    const filteredB = filterProducts(mockMcpProducts.slice(1), 20000, null);
    assert(filteredB.length === 1 && filteredB[0].id === "p2", "Relaxed filter: 25000 fits within 30% price-relaxation threshold (<= 26000)");

    // Case C: Brand mismatch falls back to general matches
    const filteredC = filterProducts(mockMcpProducts, 15000, "Rolex");
    assert(filteredC.length > 0, "Relaxed filter: Brand mismatch dropped to prevent empty search list");

    // ── TEST 5: PRODUCT RANKING (SCORE FIT) ──
    console.log("\n--- TEST 5: Product Ranking & Scoring ---");
    const ranked = rankProducts(mockMcpProducts, 30000, "Casio");
    assert(ranked[0].id === "p2", "Highest scored ranked first (Casio 25000 is closer to budget 30000 and matches brand)");
    assert(ranked[1].id === "p1", "Second scored ranked next (G-Shock 15000 is within budget but further away)");
    assert(ranked[2].id === "p3", "Lowest scored ranked last (Rolex 50000 heavily penalized as it exceeds budget)");

    // ── TEST 6: GUIDED SEQUENTIAL SEARCH PROCESS ──
    console.log("\n--- TEST 6: Stateful Guided Sequential Search Process ---");
    // Verify sequence: searches first item (Phone), updates its results, but leaves second item (Watch) pending.
    assert(!mission.missionItems[0].searchCompleted, "Phone is initially pending");
    assert(!mission.missionItems[1].searchCompleted, "Watch is initially pending");

    // We can run orchestrateSequentialSearch. Since we want to mock searchProducts, we can temporarily inspect the active flow.
    const activeItem = await orchestrateSequentialSearch(sessionId, mission);
    
    assert(activeItem !== null, "Sequential search successfully selected and executed the first item");
    assert(activeItem.category === "Phone", "Orchestrated search specifically on Phone");
    assert(activeItem.searchCompleted === true, "Phone search status updated to completed");
    assert(mission.status === MISSION_STATUS.SEARCHING, `Mission status set to: ${MISSION_STATUS.SEARCHING}`);

    // Verify watch is still pending
    assert(mission.missionItems[1].searchCompleted === false, "Guided search: second item (Watch) remains pending search");

    // Print logs
    console.log("Printing Shopping Mission logs under intermediate search state:");
    printMissionLogs(mission);

    // ── TEST 7: REFERENCE ENGINE STORAGE REGISTRY ──
    console.log("\n--- TEST 7: Reference Engine Integration ---");
    const selection = getSelection(sessionId);
    assert(selection !== null, "Selection memory correctly registered after MCP search completed");
    assert(selection.products.length > 0, "Selection memory successfully populated with searched products");

    console.log("=================================================");
    console.log(`TEST RUN COMPLETED. Passed: ${passed}, Failed: ${failed}`);
    console.log("=================================================");
    process.exit(failed > 0 ? 1 : 0);
  } catch (e) {
    console.error("Test execution threw unhandled exception:", e);
    process.exit(1);
  }
}

runGiftPlannerTests();

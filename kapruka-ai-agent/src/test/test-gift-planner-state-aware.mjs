/**
 * test-gift-planner-state-aware.mjs
 *
 * Verifies the state-aware extraction layer for the Gift Planner.
 *
 * Key scenarios:
 *  1. No categories extracted while collecting occasion/recipient/budget.
 *  2. "Girlfriend" as CUL category is rejected (matches recipient).
 *  3. Unknown/arbitrary text returns null from normalizer.
 *  4. Brand-only inputs (e.g. "Samsung") — no category but brand is detected.
 *  5. Valid categories ARE extracted when in category-collection phase.
 *  6. Duplicate categories are merged, not duplicated.
 *  7. Full flow: Occasion → Recipient → Budget → Categories (no premature items).
 */

import { extractGiftPlannerData, normalizeCategoryAndBrand, extractMissionItems } from "../services/commerce/giftPlannerExtractor.mjs";
import { normalizeCategory, isSupportedCategory } from "../services/commerce/giftPlannerNormalizer.mjs";
import { SUPPORTED_CATEGORIES } from "../services/commerce/giftPlannerKnowledge.mjs";
import { extractMissionItemsFallback } from "../services/commerce/giftPlannerFallback.mjs";

function runStateAwareTests() {
  console.log("=================================================");
  console.log("GIFT PLANNER — STATE-AWARE EXTRACTION TEST SUITE");
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

  // ── TEST 1: SUPPORTED_CATEGORIES is populated ──
  console.log("\n--- TEST 1: SUPPORTED_CATEGORIES allowlist ---");
  assert(SUPPORTED_CATEGORIES.size > 0, "SUPPORTED_CATEGORIES is non-empty");
  assert(SUPPORTED_CATEGORIES.has("Phone"), "Phone is a supported category");
  assert(SUPPORTED_CATEGORIES.has("Jewellery"), "Jewellery is a supported category");
  assert(SUPPORTED_CATEGORIES.has("Flowers"), "Flowers is a supported category");
  assert(!SUPPORTED_CATEGORIES.has("Girlfriend"), "Girlfriend is NOT a supported category");
  assert(!SUPPORTED_CATEGORIES.has("Birthday"), "Birthday is NOT a supported category");
  assert(!SUPPORTED_CATEGORIES.has("Gift"), "Gift is NOT a supported category");

  // ── TEST 2: normalizeCategory returns null for unknown text ──
  console.log("\n--- TEST 2: normalizeCategory — unknown text returns null ---");
  assert(normalizeCategory("girlfriend") === null, '"girlfriend" normalizes to null');
  assert(normalizeCategory("birthday") === null, '"birthday" normalizes to null');
  assert(normalizeCategory("surprise") === null, '"surprise" normalizes to null');
  assert(normalizeCategory("father") === null, '"father" normalizes to null');
  assert(normalizeCategory("random gibberish xyz") === null, '"random gibberish xyz" normalizes to null');
  assert(normalizeCategory("50000") === null, '"50000" normalizes to null');
  assert(normalizeCategory("") === null, 'empty string normalizes to null');

  // ── TEST 3: normalizeCategory still resolves known categories ──
  console.log("\n--- TEST 3: normalizeCategory — known categories still work ---");
  assert(normalizeCategory("phone") === "Phone", '"phone" → "Phone"');
  assert(normalizeCategory("jewellery") === "Jewellery", '"jewellery" → "Jewellery"');
  assert(normalizeCategory("flowers") === "Flowers", '"flowers" → "Flowers"');
  assert(normalizeCategory("chocolate") === "Chocolate", '"chocolate" → "Chocolate"');
  assert(normalizeCategory("silk dress") === "Silk Dress", '"silk dress" → "Silk Dress"');
  assert(normalizeCategory("earbuds") === "Personal Care", '"earbuds" → "Personal Care"');

  // ── TEST 4: isSupportedCategory ──
  console.log("\n--- TEST 4: isSupportedCategory ---");
  assert(isSupportedCategory("Phone") === true, '"Phone" is supported');
  assert(isSupportedCategory("Watch") === true, '"Watch" is supported');
  assert(isSupportedCategory("Girlfriend") === false, '"Girlfriend" is NOT supported');
  assert(isSupportedCategory(null) === false, "null is not supported");
  assert(isSupportedCategory("") === false, 'empty string is not supported');
  assert(isSupportedCategory("Random") === false, '"Random" is not supported');

  // ── TEST 5: Brand-only inputs ──
  console.log("\n--- TEST 5: Brand-only inputs ---");
  const brandOnly1 = normalizeCategoryAndBrand("Samsung");
  assert(brandOnly1.category === null, '"Samsung" alone has no category (null)');
  assert(brandOnly1.brand === "Samsung", '"Samsung" brand detected');

  const brandOnly2 = normalizeCategoryAndBrand("Apple");
  assert(brandOnly2.category === null, '"Apple" alone has no category (null)');
  assert(brandOnly2.brand === "Apple", '"Apple" brand detected');

  const brandOnly3 = normalizeCategoryAndBrand("Nike");
  assert(brandOnly3.category === null, '"Nike" alone has no category (null)');
  assert(brandOnly3.brand === "Nike", '"Nike" brand detected');

  // ── TEST 6: Brand + Category inputs ──
  console.log("\n--- TEST 6: Brand + Category inputs ---");
  const brandCat1 = normalizeCategoryAndBrand("Samsung Phone");
  assert(brandCat1.category === "Phone", '"Samsung Phone" → category "Phone"');
  assert(brandCat1.brand === "Samsung", '"Samsung Phone" → brand "Samsung"');

  const brandCat2 = normalizeCategoryAndBrand("Nike Shoes");
  assert(brandCat2.category === "Shoes", '"Nike Shoes" → category "Shoes"');
  assert(brandCat2.brand === "Nike", '"Nike Shoes" → brand "Nike"');

  // ── TEST 7: No categories while collecting occasion ──
  console.log("\n--- TEST 7: No categories while collecting occasion ---");
  const ctx_occasion = { currentStep: "Collecting Occasion", occasion: null, recipient: null, budget: null };
  const items1 = extractMissionItems("jewellery", [], { category: "jewellery" }, ctx_occasion);
  assert(items1.length === 0, 'CUL category "jewellery" ignored while collecting occasion');

  // ── TEST 8: No categories while collecting recipient ──
  console.log("\n--- TEST 8: No categories while collecting recipient ---");
  const ctx_recipient = { currentStep: "Collecting Recipient", occasion: "Birthday", recipient: null, budget: null };
  const items2 = extractMissionItems("phone", [], { category: "phone" }, ctx_recipient);
  assert(items2.length === 0, 'CUL category "phone" ignored while collecting recipient');

  // ── TEST 9: No categories while collecting budget ──
  console.log("\n--- TEST 9: No categories while collecting budget ---");
  const ctx_budget = { currentStep: "Collecting Budget", occasion: "Birthday", recipient: "Girlfriend", budget: null };
  const items3 = extractMissionItems("50000", [], { category: "girlfriend" }, ctx_budget);
  assert(items3.length === 0, 'CUL category "girlfriend" ignored while collecting budget');

  // ── TEST 10: Categories extracted when collecting categories ──
  console.log("\n--- TEST 10: Categories extracted when collecting categories ---");
  const ctx_categories = { currentStep: "Collecting Categories", occasion: "Birthday", recipient: "Girlfriend", budget: 50000 };
  const items4 = extractMissionItems("jewellery", [], { category: "jewellery" }, ctx_categories);
  assert(items4.length === 1, "Jewellery extracted when collecting categories");
  assert(items4[0].category === "Jewellery", 'Category is "Jewellery"');

  // ── TEST 11: Recipient can never become a category ──
  console.log("\n--- TEST 11: Recipient rejected as category ---");
  const ctx_cat2 = { currentStep: "Collecting Categories", occasion: "Birthday", recipient: "Girlfriend", budget: 50000 };
  const items5 = extractMissionItems("girlfriend", [], { category: "girlfriend" }, ctx_cat2);
  assert(items5.length === 0, '"girlfriend" rejected as category (matches recipient and not in allowlist)');

  // ── TEST 12: Occasion can never become a category ──
  console.log("\n--- TEST 12: Occasion rejected as category ---");
  const items6 = extractMissionItems("birthday", [], { category: "birthday" }, ctx_cat2);
  assert(items6.length === 0, '"birthday" rejected as category (not in allowlist)');

  // ── TEST 13: Full conversation flow via extractGiftPlannerData ──
  console.log("\n--- TEST 13: Full flow — no premature mission items ---");

  // Turn 1: User says "Birthday" (occasion)
  const turn1 = extractGiftPlannerData("Birthday", { occasion: "birthday" }, []);
  assert(turn1.occasion === "Birthday", "Turn 1: occasion extracted");
  assert(turn1.missionItems.length === 0, "Turn 1: no mission items");

  // Turn 2: User says "Girlfriend" (recipient)
  const turn2 = extractGiftPlannerData("Girlfriend", { recipient: "girlfriend" }, []);
  assert(turn2.recipient === "Girlfriend", "Turn 2: recipient extracted");
  assert(turn2.missionItems.length === 0, "Turn 2: no mission items");

  // Turn 3: User says "50000" (budget)
  const turn3 = extractGiftPlannerData("50000", { price: "50000" }, []);
  assert(turn3.budget === 50000, "Turn 3: budget extracted");
  assert(turn3.missionItems.length === 0, "Turn 3: no mission items (still no category)");

  // Turn 4: User says "Jewellery" (category) — NOW it should extract
  // Simulate a plannerContext where occasion/recipient/budget are known
  const turn4ctx = { currentStep: "Collecting Categories", occasion: "Birthday", recipient: "Girlfriend", budget: 50000 };
  const turn4 = extractGiftPlannerData("Jewellery", { category: "jewellery" }, [], turn4ctx);
  assert(turn4.missionItems.length === 1, "Turn 4: one mission item extracted");
  assert(turn4.missionItems[0].category === "Jewellery", 'Turn 4: category is "Jewellery"');

  // ── TEST 14: Fallback parser is also state-aware ──
  console.log("\n--- TEST 14: Fallback parser is state-aware ---");
  const fbCtxBudget = { currentStep: "Collecting Budget", occasion: "Birthday", recipient: "Father", budget: null };
  const fbItems1 = extractMissionItemsFallback("add phone and watch", [], fbCtxBudget);
  assert(fbItems1.length === 0, 'Fallback rejects "add phone and watch" while collecting budget');

  const fbCtxCat = { currentStep: "Collecting Categories", occasion: "Birthday", recipient: "Father", budget: 200000 };
  const fbItems2 = extractMissionItemsFallback("add phone and watch", [], fbCtxCat);
  assert(fbItems2.length === 2, 'Fallback accepts "add phone and watch" while collecting categories');

  // ── TEST 15: Duplicate categories are merged ──
  console.log("\n--- TEST 15: Duplicate category merge ---");
  const existingItems = [
    { id: "item_abc", category: "Phone", brand: null, budget: null, status: "pending", searchCompleted: false, searchResults: [] }
  ];
  const dupCtx = { currentStep: "Collecting Categories", occasion: "Birthday", recipient: "Girlfriend", budget: 50000 };
  const items7 = extractMissionItems("phone", existingItems, { category: "phone" }, dupCtx);
  assert(items7.length === 1, "Duplicate phone not added again");

  // ── TEST 16: Unknown category text is ignored ──
  console.log("\n--- TEST 16: Unknown category text ---");
  const unkCtx = { currentStep: "Collecting Categories", occasion: "Birthday", recipient: "Girlfriend", budget: 50000 };
  const items8 = extractMissionItems("spaceship", [], { category: "spaceship" }, unkCtx);
  assert(items8.length === 0, '"spaceship" is not a supported category — ignored');

  const items9 = extractMissionItems("happiness", [], { category: "happiness" }, unkCtx);
  assert(items9.length === 0, '"happiness" is not a supported category — ignored');

  // ── Results ──
  console.log("\n=================================================");
  console.log(`STATE-AWARE TESTS COMPLETED. Passed: ${passed}, Failed: ${failed}`);
  console.log("=================================================");
  process.exit(failed > 0 ? 1 : 0);
}

runStateAwareTests();

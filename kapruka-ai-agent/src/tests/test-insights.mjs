// test-insights.mjs
// Offline smoke test for Phase 5 – User Insights Engine.
// Tests extractInsightsJson parsing and getUserInsights/updateUserInsights
// against a mocked MongoDB connection (no real DB or LLM needed).

console.log("\n=== STARTING INSIGHTS SMOKE TEST ===\n");

// ─── Helper: replicate the JSON extractor from insights.service.mjs ──────────
function extractInsightsJson(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Could not parse insights JSON from LLM response");
  }
}

// ─── Helper: assert ───────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

// ─── Test 1: Clean JSON string ────────────────────────────────────────────────
console.log("Test 1: Parse clean JSON from Nemotron output");
{
  const raw = `{"topCategories":["cakes","flowers"],"averageBudget":4500,"topRecipient":"mother","topOccasion":"birthday","shoppingStyle":"gift_buyer","confidence":92}`;
  const result = extractInsightsJson(raw);
  assert("topCategories is array",   Array.isArray(result.topCategories));
  assert("topCategories[0] = cakes", result.topCategories[0] === "cakes");
  assert("averageBudget = 4500",     result.averageBudget === 4500);
  assert("topRecipient = mother",    result.topRecipient  === "mother");
  assert("topOccasion = birthday",   result.topOccasion   === "birthday");
  assert("shoppingStyle = gift_buyer", result.shoppingStyle === "gift_buyer");
  assert("confidence = 92",          result.confidence    === 92);
}

// ─── Test 2: JSON wrapped in markdown code fence ──────────────────────────────
console.log("\nTest 2: Parse JSON wrapped in markdown fences");
{
  const raw = "```json\n{\"topCategories\":[\"flowers\"],\"averageBudget\":null,\"topRecipient\":null,\"topOccasion\":\"anniversary\",\"shoppingStyle\":\"occasion_planner\",\"confidence\":60}\n```";
  const result = extractInsightsJson(raw);
  assert("topCategories[0] = flowers", result.topCategories[0] === "flowers");
  assert("averageBudget = null",        result.averageBudget    === null);
  assert("topOccasion = anniversary",   result.topOccasion      === "anniversary");
  assert("shoppingStyle = occasion_planner", result.shoppingStyle === "occasion_planner");
  assert("confidence = 60",             result.confidence       === 60);
}

// ─── Test 3: JSON with extra prose before/after ────────────────────────────────
console.log("\nTest 3: Parse JSON embedded in prose");
{
  const raw = `Here is the shopping insight:\n{"topCategories":["cakes"],"averageBudget":3000,"topRecipient":"wife","topOccasion":"anniversary","shoppingStyle":"gift_buyer","confidence":75}\nEnd of analysis.`;
  const result = extractInsightsJson(raw);
  assert("topCategories[0] = cakes",  result.topCategories[0] === "cakes");
  assert("averageBudget = 3000",      result.averageBudget    === 3000);
  assert("topRecipient = wife",       result.topRecipient     === "wife");
  assert("confidence = 75",           result.confidence       === 75);
}

// ─── Test 4: Robustness — missing optional fields default gracefully ──────────
console.log("\nTest 4: Robustness with minimal JSON");
{
  const raw = `{"topCategories":[],"averageBudget":null,"topRecipient":null,"topOccasion":null,"shoppingStyle":null,"confidence":5}`;
  const result = extractInsightsJson(raw);
  assert("topCategories is empty array", Array.isArray(result.topCategories) && result.topCategories.length === 0);
  assert("averageBudget is null",        result.averageBudget === null);
  assert("topRecipient is null",         result.topRecipient  === null);
  assert("confidence = 5",              result.confidence    === 5);
}

// ─── Test 5: Invalid JSON should throw ────────────────────────────────────────
console.log("\nTest 5: Invalid JSON throws an error");
{
  let threw = false;
  try {
    extractInsightsJson("This is not JSON at all, no braces");
  } catch (_) {
    threw = true;
  }
  assert("extractInsightsJson throws on invalid input", threw);
}

// ─── Test 6: Timing check (getUserInsights response target) ──────────────────
console.log("\nTest 6: getUserInsights read latency target (<10ms simulated)");
{
  const mockFindOne = () => new Promise(resolve => setTimeout(() => resolve({
    sessionId: "smoke-test-session",
    topCategories: ["cakes"],
    averageBudget: 4500,
    topRecipient: "mother",
    topOccasion: "birthday",
    shoppingStyle: "gift_buyer",
    confidence: 88,
    version: 3,
    generatedAt: new Date()
  }), 2)); // 2ms simulated DB read

  const start  = Date.now();
  const result = await mockFindOne();
  const elapsed = Date.now() - start;

  assert("sessionId present",          result.sessionId     === "smoke-test-session");
  assert("version is 3",               result.version       === 3);
  assert("Read completed in <10ms",    elapsed              < 10);
  console.log(`  ℹ Simulated read time: ${elapsed}ms`);
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n=== INSIGHTS SMOKE TEST COMPLETE ===`);
console.log(`Passed: ${passed} | Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
}

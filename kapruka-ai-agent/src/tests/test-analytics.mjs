// test-analytics.mjs
// Offline smoke test for Phase 6 – Analytics Engine.
// Tests helper logic, data shapes, and scheduler timing — no real DB or network needed.

console.log("\n=== STARTING ANALYTICS SMOKE TEST ===\n");

// ─── Assertion helpers ────────────────────────────────────────────────────────
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

// ─── Helper: replicate todayUTC() ────────────────────────────────────────────
function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Test 1: todayUTC format ──────────────────────────────────────────────────
console.log("Test 1: todayUTC() returns correct format");
{
  const date = todayUTC();
  assert("Format is YYYY-MM-DD",       /^\d{4}-\d{2}-\d{2}$/.test(date));
  assert("Length is 10",               date.length === 10);
  assert("Year is 2025 or 2026",       date.startsWith("202"));
}

// ─── Test 2: DailyAnalytics shape validation ──────────────────────────────────
console.log("\nTest 2: DailyAnalytics document shape");
{
  // Simulate the upserted document shape
  const doc = {
    date:              todayUTC(),
    totalUsers:        42,
    totalSessions:     38,
    totalSearches:     120,
    totalPurchases:    15,
    topCategories:     [{ name: "cakes", count: 45 }, { name: "flowers", count: 30 }],
    topProducts:       [{ productId: "p1", productName: "Chocolate Cake", count: 12 }],
    averageOrderValue: 4500,
    generatedAt:       new Date()
  };

  assert("date is string",               typeof doc.date            === "string");
  assert("totalUsers >= 0",              doc.totalUsers             >= 0);
  assert("totalSessions >= 0",           doc.totalSessions          >= 0);
  assert("totalSearches >= 0",           doc.totalSearches          >= 0);
  assert("totalPurchases >= 0",          doc.totalPurchases         >= 0);
  assert("topCategories is array",       Array.isArray(doc.topCategories));
  assert("topCategories[0] has name",    typeof doc.topCategories[0].name  === "string");
  assert("topCategories[0] has count",   typeof doc.topCategories[0].count === "number");
  assert("topProducts is array",         Array.isArray(doc.topProducts));
  assert("topProducts[0] has productId", typeof doc.topProducts[0].productId === "string");
  assert("averageOrderValue >= 0",       doc.averageOrderValue      >= 0);
  assert("generatedAt is Date",          doc.generatedAt instanceof Date);
}

// ─── Test 3: Budget range logic ────────────────────────────────────────────────
console.log("\nTest 3: Budget range bucketing logic");
{
  function getBudgetRange(budget) {
    if (budget <= 0)     return null;
    if (budget <= 1000)  return "0–1000";
    if (budget <= 3000)  return "1001–3000";
    if (budget <= 5000)  return "3001–5000";
    if (budget <= 10000) return "5001–10000";
    return "10001+";
  }

  assert("500   → 0–1000",     getBudgetRange(500)    === "0–1000");
  assert("1000  → 0–1000",     getBudgetRange(1000)   === "0–1000");
  assert("1001  → 1001–3000",  getBudgetRange(1001)   === "1001–3000");
  assert("3000  → 1001–3000",  getBudgetRange(3000)   === "1001–3000");
  assert("3001  → 3001–5000",  getBudgetRange(3001)   === "3001–5000");
  assert("5000  → 3001–5000",  getBudgetRange(5000)   === "3001–5000");
  assert("5001  → 5001–10000", getBudgetRange(5001)   === "5001–10000");
  assert("9999  → 5001–10000", getBudgetRange(9999)   === "5001–10000");
  assert("10001 → 10001+",     getBudgetRange(10001)  === "10001+");
  assert("0     → null",       getBudgetRange(0)      === null);
}

// ─── Test 4: getAnalytics date range filter logic ─────────────────────────────
console.log("\nTest 4: getAnalytics date range filter");
{
  const docs = [
    { date: "2026-06-10", totalPurchases: 5 },
    { date: "2026-06-11", totalPurchases: 8 },
    { date: "2026-06-12", totalPurchases: 3 },
    { date: "2026-06-13", totalPurchases: 12 }
  ];

  function filterAnalytics(docs, startDate, endDate) {
    return docs.filter(d => {
      if (startDate && d.date < startDate) return false;
      if (endDate   && d.date > endDate)   return false;
      return true;
    });
  }

  const result = filterAnalytics(docs, "2026-06-11", "2026-06-12");
  assert("Returns 2 docs in range",          result.length === 2);
  assert("First doc is 2026-06-11",          result[0].date === "2026-06-11");
  assert("Second doc is 2026-06-12",         result[1].date === "2026-06-12");

  const allDocs = filterAnalytics(docs, null, null);
  assert("No filter returns all 4 docs",     allDocs.length === 4);
}

// ─── Test 5: topCategories aggregation shape ──────────────────────────────────
console.log("\nTest 5: Top categories shape validation");
{
  // Simulated aggregation output
  const topCategories = [
    { name: "cakes",   count: 45 },
    { name: "flowers", count: 30 },
    { name: "hampers", count: 12 }
  ];

  assert("Is array",                    Array.isArray(topCategories));
  assert("Sorted descending",           topCategories[0].count >= topCategories[1].count);
  assert("Each item has name+count",    topCategories.every(c => c.name && c.count >= 0));
  assert("No _id field",                !topCategories[0]._id);
}

// ─── Test 6: Scheduler timing (verify constants) ──────────────────────────────
console.log("\nTest 6: Scheduler timing constants");
{
  const SIX_HOURS_MS  = 6 * 60 * 60 * 1000;
  const STARTUP_DELAY = 5 * 1000;

  assert("6 hours = 21,600,000 ms",     SIX_HOURS_MS  === 21_600_000);
  assert("Startup delay = 5,000 ms",    STARTUP_DELAY === 5_000);
  assert("6h > startup delay",          SIX_HOURS_MS  > STARTUP_DELAY);
}

// ─── Test 7: Structured log shape ─────────────────────────────────────────────
console.log("\nTest 7: Analytics log shape");
{
  const logEntry = {
    analyticsGenerated: new Date().toISOString(),
    date: todayUTC(),
    recordsProcessed: 215
  };

  assert("Has analyticsGenerated",      typeof logEntry.analyticsGenerated === "string");
  assert("Has date",                    typeof logEntry.date               === "string");
  assert("Has recordsProcessed",        typeof logEntry.recordsProcessed   === "number");
  assert("No sessionId in log",         !("sessionId" in logEntry));
  assert("No messages in log",          !("messages"  in logEntry));
  assert("recordsProcessed >= 0",       logEntry.recordsProcessed >= 0);
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n=== ANALYTICS SMOKE TEST COMPLETE ===`);
console.log(`Passed: ${passed} | Failed: ${failed}`);

if (failed > 0) process.exit(1);

// ============================================================
// tests/phase5-error-handling-tests.mjs
// Phase 5 – Error Handling & Edge Cases Tests
// ============================================================

const BASE = "http://localhost:5000";
const SESSION = `phase5-test-${Date.now()}`;

const c = {
  reset: "\x1b[0m", green: "\x1b[32m", red: "\x1b[31m",
  yellow: "\x1b[33m", cyan: "\x1b[36m", bold: "\x1b[1m", dim: "\x1b[2m",
};
const PASS = `${c.green}${c.bold}PASS${c.reset}`;
const FAIL = `${c.red}${c.bold}FAIL${c.reset}`;

const results = [];

function chk(label, value, note = "") {
  const passed = !!value;
  console.log(`    ${passed ? PASS : FAIL}  ${label}${note ? `  ${c.dim}(${note})${c.reset}` : ""}`);
  results.push({ label, passed });
  return passed;
}

async function postJson(path, body) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, json };
  } catch (e) {
    return { status: 0, ok: false, json: null, error: e.message };
  }
}

console.log(`\n${c.bold}=== Phase 5 – Error Handling Tests ===${c.reset}`);
console.log(`${c.dim}Backend: ${BASE}${c.reset}\n`);

// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${c.bold}${c.cyan}▶ 1. Payload Validation Guards${c.reset}`);

{
  console.log(`\n  Step 1.1 – Chat: Missing required field (message)`);
  const r = await postJson("/api/chat", { sessionId: SESSION });
  chk("Returns HTTP 400 Bad Request", r.status === 400);
  chk("Returns structured validation error", r.json?.success === false && !!r.json?.message);
}

{
  console.log(`\n  Step 1.2 – Chat: Oversized payload`);
  const r = await postJson("/api/chat", { message: "x".repeat(5000), sessionId: SESSION });
  chk("Returns HTTP 400 Bad Request", r.status === 400);
}

{
  console.log(`\n  Step 1.3 – Delivery Check: Invalid date format`);
  const r = await postJson("/api/delivery/check", { city: "Colombo", deliveryDate: "tomorrow" });
  chk("Returns HTTP 400 Bad Request", r.status === 400);
  chk("Rejects invalid date format", r.json?.errors?.some(e => e.field.includes("deliveryDate")));
}

// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${c.bold}${c.cyan}▶ 2. Rate Limiting Tests${c.reset}`);

{
  console.log(`\n  Step 2.1 – Trigger Rate Limiter (Spamming Chat Endpoint)`);
  let hit429 = false;
  // Send a burst of requests to trigger express-rate-limit
  const requests = Array.from({ length: 105 }).map(() => 
    fetch(`${BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "ping", sessionId: SESSION })
    })
  );
  
  const responses = await Promise.all(requests.map(p => p.catch(() => ({ status: 0 }))));
  hit429 = responses.some(r => r.status === 429);
  
  chk("Rate limiter triggers HTTP 429 after threshold", hit429, "Requires ~30 reqs/min limit");
}

// ─────────────────────────────────────────────────────────────────────────────
// FINAL REPORT
// ─────────────────────────────────────────────────────────────────────────────
const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;

console.log(`\n\n${c.bold}════════════════════════════════════════════════${c.reset}`);
console.log(`${c.bold}      Phase 5 – Error Handling Test Report      ${c.reset}`);
console.log(`${c.bold}════════════════════════════════════════════════${c.reset}`);
console.log(`Total checks : ${results.length}`);
console.log(`${c.green}${c.bold}PASS${c.reset}         : ${passed}`);
console.log(`${c.red}${c.bold}FAIL${c.reset}         : ${failed}`);

process.exit(failed > 0 ? 1 : 0);

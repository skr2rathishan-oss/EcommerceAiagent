// ============================================================
// tests/phase6-performance-tests.mjs
// Phase 6 – Performance & Latency Tests
// ============================================================

const BASE = "http://localhost:5000";
const SESSION = `phase6-perf-${Date.now()}`;

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

async function measurePost(path, body) {
  const start = performance.now();
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    const duration = performance.now() - start;
    return { status: res.status, ok: res.ok, duration, json };
  } catch (e) {
    return { status: 0, ok: false, duration: performance.now() - start, error: e.message };
  }
}

async function measureGet(path) {
  const start = performance.now();
  try {
    const res = await fetch(`${BASE}${path}`);
    const json = await res.json().catch(() => null);
    const duration = performance.now() - start;
    return { status: res.status, ok: res.ok, duration, json };
  } catch (e) {
    return { status: 0, ok: false, duration: performance.now() - start, error: e.message };
  }
}

// For SSE endpoints like /api/chat, measure TTFB (Time to First Byte)
async function measureSseTtfb(path, body) {
  const start = performance.now();
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    
    // Wait for the first chunk of data
    if (res.body) {
      const reader = res.body.getReader();
      await reader.read(); // first byte
      const ttfb = performance.now() - start;
      reader.cancel();
      return { status: res.status, ok: res.ok, ttfb };
    }
    return { status: res.status, ok: res.ok, ttfb: performance.now() - start };
  } catch (e) {
    return { status: 0, ok: false, ttfb: performance.now() - start, error: e.message };
  }
}

console.log(`\n${c.bold}=== Phase 6 – Performance Tests ===${c.reset}`);
console.log(`${c.dim}Backend: ${BASE}${c.reset}\n`);

async function run() {
  // ─────────────────────────────────────────────────────────────────────────────
  console.log(`\n${c.bold}${c.cyan}▶ 1. Express API Overhead${c.reset}`);
  
  const healthRes = await measureGet("/health");
  console.log(`\n  Step 1.1 – Health Check Latency: ${healthRes.duration.toFixed(2)}ms`);
  chk("Health check under 50ms", healthRes.duration < 50, "Target: < 50ms");

  const validationRes = await measurePost("/api/chat", { sessionId: SESSION }); // missing message -> 400
  console.log(`\n  Step 1.2 – Validation Rejection Latency: ${validationRes.duration.toFixed(2)}ms`);
  chk("Validation rejection under 50ms", validationRes.duration < 50, "Target: < 50ms");

  // ─────────────────────────────────────────────────────────────────────────────
  console.log(`\n${c.bold}${c.cyan}▶ 2. Backend Logic (Non-LLM)${c.reset}`);
  
  const deliveryRes = await measurePost("/api/delivery/check", { city: "Colombo", deliveryDate: "2026-06-19" });
  console.log(`\n  Step 2.1 – Delivery Check Latency: ${deliveryRes.duration.toFixed(2)}ms`);
  chk("Delivery check under 2000ms", deliveryRes.duration < 2000, "Target: < 2s");

  const trackRes = await measurePost("/api/orders/track", { orderNumber: "FAKE-123" });
  console.log(`\n  Step 2.2 – Order Tracking Latency: ${trackRes.duration.toFixed(2)}ms`);
  chk("Order tracking under 2000ms", trackRes.duration < 2000, "Target: < 2s");

  // ─────────────────────────────────────────────────────────────────────────────
  console.log(`\n${c.bold}${c.cyan}▶ 3. Streaming Chat Latency (TTFB)${c.reset}`);
  
  const chatTtfbRes = await measureSseTtfb("/api/chat", { message: "hello", sessionId: SESSION });
  console.log(`\n  Step 3.1 – LLM Chat TTFB: ${chatTtfbRes.ttfb.toFixed(2)}ms`);
  chk("LLM chat starts streaming under 4000ms", chatTtfbRes.ttfb < 4000, "Target: < 4s");

  // ─────────────────────────────────────────────────────────────────────────────
  // FINAL REPORT
  // ─────────────────────────────────────────────────────────────────────────────
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`\n\n${c.bold}════════════════════════════════════════════════${c.reset}`);
  console.log(`${c.bold}      Phase 6 – Performance Test Report      ${c.reset}`);
  console.log(`${c.bold}════════════════════════════════════════════════${c.reset}`);
  console.log(`Total checks : ${results.length}`);
  console.log(`${c.green}${c.bold}PASS${c.reset}         : ${passed}`);
  console.log(`${c.red}${c.bold}FAIL${c.reset}         : ${failed}`);

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(console.error);

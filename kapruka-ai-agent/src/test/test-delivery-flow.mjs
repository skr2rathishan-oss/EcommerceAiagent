/**
 * End-to-End Conversational Delivery Flow Test
 * ══════════════════════════════════════════════════════════════════════════════
 * Simulates multi-turn chat sessions that exercise the delivery address
 * state-machine in chat.controller.mjs:
 *
 *   delivery_address  →  delivery_address_confirmation  →  delivery_date  →
 *   (available? → order_confirmation) OR (unavailable? → delivery_recovery_options)
 *
 * NOTE: Scenario 1 is intentionally agnostic about final availability —
 * the live Kapruka MCP API may return available=false for any city/date.
 * We only verify that the state machine transitions correctly up to the date
 * step, and that the response contains the expected response patterns
 * ("great news"/"aiyoo") regardless of availability outcome.
 */

const CHAT_URL = "http://127.0.0.1:5000/api/chat";

// ─── Helper: send a message and collect the SSE "complete" payload ─────────────

async function sendMessage(sessionId, message, intent = null) {
  const body = { message };
  if (intent) body.intent = intent;

  const response = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-session-id": sessionId
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from chat endpoint`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalData = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.trim().startsWith("data: ")) {
        try {
          const parsed = JSON.parse(line.trim().substring(6));
          if (parsed.type === "complete") finalData = parsed.data;
        } catch (_) { /* partial line — skip */ }
      }
    }
  }

  // Flush tail
  if (buffer.trim().startsWith("data: ")) {
    try {
      const parsed = JSON.parse(buffer.trim().substring(6));
      if (parsed.type === "complete") finalData = parsed.data;
    } catch (_) {}
  }

  return finalData;
}

function text(payload) {
  if (!payload) return "";
  if (typeof payload === "string") return payload;
  if (payload.text) return payload.text;
  if (payload.message) return payload.message;
  return "";
}

function uid() {
  return `e2e-${Math.random().toString(36).substring(2, 9)}`;
}

// ─── Assertions ────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const errors = [];

function assert(label, condition, hint = "") {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}${hint ? " — " + hint : ""}`);
    failed++;
    errors.push(label);
  }
}

// ─── Scenario 1: Full good-address flow (state-machine check) ─────────────────

async function scenario1_goodAddressFlow() {
  console.log("\n═══ SCENARIO 1: Good Address Flow ═══");
  const session = uid();

  // Step 1 — trigger delivery check → should ask for address
  console.log("  User → \"Check delivery\"");
  let r = await sendMessage(session, "Check delivery", "check_delivery");
  let t = text(r);
  console.log(`  AI  ← "${t.replace(/\n/g, " ").substring(0, 120)}..."`);
  assert("Step 1: prompts for address", t.toLowerCase().includes("address"), `got: "${t}"`);

  // Step 2 — send a valid Sri Lankan address → should be normalized & confirmed
  console.log("  User → \"No25 temple rd wellawatte col 6\"");
  r = await sendMessage(session, "No25 temple rd wellawatte col 6");
  t = text(r);
  console.log(`  AI  ← "${t.replace(/\n/g, " ").substring(0, 120)}..."`);
  assert(
    "Step 2: returns normalized address",
    t.toLowerCase().includes("no 25, temple road, wellawatte, colombo 06"),
    `got: "${t}"`
  );
  assert("Step 2: shows A/B options", t.includes("**A.**") && t.includes("**B.**"), `got: "${t}"`);

  // Step 3 — confirm address with "A" → should advance to date prompt
  console.log("  User → \"A\"");
  r = await sendMessage(session, "A");
  t = text(r);
  console.log(`  AI  ← "${t.replace(/\n/g, " ").substring(0, 120)}..."`);
  assert(
    "Step 3: transitions to date prompt",
    t.toLowerCase().includes("delivered") || t.toLowerCase().includes("when") || t.toLowerCase().includes("date"),
    `got: "${t}"`
  );

  // Step 4 — provide date → should produce either success or failure response
  // (real MCP API — we accept both outcomes, just verify the state machine ran)
  console.log("  User → \"tomorrow\"");
  r = await sendMessage(session, "tomorrow");
  t = text(r);
  console.log(`  AI  ← "${t.replace(/\n/g, " ").substring(0, 140)}..."`);
  const dateProcessed =
    t.toLowerCase().includes("delivery") ||   // success or failure mentions delivery
    t.toLowerCase().includes("aiyoo") ||       // Sri Lankan failure expression
    t.toLowerCase().includes("great news") ||  // success expression
    t.toLowerCase().includes("deliver to");    // recovery options
  assert(
    "Step 4: state machine processed date (success or failure)",
    dateProcessed,
    `response was empty or unexpected: "${t}"`
  );
}

// ─── Scenario 2: Vague Address → rejection → good address ─────────────────────

async function scenario2_vagueAddressRejected() {
  console.log("\n═══ SCENARIO 2: Vague Address Rejected ═══");
  const session = uid();

  // Trigger flow
  await sendMessage(session, "Check delivery", "check_delivery");

  // Send vague city-only address
  console.log("  User → \"jaffna\"");
  let r = await sendMessage(session, "jaffna");
  let t = text(r);
  console.log(`  AI  ← "${t.replace(/\n/g, " ").substring(0, 140)}..."`);
  assert(
    "Step 1: rejects vague address",
    t.toLowerCase().includes("more detail") ||
    t.toLowerCase().includes("detail") ||
    t.toLowerCase().includes("house") ||
    t.toLowerCase().includes("road") ||
    t.toLowerCase().includes("aiyoo"),
    `got: "${t}"`
  );

  // Send a proper address
  console.log("  User → \"No 12 Hospital Road Jaffna\"");
  r = await sendMessage(session, "No 12 Hospital Road Jaffna");
  t = text(r);
  console.log(`  AI  ← "${t.replace(/\n/g, " ").substring(0, 140)}..."`);
  assert(
    "Step 2: normalizes corrected address",
    t.toLowerCase().includes("no 12, hospital road, jaffna"),
    `got: "${t}"`
  );
  assert(
    "Step 2: shows A/B confirm options",
    t.includes("**A.**") && t.includes("**B.**"),
    `got: "${t}"`
  );
}

// ─── Scenario 3: Address correction (reply B to edit) ─────────────────────────

async function scenario3_editAddress() {
  console.log("\n═══ SCENARIO 3: Address Edit (reply B) ═══");
  const session = uid();

  await sendMessage(session, "Check delivery", "check_delivery");
  await sendMessage(session, "No 10 Galle Road Colombo");

  // Reject address with "B"
  console.log("  User → \"B\"");
  let r = await sendMessage(session, "B");
  let t = text(r);
  console.log(`  AI  ← "${t.replace(/\n/g, " ").substring(0, 140)}..."`);
  assert(
    "Replying B re-prompts for address",
    t.toLowerCase().includes("address"),
    `got: "${t}"`
  );
}

// ─── Scenario 4: Delivery failure & recovery (unsupported city) ───────────────

async function scenario4_failureAndRecovery() {
  console.log("\n═══ SCENARIO 4: Delivery Failure & Recovery (Mullaitivu) ═══");
  const session = uid();

  // Step 1 — provide address in unsupported city
  await sendMessage(session, "Check delivery", "check_delivery");

  console.log("  User → \"No 10 Beach Road Mullaitivu\"");
  let r = await sendMessage(session, "No 10 Beach Road Mullaitivu");
  let t = text(r);
  console.log(`  AI  ← "${t.replace(/\n/g, " ").substring(0, 140)}..."`);
  assert("Step 1: shows address confirmation", t.includes("**A.**"), `got: "${t}"`);

  // Step 2 — confirm address
  console.log("  User → \"A\"");
  r = await sendMessage(session, "A");
  t = text(r);
  console.log(`  AI  ← "${t.replace(/\n/g, " ").substring(0, 140)}..."`);
  assert(
    "Step 2: transitions to date prompt",
    t.toLowerCase().includes("when") || t.toLowerCase().includes("date") || t.toLowerCase().includes("deliver"),
    `got: "${t}"`
  );

  // Step 3 — send a date (Mullaitivu is not serviced so should return failure)
  console.log("  User → \"tomorrow\"");
  r = await sendMessage(session, "tomorrow");
  t = text(r);
  console.log(`  AI  ← "${t.replace(/\n/g, " ").substring(0, 160)}..."`);
  const failureTriggered =
    t.toLowerCase().includes("aiyoo") ||
    (t.toLowerCase().includes("deliver") && t.includes("**A.**"));
  assert("Step 3: delivery failure triggered with options", failureTriggered, `got: "${t}"`);

  if (failureTriggered && t.includes("**A.**")) {
    // Step 4 — pick recovery option A (nearest city)
    console.log("  User → \"A\"");
    r = await sendMessage(session, "A");
    t = text(r);
    console.log(`  AI  ← "${t.replace(/\n/g, " ").substring(0, 160)}..."`);
    const recoveryProcessed =
      t.toLowerCase().includes("check delivery for") ||
      t.toLowerCase().includes("deliver") ||
      t.toLowerCase().includes("great news") ||
      t.toLowerCase().includes("aiyoo");
    assert("Step 4: nearest city recovery executed", recoveryProcessed, `got: "${t}"`);
  }
}

// ─── Scenario 5: Cancel flow ───────────────────────────────────────────────────

async function scenario5_cancelFlow() {
  console.log("\n═══ SCENARIO 5: Cancel at Date Step ═══");
  const session = uid();

  await sendMessage(session, "Check delivery", "check_delivery");
  await sendMessage(session, "No 5 Temple Road Kandy");
  await sendMessage(session, "A"); // confirm address

  console.log("  User → \"cancel\"");
  const r = await sendMessage(session, "cancel");
  const t = text(r);
  console.log(`  AI  ← "${t.replace(/\n/g, " ").substring(0, 140)}..."`);
  assert(
    "Cancel keyword terminates delivery flow",
    t.toLowerCase().includes("cancel") || t.toLowerCase().includes("no problem"),
    `got: "${t}"`
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function runAll() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║  E2E CONVERSATIONAL DELIVERY STATE MACHINE TESTS     ║");
  console.log("╚══════════════════════════════════════════════════════╝");

  try {
    await scenario1_goodAddressFlow();
    await scenario2_vagueAddressRejected();
    await scenario3_editAddress();
    await scenario4_failureAndRecovery();
    await scenario5_cancelFlow();
  } catch (err) {
    console.error("\n💥 Unexpected test error:", err.message, err.stack);
    process.exit(1);
  }

  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log(`║  RESULTS: ${String(passed).padStart(2)} passed, ${String(failed).padStart(2)} failed                        ║`);
  console.log("╚══════════════════════════════════════════════════════╝\n");

  if (failed > 0) {
    console.error("Failed assertions:", errors.join(", "));
    process.exit(1);
  }
}

runAll();

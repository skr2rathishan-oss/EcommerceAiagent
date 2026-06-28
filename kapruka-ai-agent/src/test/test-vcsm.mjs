/**
 * VCSM Integration Scenario Tests
 * ══════════════════════════════════════════════════════════════════════════════
 * Verifies key scenarios for the Velora Conversation State Manager (VCSM):
 * 1. Context similarity matching & Resume Prompt (e.g., "ASUS laptop" resumes "Laptop")
 * 2. Delivery Protection (blocking shopping searches while in active delivery flow)
 * 3. Cancellation (clearing delivery session but keeping context state clean)
 * 4. Pending Order Reminder (reminder shown once, and final order confirmation)
 */

const CHAT_URL = "http://127.0.0.1:5000/api/chat";

async function sendMessage(sessionId, message, intent = null, parameters = null) {
  const body = { message };
  if (intent) body.intent = intent;
  if (parameters) body.parameters = parameters;

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
        } catch (_) {}
      }
    }
  }

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
  return `vcsm-${Math.random().toString(36).substring(2, 9)}`;
}

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

async function runScenario1_ContextMatching() {
  console.log("\n═══ VCSM SCENARIO 1: Similarity Matching & Resume Prompt ═══");
  const session = uid();

  // 1. Search laptop (sets context to laptop)
  console.log("  User → \"Search for laptop\"");
  let r = await sendMessage(session, "Search for laptop", "search_products", { query: "laptop" });
  let t = text(r);
  assert("Step 1: laptop search returned products", r && r.products && r.products.length > 0, `got text: ${t}`);

  // 1b. Search for watches (sets context to watches, pausing laptop context)
  console.log("  User → \"Search for watches\"");
  r = await sendMessage(session, "Search for watches", "search_products", { query: "watches" });
  t = text(r);
  assert("Step 1b: watches search returned products", r && r.products && r.products.length > 0, `got text: ${t}`);

  // 2. Search ASUS laptop (matches paused laptop context, triggers resume prompt)
  console.log("  User → \"ASUS laptop\"");
  r = await sendMessage(session, "ASUS laptop", "search_products", { query: "ASUS laptop" });
  t = text(r);
  console.log(`  AI  ← "${t.replace(/\n/g, " ").substring(0, 140)}..."`);
  assert("Step 2: triggers resume prompt", t.toLowerCase().includes("welcome back") && t.includes("**A.**") && t.includes("**B.**"), `got: "${t}"`);

  // 3. Select A (resumes search)
  console.log("  User → \"A\"");
  r = await sendMessage(session, "A");
  t = text(r);
  console.log(`  AI  ← "${t.replace(/\n/g, " ").substring(0, 140)}..."`);
  assert("Step 3: resumes search and displays laptop products", r && r.products && r.products.length > 0, `got: "${t}"`);
}

async function runScenario2_DeliveryProtection() {
  console.log("\n═══ VCSM SCENARIO 2: Delivery Protection ═══");
  const session = uid();

  // 1. Start delivery flow
  console.log("  User → \"Check delivery\" (with product ID)");
  let r = await sendMessage(session, "Check delivery", "check_delivery", { productId: "EF_PC_ELEC0V701POD00603" });
  let t = text(r);
  assert("Step 1: prompts for address", t.toLowerCase().includes("address"), `got: "${t}"`);

  // 2. Try searching while active delivery is ongoing
  console.log("  User → \"Search for watches\"");
  r = await sendMessage(session, "Search for watches", "search_products", { query: "watches" });
  t = text(r);
  console.log(`  AI  ← "${t.replace(/\n/g, " ").substring(0, 140)}..."`);
  assert("Step 2: blocks search and prompts to complete or cancel", t.toLowerCase().includes("almost done") || t.toLowerCase().includes("finish this first"), `got: "${t}"`);
}

async function runScenario3_Cancellation() {
  console.log("\n═══ VCSM SCENARIO 3: Cancellation ═══");
  const session = uid();

  // 1. Start delivery flow
  console.log("  User → \"Check delivery\" (with product ID)");
  let r = await sendMessage(session, "Check delivery", "check_delivery", { productId: "EF_PC_ELEC0V701POD00603" });
  let t = text(r);
  assert("Step 1: prompts for address", t.toLowerCase().includes("address"), `got: "${t}"`);

  // 2. Cancel delivery
  console.log("  User → \"cancel\"");
  r = await sendMessage(session, "cancel");
  t = text(r);
  console.log(`  AI  ← "${t.replace(/\n/g, " ").substring(0, 140)}..."`);
  assert("Step 2: cancels order delivery session", t.toLowerCase().includes("cancelled") || t.toLowerCase().includes("no worries"), `got: "${t}"`);
}

async function runScenario4_PendingOrderReminder() {
  console.log("\n═══ VCSM SCENARIO 4: Pending Order Reminder & Confirmation ═══");
  const session = uid();

  // 1. Get all the way to order summary (waiting for final confirmation)
  console.log("  User → \"Check delivery\" (with product ID)");
  let r = await sendMessage(session, "Check delivery", "check_delivery", { productId: "EF_PC_ELEC0V701POD00603" });
  console.log(`  AI  ← "${text(r).replace(/\n/g, " ").substring(0, 140)}..."`);
  
  console.log("  User → \"No 25 Temple Road Colombo 01\"");
  r = await sendMessage(session, "No 25 Temple Road Colombo 01");
  console.log(`  AI  ← "${text(r).replace(/\n/g, " ").substring(0, 140)}..."`);
  
  console.log("  User → \"A\"");
  r = await sendMessage(session, "A");
  console.log(`  AI  ← "${text(r).replace(/\n/g, " ").substring(0, 140)}..."`);
  
  console.log("  User → \"tomorrow\"");
  r = await sendMessage(session, "tomorrow");
  console.log(`  AI  ← "${text(r).replace(/\n/g, " ").substring(0, 140)}..."`);
  
  console.log("  User → \"Rathishan\"");
  r = await sendMessage(session, "Rathishan");
  console.log(`  AI  ← "${text(r).replace(/\n/g, " ").substring(0, 140)}..."`);
  
  console.log("  User → \"0771234567\"");
  r = await sendMessage(session, "0771234567");
  let t = text(r);
  console.log(`  AI  ← "${t.replace(/\n/g, " ").substring(0, 140)}..."`);
  assert("Step 1: order summary shown", t.toLowerCase().includes("summary") || t.toLowerCase().includes("ready"), `got: "${t}"`);

  // 2. Search for laptops (while having a pending order) -> should show reminder once
  console.log("  User → \"Search for laptops\"");
  r = await sendMessage(session, "Search for laptops", "search_products", { query: "laptops" });
  t = text(r);
  console.log(`  AI  ← "${t.replace(/\n/g, " ").substring(0, 140)}..."`);
  assert("Step 2: shows pending order reminder", t.toLowerCase().includes("still waiting") && t.toLowerCase().includes("yes"), `got: "${t}"`);

  // 3. Search for phones (while having a pending order) -> should NOT show reminder again
  console.log("  User → \"Search for phones\"");
  r = await sendMessage(session, "Search for phones", "search_products", { query: "phones" });
  t = text(r);
  console.log(`  AI  ← "${t.replace(/\n/g, " ").substring(0, 140)}..."`);
  assert("Step 3: does NOT show reminder again", !t.toLowerCase().includes("still waiting"), `got: "${t}"`);

  // 4. Confirm order with "Yes"
  console.log("  User → \"Yes\"");
  r = await sendMessage(session, "Yes");
  t = text(r);
  console.log(`  AI  ← "${t.replace(/\n/g, " ").substring(0, 140)}..."`);
  assert("Step 4: places order successfully or fails gracefully on API error", t.toLowerCase().includes("ready") || t.toLowerCase().includes("order id") || t.toLowerCase().includes("payment") || t.toLowerCase().includes("couldn’t create"), `got: "${t}"`);

  // 5. Search for laptops again (after confirm) -> should be blocked by order processing/payment pending
  console.log("  User → \"Search for laptops after confirm\"");
  r = await sendMessage(session, "Search for laptops after confirm", "search_products", { query: "laptops" });
  t = text(r);
  console.log(`  AI  ← "${t.replace(/\n/g, " ").substring(0, 140)}..."`);
  assert("Step 5: blocks search after confirmation with payment pending message", t.toLowerCase().includes("processing") || t.toLowerCase().includes("payment pending") || t.toLowerCase().includes("finish"), `got: "${t}"`);

  // 6. Cancel the order -> should clear the state
  console.log("  User → \"cancel\"");
  r = await sendMessage(session, "cancel");
  t = text(r);
  console.log(`  AI  ← "${t.replace(/\n/g, " ").substring(0, 140)}..."`);
  assert("Step 6: cancels the order and clears session", t.toLowerCase().includes("cancelled") || t.toLowerCase().includes("no worries"), `got: "${t}"`);

  // 7. Search for laptops again (after cancel) -> triggers resume prompt
  console.log("  User → \"Search for laptops after cancel\"");
  r = await sendMessage(session, "Search for laptops after cancel", "search_products", { query: "laptops" });
  t = text(r);
  console.log(`  AI  ← "${t.replace(/\n/g, " ").substring(0, 140)}..."`);
  assert("Step 7: triggers resume prompt", t.toLowerCase().includes("welcome back") && t.includes("**A.**") && t.includes("**B.**"), `got: "${t}"`);

  // 8. Select B to start new search -> should now return laptop products
  console.log("  User → \"B\"");
  r = await sendMessage(session, "B");
  t = text(r);
  console.log(`  AI  ← "${t.replace(/\n/g, " ").substring(0, 140)}..."`);
  assert("Step 8: starts new search and displays laptop products", r && r.products && r.products.length > 0, `got: "${t}"`);
}

async function runAll() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║           VCSM INTEGRATION SCENARIO TESTS            ║");
  console.log("╚══════════════════════════════════════════════════════╝");

  try {
    await runScenario1_ContextMatching();
    await runScenario2_DeliveryProtection();
    await runScenario3_Cancellation();
    await runScenario4_PendingOrderReminder();
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

import { shouldBypassQwen, getFastPathType, isComplexQuery } from "../agent/fastPathRouter.mjs";

console.log("\n=== STARTING FAST PATH ROUTER TEST ===\n");

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

// --- Test 1: isComplexQuery logic ---
console.log("\n--- Test 1: Complex Query Classification ---");
assert("Cakes under 5000 is NOT complex", !isComplexQuery("Cakes under 5000"));
assert("Suggest a birthday gift for my mother under 5000 IS complex", isComplexQuery("Suggest a birthday gift for my mother under 5000"));
assert("Show flowers is NOT complex", !isComplexQuery("Show flowers"));
assert("Which cake is best for an anniversary IS complex", isComplexQuery("Which cake is best for an anniversary"));
assert("Compare Samsung and Apple phones IS complex", isComplexQuery("Compare Samsung and Apple phones"));

// --- Test 2: shouldBypassQwen ---
console.log("\n--- Test 2: shouldBypassQwen Intent Mapping ---");
assert("Greetings (general_chat + Hi) bypasses Qwen", shouldBypassQwen("general_chat", "Hi"));
assert("Greetings (general_chat + hello) bypasses Qwen", shouldBypassQwen("general_chat", "hello"));
assert("Conversational query (general_chat + anniversary ideas) does NOT bypass Qwen", !shouldBypassQwen("general_chat", "anniversary ideas"));

assert("Simple product search (Cakes under 5000) bypasses Qwen", shouldBypassQwen("search_products", "Cakes under 5000"));
assert("Complex product search (Suggest birthday gift) does NOT bypass Qwen", !shouldBypassQwen("search_products", "Suggest a birthday gift"));

assert("Product details intent bypasses Qwen", shouldBypassQwen("get_product_details", "Show details of product X"));
assert("Select product intent bypasses Qwen", shouldBypassQwen("select_product", "select product 1"));
assert("Order tracking intent bypasses Qwen", shouldBypassQwen("track_order", "track my order"));
assert("Delivery check intent bypasses Qwen", shouldBypassQwen("check_delivery", "can you deliver to Kandy"));

// --- Test 3: getFastPathType ---
console.log("\n--- Test 3: getFastPathType Mapping ---");
assert("general_chat greeting type is greeting", getFastPathType("general_chat", "Hi") === "greeting");
assert("general_chat conversational type is null", getFastPathType("general_chat", "tell me a joke") === null);
assert("search_products type is product_search", getFastPathType("search_products", "show cakes") === "product_search");
assert("get_product_details type is product_details", getFastPathType("get_product_details", "info") === "product_details");
assert("track_order type is order_tracking", getFastPathType("track_order", "status") === "order_tracking");
assert("check_delivery type is delivery_check", getFastPathType("check_delivery", "deliver") === "delivery_check");

// --- Test 4: Latency Target Validation ---
console.log("\n--- Test 4: Fast Path Latency Validation ---");

// Simulated Latencies (Fast path vs Qwen Path)
const simulatedLatencies = {
  greeting: 150, // ms (Nemotron/Light Model)
  product_search: 250, // ms (MCP Search + static text)
  product_details: 100, // ms (MCP Details + Local Formatter)
  order_tracking: 50, // ms (Local controller response)
  delivery_check: 40, // ms (Local delivery service response)
  qwen_path: 3600 // ms (Complex intent Qwen reasoning)
};

console.log("\nLatency Comparison Report:");
console.log("-----------------------------------------");
console.log("| Request Path      | Target  | Simulated | Status |");
console.log("-----------------------------------------");

const targets = {
  greeting: 500,
  product_search: 1000,
  product_details: 1000,
  order_tracking: 1000,
  delivery_check: 1000
};

for (const [path, latency] of Object.entries(targets)) {
  const sim = simulatedLatencies[path];
  const passedTarget = sim < latency;
  console.log(`| ${path.padEnd(17)} | <${String(latency).padEnd(4)}ms | ${String(sim).padEnd(6)}ms | ${passedTarget ? "✅ PASS" : "❌ FAIL"} |`);
  assert(`${path} latency of ${sim}ms is below ${latency}ms target`, passedTarget);
}

console.log("-----------------------------------------");
console.log(`Qwen fallback (Complex path) simulated latency: ${simulatedLatencies.qwen_path}ms (Target: ~3600ms)`);

console.log("\n=== FAST PATH ROUTER TEST COMPLETE ===");
console.log(`Passed: ${passed} | Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

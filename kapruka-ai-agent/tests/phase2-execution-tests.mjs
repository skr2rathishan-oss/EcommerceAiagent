// ============================================================
// tests/phase2-execution-tests.mjs
// Phase 2 – MCP Backend Execution Tests (complete rewrite)
// ============================================================
// Strategy:
//   - Positive tests (expectSuccess): valid input → must succeed
//   - Negative tests (expectFailure): invalid input → must error
//   - Full raw MCP response logged for every call
//   - Detailed failure block when a test does not pass
//   - Final summarized report with suspected MCP bug detection
// ============================================================

import { readFile } from "node:fs/promises";
import { expectSuccess, expectFailure, printFinalReport } from "./mcp-test-utils.mjs";

// ── Load & print the kapruka_create_order schema at startup ─────────────────
const toolsDefPath = new URL("../mcp_tools.json", import.meta.url);
const toolsDef     = JSON.parse(await readFile(toolsDefPath, "utf8"));
const toolsMap     = new Map(toolsDef.tools.map(t => [t.name, t]));

console.log("Phase 2 tests starting\n");

// Print create_order input schema so we can verify required fields
const createOrderTool = toolsMap.get("kapruka_create_order");
console.log("kapruka_create_order input schema (required fields):");
console.log(
  JSON.stringify(
    createOrderTool?.inputSchema?.$defs?.CreateOrderInput?.required ?? [],
    null, 2
  )
);
console.log("\nFull CreateOrderInput schema:");
console.log(JSON.stringify(createOrderTool?.inputSchema?.$defs?.CreateOrderInput ?? {}, null, 2));

// ── Shared date helpers ───────────────────────────────────────────────────────
const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
  .toISOString()
  .split("T")[0];

// ── VALID order payload (all required fields filled) ─────────────────────────
const VALID_ORDER = {
  cart:      [{ product_id: "cake00ka002034", quantity: 1 }],
  recipient: { name: "Bob Silva",  phone: "+94771234567" },
  delivery:  {
    address:       "45 Galle Road",
    city:          "Colombo 03",
    date:          tomorrow,
    location_type: "house",
  },
  sender:    { name: "Alice", anonymous: false },
};

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n=== Phase 2 – MCP Backend Execution Tests ===\n");

// ─── 1. kapruka_search_products ──────────────────────────────────────────────
console.log("\n── kapruka_search_products ──────────────────────────");

await expectSuccess(
  "kapruka_search_products",
  { params: { q: "birthday cake", limit: 5, response_format: "json", in_stock_only: true } },
  "Valid keyword search"
);

await expectSuccess(
  "kapruka_search_products",
  { params: { q: "roses", category: "Flowers", limit: 3, response_format: "json" } },
  "Category filter search"
);

await expectSuccess(
  "kapruka_search_products",
  { params: { q: "nonexistent-product-xyz-abc", limit: 5, response_format: "json" } },
  "Zero-results search (empty results, not an error)"
);

// ─── 2. kapruka_get_product ───────────────────────────────────────────────────
console.log("\n── kapruka_get_product ──────────────────────────────");

await expectSuccess(
  "kapruka_get_product",
  { params: { product_id: "cake00ka002034", response_format: "json" } },
  "Valid product ID"
);

// Negative: invalid product ID should return product_not_found error
await expectFailure(
  "kapruka_get_product",
  { params: { product_id: "invalid-id-12345", response_format: "json" } },
  "Invalid product ID → expect product_not_found"
);

// ─── 3. kapruka_list_categories ───────────────────────────────────────────────
console.log("\n── kapruka_list_categories ──────────────────────────");

await expectSuccess(
  "kapruka_list_categories",
  { params: { depth: 1, response_format: "json" } },
  "List top-level categories"
);

await expectSuccess(
  "kapruka_list_categories",
  { params: { depth: 2, response_format: "json" } },
  "List categories with depth 2"
);

// ─── 4. kapruka_list_delivery_cities ──────────────────────────────────────────
console.log("\n── kapruka_list_delivery_cities ─────────────────────");

await expectSuccess(
  "kapruka_list_delivery_cities",
  { params: { query: "colombo", limit: 5, response_format: "json" } },
  "Search for Colombo zones"
);

await expectSuccess(
  "kapruka_list_delivery_cities",
  { params: { query: "galle", limit: 5, response_format: "json" } },
  "Search for Galle"
);

// ─── 5. kapruka_check_delivery ────────────────────────────────────────────────
console.log("\n── kapruka_check_delivery ───────────────────────────");

await expectSuccess(
  "kapruka_check_delivery",
  { params: { city: "Colombo 03", delivery_date: tomorrow, response_format: "json" } },
  "Valid city + future date"
);

// Negative: city that Kapruka does not serve → expect city_not_supported
await expectFailure(
  "kapruka_check_delivery",
  { params: { city: "InvalidCityXYZ", delivery_date: "2099-01-01", response_format: "json" } },
  "Invalid city → expect city_not_supported"
);

// ─── 6. kapruka_create_order ──────────────────────────────────────────────────
console.log("\n── kapruka_create_order ─────────────────────────────");

// Positive: fully valid payload
await expectSuccess(
  "kapruka_create_order",
  { params: { ...VALID_ORDER, response_format: "json" } },
  "Valid order – all required fields present"
);

// Negative 1: missing recipient
await expectFailure(
  "kapruka_create_order",
  {
    params: {
      cart:     VALID_ORDER.cart,
      delivery: VALID_ORDER.delivery,
      sender:   VALID_ORDER.sender,
      response_format: "json",
    },
  },
  "Missing recipient → expect validation_error"
);

// Negative 2: missing delivery
await expectFailure(
  "kapruka_create_order",
  {
    params: {
      cart:      VALID_ORDER.cart,
      recipient: VALID_ORDER.recipient,
      sender:    VALID_ORDER.sender,
      response_format: "json",
    },
  },
  "Missing delivery → expect validation_error"
);

// Negative 3: invalid product in cart
await expectFailure(
  "kapruka_create_order",
  {
    params: {
      cart:      [{ product_id: "invalid-product-abc", quantity: 1 }],
      recipient: VALID_ORDER.recipient,
      delivery:  VALID_ORDER.delivery,
      sender:    VALID_ORDER.sender,
      response_format: "json",
    },
  },
  "Invalid product ID in cart → expect product_not_found"
);

// ─── 7. kapruka_track_order ───────────────────────────────────────────────────
console.log("\n── kapruka_track_order ──────────────────────────────");

// Negative: non-existent order → expect order_not_found
await expectFailure(
  "kapruka_track_order",
  { params: { order_number: "VIMP00000000", response_format: "json" } },
  "Non-existent order → expect order_not_found"
);

// ─────────────────────────────────────────────────────────────────────────────
// Final report
// ─────────────────────────────────────────────────────────────────────────────
printFinalReport();

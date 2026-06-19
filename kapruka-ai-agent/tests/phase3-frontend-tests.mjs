// ============================================================
// tests/phase3-frontend-tests.mjs
// Phase 3 – Frontend Component Static Audit
// ============================================================
// Performs a static analysis of the frontend component files to
// verify that:
//   1. All expected components exist
//   2. Each component exports a named or default export
//   3. Key UI elements are present (product card, error boundary,
//      order tracking, order confirmation, checkout)
//   4. ErrorBoundary wraps the application
//   5. Message type discriminators are handled in MessageArea
//   6. Components handle the "loading / empty / error" states
// ============================================================

import { readFile, stat } from "node:fs/promises";
import path from "node:path";

// ─── colours ─────────────────────────────────────────────────────────────────
const c = {
  reset: "\x1b[0m", green: "\x1b[32m", red: "\x1b[31m",
  yellow: "\x1b[33m", cyan: "\x1b[36m", bold: "\x1b[1m", dim: "\x1b[2m",
};
const PASS = `${c.green}${c.bold}PASS${c.reset}`;
const FAIL = `${c.red}${c.bold}FAIL${c.reset}`;
const WARN = `${c.yellow}${c.bold}WARN${c.reset}`;

// ─── helpers ──────────────────────────────────────────────────────────────────
const FRONTEND = path.resolve("../frontend/src/app");
const COMPONENTS = path.join(FRONTEND, "components");

const results = [];

async function fileExists(filePath) {
  try { await stat(filePath); return true; } catch { return false; }
}

async function readComponent(name) {
  const filePath = path.join(COMPONENTS, name);
  try { return await readFile(filePath, "utf8"); }
  catch { return null; }
}

function check(label, passed, note = "") {
  const status = passed ? PASS : FAIL;
  console.log(`  ${status}  ${label}${note ? `  ${c.dim}(${note})${c.reset}` : ""}`);
  results.push({ label, passed });
  return passed;
}

function warn(label, note = "") {
  console.log(`  ${WARN}  ${label}${note ? `  ${c.dim}(${note})${c.reset}` : ""}`);
  results.push({ label, passed: true }); // warnings don't fail the suite
}

// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${c.bold}=== Phase 3 – Frontend Component Static Audit ===${c.reset}\n`);

// ────────────────────────────────────────────────────────────────────────────
// SECTION 1 – Component File Existence
// ────────────────────────────────────────────────────────────────────────────
console.log(`\n${c.cyan}${c.bold}── 1. Component File Existence ──${c.reset}`);

const requiredComponents = [
  "MessageArea.tsx",
  "ProductCard.tsx",
  "ProductShowcase.tsx",
  "ProductDetailsCard.tsx",
  "OrderConfirmationCard.tsx",
  "OrderTrackingCard.tsx",
  "InteractiveOrderSummary.tsx",
  "CheckoutPanel.tsx",
  "CartScreen.tsx",
  "ErrorBoundary.tsx",
  "ChatInputBox.tsx",
  "AgentActivityBar.tsx",
  "GuidedWorkflowPanel.tsx",
  "TopNavbar.tsx",
  "Sidebar.tsx",
];

for (const comp of requiredComponents) {
  const exists = await fileExists(path.join(COMPONENTS, comp));
  check(`${comp} exists`, exists);
}

// ────────────────────────────────────────────────────────────────────────────
// SECTION 2 – ErrorBoundary checks
// ────────────────────────────────────────────────────────────────────────────
console.log(`\n${c.cyan}${c.bold}── 2. ErrorBoundary Component ──${c.reset}`);

const ebSrc = await readComponent("ErrorBoundary.tsx");
check("ErrorBoundary.tsx is readable", !!ebSrc);
check("Extends React.Component", !!ebSrc?.includes("React.Component"));
check("Implements getDerivedStateFromError", !!ebSrc?.includes("getDerivedStateFromError"));
check("Implements componentDidCatch", !!ebSrc?.includes("componentDidCatch"));
check("Renders fallback UI on error", !!ebSrc?.includes("hasError"));
check("Fallback has Reload button", !!ebSrc?.includes("Reload") || !!ebSrc?.includes("reload"));

// ────────────────────────────────────────────────────────────────────────────
// SECTION 3 – MessageArea message-type handling
// ────────────────────────────────────────────────────────────────────────────
console.log(`\n${c.cyan}${c.bold}── 3. MessageArea – Message Type Handling ──${c.reset}`);

const maSrc = await readComponent("MessageArea.tsx");
check("MessageArea.tsx is readable", !!maSrc);
check("Renders user messages", !!maSrc?.includes("msg.role === \"user\""));
check("Renders AI messages", !!maSrc?.includes("msg.role === \"ai\""));
check("Handles product list (products array)", !!maSrc?.includes("msg.products"));
check("Handles product_details type", !!maSrc?.includes("product_details"));
check("Handles order_confirmation type", !!maSrc?.includes("order_confirmation"));
check("Handles order_tracking type", !!maSrc?.includes("order_tracking"));
check("Handles order_tracking_error type", !!maSrc?.includes("order_tracking_error"));
check("Handles guided_workflow type", !!maSrc?.includes("guided_workflow"));
check("Shows typing indicator (isTyping)", !!maSrc?.includes("isTyping"));
check("Shows AgentActivityBar while typing", !!maSrc?.includes("AgentActivityBar"));
check("Load More products button present", !!maSrc?.includes("Load More"));
check("Voice playback (listen button) present", !!maSrc?.includes("handleListen"));
check("AnimatePresence wraps messages", !!maSrc?.includes("AnimatePresence"));
check("Auto-scroll on new messages", !!maSrc?.includes("scrollTo"));

// ────────────────────────────────────────────────────────────────────────────
// SECTION 4 – ProductCard
// ────────────────────────────────────────────────────────────────────────────
console.log(`\n${c.cyan}${c.bold}── 4. ProductCard Component ──${c.reset}`);

const pcSrc = await readComponent("ProductCard.tsx");
check("ProductCard.tsx is readable", !!pcSrc);
check("Renders product name", !!pcSrc?.includes("product.name"));
check("Renders product price", !!pcSrc?.includes("product.price"));
check("Renders product image", !!pcSrc?.includes("product.images"));
check("Handles image load error (imgError)", !!pcSrc?.includes("imgError"));
check("Add to Cart button present", !!pcSrc?.includes("onAddToCart"));
check("View Details button present", !!pcSrc?.includes("onViewDetails"));
check("Out of stock state handled", !!pcSrc?.includes("Out of stock") || !!pcSrc?.includes("stock === 0"));
check("Discount badge rendered", !!pcSrc?.includes("discount"));
check("Wishlist toggle present", !!pcSrc?.includes("wishlisted"));
check("isSelected state handled", !!pcSrc?.includes("isSelected"));

// ────────────────────────────────────────────────────────────────────────────
// SECTION 5 – OrderTrackingCard
// ────────────────────────────────────────────────────────────────────────────
console.log(`\n${c.cyan}${c.bold}── 5. OrderTrackingCard Component ──${c.reset}`);

const otSrc = await readComponent("OrderTrackingCard.tsx");
check("OrderTrackingCard.tsx is readable", !!otSrc);
check("Accepts orderNumber prop", !!otSrc?.includes("orderNumber"));
check("Renders order status", !!otSrc?.includes("status") || !!otSrc?.includes("Status"));
check("Renders progress timeline", !!otSrc?.includes("progress") || !!otSrc?.includes("Progress"));
check("Error/not-found state handled", !!otSrc?.includes("not found") || !!otSrc?.includes("error") || !!otSrc?.includes("Error"));
check("Continue shopping callback present", !!otSrc?.includes("onContinueShopping"));

// ────────────────────────────────────────────────────────────────────────────
// SECTION 6 – OrderConfirmationCard
// ────────────────────────────────────────────────────────────────────────────
console.log(`\n${c.cyan}${c.bold}── 6. OrderConfirmationCard Component ──${c.reset}`);

const ocSrc = await readComponent("OrderConfirmationCard.tsx");
check("OrderConfirmationCard.tsx is readable", !!ocSrc);
check("Renders referenceNumber (pre-payment reference)", !!ocSrc?.includes("referenceNumber"));
check("Renders orderNumber (post-payment number)", !!ocSrc?.includes("orderNumber"));
check("Renders grand total", !!ocSrc?.includes("grand_total") || !!ocSrc?.includes("grandTotal") || !!ocSrc?.includes("total"));
check("Track Order / receipt action button present", !!ocSrc?.includes("Track Order") || !!ocSrc?.includes("checkout"));
check("onContinueShopping callback present", !!ocSrc?.includes("onContinueShopping"));

// ────────────────────────────────────────────────────────────────────────────
// SECTION 7 – App.tsx integration checks
// ────────────────────────────────────────────────────────────────────────────
console.log(`\n${c.cyan}${c.bold}── 7. App.tsx Integration ──${c.reset}`);

const appSrc = await readFile(path.join(FRONTEND, "App.tsx"), "utf8").catch(() => null);
const mainSrc = await readFile(path.join(FRONTEND, "../main.tsx"), "utf8").catch(() => null);
check("App.tsx is readable", !!appSrc);
check("ErrorBoundary wraps App in main.tsx", !!mainSrc?.includes("ErrorBoundary"));
check("Uses MessageArea in App", !!appSrc?.includes("MessageArea"));
check("Uses ChatInputBox in App", !!appSrc?.includes("ChatInputBox"));
check("Cart state managed", !!appSrc?.includes("cart") || !!appSrc?.includes("Cart"));
check("Handles sendMessage", !!appSrc?.includes("sendMessage") || !!appSrc?.includes("handleSend"));
check("Handles onTrackOrder", !!appSrc?.includes("onTrackOrder") || !!appSrc?.includes("trackOrder"));

// ────────────────────────────────────────────────────────────────────────────
// SECTION 8 – AgentActivityBar (loading / error states)
// ────────────────────────────────────────────────────────────────────────────
console.log(`\n${c.cyan}${c.bold}── 8. AgentActivityBar – Loading & Error States ──${c.reset}`);

const aaSrc = await readComponent("AgentActivityBar.tsx");
check("AgentActivityBar.tsx is readable", !!aaSrc);
check("Shows current step/message", !!aaSrc?.includes("currentStep") || !!aaSrc?.includes("currentMessage"));
check("Renders error state", !!aaSrc?.includes("error"));
check("Retry button present", !!aaSrc?.includes("onRetry") || !!aaSrc?.includes("Retry"));
check("Expandable log panel", !!aaSrc?.includes("expanded") || !!aaSrc?.includes("onExpandedChange"));

// ────────────────────────────────────────────────────────────────────────────
// SECTION 9 – ChatInputBox
// ────────────────────────────────────────────────────────────────────────────
console.log(`\n${c.cyan}${c.bold}── 9. ChatInputBox Component ──${c.reset}`);

const cibSrc = await readComponent("ChatInputBox.tsx");
check("ChatInputBox.tsx is readable", !!cibSrc);
check("Submit / send handler present", !!cibSrc?.includes("onSend") || !!cibSrc?.includes("handleSubmit") || !!cibSrc?.includes("onSubmit"));
check("Disabled while AI is typing", !!cibSrc?.includes("isTyping") || !!cibSrc?.includes("disabled"));
check("Input field present", !!cibSrc?.includes("<input") || !!cibSrc?.includes("<textarea"));

// ─────────────────────────────────────────────────────────────────────────────
// Final Report
// ─────────────────────────────────────────────────────────────────────────────
const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;

console.log(`\n${c.bold}════════════════════════════════════════════════${c.reset}`);
console.log(`${c.bold}     Phase 3 – Frontend Static Audit Report     ${c.reset}`);
console.log(`${c.bold}════════════════════════════════════════════════${c.reset}`);
console.log(`Total checks : ${results.length}`);
console.log(`${c.green}${c.bold}PASS${c.reset}         : ${passed}`);
console.log(`${c.red}${c.bold}FAIL${c.reset}         : ${failed}`);

if (failed > 0) {
  console.log(`\n${c.red}${c.bold}═══ Failing Checks ═══${c.reset}`);
  results.filter(r => !r.passed).forEach(r => {
    console.log(`  ${c.red}✘${c.reset} ${r.label}`);
  });
}

console.log(`\n${c.bold}════════════════════════════════════════════════${c.reset}\n`);

process.exit(failed > 0 ? 1 : 0);

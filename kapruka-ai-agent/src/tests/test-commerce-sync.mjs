// test-commerce-sync.mjs
// Verifies that commerceState is correctly formatted and injected into shoppingContext memory.

import { getShoppingContext, updateMemory } from "../agent/memoryManager.mjs";

console.log("\n=== STARTING COMMERCE SYNC SMOKE TEST ===\n");

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

// Test 1: Empty state initial values
console.log("Test 1: Default empty state");
{
  const sessionId = "session_test_empty";
  const context = getShoppingContext(sessionId);
  
  assert("cart is an empty array", Array.isArray(context.cart) && context.cart.length === 0);
  assert("wishlist is an empty array", Array.isArray(context.wishlist) && context.wishlist.length === 0);
  assert("savedProducts is an empty array", Array.isArray(context.savedProducts) && context.savedProducts.length === 0);
  assert("cartSummary defaults to empty", context.cartSummary === "Current Cart is empty.");
}

// Test 2: Updates and Cart Summary calculation
console.log("\nTest 2: Sync and verify cart summary calculation");
{
  const sessionId = "session_test_active";
  
  const testCart = [
    { productId: "p1", name: "Chocolate Box", price: 8200, quantity: 1, brand: "Kapruka" },
    { productId: "p2", name: "Gift Hamper", price: 9600, quantity: 2, brand: "Kapruka" }
  ];

  const testWishlist = [
    { productId: "p3", name: "Flowers" }
  ];

  const testSaved = [
    { productId: "p4", name: "Cake", source: "recommendation" }
  ];

  // Emulate logic from chat.controller.mjs
  let cartSummary = "Current Cart is empty.";
  if (testCart && testCart.length > 0) {
    const itemsText = testCart.map(item => `${item.quantity}x ${item.name} - Rs.${item.price}`).join("\n");
    const total = testCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    cartSummary = `Current Cart:\n${itemsText}\n\nTotal:\nRs.${total}`;
  }

  updateMemory(sessionId, {
    cart: testCart,
    wishlist: testWishlist,
    savedProducts: testSaved,
    cartSummary
  });

  const context = getShoppingContext(sessionId);

  assert("cart contains p1 and p2", context.cart.length === 2);
  assert("cart[0].productId is p1", context.cart[0].productId === "p1");
  assert("wishlist contains p3", context.wishlist.length === 1);
  assert("savedProducts contains p4", context.savedProducts.length === 1);
  assert("cartSummary matches formatted summary", context.cartSummary.includes("Current Cart:\n1x Chocolate Box - Rs.8200\n2x Gift Hamper - Rs.9600"));
  assert("cartSummary includes correct Total", context.cartSummary.includes("Total:\nRs.27400"));
  
  console.log("\nGenerated Cart Summary System Prompt Block:\n");
  console.log(context.cartSummary);
  console.log("\n-------------------------------------------");
}

console.log(`\n=== COMMERCE SYNC SMOKE TEST COMPLETE ===`);
console.log(`Passed: ${passed} | Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
}

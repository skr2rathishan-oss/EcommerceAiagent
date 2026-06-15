// ── Session Memory Manager ──────────────────────────────────────────────────
// Stores arbitrary per-session state in memory.
// No persistence — resets on server restart.

const sessions = new Map();

export function getMemory(sessionId) {
  return sessions.get(sessionId) || {};
}

export function updateMemory(sessionId, updates) {
  const current = getMemory(sessionId);

  sessions.set(sessionId, {
    ...current,
    ...updates,
  });
}

// ── Shopping Context ─────────────────────────────────────────────────────────
// Stores product search results and the currently selected product per session.
// Used for the product interaction flow and future in-memory filtering.
//
// Shape:
// {
//   lastSearchResults: [],   // products from the last search_products call
//   selectedProduct: null    // the product the user last clicked on
// }

export function getShoppingContext(sessionId) {
  const memory = getMemory(sessionId);
  const base = memory.shoppingContext || {
    lastSearchResults: [],
    selectedProduct: null,
  };
  return {
    ...base,
    cart: memory.cart || [],
    wishlist: memory.wishlist || [],
    savedProducts: memory.savedProducts || [],
    cartSummary: memory.cartSummary || "Current Cart is empty."
  };
}

export function updateShoppingContext(sessionId, updates) {
  const current = getShoppingContext(sessionId);
  updateMemory(sessionId, {
    shoppingContext: {
      ...current,
      ...updates,
    },
  });
}
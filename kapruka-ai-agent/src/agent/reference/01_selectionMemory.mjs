/**
 * ============================================================
 * Velora AI
 * Selection Memory
 * ------------------------------------------------------------
 * Stores the latest product result set shown to the user.
 * Used by the Reference Engine to resolve:
 *
 * - first product
 * - second phone
 * - third mobile
 * - this one
 * - that one
 * - last item
 *
 * This data is INTERNAL ONLY.
 * Product IDs must never be exposed to the user.
 * ============================================================
 */

const selectionStore = new Map();

/**
 * Save latest product search results.
 */
export function saveSelection(sessionId, products = []) {
    if (!sessionId) return;

    selectionStore.set(sessionId, {
        timestamp: Date.now(),
        products: Array.isArray(products) ? products : [],
        lastSelectedIndex: null,
        lastSelectedProduct: null
    });
}

/**
 * Get current selection state.
 */
export function getSelection(sessionId) {
    return selectionStore.get(sessionId) || null;
}

/**
 * Update currently selected product.
 */
export function setCurrentSelection(sessionId, index) {
    const state = selectionStore.get(sessionId);

    if (!state) return;

    if (index < 0 || index >= state.products.length) return;

    state.lastSelectedIndex = index;
    state.lastSelectedProduct = state.products[index];

    selectionStore.set(sessionId, state);
}

/**
 * Get current selected product.
 */
export function getCurrentSelection(sessionId) {
    const state = selectionStore.get(sessionId);

    if (!state) return null;

    return state.lastSelectedProduct;
}

/**
 * Get product by list index.
 */
export function getProductByIndex(sessionId, index) {
    const state = selectionStore.get(sessionId);

    if (!state) return null;

    if (index < 0 || index >= state.products.length) {
        return null;
    }

    return state.products[index];
}

/**
 * Get all products.
 */
export function getProducts(sessionId) {
    const state = selectionStore.get(sessionId);

    return state?.products || [];
}

/**
 * Clear current selection only.
 * Keeps the product list for future references.
 */
export function clearCurrentSelection(sessionId) {
    const state = selectionStore.get(sessionId);

    if (!state) return;

    state.lastSelectedIndex = null;
    state.lastSelectedProduct = null;

    selectionStore.set(sessionId, state);
}

/**
 * Completely remove selection memory.
 */
export function clearSelection(sessionId) {
    selectionStore.delete(sessionId);
}

/**
 * Useful for debugging.
 */
export function getSelectionSummary(sessionId) {
    const state = selectionStore.get(sessionId);

    if (!state) {
        return {
            exists: false
        };
    }

    return {
        exists: true,
        productCount: state.products.length,
        lastSelectedIndex: state.lastSelectedIndex,
        lastSelectedProductName:
            state.lastSelectedProduct?.name ||
            state.lastSelectedProduct?.title ||
            null,
        timestamp: state.timestamp
    };
}
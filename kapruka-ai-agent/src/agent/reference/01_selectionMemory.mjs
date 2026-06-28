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

import { getShoppingContext, updateShoppingContext } from "../memoryManager.mjs";

/**
 * Save latest product search results.
 */
export function saveSelection(sessionId, products = []) {
    if (!sessionId) return;

    updateShoppingContext(sessionId, {
        lastSearchResults: Array.isArray(products) ? products : [],
        lastSelectedIndex: null,
        selectedProduct: null
    });
}

/**
 * Get current selection state.
 */
export function getSelection(sessionId) {
    const ctx = getShoppingContext(sessionId);
    if (!ctx || !ctx.lastSearchResults || ctx.lastSearchResults.length === 0) return null;
    return {
        products: ctx.lastSearchResults,
        lastSelectedIndex: ctx.lastSelectedIndex,
        lastSelectedProduct: ctx.selectedProduct
    };
}

/**
 * Update currently selected product.
 */
export function setCurrentSelection(sessionId, index) {
    const ctx = getShoppingContext(sessionId);
    if (!ctx || !ctx.lastSearchResults) return;
    const products = ctx.lastSearchResults;

    if (index < 0 || index >= products.length) return;

    updateShoppingContext(sessionId, {
        lastSelectedIndex: index,
        selectedProduct: products[index]
    });
}

/**
 * Get current selected product.
 */
export function getCurrentSelection(sessionId) {
    const ctx = getShoppingContext(sessionId);
    return ctx ? ctx.selectedProduct : null;
}

/**
 * Get product by list index.
 */
export function getProductByIndex(sessionId, index) {
    const ctx = getShoppingContext(sessionId);
    if (!ctx || !ctx.lastSearchResults) return null;
    const products = ctx.lastSearchResults;

    if (index < 0 || index >= products.length) {
        return null;
    }

    return products[index];
}

/**
 * Get all products.
 */
export function getProducts(sessionId) {
    const ctx = getShoppingContext(sessionId);
    return ctx?.lastSearchResults || [];
}

/**
 * Clear current selection only.
 * Keeps the product list for future references.
 */
export function clearCurrentSelection(sessionId) {
    updateShoppingContext(sessionId, {
        lastSelectedIndex: null,
        selectedProduct: null
    });
}

/**
 * Completely remove selection memory.
 */
export function clearSelection(sessionId) {
    updateShoppingContext(sessionId, {
        lastSearchResults: [],
        lastSelectedIndex: null,
        selectedProduct: null
    });
}

/**
 * Useful for debugging.
 */
export function getSelectionSummary(sessionId) {
    const ctx = getShoppingContext(sessionId);

    if (!ctx || !ctx.lastSearchResults || ctx.lastSearchResults.length === 0) {
        return {
            exists: false
        };
    }

    return {
        exists: true,
        productCount: ctx.lastSearchResults.length,
        lastSelectedIndex: ctx.lastSelectedIndex,
        lastSelectedProductName:
            ctx.selectedProduct?.name ||
            ctx.selectedProduct?.title ||
            null,
        timestamp: Date.now()
    };
}
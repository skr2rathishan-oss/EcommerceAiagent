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
 * Expose raw shopping context helper.
 */
export function getSelectionContext(sessionId) {
    return getShoppingContext(sessionId);
}

/**
 * Dynamic reference index builder.
 * Decouples parsing from repetitive product parsing by creating
 * a normalized index on search results arrival.
 */
export function buildReferenceIndex(products = []) {
    const index = {
        products: [],
        categories: {},
        brands: {},
        terms: {}
    };

    if (!Array.isArray(products)) return index;

    const stopWords = new Set([
        "the", "and", "a", "of", "with", "for", "to", "in", "on", "at", "by", "an", "is", "it", "from", "this", "that"
    ]);

    products.forEach((product, idx) => {
        if (!product) return;

        const name = (product.name || product.productName || product.title || "").toLowerCase();
        const catVal = product.category;
        const category = (typeof catVal === "object" && catVal ? catVal.name : catVal) || "";
        const categoryLower = String(category).toLowerCase();
        const brand = (product.brand || "").toLowerCase();

        const item = {
            index: idx,
            id: product.id || product.product_id,
            name,
            category: categoryLower,
            brand,
            searchableTerms: []
        };

        const addTerm = (term, dictionary, indexId) => {
            if (!term) return;
            const clean = term.trim().replace(/[^\w\s]/g, "").toLowerCase();
            if (!clean || stopWords.has(clean)) return;

            if (!item.searchableTerms.includes(clean)) {
                item.searchableTerms.push(clean);
            }

            if (!dictionary[clean]) {
                dictionary[clean] = [];
            }
            if (!dictionary[clean].includes(indexId)) {
                dictionary[clean].push(indexId);
            }
        };

        // Index category (singular and plural)
        if (categoryLower) {
            addTerm(categoryLower, index.categories, idx);
            if (categoryLower.endsWith("s")) {
                addTerm(categoryLower.slice(0, -1), index.categories, idx);
            } else {
                addTerm(categoryLower + "s", index.categories, idx);
            }
        }

        // Index brand
        if (brand) {
            addTerm(brand, index.brands, idx);
        }

        // Index name tokens (singular and plural)
        const nameWords = name.split(/\s+/);
        nameWords.forEach(word => {
            addTerm(word, index.terms, idx);
            if (word.endsWith("s")) {
                addTerm(word.slice(0, -1), index.terms, idx);
            } else {
                addTerm(word + "s", index.terms, idx);
            }
        });

        index.products.push(item);
    });

    return index;
}

/**
 * Save latest product search results.
 */
export function saveSelection(sessionId, products = []) {
    if (!sessionId) return;

    const lastSearchResults = Array.isArray(products) ? products : [];
    const referenceIndex = buildReferenceIndex(lastSearchResults);

    updateShoppingContext(sessionId, {
        lastSearchResults,
        lastSelectedIndex: null,
        selectedProduct: null,
        referenceIndex
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
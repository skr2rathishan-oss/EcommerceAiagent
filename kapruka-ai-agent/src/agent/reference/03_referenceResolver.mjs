/**
 * ============================================================
 * Velora AI
 * Reference Resolver
 * ------------------------------------------------------------
 * Resolves parsed references into actual product objects.
 *
 * Example:
 *
 * User:
 * "Show me the third phone"
 *
 * Parser:
 * { type: "index", index: 2 }
 *
 * Resolver:
 * Samsung Galaxy A56 Product Object
 *
 * ============================================================
 */

import {
    getSelection,
    getCurrentSelection,
    getProductByIndex,
    getProducts,
    setCurrentSelection
} from "./01_selectionMemory.mjs";

import { parseReference } from "./02_referenceParser.mjs";

/**
 * Resolve user reference into a product.
 */
export function resolveReference(sessionId, message) {

    const parsed = parseReference(message);

    if (!parsed.detected) {
        return {
            success: false,
            reason: "NO_REFERENCE_FOUND"
        };
    }

    const state = getSelection(sessionId);

    if (!state || !state.products.length) {
        return {
            success: false,
            reason: "NO_SELECTION_MEMORY"
        };
    }

    switch (parsed.type) {

        case "index":
            return resolveByIndex(sessionId, parsed.index);

        case "last":
            return resolveLast(sessionId);

        case "current":
            return resolveCurrent(sessionId);

        case "comparison":
            return resolveComparison(sessionId, parsed.indexes);

        case "generic":
            return resolveCurrent(sessionId);

        default:
            return {
                success: false,
                reason: "UNKNOWN_REFERENCE"
            };
    }
}

/**
 * Resolve by numeric index.
 */
function resolveByIndex(sessionId, index) {

    const product = getProductByIndex(sessionId, index);

    if (!product) {
        return {
            success: false,
            reason: "PRODUCT_NOT_FOUND"
        };
    }

    setCurrentSelection(sessionId, index);

    return {
        success: true,
        type: "single",
        index,
        product
    };
}

/**
 * Resolve currently selected product.
 */
function resolveCurrent(sessionId) {

    const product = getCurrentSelection(sessionId);

    if (!product) {

        return {
            success: false,
            reason: "NO_CURRENT_SELECTION"
        };
    }

    return {
        success: true,
        type: "single",
        product
    };
}

/**
 * Resolve last product.
 */
function resolveLast(sessionId) {

    const products = getProducts(sessionId);

    if (!products.length) {

        return {
            success: false,
            reason: "EMPTY_SELECTION"
        };
    }

    const index = products.length - 1;

    setCurrentSelection(sessionId, index);

    return {

        success: true,

        type: "single",

        index,

        product: products[index]
    };
}

/**
 * Resolve comparison.
 */
function resolveComparison(sessionId, indexes = []) {

    const products = [];

    for (const index of indexes) {

        const product = getProductByIndex(sessionId, index);

        if (product) {
            products.push(product);
        }
    }

    if (!products.length) {

        return {

            success: false,

            reason: "COMPARISON_FAILED"
        };
    }

    return {

        success: true,

        type: "comparison",

        products
    };
}

/**
 * Get product safely.
 * Never expose internal IDs.
 */
export function getSafeProduct(product) {

    if (!product) return null;

    return {

        name:
            product.name ||
            product.productName ||
            product.title,

        brand: product.brand || null,

        price:
            product.price ||
            product.salePrice ||
            null,

        currency:
            product.currency || "LKR",

        image:
            product.image ||
            product.imageUrl ||
            null,

        description:
            product.description ||
            null
    };
}

/**
 * Debug helper.
 */
export function explainResolution(sessionId, message) {

    const parsed = parseReference(message);

    const resolved = resolveReference(sessionId, message);

    return {

        parsed,

        resolved
    };
}
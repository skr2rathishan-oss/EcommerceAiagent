/**
 * ============================================================
 * Velora AI
 * Reference Manager
 * ------------------------------------------------------------
 * Main orchesator for conversational product references.
 *
 * Responsibilities:
 *
 * - Detect reference requests
 * - Resolve references
 * - Validate references
 * - Update selection state
 * - Return safe product objects
 *
 * NEVER:
 * - Call MCP
 * - Call Gemini
 * - Expose Product IDs
 * ============================================================
 */

import {
    saveSelection,
    getSelectionSummary,
    clearSelection
} from "./01_selectionMemory.mjs";

import {
    parseReference,
    hasReference
} from "./02_referenceParser.mjs";

import {
    resolveReference,
    getSafeProduct
} from "./03_referenceResolver.mjs";

import {
    validateReference,
    sanitizeReferenceResponse,
    hasSelectionMemory
} from "./04_referenceValidator.mjs";

/**
 * ============================================================
 * Save search results after every successful MCP search.
 * ============================================================
 */
export function rememberSearchResults(sessionId, products = []) {

    if (!sessionId) {
        return;
    }

    saveSelection(sessionId, products);
}

/**
 * ============================================================
 * Main entry point.
 *
 * Controllers should call ONLY this function.
 * ============================================================
 */
export function handleReference(sessionId, message) {

    // Not a reference request
    if (!hasReference(message)) {

        return {

            success: false,

            handled: false,

            reason: "NOT_A_REFERENCE"
        };
    }

    // Parse user input first so we can attach it to error payloads
    const parsed = parseReference(message);

    // No previous search results
    if (!hasSelectionMemory(sessionId)) {

        return {

            success: false,

            handled: true,

            reason: "NO_SELECTION_MEMORY",

            parsed,

            response:
                "I couldn't find your previous product list. Please search for a product first."
        };
    }

    // Resolve reference
    const resolved = resolveReference(sessionId, message);

    // Validate
    const validation = validateReference(sessionId, resolved);

    if (!validation.valid) {

        return {

            success: false,

            handled: true,

            reason: validation.code,

            parsed,

            response: validation.message
        };
    }

    // Single Product
    if (resolved.type === "single") {

        const safeProduct = sanitizeReferenceResponse(
            getSafeProduct(resolved.product)
        );

        return {

            success: true,

            handled: true,

            action: "PRODUCT_SELECTED",

            parsed,

            product: safeProduct,

            internalProduct: resolved.product
        };
    }

    // Comparison
    if (resolved.type === "comparison") {

        const safeProducts = resolved.products.map(product =>
            sanitizeReferenceResponse(
                getSafeProduct(product)
            )
        );

        return {

            success: true,

            handled: true,

            action: "COMPARE_PRODUCTS",

            parsed,

            products: safeProducts,

            internalProducts: resolved.products
        };
    }

    return {

        success: false,

        handled: true,

        reason: "UNKNOWN_REFERENCE"
    };
}

/**
 * ============================================================
 * Used after new searches.
 * ============================================================
 */
export function updateSelection(sessionId, products) {

    rememberSearchResults(sessionId, products);

    return getSelectionSummary(sessionId);
}

/**
 * ============================================================
 * Reset only reference memory.
 *
 * Does NOT touch:
 * - workflow
 * - checkout
 * - delivery
 * - conversation
 * ============================================================
 */
export function resetReferenceMemory(sessionId) {

    clearSelection(sessionId);
}

/**
 * ============================================================
 * Debug
 * ============================================================
 */
export function getReferenceDiagnostics(sessionId) {

    return {

        memory: getSelectionSummary(sessionId),

        hasSelection: hasSelectionMemory(sessionId)
    };
}
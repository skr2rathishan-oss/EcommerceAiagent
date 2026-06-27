/**
 * ============================================================
 * Velora AI
 * Reference Validator
 * ------------------------------------------------------------
 * Validates resolved product references before any
 * business logic or MCP request is executed.
 *
 * Responsibilities:
 * - Validate selection memory exists
 * - Validate product index
 * - Validate current selection
 * - Return user-friendly errors
 * - Prevent internal IDs from being requested
 * ============================================================
 */

import {
    getSelection,
    getProducts,
    getCurrentSelection
} from "./01_selectionMemory.mjs";

/**
 * Validate reference resolution.
 */
export function validateReference(sessionId, resolution) {

    const state = getSelection(sessionId);

    if (!state) {
        return failure(
            "NO_SELECTION_MEMORY",
            "I couldn't find your previous product list. Let's search again."
        );
    }

    if (!state.products.length) {
        return failure(
            "EMPTY_SELECTION",
            "I couldn't find any previously viewed products."
        );
    }

    if (!resolution.success) {

        switch (resolution.reason) {

            case "PRODUCT_NOT_FOUND":
                return failure(
                    resolution.reason,
                    `I couldn't find that product. Please choose a number between 1 and ${state.products.length}.`
                );

            case "NO_CURRENT_SELECTION":
                return failure(
                    resolution.reason,
                    "Please tell me which product you mean, for example 'the second one' or 'the third phone'."
                );

            case "COMPARISON_FAILED":
                return failure(
                    resolution.reason,
                    "I couldn't compare those products. Please choose products from the current list."
                );

            default:
                return failure(
                    resolution.reason,
                    "I couldn't understand which product you meant."
                );
        }
    }

    return success(resolution);
}

/**
 * Validate product index.
 */
export function validateIndex(sessionId, index) {

    const products = getProducts(sessionId);

    if (!products.length) {

        return failure(
            "EMPTY_SELECTION",
            "No products are currently available."
        );
    }

    if (index < 0 || index >= products.length) {

        return failure(
            "INDEX_OUT_OF_RANGE",
            `Please select a product between 1 and ${products.length}.`
        );
    }

    return success({
        index,
        product: products[index]
    });
}

/**
 * Validate current selection.
 */
export function validateCurrentSelection(sessionId) {

    const product = getCurrentSelection(sessionId);

    if (!product) {

        return failure(
            "NO_CURRENT_SELECTION",
            "Please select a product first."
        );
    }

    return success(product);
}

/**
 * Check if reference memory exists.
 */
export function hasSelectionMemory(sessionId) {

    const state = getSelection(sessionId);

    return !!(
        state &&
        Array.isArray(state.products) &&
        state.products.length > 0
    );
}

/**
 * Ensure internal product IDs never reach the user.
 */
export function sanitizeReferenceResponse(product = {}) {

    const sanitized = { ...product };

    delete sanitized.id;
    delete sanitized.productId;
    delete sanitized.sku;
    delete sanitized.skuId;
    delete sanitized.itemCode;
    delete sanitized.internalId;
    delete sanitized.mongoId;
    delete sanitized.objectId;
    delete sanitized._id;
    delete sanitized.apiKey;
    delete sanitized.sessionId;
    delete sanitized.debug;
    delete sanitized.metadata;

    return sanitized;
}

/**
 * Success helper.
 */
function success(data) {

    return {

        valid: true,

        success: true,

        data,

        message: null
    };
}

/**
 * Failure helper.
 */
function failure(code, message) {

    return {

        valid: false,

        success: false,

        code,

        message
    };
}

/**
 * Debug helper.
 */
export function explainValidation(sessionId, resolution) {

    return {

        sessionExists: !!getSelection(sessionId),

        productCount: getProducts(sessionId).length,

        currentSelection: getCurrentSelection(sessionId),

        validation: validateReference(sessionId, resolution)
    };
}
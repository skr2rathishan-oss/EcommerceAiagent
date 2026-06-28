/**
 * =============================================================================
 * Velora Workflow Engine
 * =============================================================================
 *
 * File:
 *    02_workflowDetector.mjs
 *
 * Purpose:
 *    Detects which workflow the user's current message belongs to.
 *
 * Responsibilities
 * ----------------
 * ✓ Detect workflow from user intent
 * ✓ Detect greeting
 * ✓ Detect shopping
 * ✓ Detect checkout
 * ✓ Detect delivery
 * ✓ Detect tracking
 * ✓ Detect support
 * ✓ Detect recovery
 *
 * Never:
 * ✗ Validate transitions
 * ✗ Change conversation state
 * ✗ Call Gemini
 * ✗ Execute business logic
 *
 * =============================================================================
 */

import WORKFLOWS from "./01_workflowDefinitions.mjs";

/* =============================================================================
 * Detect Workflow
 * =============================================================================
 */

export function detectWorkflow({

    message = "",

    intent = "",

    decision = {},

    conversationState = {}

} = {}) {

    const text = message.toLowerCase().trim();

    /* -------------------------------------------------------------------------
     * Greeting
     * ---------------------------------------------------------------------- */

    if (

        ["hi", "hello", "hey", "vanakkam", "good morning", "good evening"]
            .includes(text)

    ) {

        return WORKFLOWS.GREETING;

    }

    /* -------------------------------------------------------------------------
     * Product Search
     * ---------------------------------------------------------------------- */

    if (

        intent === "search_products" ||

        decision.module === "shopping"

    ) {

        return WORKFLOWS.PRODUCT_SEARCH;

    }

    /* -------------------------------------------------------------------------
     * Product Details
     * ---------------------------------------------------------------------- */

    if (

        intent === "product_details"

    ) {

        return WORKFLOWS.PRODUCT_DETAILS;

    }

    /* -------------------------------------------------------------------------
     * Recommendation
     * ---------------------------------------------------------------------- */

    if (

        intent === "recommend_products"

    ) {

        return WORKFLOWS.PRODUCT_RECOMMENDATION;

    }

    /* -------------------------------------------------------------------------
     * Delivery
     * ---------------------------------------------------------------------- */

    if (

        intent === "delivery"

    ) {

        return WORKFLOWS.DELIVERY;

    }

    /* -------------------------------------------------------------------------
     * Checkout
     * ---------------------------------------------------------------------- */

    if (

        intent === "checkout"

    ) {

        return WORKFLOWS.CHECKOUT;

    }

    /* -------------------------------------------------------------------------
     * Payment
     * ---------------------------------------------------------------------- */

    if (

        intent === "payment"

    ) {

        return WORKFLOWS.PAYMENT;

    }

    /* -------------------------------------------------------------------------
     * Order Tracking
     * ---------------------------------------------------------------------- */

    if (

        intent === "track_order"

    ) {

        return WORKFLOWS.ORDER_TRACKING;

    }

    /* -------------------------------------------------------------------------
     * Order History
     * ---------------------------------------------------------------------- */

    if (

        intent === "order_history"

    ) {

        return WORKFLOWS.ORDER_HISTORY;

    }

    /* -------------------------------------------------------------------------
     * Customer Support
     * ---------------------------------------------------------------------- */

    if (

        intent === "customer_support"

    ) {

        return WORKFLOWS.CUSTOMER_SUPPORT;

    }

    /* -------------------------------------------------------------------------
     * Voice
     * ---------------------------------------------------------------------- */

    if (

        conversationState.voiceMode === true

    ) {

        return WORKFLOWS.VOICE;

    }

    /* -------------------------------------------------------------------------
     * Recovery
     * ---------------------------------------------------------------------- */

    if (

        intent === "fallback"

    ) {

        return WORKFLOWS.RECOVERY;

    }

    /* -------------------------------------------------------------------------
     * Default
     * ---------------------------------------------------------------------- */

    if (conversationState?.activeFlow?.type) {
        const activeType = conversationState.activeFlow.type;
        if (Object.values(WORKFLOWS).includes(activeType) && conversationState.activeFlow.status === "active") {
            return activeType;
        }
    }

    return WORKFLOWS.IDLE;

}

/* =============================================================================
 * Detector Metadata
 * =============================================================================
 */

export const WORKFLOW_DETECTOR_INFO = Object.freeze({

    name: "Velora Workflow Detector",

    version: "1.0.0",

    status: "Production"

});

/* =============================================================================
 * Default Export
 * =============================================================================
 */

export default detectWorkflow;
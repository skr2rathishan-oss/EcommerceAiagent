/**
 * =============================================================================
 * Velora Workflow Engine
 * =============================================================================
 *
 * File:
 *    03_workflowValidator.mjs
 *
 * Purpose:
 *    Validates whether the detected workflow transition is allowed.
 *
 * Responsibilities
 * ----------------
 * ✓ Prevent invalid workflow transitions
 * ✓ Validate required conversation state
 * ✓ Prevent accidental checkout progression
 * ✓ Prevent invalid resume actions
 * ✓ Decide whether to continue, reset or reject
 *
 * Never:
 * ✗ Detect workflow
 * ✗ Execute business logic
 * ✗ Call Gemini
 * ✗ Search products
 *
 * =============================================================================
 */

import WORKFLOWS from "./01_workflowDefinitions.mjs";

/* =============================================================================
 * Validate Workflow Transition
 * =============================================================================
 */

export function validateWorkflow({

    currentWorkflow = WORKFLOWS.IDLE,

    nextWorkflow = WORKFLOWS.IDLE,

    conversationState = {},

    message = "",

    memory = {}

} = {}) {

    const result = {

        allowed: true,

        action: "continue",

        reason: "Valid transition",

        resetWorkflow: false

    };

    /* -------------------------------------------------------------------------
     * Greeting should start fresh unless user explicitly resumes.
     * ---------------------------------------------------------------------- */

    if (

        nextWorkflow === WORKFLOWS.GREETING

    ) {

        result.allowed = true;

        result.action = "reset";

        result.reason = "Greeting starts a fresh interaction.";

        result.resetWorkflow = true;

        return result;

    }

    /* -------------------------------------------------------------------------
     * Continue Checkout
     * ---------------------------------------------------------------------- */

    if (

        nextWorkflow === WORKFLOWS.CHECKOUT

    ) {

        if (!conversationState.checkoutActive) {

            result.allowed = false;

            result.action = "reject";

            result.reason =
                "Checkout is not currently active.";

            return result;

        }

    }

    /* -------------------------------------------------------------------------
     * Continue Payment
     * ---------------------------------------------------------------------- */

    if (

        nextWorkflow === WORKFLOWS.PAYMENT

    ) {

        if (!conversationState.paymentPending) {

            result.allowed = false;

            result.action = "reject";

            result.reason =
                "No payment is currently pending.";

            return result;

        }

    }

    /* -------------------------------------------------------------------------
     * Delivery Details
     * ---------------------------------------------------------------------- */

    if (

        nextWorkflow === WORKFLOWS.DELIVERY

    ) {

        if (!conversationState.waitingForDelivery) {

            result.allowed = false;

            result.action = "reject";

            result.reason =
                "Delivery details were not requested.";

            return result;

        }

    }

    /* -------------------------------------------------------------------------
     * Product Search Resume
     * ---------------------------------------------------------------------- */

    if (

        nextWorkflow === WORKFLOWS.PRODUCT_SEARCH

    ) {

        if (

            conversationState.resumeSearch === true &&

            !conversationState.previousSearchQuery

        ) {

            result.allowed = false;

            result.action = "clarify";

            result.reason =
                "Previous search query is missing.";

            return result;

        }

    }

    /* -------------------------------------------------------------------------
     * Tracking
     * ---------------------------------------------------------------------- */

    if (

        nextWorkflow === WORKFLOWS.ORDER_TRACKING

    ) {

        if (

            !conversationState.orderReference

        ) {

            result.action = "clarify";

            result.reason =
                "Need an order reference before tracking.";

            return result;

        }

    }

    /* -------------------------------------------------------------------------
     * Prevent Empty Resume
     * ---------------------------------------------------------------------- */

    const isAffirmative = ["yes", "y", "yeah", "ok", "okay", "hari", "ow", "confirm"].includes(message.trim().toLowerCase());

    if (
        isAffirmative &&
        !conversationState.awaitingConfirmation
    ) {

        result.allowed = false;

        result.action = "clarify";

        result.reason =
            "Confirmation received but nothing is awaiting confirmation.";

        return result;

    }

    /* -------------------------------------------------------------------------
     * Phone Number Validation
     * ---------------------------------------------------------------------- */

    const phoneRegex = /^0\d{9}$/;

    if (

        phoneRegex.test(message.trim()) &&

        !conversationState.waitingForPhoneNumber

    ) {

        result.allowed = false;

        result.action = "clarify";

        result.reason =
            "Phone number received unexpectedly.";

        return result;

    }

    return result;

}

/* =============================================================================
 * Validator Metadata
 * =============================================================================
 */

export const WORKFLOW_VALIDATOR_INFO = Object.freeze({

    name: "Velora Workflow Validator",

    version: "1.0.0",

    status: "Production"

});

/* =============================================================================
 * Default Export
 * =============================================================================
 */

export default validateWorkflow;
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

    memory = {},

    intent = ""

} = {}) {

    const state = {
        ...conversationState,
        waitingForDelivery: conversationState.waitingForDelivery || conversationState.workflowContext?.waitingForDelivery,
        waitingForPhoneNumber: conversationState.waitingForPhoneNumber || conversationState.workflowContext?.waitingForPhoneNumber,
        awaitingConfirmation: conversationState.awaitingConfirmation || conversationState.workflowContext?.awaitingConfirmation,
        resumeSearch: conversationState.resumeSearch || conversationState.workflowContext?.resumeSearch,
        previousSearchQuery: conversationState.previousSearchQuery || conversationState.workflowContext?.previousSearchQuery,
        checkoutActive: conversationState.checkoutActive || conversationState.activeFlow?.type === "checkout" || conversationState.workflowContext?.currentWorkflow === "checkout",
        paymentPending: conversationState.paymentPending || conversationState.workflowContext?.waitingForPayment || conversationState.activeFlow?.type === "payment" || conversationState.workflowContext?.currentWorkflow === "payment",
        orderReference: conversationState.orderReference || conversationState.order?.orderRef || conversationState.order_id
    };

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
     * Continue Checkout & Checkout Gating
     * ---------------------------------------------------------------------- */

    if (

        nextWorkflow === WORKFLOWS.CHECKOUT

    ) {

        const isAffirmativeOrCheckout = ["yes", "y", "yeah", "ok", "okay", "hari", "ow", "confirm", "buy", "order", "checkout"].some(word => message.trim().toLowerCase().includes(word));
        
        // Priority 2/8: Enforce checkout gating
        if (currentWorkflow === WORKFLOWS.PRODUCT_SEARCH && !isAffirmativeOrCheckout) {
             result.allowed = false;
             result.action = "reject";
             result.reason = "Cannot transition directly from product search to checkout without explicit confirmation.";
             return result;
        }
        
        // If not already active, user must explicitly confirm or we need a product
        if (!state.checkoutActive && !isAffirmativeOrCheckout) {

            result.allowed = false;

            result.action = "reject";

            result.reason =
                "Checkout requires explicit confirmation.";

            return result;

        }

    }

    /* -------------------------------------------------------------------------
     * Continue Payment
     * ---------------------------------------------------------------------- */

    if (

        nextWorkflow === WORKFLOWS.PAYMENT

    ) {

        if (!state.paymentPending) {

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

        if (!state.waitingForDelivery && intent !== "check_delivery" && intent !== "delivery_flow_input") {

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

            state.resumeSearch === true &&

            !state.previousSearchQuery

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

            !state.orderReference

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

    const isAwaitingConfirmation = state.awaitingConfirmation || state.workflowContext?.awaitingConfirmation;

    if (
        isAffirmative &&
        !isAwaitingConfirmation
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

    const isWaitingForPhone = state.waitingForPhoneNumber || state.workflowContext?.waitingForPhoneNumber;

    if (

        phoneRegex.test(message.trim()) &&

        !isWaitingForPhone

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
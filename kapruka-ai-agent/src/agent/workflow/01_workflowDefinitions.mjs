/**
 * =============================================================================
 * Velora Workflow Engine
 * =============================================================================
 *
 * File:
 *    01_workflowDefinitions.mjs
 *
 * Purpose:
 *    Defines every workflow supported by Velora.
 *
 * Responsibilities
 * ----------------
 * ✓ Define workflow names
 * ✓ Define workflow metadata
 * ✓ Define default workflow
 * ✓ Provide workflow lookup
 *
 * Never:
 * ✗ Execute business logic
 * ✗ Change conversation state
 * ✗ Call Gemini
 * ✗ Make decisions
 *
 * =============================================================================
 */

export const WORKFLOWS = Object.freeze({

    IDLE: "idle",

    GREETING: "greeting",

    SHOPPING: "shopping",

    PRODUCT_SEARCH: "product_search",

    PRODUCT_DETAILS: "product_details",

    PRODUCT_RECOMMENDATION: "product_recommendation",

    DELIVERY: "delivery",

    CHECKOUT: "checkout",

    PAYMENT: "payment",

    ORDER_CONFIRMATION: "order_confirmation",

    ORDER_TRACKING: "order_tracking",

    ORDER_HISTORY: "order_history",

    CUSTOMER_SUPPORT: "customer_support",

    VOICE: "voice",

    RECOVERY: "recovery",

    GIFT_PLANNER: "gift_planner"

});

/* =============================================================================
 * Workflow Metadata
 * =============================================================================
 */

export const WORKFLOW_INFO = Object.freeze({

    idle: {

        displayName: "Idle",

        interruptible: true,

        resumable: false

    },

    greeting: {

        displayName: "Greeting",

        interruptible: true,

        resumable: false

    },

    shopping: {

        displayName: "Shopping",

        interruptible: true,

        resumable: true

    },

    product_search: {

        displayName: "Product Search",

        interruptible: true,

        resumable: true

    },

    product_details: {

        displayName: "Product Details",

        interruptible: true,

        resumable: true

    },

    product_recommendation: {

        displayName: "Recommendation",

        interruptible: true,

        resumable: true

    },

    delivery: {

        displayName: "Delivery",

        interruptible: false,

        resumable: true

    },

    checkout: {

        displayName: "Checkout",

        interruptible: false,

        resumable: true

    },

    payment: {

        displayName: "Payment",

        interruptible: false,

        resumable: true

    },

    order_confirmation: {

        displayName: "Order Confirmation",

        interruptible: false,

        resumable: false

    },

    order_tracking: {

        displayName: "Order Tracking",

        interruptible: true,

        resumable: true

    },

    order_history: {

        displayName: "Order History",

        interruptible: true,

        resumable: true

    },

    customer_support: {

        displayName: "Customer Support",

        interruptible: true,

        resumable: true

    },

    voice: {

        displayName: "Voice",

        interruptible: true,

        resumable: true

    },

    recovery: {

        displayName: "Recovery",

        interruptible: true,

        resumable: false

    },

    gift_planner: {

        displayName: "Gift Planner",

        interruptible: true,

        resumable: true

    }

});

/* =============================================================================
 * Helpers
 * =============================================================================
 */

export function isValidWorkflow(workflow) {

    return Object.values(WORKFLOWS).includes(workflow);

}

export function getWorkflowInfo(workflow) {

    return WORKFLOW_INFO[workflow] || WORKFLOW_INFO.idle;

}

export function getDefaultWorkflow() {

    return WORKFLOWS.IDLE;

}

/* =============================================================================
 * Engine Metadata
 * =============================================================================
 */

export const WORKFLOW_ENGINE_INFO = Object.freeze({

    name: "Velora Workflow Engine",

    version: "1.0.0",

    totalWorkflows: Object.keys(WORKFLOWS).length,

    status: "Production"

});

export default WORKFLOWS;
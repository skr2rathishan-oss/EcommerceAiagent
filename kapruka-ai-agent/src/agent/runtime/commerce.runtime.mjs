/**
 * =============================================================================
 * Velora Prompt Operating System
 * =============================================================================
 *
 * File:
 *    commerce.runtime.mjs
 *
 * Purpose:
 *    Builds the live commerce context for the current request.
 *
 * Data Sources:
 *    • MCP Product Search
 *    • Cart Service
 *    • Delivery Service
 *    • Checkout Service
 *    • Order Service
 *    • Tracking Service
 *
 * Responsibilities:
 *    ✓ Build commerce runtime
 *    ✓ Describe current shopping state
 *    ✓ Generate commerce prompt
 *
 * This file NEVER:
 *    ✗ Calls Gemini
 *    ✗ Searches products
 *    ✗ Calculates delivery
 *    ✗ Performs checkout
 *    ✗ Modifies cart
 *    ✗ Executes business logic
 *
 * =============================================================================
 */

const DEFAULTS = Object.freeze({

    searchQuery: null,

    category: null,

    products: [],

    cartItems: 0,

    cartValue: null,

    deliveryRequired: false,

    deliveryAddress: false,

    checkoutStarted: false,

    paymentCompleted: false,

    activeOrder: null,

    trackingAvailable: false

});

/**
 * =============================================================================
 * Build Commerce Runtime
 * =============================================================================
 */

export function buildCommerceRuntime({

    commerce = {},

    products = [],

    cart = {},

    order = {},

    tracking = {}

} = {}) {

    const runtime = {

        searchQuery:
            commerce.searchQuery ??
            DEFAULTS.searchQuery,

        category:
            commerce.category ??
            DEFAULTS.category,

        products,

        totalProducts:
            products.length,

        cartItems:
            cart.items?.length ??
            DEFAULTS.cartItems,

        cartValue:
            cart.total ??
            DEFAULTS.cartValue,

        deliveryRequired:
            commerce.deliveryRequired ??
            DEFAULTS.deliveryRequired,

        deliveryAddress:
            Boolean(cart.deliveryAddress),

        checkoutStarted:
            commerce.checkoutStarted ??
            DEFAULTS.checkoutStarted,

        paymentCompleted:
            commerce.paymentCompleted ??
            DEFAULTS.paymentCompleted,

        activeOrder:
            order.orderNumber ??
            DEFAULTS.activeOrder,

        trackingAvailable:
            Boolean(tracking.status)

    };

    return {

        data: runtime,

        prompt: buildCommercePrompt(runtime)

    };

}

/**
 * =============================================================================
 * Prompt Formatter
 * =============================================================================
 */

function buildCommercePrompt(runtime) {

    return `
===============================================================================
COMMERCE RUNTIME
===============================================================================

Search Query         : ${runtime.searchQuery ?? "None"}

Category             : ${runtime.category ?? "Unknown"}

Products Returned    : ${runtime.totalProducts}

Cart Items           : ${runtime.cartItems}

Cart Value           : ${runtime.cartValue ?? "N/A"}

Delivery Required    : ${runtime.deliveryRequired ? "Yes" : "No"}

Delivery Address     : ${runtime.deliveryAddress ? "Available" : "Missing"}

Checkout Started     : ${runtime.checkoutStarted ? "Yes" : "No"}

Payment Completed    : ${runtime.paymentCompleted ? "Yes" : "No"}

Active Order         : ${runtime.activeOrder ?? "None"}

Tracking Available   : ${runtime.trackingAvailable ? "Yes" : "No"}

===============================================================================
`.trim();

}

/**
 * =============================================================================
 * Runtime Metadata
 * =============================================================================
 */

export const COMMERCE_RUNTIME_INFO = Object.freeze({

    name: "Commerce Runtime",

    version: "1.0.0",

    source: [

        "MCP",

        "Cart",

        "Delivery",

        "Checkout",

        "Orders",

        "Tracking"

    ]

});

/**
 * =============================================================================
 * Default Export
 * =============================================================================
 */

export default buildCommerceRuntime;
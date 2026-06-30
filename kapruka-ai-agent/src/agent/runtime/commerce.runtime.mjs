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
    const normTracking = tracking || {};
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
            Boolean(normTracking.status),

        trackingDetails: normTracking.status ? {
            orderNumber: normTracking.orderNumber || normTracking.order_number || "Unknown",
            status: normTracking.status,
            error: normTracking.error || null,
            recipientName: normTracking.recipient?.name || "Unknown",
            recipientCity: normTracking.recipient?.city || "Unknown",
            deliveryDate: normTracking.deliveryDate || normTracking.delivery_date || "Unknown",
            progress: normTracking.progress || [],
            items: normTracking.items || []
        } : null
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
    let prompt = `
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

    if (runtime.totalProducts > 0) {
        const productsList = runtime.products.slice(0, 5).map((p, idx) => {
            const priceVal = typeof p.price === 'object' && p.price ? `${p.price.amount} ${p.price.currency}` : `${p.price || 'N/A'} LKR`;
            return `Product ${idx + 1}:
ID: ${p.id || p.product_id}
Name: ${p.name}
Brand: ${p.brand || "N/A"}
Price: ${priceVal}
Description: ${p.description || "N/A"}
In Stock: ${p.in_stock !== undefined ? (p.in_stock ? "Yes" : "No") : "N/A"}`;
        }).join("\n\n");

        prompt += `\n\n[PRODUCTS FOUND]\n${productsList}`;
    }

    if (runtime.trackingAvailable && runtime.trackingDetails) {
        const details = runtime.trackingDetails;
        let trackingStr = `Order Number: ${details.orderNumber}\nStatus: ${details.status}`;
        if (details.error) {
            trackingStr += `\nError: ${details.error}`;
        } else {
            const progressStr = details.progress.map(p => `- ${p.step || p.step_display}: ${p.completed ? "Completed" : "Pending"}${p.timestamp ? ` (${p.timestamp})` : ""}`).join("\n");
            const itemsStr = details.items.map(item => `- ${item.name} (Qty: ${item.quantity || 1}) - ${item.price} LKR`).join("\n");
            trackingStr += `
Recipient: ${details.recipientName} (${details.recipientCity})
Delivery Date: ${details.deliveryDate}
Items Ordered:
${itemsStr || "None"}
Progress:
${progressStr || "None"}`;
        }
        prompt += `\n\n[TRACKING DETAILS]\n${trackingStr}`;
    }

    return prompt;
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
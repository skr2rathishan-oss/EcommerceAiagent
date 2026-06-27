/**
 * =============================================================================
 * Velora Prompt Operating System
 * =============================================================================
 *
 * File:
 *    customer.runtime.mjs
 *
 * Purpose:
 *    Builds the runtime customer context for the current request.
 *
 * Data Sources:
 *    • Customer Profile
 *    • Conversation Memory
 *    • Shopping Context
 *
 * Responsibilities:
 *    ✓ Build structured customer runtime
 *    ✓ Generate customer prompt section
 *    ✓ Never access the database
 *    ✓ Never call Gemini
 *    ✓ Never perform business logic
 *
 * =============================================================================
 */

const DEFAULTS = Object.freeze({
    customerName: "Unknown",
    preferredLanguage: "en",
    recipient: null,
    occasion: null,
    budget: null,
    preferredCategory: null,
    preferredBrand: null,
    city: null,
    shoppingStyle: "standard"
});

/**
 * =============================================================================
 * Build Customer Runtime
 * =============================================================================
 */

export function buildCustomerRuntime({
    customer = {},
    memory = {},
    shoppingContext = {}
} = {}) {

    const runtime = {

        customerName:
            customer.name ??
            DEFAULTS.customerName,

        preferredLanguage:
            customer.preferredLanguage ??
            memory.language ??
            DEFAULTS.preferredLanguage,

        recipient:
            shoppingContext.recipient ??
            memory.recipient ??
            DEFAULTS.recipient,

        occasion:
            shoppingContext.occasion ??
            memory.occasion ??
            DEFAULTS.occasion,

        budget:
            shoppingContext.budget ??
            memory.budget ??
            DEFAULTS.budget,

        preferredCategory:
            shoppingContext.category ??
            memory.category ??
            DEFAULTS.preferredCategory,

        preferredBrand:
            shoppingContext.brand ??
            memory.brand ??
            DEFAULTS.preferredBrand,

        city:
            customer.city ??
            memory.city ??
            DEFAULTS.city,

        shoppingStyle:
            customer.shoppingStyle ??
            DEFAULTS.shoppingStyle

    };

    return {
        data: runtime,
        prompt: buildCustomerPrompt(runtime)
    };

}

/**
 * =============================================================================
 * Prompt Formatter
 * =============================================================================
 */

function buildCustomerPrompt(runtime) {

    return `
===============================================================================
CUSTOMER RUNTIME
===============================================================================

Customer Name        : ${runtime.customerName}
Preferred Language   : ${runtime.preferredLanguage}
Recipient            : ${runtime.recipient ?? "Unknown"}
Occasion             : ${runtime.occasion ?? "Unknown"}
Budget               : ${runtime.budget ?? "Not Specified"}
Preferred Category   : ${runtime.preferredCategory ?? "Unknown"}
Preferred Brand      : ${runtime.preferredBrand ?? "Unknown"}
City                 : ${runtime.city ?? "Unknown"}
Shopping Style       : ${runtime.shoppingStyle}

===============================================================================
`.trim();

}

/**
 * =============================================================================
 * Runtime Metadata
 * =============================================================================
 */

export const CUSTOMER_RUNTIME_INFO = Object.freeze({

    name: "Customer Runtime",

    version: "1.0.0",

    source: [
        "Customer Profile",
        "Conversation Memory",
        "Shopping Context"
    ]

});

/**
 * =============================================================================
 * Default Export
 * =============================================================================
 */

export default buildCustomerRuntime;
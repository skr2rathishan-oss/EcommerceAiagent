/**
 * =============================================================================
 * Velora Prompt Operating System
 * =============================================================================
 *
 * File:
 *    memory.runtime.mjs
 *
 * Purpose:
 *    Builds the conversation memory context for the current request.
 *
 * Data Sources:
 *    • Conversation Memory
 *    • Customer Preferences
 *    • Session Memory
 *    • Long-Term Memory
 *
 * Responsibilities:
 *    ✓ Build memory runtime
 *    ✓ Summarize remembered customer information
 *    ✓ Generate memory prompt
 *
 * This file NEVER:
 *    ✗ Reads MongoDB
 *    ✗ Stores memory
 *    ✗ Updates memory
 *    ✗ Calls Gemini
 *    ✗ Performs business logic
 *
 * =============================================================================
 */

const DEFAULTS = Object.freeze({

    rememberedFacts: [],

    customerPreferences: [],

    recentTopics: [],

    recentSearches: [],

    languageHistory: [],

    lastShoppingCategory: null,

    lastOccasion: null

});

/**
 * =============================================================================
 * Build Memory Runtime
 * =============================================================================
 */

export function buildMemoryRuntime({

    memory = {}

} = {}) {

    const runtime = {

        rememberedFacts:
            memory.rememberedFacts ??
            DEFAULTS.rememberedFacts,

        customerPreferences:
            memory.customerPreferences ??
            DEFAULTS.customerPreferences,

        recentTopics:
            memory.recentTopics ??
            DEFAULTS.recentTopics,

        recentSearches:
            memory.recentSearches ??
            DEFAULTS.recentSearches,

        languageHistory:
            memory.languageHistory ??
            DEFAULTS.languageHistory,

        lastShoppingCategory:
            memory.lastShoppingCategory ??
            DEFAULTS.lastShoppingCategory,

        lastOccasion:
            memory.lastOccasion ??
            DEFAULTS.lastOccasion

    };

    return {

        data: runtime,

        prompt: buildMemoryPrompt(runtime)

    };

}

/**
 * =============================================================================
 * Prompt Formatter
 * =============================================================================
 */

function formatList(list) {

    if (!Array.isArray(list) || list.length === 0) {
        return "None";
    }

    return list.map(item => `• ${item}`).join("\n");

}

function buildMemoryPrompt(runtime) {

    return `
===============================================================================
MEMORY RUNTIME
===============================================================================

Remembered Customer Facts
-------------------------
${formatList(runtime.rememberedFacts)}

Customer Preferences
--------------------
${formatList(runtime.customerPreferences)}

Recent Conversation Topics
--------------------------
${formatList(runtime.recentTopics)}

Recent Product Searches
-----------------------
${formatList(runtime.recentSearches)}

Language History
----------------
${formatList(runtime.languageHistory)}

Last Shopping Category : ${runtime.lastShoppingCategory ?? "None"}

Last Occasion          : ${runtime.lastOccasion ?? "None"}

===============================================================================
`.trim();

}

/**
 * =============================================================================
 * Runtime Metadata
 * =============================================================================
 */

export const MEMORY_RUNTIME_INFO = Object.freeze({

    name: "Memory Runtime",

    version: "1.0.0",

    source: [

        "Conversation Memory",

        "Customer Preferences",

        "Session Memory",

        "Long-Term Memory"

    ]

});

/**
 * =============================================================================
 * Default Export
 * =============================================================================
 */

export default buildMemoryRuntime;
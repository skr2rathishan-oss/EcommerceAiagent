/**
 * =============================================================================
 * Velora Prompt Operating System
 * =============================================================================
 *
 * File:
 *    promptVersion.mjs
 *
 * Purpose:
 *    Central metadata for the Prompt Operating System.
 *
 * Responsibilities:
 *    ✓ Store Prompt OS version
 *    ✓ Store architecture information
 *    ✓ Store module counts
 *    ✓ Provide metadata for diagnostics
 *
 * Never:
 *    ✗ Build prompts
 *    ✗ Validate prompts
 *    ✗ Compress prompts
 *    ✗ Call Gemini
 *
 * =============================================================================
 */

export const PROMPT_VERSION = Object.freeze({

    /* -------------------------------------------------------------------------
     * Basic Information
     * ---------------------------------------------------------------------- */

    name: "Velora Prompt Operating System",

    version: "2.0.0",

    build: "2026.06",

    status: "Production",

    /* -------------------------------------------------------------------------
     * AI Configuration
     * ---------------------------------------------------------------------- */

    assistant: "Velora",

    provider: "Google Gemini",

    model: "Gemini 2.5 Flash",

    architecture: "Modular Prompt OS",

    /* -------------------------------------------------------------------------
     * Prompt Modules
     * ---------------------------------------------------------------------- */

    promptModules: {

        core: 5,

        intelligence: 5,

        commerce: 5,

        communication: 4,

        total: 19

    },

    /* -------------------------------------------------------------------------
     * Runtime Modules
     * ---------------------------------------------------------------------- */

    runtimeModules: {

        conversation: true,

        customer: true,

        commerce: true,

        memory: true,

        response: true,

        system: true,

        total: 6

    },

    /* -------------------------------------------------------------------------
     * Features
     * ---------------------------------------------------------------------- */

    features: {

        responseLibrary: true,

        conversationUnderstanding: true,

        decisionBuilder: true,

        conversationStateManager: true,

        runtimeBuilder: true,

        promptBuilder: true,

        streaming: true,

        voiceMode: true

    }

});

/* =============================================================================
 * Helpers
 * =============================================================================
 */

export function getPromptVersion() {

    return PROMPT_VERSION;

}

export function getPromptSummary() {

    return {

        name: PROMPT_VERSION.name,

        version: PROMPT_VERSION.version,

        build: PROMPT_VERSION.build,

        assistant: PROMPT_VERSION.assistant,

        provider: PROMPT_VERSION.provider,

        model: PROMPT_VERSION.model,

        promptModules: PROMPT_VERSION.promptModules.total,

        runtimeModules: PROMPT_VERSION.runtimeModules.total

    };

}

/* =============================================================================
 * Default Export
 * =============================================================================
 */

export default PROMPT_VERSION;
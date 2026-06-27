/**
 * =============================================================================
 * Velora Prompt Operating System
 * =============================================================================
 *
 * File:
 *    response.runtime.mjs
 *
 * Purpose:
 *    Builds the response runtime context for the current request.
 *
 * Data Sources:
 *    • Response Engine
 *    • Response Library
 *    • Decision Builder
 *
 * Responsibilities:
 *    ✓ Build response runtime
 *    ✓ Describe how Gemini should generate the response
 *    ✓ Generate response prompt section
 *
 * This file NEVER:
 *    ✗ Select response templates
 *    ✗ Build business logic
 *    ✗ Search products
 *    ✗ Call Gemini
 *    ✗ Modify response library
 *
 * =============================================================================
 */

const DEFAULTS = Object.freeze({

    responseType: "conversation",

    templateId: null,

    templateName: null,

    responseMode: "dynamic",

    streaming: true,

    voiceMode: false,

    language: "en",

    shouldSearchProducts: false,

    shouldRecommendProducts: false,

    shouldAskClarification: false,

    shouldUseMemory: true,

    shouldUseTemplate: false

});

/**
 * =============================================================================
 * Build Response Runtime
 * =============================================================================
 */

export function buildResponseRuntime({

    response = {},

    decision = {},

    settings = {}

} = {}) {

    const runtime = {

        responseType:
            response.type ??
            DEFAULTS.responseType,

        templateId:
            response.templateId ??
            DEFAULTS.templateId,

        templateName:
            response.templateName ??
            DEFAULTS.templateName,

        responseMode:
            response.mode ??
            DEFAULTS.responseMode,

        streaming:
            settings.streaming ??
            DEFAULTS.streaming,

        voiceMode:
            settings.voiceMode ??
            DEFAULTS.voiceMode,

        language:
            decision.language?.code ??
            DEFAULTS.language,

        shouldSearchProducts:
            Boolean(response.searchProducts),

        shouldRecommendProducts:
            Boolean(response.recommendProducts),

        shouldAskClarification:
            Boolean(response.askClarification),

        shouldUseMemory:
            response.useMemory ??
            DEFAULTS.shouldUseMemory,

        shouldUseTemplate:
            Boolean(response.templateId)

    };

    return {

        data: runtime,

        prompt: buildResponsePrompt(runtime)

    };

}

/**
 * =============================================================================
 * Prompt Formatter
 * =============================================================================
 */

function yesNo(value) {

    return value ? "Yes" : "No";

}

function buildResponsePrompt(runtime) {

    return `
===============================================================================
RESPONSE RUNTIME
===============================================================================

Response Type          : ${runtime.responseType}

Response Mode          : ${runtime.responseMode}

Template ID            : ${runtime.templateId ?? "None"}

Template Name          : ${runtime.templateName ?? "None"}

Language               : ${runtime.language}

Streaming              : ${yesNo(runtime.streaming)}

Voice Mode             : ${yesNo(runtime.voiceMode)}

Use Response Template  : ${yesNo(runtime.shouldUseTemplate)}

Use Memory             : ${yesNo(runtime.shouldUseMemory)}

Search Products        : ${yesNo(runtime.shouldSearchProducts)}

Recommend Products     : ${yesNo(runtime.shouldRecommendProducts)}

Ask Clarification      : ${yesNo(runtime.shouldAskClarification)}

===============================================================================
`.trim();

}

/**
 * =============================================================================
 * Runtime Metadata
 * =============================================================================
 */

export const RESPONSE_RUNTIME_INFO = Object.freeze({

    name: "Response Runtime",

    version: "1.0.0",

    source: [

        "Response Engine",

        "Response Library",

        "Decision Builder"

    ]

});

/**
 * =============================================================================
 * Default Export
 * =============================================================================
 */

export default buildResponseRuntime;
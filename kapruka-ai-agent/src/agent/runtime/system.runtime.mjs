/**
 * =============================================================================
 * Velora Prompt Operating System
 * =============================================================================
 *
 * File:
 *    system.runtime.mjs
 *
 * Purpose:
 *    Builds the runtime system context for the current request.
 *
 * Data Sources:
 *    • Environment Configuration
 *    • AI Configuration
 *    • Prompt OS
 *    • Runtime Settings
 *
 * Responsibilities:
 *    ✓ Build system runtime
 *    ✓ Describe current AI environment
 *    ✓ Generate system prompt section
 *
 * This file NEVER:
 *    ✗ Calls Gemini
 *    ✗ Performs business logic
 *    ✗ Reads databases
 *    ✗ Reads customer data
 *
 * =============================================================================
 */

const DEFAULTS = Object.freeze({

    aiName: "Velora",

    provider: "Google Gemini",

    model: "Gemini 2.5 Flash",

    environment: process.env.NODE_ENV || "development",

    timezone: "Asia/Colombo",

    locale: "en-LK",

    promptVersion: "2.0.0",

    runtimeVersion: "1.0.0",

    streaming: true,

    voiceMode: false

});

/**
 * =============================================================================
 * Build System Runtime
 * =============================================================================
 */

export function buildSystemRuntime({

    settings = {}

} = {}) {

    const runtime = {

        aiName:
            DEFAULTS.aiName,

        provider:
            DEFAULTS.provider,

        model:
            settings.model ??
            DEFAULTS.model,

        environment:
            settings.environment ??
            DEFAULTS.environment,

        timezone:
            settings.timezone ??
            DEFAULTS.timezone,

        locale:
            settings.locale ??
            DEFAULTS.locale,

        promptVersion:
            settings.promptVersion ??
            DEFAULTS.promptVersion,

        runtimeVersion:
            settings.runtimeVersion ??
            DEFAULTS.runtimeVersion,

        streaming:
            settings.streaming ??
            DEFAULTS.streaming,

        voiceMode:
            settings.voiceMode ??
            DEFAULTS.voiceMode,

        currentDate:
            new Date().toLocaleDateString("en-CA", {

                timeZone: settings.timezone ?? DEFAULTS.timezone

            }),

        currentTime:
            new Date().toLocaleTimeString("en-GB", {

                hour12: false,

                timeZone: settings.timezone ?? DEFAULTS.timezone

            })

    };

    return {

        data: runtime,

        prompt: buildSystemPrompt(runtime)

    };

}

/**
 * =============================================================================
 * Prompt Formatter
 * =============================================================================
 */

function yesNo(value) {

    return value ? "Enabled" : "Disabled";

}

function buildSystemPrompt(runtime) {

    return `
===============================================================================
SYSTEM RUNTIME
===============================================================================

AI Assistant           : ${runtime.aiName}

AI Provider            : ${runtime.provider}

AI Model               : ${runtime.model}

Environment            : ${runtime.environment}

Timezone               : ${runtime.timezone}

Locale                 : ${runtime.locale}

Current Date           : ${runtime.currentDate}

Current Time           : ${runtime.currentTime}

Prompt OS Version      : ${runtime.promptVersion}

Runtime Version        : ${runtime.runtimeVersion}

Streaming              : ${yesNo(runtime.streaming)}

Voice Mode             : ${yesNo(runtime.voiceMode)}

===============================================================================
`.trim();

}

/**
 * =============================================================================
 * Runtime Metadata
 * =============================================================================
 */

export const SYSTEM_RUNTIME_INFO = Object.freeze({

    name: "System Runtime",

    version: "1.0.0",

    source: [

        "Environment",

        "AI Configuration",

        "Prompt OS"

    ]

});

/**
 * =============================================================================
 * Default Export
 * =============================================================================
 */

export default buildSystemRuntime;
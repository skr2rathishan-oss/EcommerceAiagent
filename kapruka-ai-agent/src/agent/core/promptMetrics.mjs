/**
 * =============================================================================
 * Velora Prompt Operating System
 * =============================================================================
 *
 * File:
 *    promptMetrics.mjs
 *
 * Purpose:
 *    Collects metrics for the Prompt Operating System.
 *
 * Responsibilities
 * ----------------
 * ✓ Measure Prompt Size
 * ✓ Measure Runtime Size
 * ✓ Estimate Tokens
 * ✓ Measure Build Time
 * ✓ Track Cache Status
 * ✓ Generate Diagnostic Report
 *
 * Never:
 * ✗ Modify prompts
 * ✗ Call Gemini
 * ✗ Perform business logic
 *
 * =============================================================================
 */

import PROMPT_VERSION from "./promptVersion.mjs";

/* =============================================================================
 * Helpers
 * =============================================================================
 */

function estimateTokens(text = "") {

    // Simple estimation (~4 characters per token)
    return Math.ceil(text.length / 4);

}

/* =============================================================================
 * Build Prompt Metrics
 * =============================================================================
 */

export function buildPromptMetrics({

    promptOS = "",

    runtimePrompt = "",

    finalPrompt = "",

    buildTime = 0,

    cacheEnabled = true,

    cacheHit = true

} = {}) {

    const promptSize = promptOS.length;

    const runtimeSize = runtimePrompt.length;

    const finalSize = finalPrompt.length;

    return {

        version: PROMPT_VERSION.version,

        assistant: PROMPT_VERSION.assistant,

        provider: PROMPT_VERSION.provider,

        model: PROMPT_VERSION.model,

        promptModules:
            PROMPT_VERSION.promptModules.total,

        runtimeModules:
            PROMPT_VERSION.runtimeModules.total,

        sizes: {

            promptOS: promptSize,

            runtime: runtimeSize,

            finalPrompt: finalSize

        },

        estimatedTokens: {

            promptOS:
                estimateTokens(promptOS),

            runtime:
                estimateTokens(runtimePrompt),

            finalPrompt:
                estimateTokens(finalPrompt)

        },

        performance: {

            buildTime,

            cacheEnabled,

            cacheHit

        },

        generatedAt:
            new Date().toISOString()

    };

}

/* =============================================================================
 * Console Report
 * =============================================================================
 */

export function printPromptMetrics(metrics) {

    console.log(`
══════════════════════════════════════════════════════════════════════

                    VELORA PROMPT METRICS

══════════════════════════════════════════════════════════════════════

 Prompt Version        ${metrics.version}

 AI Provider           ${metrics.provider}

 Model                 ${metrics.model}

 Prompt Modules        ${metrics.promptModules}

 Runtime Modules       ${metrics.runtimeModules}

------------------------------------------------------------

 Prompt Size           ${metrics.sizes.promptOS} chars

 Runtime Size          ${metrics.sizes.runtime} chars

 Final Prompt          ${metrics.sizes.finalPrompt} chars

------------------------------------------------------------

 Estimated Tokens      ${metrics.estimatedTokens.finalPrompt}

------------------------------------------------------------

 Build Time            ${metrics.performance.buildTime} ms

 Cache Enabled         ${metrics.performance.cacheEnabled ? "YES" : "NO"}

 Cache Hit             ${metrics.performance.cacheHit ? "YES" : "NO"}

══════════════════════════════════════════════════════════════════════
`);

}

/* =============================================================================
 * Metrics Metadata
 * =============================================================================
 */

export const PROMPT_METRICS_INFO = Object.freeze({

    name: "Velora Prompt Metrics",

    version: "1.0.0",

    status: "Ready"

});

/* =============================================================================
 * Default Export
 * =============================================================================
 */

export default buildPromptMetrics;
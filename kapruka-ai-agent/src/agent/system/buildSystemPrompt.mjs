/**
 * =============================================================================
 * Velora AI Prompt Engine
 * =============================================================================
 *
 * File:
 *    buildSystemPrompt.mjs
 *
 * Purpose:
 *    Creates the complete system prompt sent to Gemini.
 *
 * Architecture:
 *
 *      Prompt Operating System
 *                  +
 *         Runtime Context
 *                  +
 *      Latest User Message
 *                  =
 *        Final System Prompt
 *
 * Responsibilities
 * ----------------
 * ✓ Build Prompt OS
 * ✓ Build Runtime Context
 * ✓ Inject Latest Customer Message
 * ✓ Return one complete System Prompt
 *
 * Never:
 * ✗ Call Gemini
 * ✗ Perform business logic
 * ✗ Search products
 * ✗ Modify runtime
 * ✗ Validate prompts
 *
 * =============================================================================
 */

import getPromptCache from "../core/promptCache.mjs";
import buildRuntimeContext from "../builders/runtimeBuilder.mjs";

/* =============================================================================
 * Build Complete System Prompt
 * ========================================================================== */

export function buildSystemPrompt(runtimeContext = {}) {

    const promptOS = getPromptCache();

    const runtime = buildRuntimeContext(runtimeContext);

    const latestMessage =
        runtimeContext.latestMessage ||
        runtimeContext.message ||
        "No customer message provided.";

    return `
===============================================================================
VELORA AI SYSTEM PROMPT
===============================================================================

${promptOS}

===============================================================================
VELORA RUNTIME CONTEXT
===============================================================================

${runtime.prompt}

===============================================================================
LATEST CUSTOMER MESSAGE
===============================================================================

${latestMessage}

===============================================================================
END OF SYSTEM PROMPT
===============================================================================
`.trim();

}

/* =============================================================================
 * Build Complete Prompt Package
 * ========================================================================== */

export function buildPromptPackage(runtimeContext = {}) {

    const promptOS = getPromptCache();

    const runtime = buildRuntimeContext(runtimeContext);

    const systemPrompt = buildSystemPrompt(runtimeContext);

    return {

        systemPrompt,

        promptOS,

        runtime,

        metadata: {

            promptVersion: "2.0.0",

            runtimeVersion: "1.0.0",

            provider: "Google Gemini",

            generatedAt: new Date().toISOString()

        }

    };

}

/* =============================================================================
 * Engine Metadata
 * ========================================================================== */

export const SYSTEM_PROMPT_INFO = Object.freeze({

    name: "Velora Prompt Engine",

    version: "2.0.0",

    provider: "Google Gemini",

    architecture: "Prompt Operating System"

});

/* =============================================================================
 * Default Export
 * ========================================================================== */

export default buildSystemPrompt;
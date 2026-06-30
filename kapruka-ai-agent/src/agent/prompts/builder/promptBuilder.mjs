/**
 * =============================================================================
 * Velora Prompt Operating System Builder
 * =============================================================================
 *
 * File:
 *    promptBuilder.mjs
 *
 * Purpose:
 *    Assembles the complete system prompt dynamically by reading prompt modules
 *    from the central Prompt Registry.
 */

import { Core, Commerce, Communication, Intelligence } from "../index.mjs";
import buildRuntimeContext from "../../builders/runtimeBuilder.mjs";

/* ============================================================================
 * Prompt OS Version
 * ========================================================================== */
export const PROMPT_OS_VERSION = Object.freeze({
    name: "Velora Prompt Operating System",
    version: "2.0.0",
    modules: 20
});

/* ============================================================================
 * Helpers
 * ========================================================================== */
function buildSection(title, prompts) {
    return `
===============================================================================
${title}
===============================================================================

${prompts.filter(Boolean).join("\n\n")}
`;
}

/* ============================================================================
 * Build Prompt OS (Static / Legacy Compatibility)
 * ========================================================================== */
export function buildPromptOS() {
    const corePrompts = [
        Core.identity,
        Core.mission,
        Core.personality,
        Core.safety,
        Core.localization
    ];

    const intelligencePrompts = [
        Intelligence.commerce,
        Intelligence.customerPsychology,
        Intelligence.conversationStrategy,
        Intelligence.recommendationStrategy,
        Intelligence.responseLibrary,
        Intelligence.reference
    ];

    const commercePrompts = [
        Commerce.shopping,
        Commerce.delivery,
        Commerce.checkout,
        Commerce.orders,
        Commerce.tracking
    ];

    const communicationPrompts = [
        Communication.writingStyle,
        Communication.voice,
        Communication.clarification,
        Communication.recovery
    ];

    return `
===============================================================================
VELORA PROMPT OPERATING SYSTEM
===============================================================================

Name       : ${PROMPT_OS_VERSION.name}
Version    : ${PROMPT_OS_VERSION.version}
Modules    : ${PROMPT_OS_VERSION.modules}

This Prompt OS defines Velora's permanent behaviour.
===============================================================================

${buildSection("CORE", corePrompts)}

${buildSection("INTELLIGENCE", intelligencePrompts)}

${buildSection("COMMERCE", commercePrompts)}

${buildSection("COMMUNICATION", communicationPrompts)}

===============================================================================
END OF PROMPT OPERATING SYSTEM
===============================================================================
`.trim();
}

/* ============================================================================
 * Build Complete System Prompt (Dynamic)
 * ========================================================================== */
export function buildSystemPrompt(runtimeContext = {}) {
    const runtime = buildRuntimeContext(runtimeContext);

    // 1. Core prompts
    const corePrompts = [
        Core.identity,
        Core.mission,
        Core.personality,
        Core.safety,
        Core.localization
    ];

    // 2. Intelligence prompts
    const intelligencePrompts = [
        Intelligence.commerce,
        Intelligence.customerPsychology,
        Intelligence.conversationStrategy,
        Intelligence.recommendationStrategy,
        Intelligence.responseLibrary,
        Intelligence.reference
    ];

    // 3. Commerce prompts (assembled dynamically based on active workflow context)
    const commercePrompts = [];
    const workflow = runtimeContext?.workflow?.currentWorkflow || "idle";
    const hasProducts = runtimeContext?.products && runtimeContext.products.length > 0;
    const hasTracking = runtimeContext?.tracking && runtimeContext.tracking.status;

    // Always include shopping
    commercePrompts.push(Commerce.shopping);

    // Conditionally include delivery, checkout, orders, tracking
    if (workflow === "delivery" || runtimeContext?.delivery?.deliveryRequired) {
        commercePrompts.push(Commerce.delivery);
    }
    if (workflow === "checkout" || runtimeContext?.shopping?.checkoutStarted) {
        commercePrompts.push(Commerce.checkout);
    }
    if (workflow === "orders" || runtimeContext?.activeOrder) {
        commercePrompts.push(Commerce.orders);
    }
    if (workflow === "order_tracking" || hasTracking) {
        commercePrompts.push(Commerce.tracking);
    }

    // Include all as reference if no specific active workflow
    if (commercePrompts.length === 1) {
        commercePrompts.push(Commerce.delivery, Commerce.checkout, Commerce.orders, Commerce.tracking);
    }

    // 4. Communication prompts
    const communicationPrompts = [
        Communication.writingStyle,
        Communication.voice
    ];
    if (workflow === "clarify" || runtimeContext?.response?.askClarification) {
        communicationPrompts.push(Communication.clarification);
    }
    if (workflow === "recovery") {
        communicationPrompts.push(Communication.recovery);
    } else {
        communicationPrompts.push(Communication.recovery);
    }

    // Build Prompt OS section dynamically
    const promptOSStr = `
===============================================================================
VELORA PROMPT OPERATING SYSTEM (DYNAMIC)
===============================================================================

${buildSection("CORE", corePrompts)}

${buildSection("INTELLIGENCE", intelligencePrompts)}

${buildSection("COMMERCE", commercePrompts)}

${buildSection("COMMUNICATION", communicationPrompts)}
`;

    const latestMessage =
        runtimeContext.latestMessage ||
        runtimeContext.message ||
        "No customer message provided.";

    const finalPromptText = `
VELORA SYSTEM PROMPT PACKAGE
${promptOSStr}
`;
    const tokenEst = Math.ceil(finalPromptText.length / 4);

    // Prompt Debugging Console Output
    console.log(`
[PROMPT]
Workflow: ${workflow}
Language: ${runtimeContext?.customer?.preferredLanguage || "english"}

Prompt Modules:
✓ Core
✓ Intelligence
✓ Commerce
✓ Voice
✓ Writing Style
${runtimeContext?.responseLibrary ? "✓ Response Library" : "✗ Response Library"}
✓ Recommendation Strategy

Response Library: ${runtimeContext?.responseLibrary ? `${runtimeContext.responseLibrary.module}.${runtimeContext.responseLibrary.category}` : "None"}
Templates Used: ${runtimeContext?.responseLibrary?.templates?.length || 0}
LLM Tokens (Estimated): ${tokenEst}
`.trim());

    // Assemble final system prompt package
    return `
===============================================================================
VELORA AI SYSTEM PROMPT
===============================================================================

${promptOSStr}

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

/* ============================================================================
 * Prompt Metadata
 * ========================================================================== */
export function getPromptOSInfo() {
    return {
        ...PROMPT_OS_VERSION,
        sections: {
            core: 5,
            intelligence: 6,
            commerce: 5,
            communication: 4
        }
    };
}

export default buildPromptOS;
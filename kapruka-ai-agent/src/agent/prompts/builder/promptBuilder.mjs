/**
 * =============================================================================
 * Velora Prompt Operating System
 * =============================================================================
 *
 * File:
 *    promptBuilder.mjs
 *
 * Purpose:
 *    Builds the complete static Prompt Operating System by assembling all
 *    prompt modules into a single system instruction.
 *
 * Responsibilities:
 *    ✓ Load every Prompt OS module
 *    ✓ Organize prompts into logical sections
 *    ✓ Build one immutable Prompt OS
 *
 * This file NEVER:
 *    ✗ Calls Gemini
 *    ✗ Uses runtime context
 *    ✗ Accesses conversation state
 *    ✗ Reads MCP products
 *    ✗ Performs business logic
 *    ✗ Validates prompts
 *    ✗ Compresses prompts
 *
 * =============================================================================
 */

import { IDENTITY_PROMPT } from "../core/01_identity.prompt.mjs";
import { MISSION_PROMPT } from "../core/02_mission.prompt.mjs";
import { PERSONALITY_PROMPT } from "../core/03_personality.prompt.mjs";
import { SAFETY_PROMPT } from "../core/04_safety.prompt.mjs";
import { LOCALIZATION_PROMPT } from "../core/05_localization.prompt.mjs";

import { COMMERCE_PROMPT } from "../intelligence/06_commerce.prompt.mjs";
import { CUSTOMER_PSYCHOLOGY_PROMPT } from "../intelligence/07_customerPsychology.prompt.mjs";
import { CONVERSATION_STRATEGY_PROMPT } from "../intelligence/08_conversationStrategy.prompt.mjs";
import { RECOMMENDATION_STRATEGY_PROMPT } from "../intelligence/09_recommendationStrategy.prompt.mjs";
import { RESPONSE_LIBRARY_PROMPT } from "../intelligence/10_responseLibrary.prompt.mjs";

import { SHOPPING_PROMPT } from "../commerce/11_shopping.prompt.mjs";
import { DELIVERY_PROMPT } from "../commerce/12_delivery.prompt.mjs";
import { CHECKOUT_PROMPT } from "../commerce/13_checkout.prompt.mjs";
import { ORDERS_PROMPT } from "../commerce/14_orders.prompt.mjs";
import { TRACKING_PROMPT } from "../commerce/15_tracking.prompt.mjs";

import { WRITING_STYLE_PROMPT } from "../communication/16_writingStyle.prompt.mjs";
import { VOICE_PROMPT } from "../communication/17_voice.prompt.mjs";
import { CLARIFICATION_PROMPT } from "../communication/18_clarification.prompt.mjs";
import { RECOVERY_PROMPT } from "../communication/19_recovery.prompt.mjs";

/* ============================================================================
 * Prompt OS Version
 * ========================================================================== */

export const PROMPT_OS_VERSION = Object.freeze({
    name: "Velora Prompt Operating System",
    version: "2.0.0",
    modules: 19
});

/* ============================================================================
 * Prompt Sections
 * ========================================================================== */

const CORE = [
    IDENTITY_PROMPT,
    MISSION_PROMPT,
    PERSONALITY_PROMPT,
    SAFETY_PROMPT,
    LOCALIZATION_PROMPT
];

const INTELLIGENCE = [
    COMMERCE_PROMPT,
    CUSTOMER_PSYCHOLOGY_PROMPT,
    CONVERSATION_STRATEGY_PROMPT,
    RECOMMENDATION_STRATEGY_PROMPT,
    RESPONSE_LIBRARY_PROMPT
];

const COMMERCE = [
    SHOPPING_PROMPT,
    DELIVERY_PROMPT,
    CHECKOUT_PROMPT,
    ORDERS_PROMPT,
    TRACKING_PROMPT
];

const COMMUNICATION = [
    WRITING_STYLE_PROMPT,
    VOICE_PROMPT,
    CLARIFICATION_PROMPT,
    RECOVERY_PROMPT
];

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
 * Build Prompt Operating System
 * ========================================================================== */

export function buildPromptOS() {

    return `
===============================================================================
VELORA PROMPT OPERATING SYSTEM
===============================================================================

Name       : ${PROMPT_OS_VERSION.name}
Version    : ${PROMPT_OS_VERSION.version}
Modules    : ${PROMPT_OS_VERSION.modules}

This Prompt OS defines Velora's permanent behaviour.

Runtime context such as language, conversation state,
customer memory, MCP products, response templates,
and user messages are injected separately by the runtime builder.

===============================================================================

${buildSection("CORE", CORE)}

${buildSection("INTELLIGENCE", INTELLIGENCE)}

${buildSection("COMMERCE", COMMERCE)}

${buildSection("COMMUNICATION", COMMUNICATION)}

===============================================================================
END OF PROMPT OPERATING SYSTEM
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
            core: CORE.length,
            intelligence: INTELLIGENCE.length,
            commerce: COMMERCE.length,
            communication: COMMUNICATION.length
        }
    };

}

/* ============================================================================
 * Default Export
 * ========================================================================== */

export default buildPromptOS;
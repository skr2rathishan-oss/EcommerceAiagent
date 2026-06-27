/**
 * =============================================================================
 * Velora Prompt Operating System
 * =============================================================================
 *
 * File:
 *    conversation.runtime.mjs
 *
 * Purpose:
 *    Builds the runtime conversation context for the current request.
 *
 * Data Sources:
 *    • Conversation Understanding Layer
 *    • Decision Builder
 *    • Conversation State Manager
 *
 * Responsibilities:
 *    ✓ Build structured runtime conversation data
 *    ✓ Generate runtime prompt section
 *    ✓ Never perform business logic
 *    ✓ Never call Gemini
 *    ✓ Never access the database
 *
 * =============================================================================
 */

const DEFAULTS = Object.freeze({
    language: "en",
    intent: "general",
    emotion: "neutral",
    stage: "conversation",
    workflow: "conversation",
    currentStep: "unknown",
    previousStep: "none",
    confidence: 0,
    interrupted: false
});

/**
 * =============================================================================
 * Build Conversation Runtime
 * =============================================================================
 */

export function buildConversationRuntime({
    decision = {},
    conversationState = {},
    latestMessage = ""
} = {}) {

    const runtime = {
        language:
            decision.language?.code ??
            conversationState.language ??
            DEFAULTS.language,

        intent:
            decision.intent?.value ??
            DEFAULTS.intent,

        emotion:
            decision.emotion ??
            DEFAULTS.emotion,

        stage:
            decision.conversationStage ??
            conversationState.stage ??
            DEFAULTS.stage,

        workflow:
            conversationState.activeFlow ??
            DEFAULTS.workflow,

        currentStep:
            conversationState.currentStep ??
            DEFAULTS.currentStep,

        previousStep:
            conversationState.previousStep ??
            DEFAULTS.previousStep,

        confidence:
            decision.analysisConfidence ??
            DEFAULTS.confidence,

        interrupted:
            conversationState.isInterrupted ??
            DEFAULTS.interrupted,

        latestMessage
    };

    return {
        data: runtime,
        prompt: buildConversationPrompt(runtime)
    };
}

/**
 * =============================================================================
 * Prompt Formatter
 * =============================================================================
 */

function buildConversationPrompt(runtime) {

    return `
===============================================================================
CONVERSATION RUNTIME
===============================================================================

Language             : ${runtime.language}
Intent               : ${runtime.intent}
Emotion              : ${runtime.emotion}
Conversation Stage   : ${runtime.stage}
Active Workflow      : ${runtime.workflow}
Current Step         : ${runtime.currentStep}
Previous Step        : ${runtime.previousStep}
Analysis Confidence  : ${runtime.confidence}
Interrupted          : ${runtime.interrupted ? "Yes" : "No"}

Latest Customer Message
-----------------------
${runtime.latestMessage || "N/A"}

===============================================================================
`.trim();

}

/**
 * =============================================================================
 * Runtime Metadata
 * =============================================================================
 */

export const CONVERSATION_RUNTIME_INFO = Object.freeze({

    name: "Conversation Runtime",

    version: "1.0.0",

    source: [
        "Conversation Understanding Layer",
        "Decision Builder",
        "Conversation State Manager"
    ]

});

/**
 * =============================================================================
 * Default Export
 * =============================================================================
 */

export default buildConversationRuntime;
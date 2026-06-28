/**
 * =============================================================================
 * Velora Workflow Engine
 * =============================================================================
 *
 * File:
 *    05_workflowManager.mjs
 *
 * Purpose:
 *    Central orchestrator for workflow management.
 *
 * Responsibilities
 * ----------------
 * ✓ Detect workflow
 * ✓ Validate workflow
 * ✓ Validate transition
 * ✓ Update conversation workflow
 * ✓ Return final workflow decision
 *
 * Never:
 * ✗ Call Gemini
 * ✗ Execute business logic
 * ✗ Search products
 *
 * =============================================================================
 */

import detectWorkflow from "./02_workflowDetector.mjs";
import validateWorkflow from "./03_workflowValidator.mjs";

import {
    canTransition,
    isGlobalInterrupt,
    getAvailableTransitions
} from "./04_workflowTransitions.mjs";

import {
    WORKFLOWS
} from "./01_workflowDefinitions.mjs";

/* =============================================================================
 * Workflow Manager
 * =============================================================================
 */

export function manageWorkflow({

    message = "",

    intent = "",

    decision = {},

    conversationState = {},

    memory = {}

} = {}) {

    let currentWorkflow =
        conversationState.currentWorkflow ||
        WORKFLOWS.IDLE;

    if (currentWorkflow === "general_chat") {
        currentWorkflow = WORKFLOWS.IDLE;
    }

    console.log(`\n[WorkflowManager] TRANSITION ATTEMPT:
  Session ID: ${conversationState.sessionId || 'Unknown'}
  Current Workflow: ${currentWorkflow}
  Active Flow: ${conversationState.activeFlow?.type || 'Unknown'}
  Caller Stack: ${new Error().stack.split('\n').slice(1, 4).join('\n')}`);

    /* -------------------------------------------------------------------------
     * Step 1
     * Detect next workflow
     * ---------------------------------------------------------------------- */

    const nextWorkflow =
        detectWorkflow({

            message,

            intent,

            decision,

            conversationState

        });

    console.log(`  Requested Workflow: ${nextWorkflow}\n`);

    /* -------------------------------------------------------------------------
     * Step 2
     * Validate workflow state
     * ---------------------------------------------------------------------- */

    const validation =
        validateWorkflow({

            currentWorkflow,

            nextWorkflow,

            conversationState,

            message,

            memory

        });

    if (!validation.allowed) {

        console.warn(`[WorkflowManager] VALIDATION FAILED: ${validation.reason}. Action: ${validation.action}`);

        return {

            success: false,

            workflow: currentWorkflow,

            action: "REQUIRE_USER_INPUT",

            reason: validation.reason,

            resetWorkflow: false

        };

    }

    /* -------------------------------------------------------------------------
     * Step 3
     * Greeting reset
     * ---------------------------------------------------------------------- */

    if (validation.resetWorkflow) {

        return {

            success: true,

            workflow: WORKFLOWS.GREETING,

            previousWorkflow: currentWorkflow,

            action: "START_NEW_WORKFLOW",

            reason: validation.reason,

            resetWorkflow: true

        };

    }

    /* -------------------------------------------------------------------------
     * Step 4
     * Global Interrupt
     * ---------------------------------------------------------------------- */

    if (

        isGlobalInterrupt(nextWorkflow)

    ) {

        return {

            success: true,

            workflow: nextWorkflow,

            previousWorkflow: currentWorkflow,

            action: "INTERRUPT_WORKFLOW",

            reason: "Global workflow interrupt.",

            resetWorkflow: false

        };

    }

    /* -------------------------------------------------------------------------
     * Step 5
     * Validate transition
     * ---------------------------------------------------------------------- */

    if (

        !canTransition(

            currentWorkflow,

            nextWorkflow

        )

    ) {

        console.error(`[WorkflowManager] TRANSITION REJECTED: Cannot transition from ${currentWorkflow} to ${nextWorkflow}. Allowed transitions: ${getAvailableTransitions(currentWorkflow).join(", ")}`);

        return {

            success: false,

            workflow: currentWorkflow,

            action: "REQUIRE_USER_INPUT",

            reason:
                `Cannot transition from ${currentWorkflow} to ${nextWorkflow}.`

        };

    }

    /* -------------------------------------------------------------------------
     * Step 6
     * Transition approved
     * ---------------------------------------------------------------------- */

    return {

        success: true,

        workflow: nextWorkflow,

        previousWorkflow: currentWorkflow,

        action: "CONTINUE_WORKFLOW",

        reason: "Workflow transition approved.",

        resetWorkflow: false

    };

}

/* =============================================================================
 * Metadata
 * =============================================================================
 */

export const WORKFLOW_MANAGER_INFO = Object.freeze({

    name: "Velora Workflow Manager",

    version: "1.0.0",

    status: "Production"

});

/* =============================================================================
 * Default Export
 * =============================================================================
 */

export default manageWorkflow;
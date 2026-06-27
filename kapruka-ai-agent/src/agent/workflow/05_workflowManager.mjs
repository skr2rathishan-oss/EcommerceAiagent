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
    isGlobalInterrupt
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

    const currentWorkflow =
        conversationState.currentWorkflow ||
        WORKFLOWS.IDLE;

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

        return {

            success: false,

            workflow: currentWorkflow,

            action: validation.action,

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

            action: "reset",

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

            action: "interrupt",

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

        return {

            success: false,

            workflow: currentWorkflow,

            action: "clarify",

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

        action: "continue",

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
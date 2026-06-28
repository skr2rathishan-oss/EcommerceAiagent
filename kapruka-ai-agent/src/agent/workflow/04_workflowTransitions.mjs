/**
 * =============================================================================
 * Velora Workflow Engine
 * =============================================================================
 *
 * File:
 *    04_workflowTransitions.mjs
 *
 * Purpose:
 *    Defines all valid workflow transitions.
 *
 * Responsibilities
 * ----------------
 * ✓ Define valid workflow transitions
 * ✓ Prevent impossible workflow jumps
 * ✓ Support workflow interruption
 * ✓ Support workflow reset
 *
 * Never:
 * ✗ Execute business logic
 * ✗ Call Gemini
 * ✗ Detect workflow
 * ✗ Modify conversation state
 *
 * =============================================================================
 */

import WORKFLOWS from "./01_workflowDefinitions.mjs";

/* =============================================================================
 * Workflow Transition Map
 * =============================================================================
 */

export const WORKFLOW_TRANSITIONS = Object.freeze({

    [WORKFLOWS.IDLE]: [

        WORKFLOWS.GREETING,
        WORKFLOWS.PRODUCT_SEARCH,
        WORKFLOWS.ORDER_TRACKING,
        WORKFLOWS.CUSTOMER_SUPPORT

    ],

    [WORKFLOWS.GREETING]: [

        WORKFLOWS.PRODUCT_SEARCH,
        WORKFLOWS.ORDER_TRACKING,
        WORKFLOWS.CUSTOMER_SUPPORT

    ],

    [WORKFLOWS.PRODUCT_SEARCH]: [

        WORKFLOWS.PRODUCT_DETAILS,
        WORKFLOWS.PRODUCT_RECOMMENDATION,
        WORKFLOWS.DELIVERY,
        WORKFLOWS.ORDER_TRACKING,
        WORKFLOWS.CUSTOMER_SUPPORT,
        WORKFLOWS.SHOPPING

    ],

    [WORKFLOWS.SHOPPING]: [

        WORKFLOWS.PRODUCT_SEARCH,
        WORKFLOWS.PRODUCT_DETAILS,
        WORKFLOWS.PRODUCT_RECOMMENDATION,
        WORKFLOWS.DELIVERY,
        WORKFLOWS.ORDER_TRACKING,
        WORKFLOWS.CUSTOMER_SUPPORT

    ],

    [WORKFLOWS.PRODUCT_DETAILS]: [

        WORKFLOWS.PRODUCT_SEARCH,
        WORKFLOWS.DELIVERY,
        WORKFLOWS.CHECKOUT

    ],

    [WORKFLOWS.PRODUCT_RECOMMENDATION]: [

        WORKFLOWS.PRODUCT_DETAILS,
        WORKFLOWS.DELIVERY,
        WORKFLOWS.CHECKOUT

    ],

    [WORKFLOWS.DELIVERY]: [

        WORKFLOWS.CHECKOUT,
        WORKFLOWS.PRODUCT_SEARCH

    ],

    [WORKFLOWS.CHECKOUT]: [

        WORKFLOWS.PAYMENT,
        WORKFLOWS.PRODUCT_SEARCH

    ],

    [WORKFLOWS.PAYMENT]: [

        WORKFLOWS.ORDER_CONFIRMATION

    ],

    [WORKFLOWS.ORDER_CONFIRMATION]: [

        WORKFLOWS.ORDER_TRACKING,
        WORKFLOWS.PRODUCT_SEARCH

    ],

    [WORKFLOWS.ORDER_TRACKING]: [

        WORKFLOWS.PRODUCT_SEARCH,
        WORKFLOWS.CUSTOMER_SUPPORT

    ],

    [WORKFLOWS.CUSTOMER_SUPPORT]: [

        WORKFLOWS.PRODUCT_SEARCH,
        WORKFLOWS.ORDER_TRACKING

    ],

    [WORKFLOWS.RECOVERY]: [

        WORKFLOWS.PRODUCT_SEARCH,
        WORKFLOWS.GREETING

    ]

});

/* =============================================================================
 * Global Interrupt Workflows
 * =============================================================================
 */

export const GLOBAL_INTERRUPTS = Object.freeze([

    WORKFLOWS.GREETING,

    WORKFLOWS.ORDER_TRACKING,

    WORKFLOWS.CUSTOMER_SUPPORT,

    WORKFLOWS.RECOVERY

]);

/* =============================================================================
 * Can Transition
 * =============================================================================
 */

export function canTransition(currentWorkflow, nextWorkflow) {

    if (!currentWorkflow || !nextWorkflow) {

        return false;

    }

    if (currentWorkflow === nextWorkflow) {

        return true;

    }

    const allowedTransitions =
        WORKFLOW_TRANSITIONS[currentWorkflow] || [];

    return allowedTransitions.includes(nextWorkflow);

}

/* =============================================================================
 * Is Global Interrupt
 * =============================================================================
 */

export function isGlobalInterrupt(workflow) {

    return GLOBAL_INTERRUPTS.includes(workflow);

}

/* =============================================================================
 * Get Available Transitions
 * =============================================================================
 */

export function getAvailableTransitions(workflow) {

    return WORKFLOW_TRANSITIONS[workflow] || [];

}

/* =============================================================================
 * Metadata
 * =============================================================================
 */

export const WORKFLOW_TRANSITION_INFO = Object.freeze({

    name: "Velora Workflow Transition Engine",

    version: "1.0.0",

    status: "Production"

});

/* =============================================================================
 * Default Export
 * =============================================================================
 */

export default WORKFLOW_TRANSITIONS;
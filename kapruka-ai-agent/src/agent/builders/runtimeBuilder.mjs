/**
 * =============================================================================
 * Velora AI Runtime Builder
 * =============================================================================
 *
 * File:
 *    runtimeBuilder.mjs
 *
 * Purpose:
 *    Builds the complete Runtime Context used by Gemini.
 *
 * Responsibilities
 * ----------------
 * ✓ Build Conversation Runtime
 * ✓ Build Customer Runtime
 * ✓ Build Commerce Runtime
 * ✓ Build Memory Runtime
 * ✓ Build Response Runtime
 * ✓ Build System Runtime
 * ✓ Combine everything into one Runtime Context
 *
 * Never:
 * ✗ Call Gemini
 * ✗ Perform business logic
 * ✗ Access MongoDB
 * ✗ Search MCP
 * ✗ Validate prompts
 *
 * =============================================================================
 */

import buildConversationRuntime from "../runtime/conversation.runtime.mjs";
import buildCustomerRuntime from "../runtime/customer.runtime.mjs";
import buildCommerceRuntime from "../runtime/commerce.runtime.mjs";
import buildMemoryRuntime from "../runtime/memory.runtime.mjs";
import buildResponseRuntime from "../runtime/response.runtime.mjs";
import buildSystemRuntime from "../runtime/system.runtime.mjs";

/* =============================================================================
 * Runtime Builder
 * ========================================================================== */
export function buildRuntimeContext(runtimeContext = {}) {

    const conversation = buildConversationRuntime(runtimeContext);

    const customer = buildCustomerRuntime(runtimeContext);
    
    // Explicit Language override to fix telemetry/prompt
    if (runtimeContext.customer) {
       customer.data.preferredLanguage = runtimeContext.customer.preferredLanguage;
    }

    const commerce = buildCommerceRuntime(runtimeContext);

    const memory = buildMemoryRuntime({
        ...runtimeContext,
        shouldSuppressMemory: runtimeContext.shouldSuppressMemory
    });

    const response = buildResponseRuntime(runtimeContext);

    const system = buildSystemRuntime(runtimeContext);

    const workflowData = runtimeContext.workflow || {};
    const workflowPrompt = `
===============================================================================
WORKFLOW RUNTIME
===============================================================================

Current Workflow      : ${workflowData.currentWorkflow || "idle"}
Previous Workflow     : ${workflowData.previousWorkflow || "idle"}
Last Transition       : ${workflowData.lastTransition || "none"}
Awaiting Confirmation : ${workflowData.awaitingConfirmation ? "Yes" : "No"}
Waiting For Phone     : ${workflowData.waitingForPhoneNumber ? "Yes" : "No"}
Waiting For Delivery  : ${workflowData.waitingForDelivery ? "Yes" : "No"}
Waiting For Payment   : ${workflowData.waitingForPayment ? "Yes" : "No"}
Resume Search         : ${workflowData.resumeSearch ? "Yes" : "No"}
Previous Search Query : ${workflowData.previousSearchQuery || "none"}

===============================================================================
`.trim();

    const referenceData = runtimeContext.resolvedReference || null;
    let referencePrompt = "";
    if (referenceData && referenceData.success && referenceData.handled) {
        if (referenceData.action === "PRODUCT_SELECTED" && referenceData.product) {
            referencePrompt = `
===============================================================================
REFERENCE RUNTIME (RESOLVED PRODUCT)
===============================================================================

The user is referring to the following product. This product has already been resolved from the user's message (e.g. ordinals or pronouns in their message refer to this product). You MUST focus on and talk about this resolved product, ignoring any literal ordinal numbers in the user's message:
Name: ${referenceData.product.name}
Brand: ${referenceData.product.brand || "N/A"}
Price: ${referenceData.product.price || "N/A"} ${referenceData.product.currency || ""}
Description: ${referenceData.product.description || "N/A"}

===============================================================================
`.trim();
        } else if (referenceData.action === "COMPARE_PRODUCTS" && referenceData.products) {
            const productsList = referenceData.products.map((p, idx) => `
Product ${idx + 1}:
Name: ${p.name}
Brand: ${p.brand || "N/A"}
Price: ${p.price || "N/A"} ${p.currency || ""}
Description: ${p.description || "N/A"}
`).join("\n");
            referencePrompt = `
===============================================================================
REFERENCE RUNTIME (COMPARE PRODUCTS)
===============================================================================

The user is comparing the following products. These products have already been resolved from the user's message (e.g. ordinals like "2nd", "4th" or pronouns in their message refer to these specific products). You MUST compare only these resolved products and ignore any literal ordinal numbers in the user's message since they have already been resolved for you:
${productsList}

===============================================================================
`.trim();
        }
    }

    return {

        data: {

            conversation: conversation.data,

            customer: customer.data,

            shopping: commerce.data,

            delivery: runtimeContext.delivery || {},

            memory: memory.data,

            response: response.data,

            workflow: workflowData,

            resolvedReference: runtimeContext.resolvedReference || null

        },

        prompt: [

            "===============================================================================",
            "VELORA RUNTIME CONTEXT",
            "===============================================================================",
            "",

            conversation.prompt,
            "",
            customer.prompt,
            "",
            commerce.prompt,
            "",
            workflowPrompt,
            "",
            referencePrompt,
            "",
            memory.prompt,
            "",
            response.prompt,
            "",
            system.prompt

        ].filter(Boolean).join("\n")

    };

}

/* =============================================================================
 * Runtime Metadata
 * ========================================================================== */

export const RUNTIME_BUILDER_INFO = Object.freeze({

    name: "Velora Runtime Builder",

    version: "1.0.0",

    modules: 7,

    runtime: [

        "Conversation",

        "Customer",

        "Commerce",

        "Memory",

        "Response",

        "System",

        "Workflow"

    ]

});

/* =============================================================================
 * Helper: Construct Runtime Data Object
 * ========================================================================== */

export function constructRuntimeData({
    decision,
    userState,
    memory,
    memoryState,
    deliverySession,
    pendingOrder,
    voiceMode,
    message,
    resolvedReference,
    products = [],
    tracking = null,
    responseLibrary = null,
    shouldSuppressMemory = false
}) {
    return {
        decision,
        conversationState: userState,
        shouldSuppressMemory,
        customer: {
            name: decision?.variables?.customer_name || userState?.customerName,
            preferredLanguage: decision?.language?.detected || userState?.preferredLanguage || "english",
            city: decision?.variables?.city || userState?.city,
            shoppingStyle: memory?.shoppingStyle || "standard"
        },
        memory: memoryState,
        shopping: {
            searchQuery: decision?.variables?.product_name || memory?.searchQuery,
            category: decision?.variables?.category || memory?.category,
            activeContextId: userState?.active_shopping_context
        },
        delivery: {
            deliveryRequired: userState?.activeFlow === "delivery",
            deliveryAddress: deliverySession?.delivery_address || null,
            deliveryDate: deliverySession?.delivery_date || null,
            status: deliverySession?.state || null
        },
        workflow: userState?.workflowContext || {
            currentWorkflow: userState?.activeFlow?.type || "idle",
            previousWorkflow: "idle",
            lastTransition: null,
            workflowStartedAt: null,
            awaitingConfirmation: false,
            waitingForPhoneNumber: false,
            waitingForDelivery: false,
            waitingForPayment: false,
            resumeSearch: false,
            previousSearchQuery: null,
            canInterrupt: true,
            canResume: false
        },
        response: {
            type: decision?.response?.type || "conversation",
            templateId: decision?.response?.templateId,
            templateName: decision?.response?.templateName,
            mode: decision?.response?.mode || "dynamic",
            searchProducts: decision?.response?.searchProducts,
            recommendProducts: decision?.response?.recommendProducts,
            askClarification: decision?.response?.askClarification,
            useMemory: decision?.response?.useMemory !== false,
            template: decision?.response?.templateId
        },
        settings: {
            streaming: !voiceMode,
            voiceMode: !!voiceMode,
            model: null,
            environment: process.env.NODE_ENV || "development"
        },
        latestMessage: message,
        resolvedReference: resolvedReference || null,
        products,
        tracking,
        responseLibrary
    };
}

/* =============================================================================
 * Default Export
 * ========================================================================== */

export default buildRuntimeContext;
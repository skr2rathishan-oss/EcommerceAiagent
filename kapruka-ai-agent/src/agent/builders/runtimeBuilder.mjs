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

    const commerce = buildCommerceRuntime(runtimeContext);

    const memory = buildMemoryRuntime(runtimeContext);

    const response = buildResponseRuntime(runtimeContext);

    const system = buildSystemRuntime(runtimeContext);

    return {

        data: {

            conversation: conversation.data,

            customer: customer.data,

            commerce: commerce.data,

            memory: memory.data,

            response: response.data,

            system: system.data

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
            memory.prompt,
            "",
            response.prompt,
            "",
            system.prompt

        ].join("\n")

    };

}

/* =============================================================================
 * Runtime Metadata
 * ========================================================================== */

export const RUNTIME_BUILDER_INFO = Object.freeze({

    name: "Velora Runtime Builder",

    version: "1.0.0",

    modules: 6,

    runtime: [

        "Conversation",

        "Customer",

        "Commerce",

        "Memory",

        "Response",

        "System"

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
    message
}) {
    return {
        decision,
        conversationState: userState,
        customer: {
            name: decision?.variables?.customer_name || userState?.customerName,
            preferredLanguage: decision?.language?.code || userState?.language,
            city: decision?.variables?.city || userState?.city,
            shoppingStyle: memory?.shoppingStyle || "standard"
        },
        memory: memoryState,
        commerce: {
            searchQuery: decision?.variables?.product_name || memory?.searchQuery,
            category: decision?.variables?.category || memory?.category,
            deliveryRequired: userState?.activeFlow === "delivery",
            checkoutStarted: userState?.activeFlow === "checkout",
            paymentCompleted: deliverySession?.state === "COMPLETED"
        },
        products: [],
        cart: {
            items: memory?.cart || [],
            total: memory?.cart?.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0) || 0,
            deliveryAddress: deliverySession?.delivery_address
        },
        order: {
            orderNumber: pendingOrder || deliverySession?.orderNumber || deliverySession?.id
        },
        tracking: {
            status: deliverySession?.state
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
        latestMessage: message
    };
}

/* =============================================================================
 * Default Export
 * ========================================================================== */

export default buildRuntimeContext;
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

    const mission = runtimeContext.shoppingMission || null;
    let missionPrompt = "";
    if (mission) {
        let phaseInstructions = "";
        const isSelectionPhase = mission.status === "SEARCHING" || mission.status === "SELECTING_PRODUCTS" || mission.status === "READY_FOR_CHECKOUT" || mission.status === "COMPLETED";
        
        if (mission.status === "READY_FOR_CHECKOUT") {
            phaseInstructions = `
Instructions for READY_FOR_CHECKOUT Phase:
1. The Shopping Mission is complete! Every required product has been successfully selected.
2. Under NO circumstances ask the user to select another product or search anymore.
3. Generate a beautiful, structured, conversational Gift Summary showing:
   - Occasion (e.g., "🎁 Anniversary Gift Plan" or "🎁 Birthday Gift Plan")
   - Recipient
   - Total Budget
   - Selected Products list with names and prices (e.g. "👗 Silk Dress - Rs. 35000", "🎧 Samsung Galaxy Buds - Rs. 28000")
   - Total Cost of all selected gifts
   - Remaining Budget
   - Budget Status (e.g., "✓ Within Budget", "⚠ Near Budget", "Over Budget")
4. Follow the summary with a warm, natural review of the selected gifts in the user's active/detected preferred language (${runtimeContext.customer?.preferredLanguage || "English"}), confirming they fit comfortably within the budget and make a balanced combination. Tell them they can say "Checkout" or "add to cart" to proceed to checkout or replace any item if they'd like.
`.trim();
        } else if (isSelectionPhase) {
            const activeItem = mission.missionItems?.find(item => item.searchCompleted && !item.selectedProduct);
            phaseInstructions = `
Instructions for Product Selection Phase:
1. We have automatically transitioned into the product selection phase because all required details are complete!
2. Under NO circumstances tell the user that you cannot show images, cannot display products in this chat, or that they should search on the Kapruka website. The frontend completely renders rich cards and images.
3. Enthusiastically present the displaying recommended products for the active item category: "${activeItem?.category || "Gift"}".
4. Explicitly guide the user to choose or select from the product cards shown in the carousel below (e.g. "Perfect! I've planned your anniversary gift. Let's start by choosing the clothing item first.").
5. The conversation must flow sequentially: Search -> User Selects -> Next Search -> User Selects.
`.trim();
        } else {
            phaseInstructions = `
STRICT Instructions for Information Collection Phase:
1. The Shopping Mission is the SINGLE SOURCE OF TRUTH. Follow shoppingMission.currentStep EXACTLY.
2. Current step is: "${mission.currentStep || 'Collecting Occasion'}".
3. If ANY required field is missing, ask for ONLY the next missing field in a polite, conversational Sri Lankan concierge style.
4. NEVER skip steps. NEVER assume missing information.
5. CRITICAL PROHIBITIONS during information collection:
   - NEVER mention or recommend products
   - NEVER say "I'll show you...", "Let me search...", "I found...", or similar
   - NEVER generate product names, prices, or descriptions
   - NEVER mention searching or browsing
   - NEVER generate a "Search Products" UI payload
   - If the user mentions a category or product name (e.g. "dress", "iPhone", "flowers"), acknowledge it politely but CONTINUE collecting the missing field
   - Example: User says "dress" while budget is missing → "Great choice! Before I start looking, could you share your budget so I can find the best options?"
6. Be helpful, concise, and do not repeat questions for information that has already been collected.
`.trim();
        }

        missionPrompt = `
SHOPPING MISSION RUNTIME (GIFT PLANNER)

Active Shopping Mission State:
ID:               ${mission.id}
Status:           ${mission.status}
Occasion:         ${mission.occasion || "Missing"}
Recipient:        ${mission.recipient || "Missing"}
Budget:           ${mission.budget ? `${mission.budget} ${mission.currency}` : "Missing"}
Remaining Budget: ${mission.remainingBudget ? `${mission.remainingBudget} ${mission.currency}` : "Missing"}
Categories:       ${(mission.missionItems || []).map(i => i.category).join(", ") || "Missing"}
Current Step:     ${mission.currentStep || "Collecting Occasion"}

${phaseInstructions}
`.trim();
    }
    
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

The user is referring to the following product. Address their question or action regarding this specific product:
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

The user is comparing the following products. Address their comparison regarding these products:
${productsList}

===============================================================================
`.trim();
        }
    }

    // ── Dedicated Presentation Layer Instructions ──
    const presentationPrompt = `
PRODUCT PRESENTATION LAYER CONSTRAINTS

You MUST strictly follow these rules when presenting or discussing products in this turn:
1. GREETING/INTRO: Use ONLY a very short conversational introduction (2-3 sentences maximum) before letting the frontend render the products list/cards.
2. NO ESSAYS/BREAKDOWNS: NEVER generate detailed explanations, comparisons, pros/cons, or alternatives of the products unless the user explicitly asks for them in their message.
3. PRODUCT FOCUS: Product cards are the primary focus of the UI. Keep text incredibly concise and light.
4. NO FABRICATION: Never invent or fabricate product names, prices, brands, images, or details. Only recommend real products returned in the context. If no matching products exist in the returned list, explain naturally and ask whether to broaden/modify the search. Do not fabricate anything.
5. NO RE-USE: Only discuss products matching the active category. Never leak or reuse previous categories' search results.
`.trim();

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
            missionPrompt,
            "",
            presentationPrompt,
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
        shoppingMission: userState?.shoppingMission || null,
        customer: {
            name: decision?.variables?.customer_name || userState?.customerName,
            preferredLanguage: decision?.language?.detected || userState?.preferredLanguage || "english",
            city: decision?.variables?.city || userState?.city,
            shoppingStyle: memory?.shoppingStyle || "standard"
        },
        memory: memoryState,
        shopping: {
            searchQuery: (userState?.shoppingMission?.status === "COLLECTING_INFORMATION") ? null : (decision?.variables?.product_name || memory?.searchQuery),
            category: (userState?.shoppingMission?.status === "COLLECTING_INFORMATION") ? null : (decision?.variables?.category || memory?.category),
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
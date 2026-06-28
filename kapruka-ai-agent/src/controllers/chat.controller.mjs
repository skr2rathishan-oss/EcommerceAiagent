import { chatWithLLM } from "../services/ai/llm.service.mjs";
import { understandConversation, selectResponse, selectResponseWithFallback, buildDecision } from "../services/responseService.mjs";
import manageWorkflow from "../agent/workflow/05_workflowManager.mjs";
import { constructRuntimeData } from "../agent/builders/runtimeBuilder.mjs";
import { handleReference } from "../agent/reference/05_referenceManager.mjs";
import {
  recordIntentDetection,
  recordMemoryLoad,
  recordQwenResponse,
  recordMcpSearch,
  recordFormatting,
  recordTotal
} from "../services/core/performance.service.mjs";
import { routeIntent } from "../agent/intentRouter.mjs";
import { getRecentHistory, addMessage, clearConversation } from "../services/memory/chatMemory.service.mjs";
import { formatRecommendations } from "../utils/formatters/recommendationFormatter.js";
import { getShoppingContext, updateMemory, getMemory } from "../agent/memoryManager.mjs";
import { saveMessage } from "../services/memory/conversation.service.mjs";
import { checkAndTriggerSummarization } from "../services/memory/memory.service.mjs";
import { buildPersonalizedContext, shouldUseMemory, getMessageIntent } from "../memory/contextEngine.mjs";
import { mergeToProfile, getDeliverySession, updateDeliverySession } from "../memory/memoryStore.mjs";
import { shouldBypassQwen, getFastPathType } from "../agent/fastPathRouter.mjs";
import { getContext } from "../services/core/logger.service.mjs";
import { cacheService } from "../cache/cacheService.mjs";
import {
  loadConversationState,
  saveConversationState,
  getActiveDelivery,
  getPendingOrder,
  getShoppingContexts,
  setActiveShoppingContext,
  setPendingOrder,
  clearPendingOrder,
  clearConversationState,
  pauseCurrentFlow,
  resumeFlow
} from "../services/commerce/conversationStateService.mjs";
import {
  createShoppingContext,
  pauseShoppingContext,
  resumeShoppingContext,
  completeShoppingContext,
  findMatchingContext,
  restoreShoppingContext,
  updateShoppingContextInDB
} from "../services/commerce/shoppingContextService.mjs";
import {
  handleAddressInput,
  handleAddressConfirmation,
  handleDateInput,
  handleRecoveryChoice,
  handleCancelOptions,
  handleCheckoutConfirmation,
  handleContactNameInput,
  handleContactPhoneInput,
  handleFinalOrderConfirmation,
  handleCancelChoice
} from "../services/commerce/deliveryFlowService.mjs";
import {
  buildInitialLogs,
  extractText,
  createProgressUpdater,
  sendErrorAndEnd,
  sendCompleteAndEnd,
  setSSEHeaders
} from "../utils/sse.utils.mjs";
import {
  logIncomingMessage,
  logStepStart,
  logStepDone,
  logStepError,
  logContextExtracted,
  logRequestFooter,
  logCacheHit,
  logBackground,
  logError,
  logWorkflowTrace
} from "../utils/velora.console.mjs";

export const chat = async (req, res) => {
  const requestStart = Date.now();
  const context = getContext();

  let logs = [];
  let intentLabel = "—";
  let providerUsed = "";

  try {
    const { message, commerceState, voiceMode } = req.body;
    const sessionId = req.headers["x-session-id"] || req.body.sessionId || "default";

    // ── Validate ─────────────────────────────────────────────────────────────
    if (!message || typeof message !== "string" || message.trim() === "") {
      return res.status(400).json({ success: false, message: "Message is required." });
    }

    // ── Cart state update (non-blocking, silent) ──────────────────────────────
    if (commerceState) {
      const { cart, wishlist, saved, buyNowProduct, buyNowVariants, deliveryInfo } = commerceState;
      let cartSummary = "Current Cart is empty.";
      if (cart?.length > 0) {
        const itemsText = cart.map(i => `${i.quantity}x ${i.name} - Rs.${i.price}`).join("\n");
        const total = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
        cartSummary = `Current Cart:\n${itemsText}\n\nTotal:\nRs.${total}`;
      }

      const memoryUpdates = {
        cart: cart || [],
        wishlist: wishlist || [],
        savedProducts: saved || [],
        cartSummary
      };

      if (buyNowProduct !== undefined) memoryUpdates.buyNowProduct = buyNowProduct;
      if (buyNowVariants !== undefined) memoryUpdates.buyNowVariants = buyNowVariants;
      if (deliveryInfo !== undefined) memoryUpdates.deliveryInfo = deliveryInfo;

      updateMemory(sessionId, memoryUpdates);
    }

    // ── Load Conversation State and History first for CUL ───────────────────
    let userState = await loadConversationState(sessionId);
    
    const lowerMsg = message.toLowerCase().trim();

    const activeCollectingStates = [
      "WAITING_FOR_ADDRESS",
      "WAITING_FOR_ADDRESS_CONFIRMATION",
      "WAITING_FOR_DATE",
      "CHECKING_DELIVERY",
      "WAITING_FOR_RECOVERY_CHOICE",
      "WAITING_FOR_ALTERNATIVE_PRODUCT_SELECTION",
      "WAITING_FOR_CONFIRMATION",
      "WAITING_FOR_FINAL_ORDER_CONFIRMATION",
      "WAITING_FOR_CONTACT_NAME",
      "WAITING_FOR_CONTACT_PHONE",
      "WAITING_FOR_CANCEL_CHOICE"
    ];
    const isResumeHistory = ["resume previous chat", "resume my previous chat", "continue my last chat", "continue previous chat", "load previous chat", "load my previous chat", "resume previous chatting", "resume chat"].some(
      phrase => lowerMsg.includes(phrase)
    );

    if (isResumeHistory && userState?.workflowContext?.lastResetAt) {
      logStepStart("Resume previous chat history");
      userState = await saveConversationState(sessionId, {
        workflowContext: {
          ...(userState.workflowContext || {}),
          lastResetAt: null
        }
      });
      logStepDone("Resume previous chat history", "Cleared lastResetAt to restore history");
    }

    const lastResetAt = userState?.workflowContext?.lastResetAt;
    const history = await getRecentHistory(sessionId, lastResetAt);
    const activeDeliveryId = userState?.active_delivery_session || userState?.pending_order;
    const pendingOrder = userState?.pending_order;

    // Load delivery session
    let deliverySession = activeDeliveryId ? await getDeliverySession(activeDeliveryId).catch(() => null) : null;
    let deliveryState = deliverySession?.state;

    // ── Run Conversation Understanding Layer (CUL) ──
    logStepStart("Conversation Understanding");
    const culOutput = await understandConversation({
      message,
      deliveryState: deliveryState || null,
      conversationState: userState,
      history,
      voiceMode: !!voiceMode,
    });
    const decision = buildDecision(culOutput, deliveryState || null, userState, message);
    if (bodyIntent) {
      decision.intent.value = bodyIntent;
    }
    const currentLang = decision.language.code;
    const memory = getMemory(sessionId);

    // Resolve conversational reference before any product detail/compare/cart operation
    const refResult = handleReference(sessionId, message);
    let resolvedReference = null;

    if (refResult.handled) {
      // Smart bypass: If reference is generic and not product-specific intent, do not intercept
      const isProductSpecificIntent = ["get_product_details", "select_product", "check_delivery"].includes(decision.intent.value);
      const isExplicitRef = refResult.parsed && refResult.parsed.type !== "generic";
      if (!isExplicitRef && !isProductSpecificIntent) {
        refResult.handled = false;
      }
    }

    if (refResult.handled) {
      if (!refResult.success) {
        logStepError("Reference Engine", refResult.reason);
        setSSEHeaders(res);
        saveMessage(sessionId, "assistant", refResult.response).catch(() => {});
        return sendCompleteAndEnd(res, { type: "text", text: refResult.response });
      } else {
        logStepDone("Reference Engine", `Resolved reference: ${refResult.action}`);
        resolvedReference = refResult;
        
        if (refResult.action === "PRODUCT_SELECTED" && refResult.internalProduct) {
          decision.variables = decision.variables || {};
          decision.variables.product_id = refResult.internalProduct.id;
          decision.variables.product_name = refResult.internalProduct.name;
          
          if (decision.intent.value === "general_chat") {
            const lowerMsg = message.toLowerCase();
            if (["detail", "info", "spec", "about", "describe", "show"].some(word => lowerMsg.includes(word))) {
              decision.intent.value = "get_product_details";
            } else {
              decision.intent.value = "select_product";
            }
          }
        } else if (refResult.action === "COMPARE_PRODUCTS" && refResult.internalProducts) {
          decision.intent.value = "general_chat";
        }
      }
    }

    // If active delivery flow is ongoing, check if the input is a valid flow response.
    // If so, override intent to prevent it being intercepted or rejected by validator.


    if (deliverySession && activeCollectingStates.includes(deliveryState)) {
      const isChoiceInput = ["a", "b", "c", "1", "2", "3", "yes", "no", "y", "n", "hari", "ow", "na", "epa", "confirm", "cancel", "edit"].some(
        opt => lowerMsg === opt || lowerMsg.startsWith(opt + " ") || lowerMsg.includes("use this") || lowerMsg.includes("start over")
      );

      let isFlowInput = false;
      if (deliveryState === "WAITING_FOR_ADDRESS_CONFIRMATION" || 
          deliveryState === "WAITING_FOR_RECOVERY_CHOICE" || 
          deliveryState === "WAITING_FOR_ALTERNATIVE_PRODUCT_SELECTION" || 
          deliveryState === "WAITING_FOR_CONFIRMATION" || 
          deliveryState === "WAITING_FOR_CANCEL_CHOICE") {
        if (isChoiceInput) {
          isFlowInput = true;
        }
      } else if (deliveryState === "WAITING_FOR_DATE") {
        const dateKeywords = ["today", "tomorrow", "next", "day after", "ada", "heta", "anidda", "indru", "naalai", "mon", "tue", "wed", "thu", "fri", "sat", "sun", "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
        const hasDateKeyword = dateKeywords.some(kw => lowerMsg.includes(kw));
        const hasDigits = /\d+/.test(lowerMsg);
        if (hasDateKeyword || hasDigits || isChoiceInput) {
          isFlowInput = true;
        }
      } else if (deliveryState === "WAITING_FOR_CONTACT_PHONE") {
        const hasDigits = lowerMsg.replace(/[^0-9]/g, "").length >= 7;
        if (hasDigits || isChoiceInput) {
          isFlowInput = true;
        }
      } else if (deliveryState === "WAITING_FOR_CONTACT_NAME") {
        const wordCount = lowerMsg.split(/\s+/).length;
        const isQuestion = lowerMsg.includes("?") || ["what", "how", "who", "why", "where", "can you", "hi", "hello"].some(q => lowerMsg.startsWith(q));
        if (wordCount <= 3 && !isQuestion) {
          isFlowInput = true;
        }
      } else if (deliveryState === "WAITING_FOR_ADDRESS") {
        const isQuestion = lowerMsg.includes("?") || ["what", "how", "who", "why", "where", "can you", "hi", "hello"].some(q => lowerMsg.startsWith(q));
        const wordCount = lowerMsg.split(/\s+/).length;
        if (wordCount >= 2 && !isQuestion) {
          isFlowInput = true;
        }
      }

      if (isFlowInput) {
        decision.intent.value = "delivery_flow_input";
      }
    }

    // ── Run Workflow Manager ──
    logStepStart("Workflow Manager validation");
    const workflowDecision = manageWorkflow({
      message,
      intent: decision.intent.value,
      decision,
      conversationState: userState,
      memory
    });

    if (!workflowDecision.success || workflowDecision.action === "REQUIRE_USER_INPUT") {
      logStepDone("Workflow Manager", `Validation failed: ${workflowDecision.reason}`);
      const responsePayload = selectResponse(decision, decision.variables, sessionId, workflowDecision);
      let finalPayload = responsePayload;
      if (!finalPayload) {
        // Use Response Engine with confused category as fallback
        const confusedDecision = {
          ...decision,
          response: { module: "common", category: "confused" },
          llm_response: false
        };
        finalPayload = selectResponseWithFallback(confusedDecision, decision.variables, sessionId);
      }
      setSSEHeaders(res);
      if (finalPayload.text) {
        saveMessage(sessionId, "assistant", finalPayload.text).catch(() => {});
      }
      return sendCompleteAndEnd(res, finalPayload);
    }

    logStepDone("Workflow Manager", `Transition allowed to: ${workflowDecision.workflow}`);

    // If reset is triggered, clear conversation state
    if (workflowDecision.action === "START_NEW_WORKFLOW" || workflowDecision.resetWorkflow) {
      userState = await clearConversationState(sessionId);
      
      // Reset the temporary memory context
      if (memory) {
        delete memory.waitingForResumeChoice;
        delete memory.resumableContextId;
        delete memory.pendingSearchQuery;
        delete memory.hasRemindedPendingOrder;
        if (memory.shoppingContext) {
          memory.shoppingContext.lastSearchResults = [];
          memory.shoppingContext.selectedProduct = null;
        }
        updateMemory(sessionId, memory);
      }
    } else if (workflowDecision.action === "INTERRUPT_WORKFLOW") {
      logStepDone("Workflow Manager", "Global Interrupt - Pausing current flow");
      userState = await pauseCurrentFlow(sessionId, "user_interruption") || userState;
    } else {
      // Save state before response generation
      const previousWorkflow = userState?.workflowContext?.currentWorkflow || "idle";
      const updatedWorkflowContext = {
        ...(userState.workflowContext || {}),
        currentWorkflow: workflowDecision.workflow,
        previousWorkflow: previousWorkflow,
        lastTransition: `${previousWorkflow}_to_${workflowDecision.workflow}`,
        workflowStartedAt: userState?.workflowContext?.workflowStartedAt || new Date(),
        awaitingConfirmation: workflowDecision.workflow === "checkout" || (deliverySession && ["WAITING_FOR_CONFIRMATION", "WAITING_FOR_FINAL_ORDER_CONFIRMATION"].includes(deliverySession.state)),
        waitingForPhoneNumber: deliverySession && deliverySession.state === "WAITING_FOR_CONTACT_PHONE",
        waitingForDelivery: deliverySession && ["WAITING_FOR_ADDRESS", "WAITING_FOR_DATE"].includes(deliverySession.state),
        waitingForPayment: deliverySession && deliverySession.state === "PAYMENT_PENDING",
        resumeSearch: workflowDecision.workflow === "product_search" && !!userState?.workflowContext?.previousSearchQuery,
        previousSearchQuery: workflowDecision.workflow === "product_search" ? (userState?.workflowContext?.previousSearchQuery || decision.variables.product_name) : userState?.workflowContext?.previousSearchQuery,
        canInterrupt: true,
        canResume: true
      };

      userState = await saveConversationState(sessionId, {
        activeFlow: {
          type: workflowDecision.workflow,
          status: "active",
          currentStep: decision.conversation_stage
        },
        workflowContext: updatedWorkflowContext
      });
    }

    // ── Log incoming message using CUL's resolved language ──
    logIncomingMessage(sessionId, message, currentLang);
    logStepDone("Language detected", currentLang === "si" ? "Sinhala" : currentLang === "ta" ? "Tamil" : "English");

    // ── Persist user message (background) ──
    saveMessage(sessionId, "user", message).catch(() => { });
    addMessage(sessionId, "user", message).catch(() => { });

    // ── Memory extraction using CUL variables (background) ──
    const extracted = {
      recipients: decision.variables.recipient ? [decision.variables.recipient] : [],
      occasions: decision.variables.occasion ? [decision.variables.occasion] : [],
      budget: decision.variables.price ? parseFloat(decision.variables.price) || null : null,
      categories: decision.variables.category ? [decision.variables.category] : []
    };
    const hasEntities = extracted.recipients.length || extracted.occasions.length ||
      extracted.budget !== null || extracted.categories.length;
    if (hasEntities) {
      mergeToProfile(sessionId, extracted).catch(() => { });
    }

    // Build compatibility parsedIntent and extractedContext structures for existing VCSM logic
    let parsedIntent = {
      intent: decision.intent.value,
      parameters: {
        query: decision.variables.product_name,
        city: decision.variables.city,
        deliveryDate: decision.variables.delivery_date,
        recipient: decision.variables.recipient,
        occasion: decision.variables.occasion,
        filters: {
          category: decision.variables.category,
          brand: decision.variables.brand,
          priceMax: decision.variables.price ? parseFloat(decision.variables.price) || null : null
        }
      }
    };

    // Inject resolved reference parameters
    if (resolvedReference) {
      if (resolvedReference.action === "PRODUCT_SELECTED" && resolvedReference.internalProduct) {
        parsedIntent.parameters.productId = resolvedReference.internalProduct.id;
        parsedIntent.parameters.product_id = resolvedReference.internalProduct.id;
        parsedIntent.parameters.product = resolvedReference.internalProduct;
      } else if (resolvedReference.action === "COMPARE_PRODUCTS" && resolvedReference.internalProducts) {
        parsedIntent.parameters.compareProducts = resolvedReference.internalProducts;
      }
    }
    if (req.body.intent) {
      parsedIntent.intent = req.body.intent;
      parsedIntent.parameters = {
        ...parsedIntent.parameters,
        ...(req.body.parameters || {})
      };
    }
    intentLabel = parsedIntent.intent;

    const extractedContext = {
      conversationLanguage: decision.language.detected,
      recipient: decision.variables.recipient || null,
      occasion: decision.variables.occasion || null,
      budget: decision.variables.price ? parseFloat(decision.variables.price) || null : null,
      productType: decision.variables.product_name || null,
      brand: decision.variables.brand || null,
      category: decision.variables.category || null,
      deliveryDate: decision.variables.delivery_date || null,
      deliveryLocation: decision.variables.city || null,
      phone_number: decision.variables.phone_number || null,
      customer_name: decision.variables.customer_name || null,
      emotion: decision.emotion,
      urgency: decision._raw?.urgency || "normal",
      situation: decision._raw?.situation || "general"
    };
    parsedIntent.parameters.context = extractedContext;



    // CSM Resume Flow Check using Workflow Engine
    const shouldResumeDelivery = workflowDecision.workflow === "delivery" && userState?.pausedFlows?.some(f => f.type === "delivery");
    if (shouldResumeDelivery) {
      logStepDone("Interception", "VCSM: Resuming Paused Delivery Flow via Workflow Engine");
      await resumeFlow(sessionId, "delivery");
      
      // Reload delivery session details
      deliverySession = await getDeliverySession(sessionId);
      deliveryState = deliverySession?.state;

      let category = "continue_delivery_flow";
      let module = "delivery";
      if (deliveryState === "WAITING_FOR_ADDRESS") {
        category = "ask_delivery_address";
      } else if (deliveryState === "WAITING_FOR_DATE") {
        category = "ask_delivery_date";
      } else if (deliveryState === "WAITING_FOR_CONTACT_NAME") {
        category = "ask_contact_name";
      } else if (deliveryState === "WAITING_FOR_CONTACT_PHONE") {
        category = "ask_contact_phone";
      } else if (deliveryState === "WAITING_FOR_CONFIRMATION" || deliveryState === "WAITING_FOR_FINAL_ORDER_CONFIRMATION") {
        category = "confirm_order";
      }

      const resumeDecision = {
        ...decision,
        module,
        category,
        response: { module, category },
        llm_response: false
      };
      const resumeRes = selectResponse(resumeDecision, {}, sessionId);
      let promptText = "Welcome back! 😊 " + (resumeRes?.text || "");

      setSSEHeaders(res);
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ type: "chunk", text: promptText })}\n\n`);
      }
      saveMessage(sessionId, "assistant", promptText).catch(() => {});
      return sendCompleteAndEnd(res, { type: "text", text: promptText });
    }

    // Priority 13: Order Cancellation ("cancel", "don't place it", "never mind", "cancel order", "stop order")
    const cancellationPhrases = ["cancel order", "don't place it", "never mind", "don't place", "cancel my order", "stop order", "cancel"];
    const isCancellation = cancellationPhrases.some(phrase => lowerMsg.includes(phrase)) || (deliveryState === "WAITING_FOR_FINAL_ORDER_CONFIRMATION" && lowerMsg === "no");
    if (isCancellation && (pendingOrder || deliverySession)) {
      logStepDone("Interception", "VCSM: Order Cancellation");
      await saveConversationState(sessionId, { active_delivery_session: null, pending_order: null });
      if (deliverySession) {
        await updateDeliverySession(deliverySession.sessionId, { state: "CANCELLED" }, deliverySession.session_version);
      }
      const cancelDecision = {
        ...decision,
        module: "order",
        category: "order_cancelled",
        response: { module: "order", category: "order_cancelled" },
        llm_response: false
      };
      const cancelRes = selectResponse(cancelDecision, {}, sessionId);
      const cancelText = cancelRes?.text || "";
      saveMessage(sessionId, "assistant", cancelText).catch(() => {});
      return sendCompleteAndEnd(res, { type: "text", text: cancelText });
    }

    // Block operations if order is currently being created or payment is pending
    if (deliverySession && (deliveryState === "CREATING_ORDER" || deliveryState === "PAYMENT_PENDING")) {
      logStepDone("Interception", `VCSM Order Processing Block. State: ${deliveryState}`);
      let msgText = "";
      if (deliveryState === "PAYMENT_PENDING") {
        const blockDecision = {
          ...decision,
          module: "interruption",
          category: "payment_pending_block",
          response: { module: "interruption", category: "payment_pending_block" },
          llm_response: false
        };
        const blockRes = selectResponse(blockDecision, {}, sessionId);
        msgText = blockRes?.text || "";
      } else if (deliveryState === "CREATING_ORDER") {
        const blockDecision = {
          ...decision,
          module: "interruption",
          category: "order_creation_in_progress",
          response: { module: "interruption", category: "order_creation_in_progress" },
          llm_response: false
        };
        const blockRes = selectResponse(blockDecision, {}, sessionId);
        msgText = blockRes?.text || "";
      } else {
        const blockDecision = {
          ...decision,
          module: "interruption",
          category: "order_creation_in_progress",
          response: { module: "interruption", category: "order_creation_in_progress" },
          llm_response: false
        };
        const blockRes = selectResponse(blockDecision, {}, sessionId);
        msgText = blockRes?.text || "";
      }
      saveMessage(sessionId, "assistant", msgText).catch(() => {});
      return sendCompleteAndEnd(res, { type: "text", text: msgText });
    }

    // Priority 3 / 9 / 10 Choice: Shopping Context Resume Choice
    if (memory.waitingForResumeChoice && memory.resumableContextId) {
      const contextId = memory.resumableContextId;
      const isChoiceA = lowerMsg === "a" || lowerMsg === "1" || lowerMsg.includes("continue") || lowerMsg.includes("previous");
      const isChoiceB = lowerMsg === "b" || lowerMsg === "2" || lowerMsg.includes("new") || lowerMsg.includes("start over");

      if (isChoiceA) {
        logStepDone("Interception", "VCSM: Resume Previous Search");
        delete memory.waitingForResumeChoice;
        delete memory.resumableContextId;
        updateMemory(sessionId, memory);

        const restored = await resumeShoppingContext(sessionId, contextId);
        if (restored) {
          await setActiveShoppingContext(sessionId, contextId);
          setSSEHeaders(res);
          const searchResult = await routeIntent("search_products", { query: restored.searchQuery, filters: restored.filters }, sessionId, null, currentLang);
          
          let finalPayload = searchResult;
          if (Array.isArray(searchResult)) {
            const history = await getRecentHistory(sessionId);
            const formattedText = await formatRecommendations(message, searchResult, history, voiceMode);
            finalPayload = { type: "product_grid", text: formattedText, products: searchResult };
          }
          
          const assistantText = extractText(finalPayload);
          if (assistantText) saveMessage(sessionId, "assistant", assistantText).catch(() => {});
          return sendCompleteAndEnd(res, finalPayload);
        }
      } else if (isChoiceB) {
        logStepDone("Interception", "VCSM: Start New Search");
        const pendingQuery = memory.pendingSearchQuery;
        delete memory.waitingForResumeChoice;
        delete memory.resumableContextId;
        delete memory.pendingSearchQuery;
        updateMemory(sessionId, memory);

        await pauseShoppingContext(sessionId, contextId);

        if (pendingQuery) {
          const newCtx = await createShoppingContext(sessionId, pendingQuery);
          await setActiveShoppingContext(sessionId, newCtx.contextId);

          setSSEHeaders(res);
          const searchResult = await routeIntent("search_products", { query: pendingQuery }, sessionId, null, currentLang);
          
          let finalPayload = searchResult;
          if (Array.isArray(searchResult)) {
            const history = await getRecentHistory(sessionId);
            const formattedText = await formatRecommendations(pendingQuery, searchResult, history, voiceMode);
            finalPayload = { type: "product_grid", text: formattedText, products: searchResult };
          }
          
          const assistantText = extractText(finalPayload);
          if (assistantText) saveMessage(sessionId, "assistant", assistantText).catch(() => {});
          return sendCompleteAndEnd(res, finalPayload);
        }
        // Continue regular search routing
      } else {
        setSSEHeaders(res);
        const resumeDecision = {
          ...decision,
          module: "common",
          category: "resume_previous_search_options",
          response: { module: "common", category: "resume_previous_search_options" },
          llm_response: false
        };
        const resumeRes = selectResponse(resumeDecision, { search_query: memory.pendingSearchQuery || "your previous search" }, sessionId);
        const promptText = resumeRes?.text || "";
        saveMessage(sessionId, "assistant", promptText).catch(() => {});
        return sendCompleteAndEnd(res, { type: "text", text: promptText });
      }
    }

    // Priority 1: Pending Order Confirmation (Yes/Y/Confirm)
    const isYes = ["yes", "y", "hari", "ow", "yes machan", "confirm", "place the order", "place order", "confirm the order", "yes, place", "yes please", "ok", "okay"].some(
      word => lowerMsg === word || lowerMsg.startsWith(word + " ") || lowerMsg.endsWith(" " + word) || lowerMsg.includes("yes ") || lowerMsg.includes("confirm ") || lowerMsg.includes("place ")
    );
    if (pendingOrder && isYes && deliverySession) {
      logStepDone("Interception", "VCSM: Pending Order Confirmation");
      
      // Clear reminder memory so that future orders can trigger reminders again
      delete memory.hasRemindedPendingOrder;
      updateMemory(sessionId, memory);

      setSSEHeaders(res);
      const serviceResult = await handleFinalOrderConfirmation(deliverySession, message, currentLang);
      if (serviceResult) {
        if (serviceResult.status) {
          let textResponse = "";
          let prefix = "";
          if (serviceResult.prefixStatus) {
            const prefixDecision = {
              ...decision,
              module: serviceResult.prefixModule || "delivery",
              category: serviceResult.prefixStatus,
              response: { module: serviceResult.prefixModule || "delivery", category: serviceResult.prefixStatus },
              llm_response: false
            };
            const prefixRes = selectResponse(prefixDecision, serviceResult.prefixContext || {}, sessionId);
            prefix = prefixRes?.text ? prefixRes.text + "\n\n" : "";
          }

          const serviceDecision = {
            ...decision,
            module: serviceResult.module || "delivery",
            category: serviceResult.status,
            response: { module: serviceResult.module || "delivery", category: serviceResult.status },
            llm_response: false
          };
          const mainRes = selectResponse(serviceDecision, serviceResult.context || {}, sessionId);
          let mainText = mainRes?.text || "";

          let perishableWarning = "";
          if (serviceResult.perishableStatus) {
            const perishableDecision = {
              ...decision,
              module: serviceResult.perishableModule || "delivery",
              category: serviceResult.perishableStatus,
              response: { module: serviceResult.perishableModule || "delivery", category: serviceResult.perishableStatus },
              llm_response: false
            };
            const perishableRes = selectResponse(perishableDecision, serviceResult.perishableContext || {}, sessionId);
            perishableWarning = perishableRes?.text ? "\n\n" + perishableRes.text : "";
          }

          let nextPrompt = "";
          if (serviceResult.nextPromptStatus) {
            const nextDecision = {
              ...decision,
              module: serviceResult.nextPromptModule || "delivery",
              category: serviceResult.nextPromptStatus,
              response: { module: serviceResult.nextPromptModule || "delivery", category: serviceResult.nextPromptStatus },
              llm_response: false
            };
            const nextRes = selectResponse(nextDecision, serviceResult.nextPromptContext || {}, sessionId);
            nextPrompt = nextRes?.text ? "\n\n" + nextRes.text : "";
          }

          let detailsText = "";
          if (serviceResult.detailsText) {
            detailsText = "\n\n" + serviceResult.detailsText;
          }

          let confirmPrompt = "";
          if (serviceResult.confirmStatus) {
            const confirmDecision = {
              ...decision,
              module: serviceResult.confirmModule || "delivery",
              category: serviceResult.confirmStatus,
              response: { module: serviceResult.confirmModule || "delivery", category: serviceResult.confirmStatus },
              llm_response: false
            };
            const confirmRes = selectResponse(confirmDecision, serviceResult.confirmContext || {}, sessionId);
            confirmPrompt = confirmRes?.text ? "\n\n" + confirmRes.text : "";
          }

          let paymentPrompt = "";
          if (serviceResult.paymentStatus) {
            const paymentDecision = {
              ...decision,
              module: serviceResult.paymentModule || "delivery",
              category: serviceResult.paymentStatus,
              response: { module: serviceResult.paymentModule || "delivery", category: serviceResult.paymentStatus },
              llm_response: false
            };
            const paymentRes = selectResponse(paymentDecision, serviceResult.paymentContext || {}, sessionId);
            paymentPrompt = paymentRes?.text ? "\n\n" + paymentRes.text : "";
          }

          textResponse = prefix + mainText + perishableWarning + detailsText + confirmPrompt + nextPrompt + paymentPrompt;
          serviceResult.text = textResponse;
        }

        saveMessage(sessionId, "assistant", serviceResult.text || "").catch(() => {});
      }
      return sendCompleteAndEnd(res, serviceResult);
    }

    // Priority 2: Active Delivery Session & Delivery Protection
    if (deliverySession && activeCollectingStates.includes(deliveryState) && deliveryState !== "WAITING_FOR_FINAL_ORDER_CONFIRMATION") {
      if (parsedIntent.intent === "search_products" || parsedIntent.intent === "select_product" || parsedIntent.intent === "get_product_details") {
        logStepDone("Interception", "VCSM: Delivery Protection Triggered");
        const protectDecision = {
          ...decision,
          module: "interruption",
          category: "checkout_in_progress",
          response: { module: "interruption", category: "checkout_in_progress" },
          llm_response: false
        };
        const protectRes = selectResponse(protectDecision, {}, sessionId);
        const protectMsg = protectRes?.text || "";
        saveMessage(sessionId, "assistant", protectMsg).catch(() => {});
        return sendCompleteAndEnd(res, { type: "text", text: protectMsg });
      }
    }

    if (deliverySession && activeCollectingStates.includes(deliveryState) && (parsedIntent.intent === "delivery_flow_input" || parsedIntent.intent === "general_chat" || deliveryState !== "WAITING_FOR_FINAL_ORDER_CONFIRMATION")) {
      logStepDone("Interception", `VCSM Active Delivery Session state: ${deliveryState}`);

      // Small Talk / General Chat in Active Delivery
      if (parsedIntent.intent === "general_chat") {
        logStepDone("Interception", "VCSM: Small Talk during Active Delivery");
        const history = await getRecentHistory(sessionId);
        const memoryState = {
          ...getShoppingContext(sessionId),
          ...(memory || {})
        };
        const runtimeContext = {
          decision,
          conversationState: userState,
          customer: {
            name: decision.variables?.customer_name || userState?.customerName,
            preferredLanguage: decision.language?.code || userState?.language,
            city: decision.variables?.city || userState?.city,
            shoppingStyle: memory?.shoppingStyle || "standard"
          },
          memory: memoryState,
          commerce: {
            searchQuery: decision.variables?.product_name || memory?.searchQuery,
            category: decision.variables?.category || memory?.category,
            deliveryRequired: userState?.activeFlow === "delivery",
            checkoutStarted: userState?.activeFlow === "checkout",
            paymentCompleted: deliverySession?.state === "COMPLETED"
          },
          products: [],
          cart: {
            items: memory?.cart || [],
            total: memory?.cart?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0,
            deliveryAddress: deliverySession?.delivery_address
          },
          order: {
            orderNumber: pendingOrder || deliverySession?.orderNumber || deliverySession?.id
          },
          tracking: {
            status: deliverySession?.state
          },
          response: {
            type: decision.response?.type || "conversation",
            templateId: decision.response?.templateId,
            templateName: decision.response?.templateName,
            mode: decision.response?.mode || "dynamic",
            searchProducts: decision.response?.searchProducts,
            recommendProducts: decision.response?.recommendProducts,
            askClarification: decision.response?.askClarification,
            useMemory: decision.response?.useMemory !== false,
            template: decision.response?.templateId
          },
          settings: {
            streaming: !voiceMode,
            voiceMode: voiceMode,
            model: null,
            environment: process.env.NODE_ENV || "development"
          },
          latestMessage: message,
          resolvedReference: resolvedReference || null
        };
        const chatResult = await chatWithLLM({ message, history, memory: memoryState, memoryContext: "", runtimeContext });
        
        let promptText = "";
        let promptResponse = null;
        if (deliveryState === "WAITING_FOR_ADDRESS") {
          promptResponse = selectResponse({ module: "delivery", category: "ask_delivery_address", language: { detected: currentLang } }, {}, sessionId);
        } else if (deliveryState === "WAITING_FOR_DATE") {
          promptResponse = selectResponse({ module: "delivery", category: "ask_delivery_date", language: { detected: currentLang } }, {}, sessionId);
        } else if (deliveryState === "WAITING_FOR_CONTACT_NAME") {
          promptResponse = selectResponse({ module: "order", category: "ask_contact_name", language: { detected: currentLang } }, {}, sessionId);
        } else if (deliveryState === "WAITING_FOR_CONTACT_PHONE") {
          promptResponse = selectResponse({ module: "delivery", category: "ask_contact_phone", language: { detected: currentLang } }, {}, sessionId);
        } else {
          promptResponse = selectResponse({ module: "delivery", category: "continue_delivery_flow", language: { detected: currentLang } }, {}, sessionId);
        }
        promptText = "\n\n" + (promptResponse?.text || "");

        const combinedText = (typeof chatResult === "string" ? chatResult : chatResult.text || "") + promptText;
        saveMessage(sessionId, "assistant", combinedText).catch(() => {});
        setSSEHeaders(res);
        return sendCompleteAndEnd(res, { type: "text", text: combinedText });
      }

      // Route to Delivery Flow State Machine
      setSSEHeaders(res);
      let serviceResult = null;
      if (deliveryState === "WAITING_FOR_ADDRESS") {
        serviceResult = await handleAddressInput(deliverySession, message, currentLang);
      } else if (deliveryState === "WAITING_FOR_ADDRESS_CONFIRMATION") {
        serviceResult = await handleAddressConfirmation(deliverySession, message, currentLang);
      } else if (deliveryState === "WAITING_FOR_DATE") {
        serviceResult = await handleDateInput(deliverySession, message, currentLang);
      } else if (deliveryState === "WAITING_FOR_RECOVERY_CHOICE") {
        serviceResult = await handleRecoveryChoice(deliverySession, message, currentLang);
      } else if (deliveryState === "WAITING_FOR_ALTERNATIVE_PRODUCT_SELECTION") {
        serviceResult = await handleCancelOptions(deliverySession, message, currentLang);
      } else if (deliveryState === "WAITING_FOR_CONFIRMATION" || deliveryState === "WAITING_FOR_FINAL_ORDER_CONFIRMATION") {
        serviceResult = await handleCheckoutConfirmation(deliverySession, message, currentLang);
      } else if (deliveryState === "WAITING_FOR_CONTACT_NAME") {
        serviceResult = await handleContactNameInput(deliverySession, message, currentLang);
      } else if (deliveryState === "WAITING_FOR_CONTACT_PHONE") {
        serviceResult = await handleContactPhoneInput(deliverySession, message, currentLang);
      } else if (deliveryState === "WAITING_FOR_CANCEL_CHOICE") {
        serviceResult = await handleCancelChoice(deliverySession, message, currentLang);
      }

      if (serviceResult === null) {
        // Use Response Engine with temporary_error category from recovery module
        const errorDecision = {
          ...decision,
          response: { module: "recovery", category: "temporary_error" },
          llm_response: false
        };
        const errorResponse = selectResponseWithFallback(errorDecision, decision.variables, sessionId);
        const errorMsg = errorResponse?.text;
        saveMessage(sessionId, "assistant", errorMsg).catch(() => {});
        return sendCompleteAndEnd(res, { type: "text", text: errorMsg });
      }
       if (serviceResult) {
        logStepDone("Interception", "VCSM: State machine processed. Returning direct response.");
        
        let textResponse = "";
        if (serviceResult.status) {
          let prefix = "";
          if (serviceResult.prefixStatus) {
            const prefixDecision = {
              ...decision,
              module: serviceResult.prefixModule || "delivery",
              category: serviceResult.prefixStatus,
              response: { module: serviceResult.prefixModule || "delivery", category: serviceResult.prefixStatus },
              llm_response: false
            };
            const prefixRes = selectResponse(prefixDecision, serviceResult.prefixContext || {}, sessionId);
            prefix = prefixRes?.text ? prefixRes.text + "\n\n" : "";
          }

          const serviceDecision = {
            ...decision,
            module: serviceResult.module || "delivery",
            category: serviceResult.status,
            response: { module: serviceResult.module || "delivery", category: serviceResult.status },
            llm_response: false
          };
          const mainRes = selectResponse(serviceDecision, serviceResult.context || {}, sessionId);
          let mainText = mainRes?.text || "";

          let perishableWarning = "";
          if (serviceResult.perishableStatus) {
            const perishableDecision = {
              ...decision,
              module: serviceResult.perishableModule || "delivery",
              category: serviceResult.perishableStatus,
              response: { module: serviceResult.perishableModule || "delivery", category: serviceResult.perishableStatus },
              llm_response: false
            };
            const perishableRes = selectResponse(perishableDecision, serviceResult.perishableContext || {}, sessionId);
            perishableWarning = perishableRes?.text ? "\n\n" + perishableRes.text : "";
          }

          let nextPrompt = "";
          if (serviceResult.nextPromptStatus) {
            const nextDecision = {
              ...decision,
              module: serviceResult.nextPromptModule || "delivery",
              category: serviceResult.nextPromptStatus,
              response: { module: serviceResult.nextPromptModule || "delivery", category: serviceResult.nextPromptStatus },
              llm_response: false
            };
            const nextRes = selectResponse(nextDecision, serviceResult.nextPromptContext || {}, sessionId);
            nextPrompt = nextRes?.text ? "\n\n" + nextRes.text : "";
          }

          let detailsText = "";
          if (serviceResult.detailsText) {
            detailsText = "\n\n" + serviceResult.detailsText;
          }

          let confirmPrompt = "";
          if (serviceResult.confirmStatus) {
            const confirmDecision = {
              ...decision,
              module: serviceResult.confirmModule || "delivery",
              category: serviceResult.confirmStatus,
              response: { module: serviceResult.confirmModule || "delivery", category: serviceResult.confirmStatus },
              llm_response: false
            };
            const confirmRes = selectResponse(confirmDecision, serviceResult.confirmContext || {}, sessionId);
            confirmPrompt = confirmRes?.text ? "\n\n" + confirmRes.text : "";
          }

          let paymentPrompt = "";
          if (serviceResult.paymentStatus) {
            const paymentDecision = {
              ...decision,
              module: serviceResult.paymentModule || "delivery",
              category: serviceResult.paymentStatus,
              response: { module: serviceResult.paymentModule || "delivery", category: serviceResult.paymentStatus },
              llm_response: false
            };
            const paymentRes = selectResponse(paymentDecision, serviceResult.paymentContext || {}, sessionId);
            paymentPrompt = paymentRes?.text ? "\n\n" + paymentRes.text : "";
          }

          textResponse = prefix + mainText + perishableWarning + detailsText + confirmPrompt + nextPrompt + paymentPrompt;
          serviceResult.text = textResponse;
        }

        if (serviceResult.text) saveMessage(sessionId, "assistant", serviceResult.text).catch(() => {});
        return sendCompleteAndEnd(res, serviceResult);
      }
    }

    // Priority 3: Shopping Context Resume Detection
    if (parsedIntent.intent === "search_products") {
      const searchQuery = parsedIntent.parameters.query || parsedIntent.parameters.q;
      if (searchQuery) {
        const matchingCtx = await findMatchingContext(sessionId, searchQuery);
        if (matchingCtx && matchingCtx.contextId !== userState.active_shopping_context) {
          logStepDone("Interception", `VCSM: Found matching context ${matchingCtx.contextId}`);
          memory.waitingForResumeChoice = true;
          memory.resumableContextId = matchingCtx.contextId;
          memory.pendingSearchQuery = searchQuery;
          updateMemory(sessionId, memory);

          const resumeDecision = {
            ...decision,
            module: "common",
            category: "resume_previous_search_options",
            response: { module: "common", category: "resume_previous_search_options" },
            llm_response: false
          };
          const resumeRes = selectResponse(resumeDecision, { search_query: matchingCtx.searchQuery }, sessionId);
          const resumePrompt = resumeRes?.text || "";
          saveMessage(sessionId, "assistant", resumePrompt).catch(() => {});
          return sendCompleteAndEnd(res, { type: "text", text: resumePrompt });
        }
      }
    }

    // Priority 7: Pending Order Reminder Check
    let shouldAddReminder = false;
    let reminderText = "";
    if (pendingOrder && (parsedIntent.intent === "search_products" || parsedIntent.intent === "select_product" || parsedIntent.intent === "get_product_details")) {
      if (!memory.hasRemindedPendingOrder) {
        memory.hasRemindedPendingOrder = true;
        updateMemory(sessionId, memory);
        
        const pendingSession = await getDeliverySession(pendingOrder).catch(() => null);
        const pendingProduct = pendingSession?.selected_product?.product_name || "item";
        const reminderDecision = {
          ...decision,
          module: "order",
          category: "pending_order_reminder",
          response: { module: "order", category: "pending_order_reminder" },
          llm_response: false
        };
        const reminderRes = selectResponse(reminderDecision, { product_name: pendingProduct }, sessionId);
        reminderText = (reminderRes?.text || "") + "\n\n";
        shouldAddReminder = true;
      }
    }

    // ── Step 5b: Context Extraction (Consolidated into CUL) ───────────────────
    logStepStart("Context extraction");
    setSSEHeaders(res);
    logStepDone("Context extraction", "done");
    logContextExtracted(extractedContext);

    const ctxDetails = [];
    if (extractedContext.conversationLanguage) ctxDetails.push(`Language: ${extractedContext.conversationLanguage}`);
    if (extractedContext.recipient) ctxDetails.push(`Recipient: ${extractedContext.recipient}`);
    if (extractedContext.occasion) ctxDetails.push(`Occasion: ${extractedContext.occasion}`);
    if (extractedContext.budget) ctxDetails.push(`Budget: Rs.${extractedContext.budget}`);
    if (extractedContext.productType) ctxDetails.push(`Product: ${extractedContext.productType}`);
    if (extractedContext.deliveryLocation) ctxDetails.push(`Location: ${extractedContext.deliveryLocation}`);
    if (extractedContext.urgency) ctxDetails.push(`Urgency: ${extractedContext.urgency}`);

    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({
        type: "progress",
        step: "EXTRACTING",
        message: "Context extracted",
        logs: [
          { id: "UNDERSTANDING", title: "Understanding request", status: "completed", details: [`Intent: ${parsedIntent.intent}`] },
          { id: "EXTRACTING", title: "Extracting context", status: "completed", details: ctxDetails }
        ]
      })}\n\n`);
    }

    const isFastPath = shouldBypassQwen(parsedIntent.intent, message, voiceMode);
    let intentType = parsedIntent.intent;
    if (intentType === "general_chat") intentType = getMessageIntent(message, intentType);
    else if (intentType === "search_products" || intentType === "get_product_details") intentType = "product_search";

    // ── Step 6: Memory load ───────────────────────────────────────────────────
    logStepStart("Memory retrieval");
    let memoryContext = "";
    const memoryStart = Date.now();
    if (shouldUseMemory(intentType)) {
      memoryContext = await buildPersonalizedContext(sessionId, intentType);
    }
    const memoryMs = Date.now() - memoryStart;
    logStepDone("Memory retrieval", `${memoryContext ? "profile loaded" : "no profile"}  (${memoryMs}ms)`);

    // ── Step 7: Cache check ───────────────────────────────────────────────────
    let cacheKey = null;
    if (parsedIntent.intent === "search_products" && parsedIntent.parameters?.query) {
      cacheKey = `velora:search:${sessionId}:${parsedIntent.parameters.query}`.toLowerCase().replace(/\s+/g, "_");
      const cached = await cacheService.get(cacheKey).catch(() => null);
      if (cached) {
        logCacheHit(cacheKey);
      }
    }

    // ── Step 8: Build SSE progress logs ──────────────────────────────────────
    const intentDetails = [];
    if (parsedIntent.intent === "search_products" && parsedIntent.parameters?.filters) {
      const f = parsedIntent.parameters.filters;
      if (f.category) intentDetails.push(`Category: ${f.category}`);
      if (f.priceMin && f.priceMax) intentDetails.push(`Budget: Rs.${f.priceMin}–${f.priceMax}`);
    }
    logs = buildInitialLogs(parsedIntent.intent, intentDetails);
    const updateProgress = createProgressUpdater(res, logs);
    const nextStepId = parsedIntent.intent === "search_products" ? "SEARCHING" : "READY";
    updateProgress(nextStepId, "active");

    // ── Step 9: Execute intent ────────────────────────────────────────────────
    let result;
    if (parsedIntent.intent === "general_chat") {
      logStepStart("LLM generation", "Gemini 2.5 Flash");
      const history = await getRecentHistory(sessionId);
      await addMessage(sessionId, "user", message);
      const memoryState = {
        ...getShoppingContext(sessionId),
        ...(extractedContext || {})
      };

      const runtimeContext = constructRuntimeData({
        decision,
        userState,
        memory,
        memoryState,
        deliverySession,
        pendingOrder,
        voiceMode,
        message,
        resolvedReference
      });

      const llmStart = Date.now();
      result = await chatWithLLM({ message, history, memory: memoryState, memoryContext, runtimeContext });
      const llmMs = Date.now() - llmStart;

      if (typeof result === "string") {
        await addMessage(sessionId, "assistant", result);
        logStepDone("LLM generation", `${llmMs}ms`);
        providerUsed = "gemini";
      } else if (result?.error) {
        logStepError("LLM generation", result.message);
        return sendErrorAndEnd(res, logs, result.message || "Failed to process AI request");
      }

    } else {
      // Phase 8: MCP Validation
      if (parsedIntent.intent === "search_products") {
        const query = parsedIntent.parameters?.query || parsedIntent.parameters?.q;
        const currentWorkflow = workflowDecision.workflow;

        // Prevent empty query or invalid workflow/shopping context
        if (!query || query.trim() === "" || currentWorkflow !== "product_search") {
          logStepDone("MCP Validation", "Blocked invalid or empty product search query");
          const confusedDecision = {
            ...decision,
            module: "common",
            category: "confused",
            response: { module: "common", category: "confused" },
            llm_response: false
          };
          const confusedRes = selectResponse(confusedDecision, {}, sessionId);
          const clarifyText = confusedRes?.text || "What products are you looking for? 😊";
          saveMessage(sessionId, "assistant", clarifyText).catch(() => {});
          return sendCompleteAndEnd(res, { type: "text", text: clarifyText });
        }
      }

      logStepStart("Routing intent", parsedIntent.intent);
      try {
        result = await routeIntent(parsedIntent.intent, parsedIntent.parameters, sessionId, updateProgress);
        logStepDone("Intent handler", `${parsedIntent.intent}`);
        providerUsed = "gemini";
      } catch (err) {
        logStepError("Intent handler", err.message);
        return sendErrorAndEnd(res, logs, err.message || "Catalog service unavailable");
      }
    }

    if (result?.error) {
      return sendErrorAndEnd(res, logs, result.message || "Operation failed");
    }

    // ── Step 10: Format response ──────────────────────────────────────────────
    let finalPayload;
    if (Array.isArray(result)) {
      await addMessage(sessionId, "user", message);
      const history = await getRecentHistory(sessionId);
      let text;
      if (isFastPath) {
        if (currentLang === "si") {
          text = "ඔබගේ ඉල්ලීමට ගැලපෙන හොඳම නිෂ්පාදන කිහිපයක් මා සොයාගත්තා! පහතින් බලන්න 😊";
        } else if (currentLang === "ta") {
          text = "உங்கள் கோரிக்கைக்குப் பொருத்தமான சில சிறந்த தயாரிப்புகளை நான் கண்டறிந்துள்ளேன்! கீழே பாருங்கள் 😊";
        } else {
          text = "I found some great options matching your request! Take a look below 😊";
        }
      } else {
        logStepStart("Formatting results");
        text = await formatRecommendations(message, result, history, voiceMode);
        logStepDone("Formatting done", `${result.length} products`);
      }
      if (shouldAddReminder) {
        text = reminderText + text;
      }
      await addMessage(sessionId, "assistant", text);
      finalPayload = { type: "product_grid", text, products: result };
    } else if (result?.type) {
      if (result.type === "product_grid") {
        await addMessage(sessionId, "user", message);
        let text = result.text || "";
        if (!isFastPath) {
          logStepStart("Formatting suggested results");
          const history = await getRecentHistory(sessionId);
          text = await formatRecommendations(message, result.products || [], history, voiceMode);
          logStepDone("Formatting suggested done");
        }
        result.text = text;
        if (shouldAddReminder) {
          result.text = reminderText + result.text;
        }
        await addMessage(sessionId, "assistant", result.text || "");
      }
      if (shouldAddReminder && result.text) {
        result.text = reminderText + result.text;
      }
      finalPayload = result;
    } else if (typeof result === "string") {
      let text = result;
      if (shouldAddReminder) {
        text = reminderText + text;
      }
      finalPayload = { type: "text", text };
    } else {
      finalPayload = result;
    }

    updateProgress("READY", "completed");

    // ── Step 11: Persist assistant response (background) ──────────────────────
    const assistantText = extractText(finalPayload);
    if (assistantText) {
      saveMessage(sessionId, "assistant", assistantText)
        .then((u) => {
          if (u) {
            logBackground("Memory check", `${u.messages.length} messages in session`);
            checkAndTriggerSummarization(sessionId, u.messages.length).catch(() => { });
          }
        })
        .catch(() => { });
    }

    // Populate request telemetry
    const ctx = getContext();
    if (ctx && ctx.telemetry) {
      ctx.telemetry.detectedLanguage = (typeof decision !== "undefined" && decision?.language?.detected) || (typeof logLang !== "undefined" ? (logLang === "si" ? "Sinhala" : logLang === "ta" ? "Tamil" : "English") : "English");
      ctx.telemetry.intent = (typeof decision !== "undefined" && decision?.intent?.value) || intentLabel || "general_chat";
      ctx.telemetry.conversationStage = (typeof decision !== "undefined" && decision?.conversation_stage) || "browsing";
      ctx.telemetry.activeFlow = (typeof decision !== "undefined" && decision?.active_flow) || "general_chat";
      ctx.telemetry.decisionBuilder = "READY";
      ctx.telemetry.responseEngine = providerUsed === "response_library" ? "Response Library" : "LLM Generator";
      ctx.telemetry.responseLibraryModule = providerUsed === "response_library" ? `${decision?.response?.module || decision?.module}/${decision?.response?.category || decision?.category}` : "N/A";
      ctx.telemetry.streamingStatus = providerUsed === "response_library" ? "DISABLED" : "ENABLED";
      ctx.telemetry.commerceResults = finalPayload ? (finalPayload.type === "product_grid" ? `${finalPayload.products?.length || 0} products` : "Text") : "N/A";
      ctx.telemetry.geminiResponseTime = providerUsed === "gemini" ? `${Date.now() - requestStart}ms` : "0ms";
    }

    // Phase 10: Structured transition logging
    logWorkflowTrace({
      sessionId,
      message,
      currentWorkflow: userState?.workflowContext?.previousWorkflow || "idle",
      workflowStep: userState?.activeFlow?.currentStep || "browsing",
      intent: decision?.intent?.value || intentLabel || "general_chat",
      workflowDecision: workflowDecision?.action || "unknown",
      contextUpdates: JSON.stringify({ activeFlow: userState?.activeFlow }),
      workflowTransition: `${userState?.workflowContext?.previousWorkflow} -> ${workflowDecision?.workflow}`,
      response: assistantText || JSON.stringify(finalPayload)
    });

    logRequestFooter(intentLabel, Date.now() - requestStart, providerUsed);
    return sendCompleteAndEnd(res, finalPayload);

  } catch (error) {
    logError("CHAT", `Unhandled error — ${error.message}`);
    return sendErrorAndEnd(res, logs, error.message || "Internal Server Error");
  }
};

export const saveLocalMessage = async (req, res) => {
  try {
    const { role, content } = req.body;
    const sessionId = req.headers["x-session-id"] || req.body.sessionId || "default";

    if (!role || !content) {
      return res.status(400).json({ success: false, message: "Role and content are required." });
    }

    // 1. Save to MongoDB
    await saveMessage(sessionId, role, content);

    // 2. Save to cache
    await addMessage(sessionId, role, content);

    return res.json({ success: true });
  } catch (error) {
    console.error("Failed to save local message:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
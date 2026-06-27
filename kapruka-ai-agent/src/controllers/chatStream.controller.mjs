import { understandConversation, selectResponse, buildDecision } from "../services/responseService.mjs";
import manageWorkflow from "../agent/workflow/05_workflowManager.mjs";
import { constructRuntimeData } from "../agent/builders/runtimeBuilder.mjs";
import { handleReference } from "../agent/reference/05_referenceManager.mjs";
import {
  chatWithLLMStream,
  formatRecommendationsStream
} from "../services/ai/llmStream.service.mjs";
import { routeIntent } from "../agent/intentRouter.mjs";
import { getRecentHistory, addMessage, clearConversation } from "../services/memory/chatMemory.service.mjs";
import { getShoppingContext, updateMemory, getMemory } from "../agent/memoryManager.mjs";
import { saveMessage } from "../services/memory/conversation.service.mjs";
import { checkAndTriggerSummarization } from "../services/memory/memory.service.mjs";
import { buildPersonalizedContext, shouldUseMemory, getMessageIntent } from "../memory/contextEngine.mjs";
import { mergeToProfile, getDeliverySession, updateDeliverySession } from "../memory/memoryStore.mjs";
import { shouldBypassQwen } from "../agent/fastPathRouter.mjs";
import { getContext } from "../services/core/logger.service.mjs";
import { cacheService } from "../cache/cacheService.mjs";
import {
  loadConversationState,
  saveConversationState,
  setActiveShoppingContext,
  clearConversationState,
  pauseCurrentFlow,
  resumeFlow,
  transitionTo,
} from "../services/commerce/conversationStateService.mjs";
import {
  createShoppingContext,
  pauseShoppingContext,
  resumeShoppingContext,
  findMatchingContext,
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
} from "../utils/velora.console.mjs";

export const chatStream = async (req, res) => {
  const requestStart = Date.now();
  const context = getContext();

  let logs = [];
  let intentLabel = "—";
  let providerUsed = "";

  try {
    const { message, commerceState, voiceMode, intent: bodyIntent, parameters: bodyParams } = req.body;
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
    // Construct final decision based on intent and VCSM state
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
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ type: "chunk", text: refResult.response })}\n\n`);
        }
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

    // ══════════════════════════════════════════════════════════════════════════
    // PRE-WORKFLOW INTERCEPTIONS
    // These must run BEFORE the workflow manager to avoid transition errors
    // when the user is confirming/cancelling/blocked by an active order.
    // ══════════════════════════════════════════════════════════════════════════

    // Reuse the existing normalized message from earlier in the handler.

    // ── Early Cancellation Check ──────────────────────────────────────────────
    const cancellationPhrases = ["cancel order", "don't place it", "never mind", "don't place", "cancel my order", "stop order", "cancel"];
    const isEarlyCancellation = cancellationPhrases.some(phrase => lowerMsg.includes(phrase));
    if (isEarlyCancellation && (pendingOrder || deliverySession)) {
      logStepDone("Interception", "PRE-WF: Order Cancellation");
      await saveConversationState(sessionId, { active_delivery_session: null, pending_order: null });
      if (deliverySession) {
        await updateDeliverySession(deliverySession.sessionId, { state: "CANCELLED" }, deliverySession.session_version);
      }
      saveMessage(sessionId, "user", message).catch(() => {});
      addMessage(sessionId, "user", message).catch(() => {});
      setSSEHeaders(res);
      const cancelText = "😊 No worries. I've cancelled your pending order. What would you like to do next?";
      saveMessage(sessionId, "assistant", cancelText).catch(() => {});
      return sendCompleteAndEnd(res, { type: "text", text: cancelText });
    }

    // ── Early Payment Pending / Creating Order Block ──────────────────────────
    if (deliverySession && (deliveryState === "CREATING_ORDER" || deliveryState === "PAYMENT_PENDING")) {
      logStepDone("Interception", `PRE-WF: Order Processing Block. State: ${deliveryState}`);
      saveMessage(sessionId, "user", message).catch(() => {});
      addMessage(sessionId, "user", message).catch(() => {});
      setSSEHeaders(res);
      let msgText = "😊 We are currently processing your order. Please finish that first.";
      if (deliveryState === "PAYMENT_PENDING") {
        msgText = `😊 Your order is currently processing (payment pending). Please complete the payment using the checkout link first. If you would like to cancel this order to do something else, just tell me "cancel".`;
      } else if (deliveryState === "CREATING_ORDER") {
        msgText = "😊 We are currently creating your order. Please wait a moment.";
      }
      saveMessage(sessionId, "assistant", msgText).catch(() => {});
      return sendCompleteAndEnd(res, { type: "text", text: msgText });
    }

    // ── Early Pending Order Confirmation ("Yes" / "Confirm") ──────────────────
    const isYesEarly = ["yes", "y", "hari", "ow", "yes machan", "confirm", "place the order", "place order", "confirm the order", "yes, place", "yes please", "ok", "okay"].some(
      word => lowerMsg === word || lowerMsg.startsWith(word + " ") || lowerMsg.endsWith(" " + word) || lowerMsg.includes("yes ") || lowerMsg.includes("confirm ") || lowerMsg.includes("place ")
    );
    if (pendingOrder && isYesEarly && deliverySession && (deliveryState === "WAITING_FOR_FINAL_ORDER_CONFIRMATION" || deliveryState === "WAITING_FOR_CONFIRMATION")) {
      logStepDone("Interception", "PRE-WF: Pending Order Confirmation");
      const memory = getMemory(sessionId);
      delete memory.hasRemindedPendingOrder;
      updateMemory(sessionId, memory);
      saveMessage(sessionId, "user", message).catch(() => {});
      addMessage(sessionId, "user", message).catch(() => {});
      setSSEHeaders(res);
      const serviceResult = await handleFinalOrderConfirmation(deliverySession, message, decision.language.code);
      if (serviceResult) {
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ type: "chunk", text: serviceResult.text })}\\n\\n`);
        }
        saveMessage(sessionId, "assistant", serviceResult.text || "").catch(() => {});
      }
      return sendCompleteAndEnd(res, serviceResult);
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

    if (!workflowDecision.success || workflowDecision.action === "clarify") {
      logStepDone("Workflow Manager", `Validation failed: ${workflowDecision.reason}`);
      const responsePayload = selectResponse(decision, decision.variables, sessionId, workflowDecision);
      let finalPayload = responsePayload;
      if (!finalPayload) {
        finalPayload = { type: "text", text: workflowDecision.reason || "I'm sorry, I'm a bit confused. Can you please clarify what you would like to do?" };
      }
      setSSEHeaders(res);
      if (finalPayload.text) {
        saveMessage(sessionId, "assistant", finalPayload.text).catch(() => {});
        // Stream the response for client consistency
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ type: "chunk", text: finalPayload.text })}\n\n`);
        }
      }
      return sendCompleteAndEnd(res, finalPayload);
    }

    logStepDone("Workflow Manager", `Transition allowed to: ${workflowDecision.workflow}`);

    // If reset is triggered, clear conversation state
    if (workflowDecision.action === "reset" || workflowDecision.resetWorkflow) {
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

      let promptText = "Welcome back to your order! 😊 Let's continue.";
      if (deliveryState === "WAITING_FOR_ADDRESS") {
        promptText = "Welcome back! 😊 To check delivery availability, could you please provide your full delivery address? (including house/building number, road, area, and city) 😊";
      } else if (deliveryState === "WAITING_FOR_DATE") {
        promptText = "Welcome back! 😊 When would you like this delivered? (tomorrow, next day, or a specific date) 😊";
      } else if (deliveryState === "WAITING_FOR_CONTACT_NAME") {
        promptText = "Welcome back! 😊 Now I just need the **contact name** for the order. 😊 Please send the name of the person we should contact for delivery.";
      } else if (deliveryState === "WAITING_FOR_CONTACT_PHONE") {
        promptText = "Welcome back! 😊 Now send me the **contact phone number** for the delivery. Example: **0771234567**";
      } else if (deliveryState === "WAITING_FOR_CONFIRMATION") {
        promptText = "Welcome back! 😊 Please confirm your order details to place it.";
      }

      setSSEHeaders(res);
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ type: "chunk", text: promptText })}\n\n`);
      }
      saveMessage(sessionId, "assistant", promptText).catch(() => {});
      return sendCompleteAndEnd(res, { type: "text", text: promptText });
    }

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

    // If active delivery flow is ongoing, check if the input is a valid flow response.
    // If so, override general_chat to prevent it being intercepted as small talk.
    if (deliverySession && activeCollectingStates.includes(deliveryState) && parsedIntent.intent === "general_chat") {
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
        parsedIntent.intent = "delivery_flow_input";
      }
    }

    // Priority 13: Order Cancellation ("cancel", "don't place it", "never mind", "cancel order", "stop order")
    const isCancellation = cancellationPhrases.some(phrase => lowerMsg.includes(phrase)) || (deliveryState === "WAITING_FOR_FINAL_ORDER_CONFIRMATION" && lowerMsg === "no");
    if (isCancellation && (pendingOrder || deliverySession)) {
      logStepDone("Interception", "VCSM: Order Cancellation");
      await saveConversationState(sessionId, { active_delivery_session: null, pending_order: null });
      if (deliverySession) {
        await updateDeliverySession(deliverySession.sessionId, { state: "CANCELLED" }, deliverySession.session_version);
      }
      setSSEHeaders(res);
      const cancelText = "😊 No worries. I've cancelled your pending order. What would you like to do next?";
      saveMessage(sessionId, "assistant", cancelText).catch(() => {});
      return sendCompleteAndEnd(res, { type: "text", text: cancelText });
    }

    // Block operations if order is currently being created or payment is pending
    if (deliverySession && (deliveryState === "CREATING_ORDER" || deliveryState === "PAYMENT_PENDING")) {
      logStepDone("Interception", `VCSM Order Processing Block. State: ${deliveryState}`);
      setSSEHeaders(res);
      let msgText = "😊 We are currently processing your order. Please finish that first.";
      if (deliveryState === "PAYMENT_PENDING") {
        msgText = `😊 Your order is currently processing (payment pending). Please complete the payment using the checkout link first. If you would like to cancel this order to do something else, just tell me "cancel".`;
      } else if (deliveryState === "CREATING_ORDER") {
        msgText = "😊 We are currently creating your order. Please wait a moment.";
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
          let searchResult;
          if (!restored.searchQuery || restored.searchQuery.trim().length === 0) {
            logStepDone("Interception", "VCSM: Restored context lacks query. Prompting user.");
            const fallbackMsg = "😊 I couldn't find the exact details of that search. What would you like to search for instead?";
            saveMessage(sessionId, "assistant", fallbackMsg).catch(() => {});
            return sendCompleteAndEnd(res, { type: "text", text: fallbackMsg });
          } else {
            searchResult = await routeIntent("search_products", { query: restored.searchQuery, filters: restored.filters }, sessionId, null, currentLang);
          }
          
          let finalPayload = searchResult;
          if (Array.isArray(searchResult)) {
            const history = await getRecentHistory(sessionId);
            // Stream the introduction recommendations format
            const formattedText = await formatRecommendationsStream(
              message,
              searchResult,
              history,
              voiceMode,
              (chunk) => {
                if (!res.writableEnded) {
                  res.write(`data: ${JSON.stringify({ type: "chunk", text: chunk })}\n\n`);
                }
              }
            );
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
            // Stream the introduction recommendations format
            const formattedText = await formatRecommendationsStream(
              pendingQuery,
              searchResult,
              history,
              voiceMode,
              (chunk) => {
                if (!res.writableEnded) {
                  res.write(`data: ${JSON.stringify({ type: "chunk", text: chunk })}\n\n`);
                }
              }
            );
            finalPayload = { type: "product_grid", text: formattedText, products: searchResult };
          }
          
          const assistantText = extractText(finalPayload);
          if (assistantText) saveMessage(sessionId, "assistant", assistantText).catch(() => {});
          return sendCompleteAndEnd(res, finalPayload);
        }
      } else {
        setSSEHeaders(res);
        const promptText = "Please reply with **A** to continue the previous search or **B** to start a new search.";
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
      
      delete memory.hasRemindedPendingOrder;
      updateMemory(sessionId, memory);

      setSSEHeaders(res);
      const serviceResult = await handleFinalOrderConfirmation(deliverySession, message, currentLang);
      if (serviceResult) {
        saveMessage(sessionId, "assistant", serviceResult.text || "").catch(() => {});
      }
      return sendCompleteAndEnd(res, serviceResult);
    }

    // Priority 2: Active Delivery Session & Delivery Protection
    if (deliverySession && activeCollectingStates.includes(deliveryState) && deliveryState !== "WAITING_FOR_FINAL_ORDER_CONFIRMATION") {
      if (parsedIntent.intent === "search_products" || parsedIntent.intent === "select_product" || parsedIntent.intent === "get_product_details") {
        logStepDone("Interception", "VCSM: Delivery Protection Triggered");
        setSSEHeaders(res);
        const protectMsg = "😊 We're almost done with your current order. Let's finish this first. If you'd like to cancel it, just let me know and I'll help you search for something else.";
        saveMessage(sessionId, "assistant", protectMsg).catch(() => {});
        return sendCompleteAndEnd(res, { type: "text", text: protectMsg });
      }
    }

    if (deliverySession && activeCollectingStates.includes(deliveryState) && (parsedIntent.intent === "delivery_flow_input" || parsedIntent.intent === "general_chat" || deliveryState !== "WAITING_FOR_FINAL_ORDER_CONFIRMATION")) {
      logStepDone("Interception", `VCSM Active Delivery Session state: ${deliveryState}`);

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
          latestMessage: message
        };

        setSSEHeaders(res);
        // Stream small talk response
        const chatResult = await chatWithLLMStream({
          message,
          history,
          memory: memoryState,
          memoryContext: "",
          runtimeContext,
          onChunk: (chunk) => {
            if (!res.writableEnded) {
              res.write(`data: ${JSON.stringify({ type: "chunk", text: chunk })}\n\n`);
            }
          }
        });
        
        let promptText = "";
        if (deliveryState === "WAITING_FOR_ADDRESS") {
          promptText = "\n\nTo check delivery availability, could you please provide your full delivery address? (including house/building number, road, area, and city) 😊";
        } else if (deliveryState === "WAITING_FOR_DATE") {
          promptText = "\n\nGot it 👍 When would you like this delivered? (tomorrow, next day, or a specific date) 😊";
        } else if (deliveryState === "WAITING_FOR_CONTACT_NAME") {
          promptText = "\n\nNow I just need the **contact name** for the order. 😊 Please send the name of the person we should contact for delivery.";
        } else if (deliveryState === "WAITING_FOR_CONTACT_PHONE") {
          promptText = "\n\nPerfect! 😊 Now send me the **contact phone number** for the delivery. Example: **0771234567**";
        } else {
          promptText = "\n\nPlease continue with your delivery flow.";
        }

        // Send the prompt text suffix as a chunk so user sees it appended
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ type: "chunk", text: promptText })}\n\n`);
        }

        const combinedText = chatResult + promptText;
        saveMessage(sessionId, "assistant", combinedText).catch(() => {});
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
        const staleMsg = "Sorry, there was a brief conflict. Please try again.";
        saveMessage(sessionId, "assistant", staleMsg).catch(() => {});
        return sendCompleteAndEnd(res, { type: "text", text: staleMsg });
      }

      if (serviceResult) {
        logStepDone("Interception", "VCSM: State machine processed. Returning direct response.");
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ type: "chunk", text: serviceResult.text })}\n\n`);
        }
        if (serviceResult.text) {
          saveMessage(sessionId, "assistant", serviceResult.text).catch(() => {});
        }
        return sendCompleteAndEnd(res, serviceResult);
      }
    }

    // Priority 3: Shopping Context Resume Detection
    if (parsedIntent.intent === "search_products") {
      const searchQuery = parsedIntent.parameters.query || parsedIntent.parameters.q;
      if (searchQuery) {
        const matchingCtx = await findMatchingContext(sessionId, searchQuery);
        if (matchingCtx && matchingCtx.contextId !== userState.active_shopping_context && matchingCtx.searchQuery && matchingCtx.searchQuery.trim().length > 0) {
          logStepDone("Interception", `VCSM: Found matching context ${matchingCtx.contextId}`);
          memory.waitingForResumeChoice = true;
          memory.resumableContextId = matchingCtx.contextId;
          memory.pendingSearchQuery = searchQuery;
          updateMemory(sessionId, memory);

          setSSEHeaders(res);
          const resumePrompt = `😊 Welcome back!\n\nWe were already looking at ${matchingCtx.searchQuery} earlier.\n\nWould you like to:\n\n**A.** Continue the previous search\n**B.** Start a new search`;
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
        reminderText = `😊 By the way, your **${pendingProduct}** order is still waiting for confirmation. Whenever you're ready, simply type **Yes** and I'll place the order.\n\n`;
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

    // ── Step 9: Conversation Understanding Layer (Executed Early) ─────────────
    logStepDone("Understanding & Decision", `active_flow=${decision.active_flow} module=${decision.response.module} category=${decision.response.category} llm=${decision.llm_response}`);

    // ── Step 9b: Execute intent ───────────────────────────────────────────────
    let result;
    if (parsedIntent.intent === "general_chat") {

      // ── Response Library path (no LLM needed) ─────────────────────────────
      if (!decision.llm_response) {
        const libraryResponse = selectResponse(decision, {}, sessionId);
        if (libraryResponse) {
          logStepDone("Response Library", `${decision.response.module}/${decision.response.category}`);
          result = libraryResponse.text;
          providerUsed = "response_library";

          // Stream the library response as a single chunk for frontend consistency
          if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify({ type: "chunk", text: libraryResponse.text })}\n\n`);
          }
          await addMessage(sessionId, "assistant", libraryResponse.text);
        } else {
          // Fallback: library had no match → let LLM handle it
          decision.llm_response = true;
        }
      }

      // ── LLM streaming path (dynamic response) ────────────────────────────
      if (decision.llm_response) {
        logStepStart("LLM generation stream");
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
        result = await chatWithLLMStream({
          message,
          history,
          memory: memoryState,
          memoryContext,
          runtimeContext,
          onChunk: (chunk) => {
            if (!res.writableEnded) {
              res.write(`data: ${JSON.stringify({ type: "chunk", text: chunk })}\n\n`);
            }
          }
        });
        const llmMs = Date.now() - llmStart;

        if (typeof result === "string") {
          await addMessage(sessionId, "assistant", result);
          logStepDone("LLM generation stream", `${llmMs}ms`);
          providerUsed = "gemini";
        } else if (result?.error) {
          logStepError("LLM generation stream", result.message);
          return sendErrorAndEnd(res, logs, result.message || "Failed to process AI request");
        }
      }

    } else {
      // Phase 8: MCP Validation
      if (parsedIntent.intent === "search_products") {
        const query = parsedIntent.parameters?.query || parsedIntent.parameters?.q;
        const currentWorkflow = workflowDecision.workflow;

        // Prevent empty query or invalid workflow/shopping context
        if (!query || query.trim() === "" || currentWorkflow !== "product_search") {
          logStepDone("MCP Validation", "Blocked invalid or empty product search query");
          const clarifyText = "What products are you looking for? Please let me know what item you want to find! 😊";
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
          text = "உங்கள் கோரிக்கைக்குப் பொருத்தமான சில தயாரிப்புகளை நான் கண்டறிந்துள்ளேன்! கீழே பாருங்கள் 😊";
        } else {
          text = "I found some great options matching your request! Take a look below 😊";
        }
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ type: "chunk", text })}\n\n`);
        }
      } else {
        logStepStart("Formatting results stream");
        text = await formatRecommendationsStream(
          message,
          result,
          history,
          voiceMode,
          (chunk) => {
            if (!res.writableEnded) {
              res.write(`data: ${JSON.stringify({ type: "chunk", text: chunk })}\n\n`);
            }
          }
        );
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
          logStepStart("Formatting suggested results stream");
          const history = await getRecentHistory(sessionId);
          text = await formatRecommendationsStream(
            message,
            result.products || [],
            history,
            voiceMode,
            (chunk) => {
              if (!res.writableEnded) {
                res.write(`data: ${JSON.stringify({ type: "chunk", text: chunk })}\n\n`);
              }
            }
          );
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

    // Phase 10: Temporarily add structured integration trace logging
    console.log(`
══════════════════════════════════════
Incoming Message         : ${message}
Intent                   : ${parsedIntent?.intent || "N/A"}
Decision                 : ${JSON.stringify(decision || {})}
Conversation State (Load): ${JSON.stringify(userState || {})}
Workflow Decision        : ${JSON.stringify(workflowDecision || {})}
Conversation State (Saved): ${JSON.stringify(userState || {})}
Response Engine Input    : ${JSON.stringify({ decision, workflowDecision })}
Runtime Builder Input    : ${JSON.stringify({ decision, userState })}
Prompt Builder Input     : ${JSON.stringify({ decision, userState })}
Gemini Request           : ${providerUsed === "gemini" ? "YES (Gemini API called)" : "NO (Response Library or Fast Path)"}
Streaming Status         : ${!voiceMode ? "ENABLED" : "DISABLED"}
══════════════════════════════════════
    `);

    logRequestFooter(intentLabel, Date.now() - requestStart, providerUsed);
    return sendCompleteAndEnd(res, finalPayload);

  } catch (error) {
    logError("CHAT_STREAM", `Unhandled error — ${error.message}`);
    return sendErrorAndEnd(res, logs, error.message || "Internal Server Error");
  }
};

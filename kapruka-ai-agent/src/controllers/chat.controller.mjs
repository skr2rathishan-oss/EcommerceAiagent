import { detectIntent, extractContext, chatWithLLM } from "../services/ai/llm.service.mjs";
import {
  recordIntentDetection,
  recordMemoryLoad,
  recordQwenResponse,
  recordMcpSearch,
  recordFormatting,
  recordTotal
} from "../services/core/performance.service.mjs";
import { routeIntent } from "../agent/intentRouter.mjs";
import { getRecentHistory, addMessage } from "../services/memory/chatMemory.service.mjs";
import { formatRecommendations } from "../utils/formatters/recommendationFormatter.js";
import { getShoppingContext, updateMemory, getMemory } from "../agent/memoryManager.mjs";
import { saveMessage } from "../services/memory/conversation.service.mjs";
import { checkAndTriggerSummarization } from "../services/memory/memory.service.mjs";
import { buildPersonalizedContext, shouldUseMemory, getMessageIntent } from "../memory/contextEngine.mjs";
import { memoryExtractor } from "../memory/memoryExtractor.mjs";
import { mergeToProfile, getDeliverySession, updateDeliverySession } from "../memory/memoryStore.mjs";
import { shouldBypassQwen, getFastPathType } from "../agent/fastPathRouter.mjs";
import { getContext } from "../services/core/logger.service.mjs";
import { cacheService } from "../cache/cacheService.mjs";
import { extractContext as localExtractContext } from "../ai/context/contextExtractor.mjs";
import { localDetectLanguage, detectLanguageFromHistory } from "../utils/language.utils.mjs";
import {
  loadConversationState,
  saveConversationState,
  getActiveDelivery,
  getPendingOrder,
  getShoppingContexts,
  setActiveShoppingContext,
  setPendingOrder,
  clearPendingOrder,
  clearConversationState
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

    // ── Step 1: Log incoming message ───────────────────────────────────────────
    const logLang = localDetectLanguage(message);
    logIncomingMessage(sessionId, message, logLang);
    logStepDone("Language detected", logLang === "si" ? "Sinhala" : logLang === "ta" ? "Tamil" : "English");

    // ── Step 2: Persist user message (background) ─────────────────────────────
    saveMessage(sessionId, "user", message).catch(() => { });
    addMessage(sessionId, "user", message).catch(() => { });

    // ── Step 3: Memory extraction (background) ────────────────────────────────
    const extracted = memoryExtractor.extractFromText(message);
    const hasEntities = extracted.recipients.length || extracted.occasions.length ||
      extracted.budget !== null || extracted.categories.length;
    if (hasEntities) {
      mergeToProfile(sessionId, extracted).catch(() => { });
    }

    // ── VCSM Priority Routing and Interception ───────────────────────────────
    const currentLang = localDetectLanguage(message);
    const lowerMsg = message.toLowerCase().trim();
    const memory = getMemory(sessionId);

    // Initial Intent Detection to inform VCSM routing
    let parsedIntent = { intent: "general_chat", parameters: {} };
    if (req.body.intent) {
      parsedIntent = {
        intent: req.body.intent,
        parameters: req.body.parameters || {}
      };
      intentLabel = parsedIntent.intent;
    } else {
      try {
        const intentResult = await detectIntent(message);
        const cleanIntent = intentResult
          .trim()
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/```\s*$/, "")
          .trim();
        parsedIntent = JSON.parse(cleanIntent);
        intentLabel = parsedIntent.intent;
      } catch (parseErr) {
        parsedIntent = { intent: "general_chat", parameters: {} };
      }
    }

    // Load ConversationState
    const userState = await loadConversationState(sessionId);
    const activeDeliveryId = userState?.active_delivery_session;
    const pendingOrder = userState?.pending_order;

    // Load delivery session
    const deliverySession = activeDeliveryId ? await getDeliverySession(activeDeliveryId).catch(() => null) : null;
    const deliveryState = deliverySession?.state;

    const activeCollectingStates = [
      "WAITING_FOR_ADDRESS",
      "WAITING_FOR_ADDRESS_CONFIRMATION",
      "WAITING_FOR_DATE",
      "CHECKING_DELIVERY",
      "WAITING_FOR_RECOVERY_CHOICE",
      "WAITING_FOR_ALTERNATIVE_PRODUCT_SELECTION",
      "WAITING_FOR_CONFIRMATION",
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
    const cancellationPhrases = ["cancel order", "don't place it", "never mind", "don't place", "cancel my order", "stop order", "cancel"];
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
      
      // Clear reminder memory so that future orders can trigger reminders again
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
    if (deliverySession && activeCollectingStates.includes(deliveryState)) {
      logStepDone("Interception", `VCSM Active Delivery Session state: ${deliveryState}`);
      
      // Delivery Protection: Block shopping intents
      if (parsedIntent.intent === "search_products" || parsedIntent.intent === "select_product" || parsedIntent.intent === "get_product_details") {
        logStepDone("Interception", "VCSM: Delivery Protection Triggered");
        setSSEHeaders(res);
        const protectMsg = "😊 We're almost done with your current order. Let's finish this first. If you'd like to cancel it, just let me know and I'll help you search for something else.";
        saveMessage(sessionId, "assistant", protectMsg).catch(() => {});
        return sendCompleteAndEnd(res, { type: "text", text: protectMsg });
      }

      // Small Talk / General Chat in Active Delivery
      if (parsedIntent.intent === "general_chat") {
        logStepDone("Interception", "VCSM: Small Talk during Active Delivery");
        const history = await getRecentHistory(sessionId);
        const memoryState = {
          ...getShoppingContext(sessionId),
          ...(memory || {})
        };
        const chatResult = await chatWithLLM({ message, history, memory: memoryState, memoryContext: "" });
        
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
      } else if (deliveryState === "WAITING_FOR_CONFIRMATION") {
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
      if (serviceResult.text) saveMessage(sessionId, "assistant", serviceResult.text).catch(() => {});
      return sendCompleteAndEnd(res, serviceResult);
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

    // ── Step 5b: Context Extraction ───────────────────────────────────────────
    logStepStart("Context extraction");
    setSSEHeaders(res);

    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({
        type: "progress",
        step: "EXTRACTING",
        message: "Extracting context...",
        logs: [
          { id: "UNDERSTANDING", title: "Understanding request", status: "completed", details: [`Intent: ${parsedIntent.intent}`] },
          { id: "EXTRACTING", title: "Extracting context", status: "active", details: [] }
        ]
      })}\n\n`);
    }

    let extractedContext = null;
    try {
      const ctxStart = Date.now();
      const ctxRaw = await extractContext(message);
      const cleanCtx = ctxRaw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/, "").trim();
      extractedContext = JSON.parse(cleanCtx);

      try {
        const localCtx = localExtractContext(message);
        if (localCtx) {
          if (localCtx.emotion && localCtx.emotion !== "neutral") {
            extractedContext.emotion = localCtx.emotion;
            extractedContext.emotionConfidence = localCtx.emotionConfidence;
          }
          if (localCtx.situation && localCtx.situation !== "general") {
            extractedContext.situation = localCtx.situation;
            extractedContext.situationConfidence = localCtx.situationConfidence;
          }
          if (localCtx.urgency && localCtx.urgency === "high") {
            extractedContext.urgency = localCtx.urgency;
          }
        }
      } catch (localErr) {
        logger.warn(`Local pattern-based context extraction failed: ${localErr.message}`);
      }

      if (voiceMode) {
        extractedContext.voiceMode = true;
      }
      const ctxMs = Date.now() - ctxStart;
      logStepDone("Context extraction", `(${ctxMs}ms)`);
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

      if (parsedIntent.intent === "search_products" && extractedContext) {
        parsedIntent.parameters = parsedIntent.parameters || {};
        parsedIntent.parameters.filters = parsedIntent.parameters.filters || {};
        const f = parsedIntent.parameters.filters;
        const e = extractedContext;

        if (e.category && !f.category) f.category = e.category;
        if (e.brand && !f.brand) f.brand = e.brand;
        if (e.color && !f.color) f.color = e.color;
        if (e.size && !f.size) f.size = e.size;
        if (e.gender && !f.gender) f.gender = e.gender;
        if (e.budget && !f.priceMax) f.priceMax = e.budget;

        parsedIntent.parameters.context = e;
      } else {
        parsedIntent.parameters = parsedIntent.parameters || {};
        parsedIntent.parameters.context = extractedContext;
      }
    } catch (err) {
      logStepError("Context extraction", err.message);
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({
          type: "progress",
          step: "EXTRACTING",
          message: "Context extraction skipped",
          logs: [
            { id: "UNDERSTANDING", title: "Understanding request", status: "completed", details: [] },
            { id: "EXTRACTING", title: "Extracting context", status: "error", details: [] }
          ]
        })}\n\n`);
      }
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

      const llmStart = Date.now();
      result = await chatWithLLM({ message, history, memory: memoryState, memoryContext });
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
        if (logLang === "si") {
          text = "ඔබගේ ඉල්ලීමට ගැලපෙන හොඳම නිෂ්පාදන කිහිපයක් මා සොයාගත්තා! පහතින් බලන්න 😊";
        } else if (logLang === "ta") {
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
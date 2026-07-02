import { chatWithLLM } from "../../../services/ai/llm.service.mjs";
import { chatWithLLMStream, formatRecommendationsStream } from "../../../services/ai/llmStream.service.mjs";
import { formatRecommendations } from "../../../utils/formatters/recommendationFormatter.js";
import { verifyProductsMatchCategory } from "../../commerce/giftPlannerValidator.mjs";
import { getRecentHistory, addMessage } from "../../../services/memory/chatMemory.service.mjs";
import { getShoppingContext } from "../../../agent/memoryManager.mjs";
import { constructRuntimeData } from "../../../agent/builders/runtimeBuilder.mjs";
import { routeIntent } from "../../../agent/intentRouter.mjs";
import { selectResponseWithFallback, getResponseTemplates } from "../../../services/responseService.mjs";
import { logStepStart, logStepDone, logStepError } from "../../../utils/velora.console.mjs";

export const executeResponseEngine = async (reqBody, parsedIntent, contextData, decision, resolvedReference, shouldAddReminder, reminderText, isStream, onChunk, interceptedText = null, giftPlannerBlocking = {}) => {
  const { message, voiceMode } = reqBody;
  const { sessionId, memory, userState, deliverySession, pendingOrder, currentLang } = contextData;

  let providerUsed = "gemini";
  let result;

  // 1. Execute routing/MCP handler if not general_chat
  if (parsedIntent.intent !== "general_chat") {
    logStepStart("Routing intent", parsedIntent.intent);
    try {
      result = await routeIntent(parsedIntent.intent, parsedIntent.parameters, sessionId, null, currentLang);
      logStepDone("Intent handler", `${parsedIntent.intent}`);
    } catch (err) {
      logStepError("Intent handler", err.message);
      return { error: true, message: err.message || "Catalog service unavailable" };
    }

    if (result?.error) {
      // If error occurred during commerce services, construct response library key for temporary error
      decision = {
        ...decision,
        response: { module: "recovery", category: "temporary_error" }
      };
    }
  }

  // ── Gift Planner State Guard ──
  // When the Shopping Mission is COLLECTING_INFORMATION, block ALL product/search logic
  if (giftPlannerBlocking?.blocked) {
    logStepDone("ResponseEngine", `GiftPlanner BLOCKED: ${giftPlannerBlocking.blockedReason} — suppressing search_products intent and products`);
    // Override intent to prevent routeIntent from executing a search
    if (parsedIntent.intent === "search_products") {
      parsedIntent.intent = "general_chat";
      result = null;
    }
  }

  // 2. Perform Response Library Lookup to guide the LLM
  let responseLibraryContext = null;
  const targetModule = decision?.response?.module || decision?.module;
  const targetCategory = decision?.response?.category || decision?.category;

  if (interceptedText) {
    responseLibraryContext = {
      module: targetModule || "intercept",
      category: targetCategory || "intercept",
      language: currentLang,
      templates: [interceptedText]
    };
  } else if (parsedIntent.intent === "delivery_flow_input" || parsedIntent.intent === "check_delivery") {
    if (result && result.status) {
      let prefix = "";
      if (result.prefixStatus) {
        const prefixDecision = { ...decision, module: result.prefixModule || "delivery", category: result.prefixStatus, response: { module: result.prefixModule || "delivery", category: result.prefixStatus }, llm_response: false };
        const prefixRes = selectResponseWithFallback(prefixDecision, result.prefixContext || {}, sessionId);
        prefix = prefixRes?.text ? prefixRes.text + "\n\n" : "";
      }

      const serviceDecision = { ...decision, module: result.module || "delivery", category: result.status, response: { module: result.module || "delivery", category: result.status }, llm_response: false };
      const mergedContext = { ...decision.variables, ...(result.context || {}) };
      const mainRes = selectResponseWithFallback(serviceDecision, mergedContext, sessionId);
      let mainText = mainRes?.text || result.status;

      let perishableWarning = "";
      if (result.perishableStatus) {
        const perishableDecision = { ...decision, module: result.perishableModule || "delivery", category: result.perishableStatus, response: { module: result.perishableModule || "delivery", category: result.perishableStatus }, llm_response: false };
        const perishableRes = selectResponseWithFallback(perishableDecision, result.perishableContext || {}, sessionId);
        perishableWarning = perishableRes?.text ? "\n\n" + perishableRes.text : "";
      }

      let nextPrompt = "";
      if (result.nextPromptStatus) {
        const nextDecision = { ...decision, module: result.nextPromptModule || "delivery", category: result.nextPromptStatus, response: { module: result.nextPromptModule || "delivery", category: result.nextPromptStatus }, llm_response: false };
        const nextRes = selectResponseWithFallback(nextDecision, result.nextPromptContext || {}, sessionId);
        nextPrompt = nextRes?.text ? "\n\n" + nextRes.text : "";
      }

      let confirmPrompt = "";
      if (result.confirmStatus) {
        const confirmDecision = { ...decision, module: result.confirmModule || "delivery", category: result.confirmStatus, response: { module: result.confirmModule || "delivery", category: result.confirmStatus }, llm_response: false };
        const confirmRes = selectResponseWithFallback(confirmDecision, result.confirmContext || {}, sessionId);
        confirmPrompt = confirmRes?.text ? "\n\n" + confirmRes.text : "";
      }

      let paymentPrompt = "";
      if (result.paymentStatus) {
        const paymentDecision = { ...decision, module: result.paymentModule || "delivery", category: result.paymentStatus, response: { module: result.paymentModule || "delivery", category: result.paymentStatus }, llm_response: false };
        const paymentRes = selectResponseWithFallback(paymentDecision, result.paymentContext || {}, sessionId);
        paymentPrompt = paymentRes?.text ? "\n\n" + paymentRes.text : "";
      }

      const composedText = prefix + mainText + perishableWarning + confirmPrompt + nextPrompt + paymentPrompt;
      responseLibraryContext = {
        module: "delivery",
        category: result.status,
        language: currentLang,
        templates: [composedText]
      };
    }
  } else {
    if (targetModule && targetCategory) {
      const templates = getResponseTemplates(targetModule, targetCategory, currentLang, { ...decision.variables, ...parsedIntent.parameters });
      if (templates && templates.length > 0) {
        responseLibraryContext = {
          module: targetModule,
          category: targetCategory,
          language: currentLang,
          templates
        };
      }
    }
  }

  // Bypass generic conversation handling and suppress response library templates during active Gift Planner selection (Step 9)
  if (userState?.shoppingMission && (userState.shoppingMission.status === "SEARCHING" || userState.shoppingMission.status === "SELECTING_PRODUCTS")) {
    responseLibraryContext = null;
  }

  // 3. UI Selection Bypasses (These are structured data, not conversational generation)
  if (parsedIntent.intent === "select_product" && result && result.type === "product_selected") {
     let selectMessage = `Great choice! 😊\n\nThat looks like a promising option.\n\nWhat would you like to do next?`;
     let actions = [
         { id: "view_details", label: "View Full Details", emoji: "👀" },
         { id: "check_delivery", label: "Check Delivery", emoji: "🚚" },
         { id: "add_to_cart", label: "Add To Cart", emoji: "🛒" },
         { id: "save_for_later", label: "Save For Later", emoji: "❤️" },
         { id: "compare", label: "Compare With Similar", emoji: "⚖️" },
     ];

     if (currentLang === "ta") {
         selectMessage = `அருமையான தேர்வு! 😊\n\nஅது ஒரு சிறந்த தயாரிப்பாகத் தெரிகிறது.\n\nஅடுத்து நீங்கள் என்ன செய்ய விரும்புகிறீர்கள்?`;
         actions = [
             { id: "view_details", label: "முழு விபரங்களையும் காண்க", emoji: "👀" },
             { id: "check_delivery", label: "டெலிவரியைச் சரிபார்", emoji: "🚚" },
             { id: "add_to_cart", label: "கார்ட்டில் சேர்", emoji: "🛒" },
             { id: "save_for_later", label: "பின்னர் சேமிக்கவும்", emoji: "❤️" },
             { id: "compare", label: "ஒத்தவற்றுடன் ஒப்பிடுக", emoji: "⚖️" },
         ];
     } else if (currentLang === "si") {
         selectMessage = `නියම තේරීමක්! 😊\n\nඑය හොඳ නිෂ්පාදනයක් බව පෙනේ.\n\nඊළඟට ඔබ කුමක් කිරීමට කැමතිද?`;
         actions = [
             { id: "view_details", label: "සම්පූර්ණ විස්තර බලන්න", emoji: "👀" },
             { id: "check_delivery", label: "බෙදා හැරීම පරීක්ෂා කරන්න", emoji: "🚚" },
             { id: "add_to_cart", label: "කරත්තයට එක් කරන්න", emoji: "🛒" },
             { id: "save_for_later", label: "පසුවට සුරකින්න", emoji: "❤️" },
             { id: "compare", label: "සමාන ඒවා සමඟ සසඳන්න", emoji: "⚖️" },
         ];
     }

     result.message = selectMessage;
     result.actions = actions;
     result.source = "response_engine";
     if (userState?.shoppingMission) {
       result.shoppingMission = userState.shoppingMission;
     }
     return { finalPayload: result, providerUsed };
  }

  if (parsedIntent.intent === "get_product_details" && result && (result.type === "product_details" || result.product || result.content)) {
      const detailPayload = {
        ...result,
        text: result.text || `Here are the full details for ${result.product?.name || "the product"}.`,
        source: "response_engine"
      };
      if (userState?.shoppingMission) {
        detailPayload.shoppingMission = userState.shoppingMission;
      }
      return { finalPayload: detailPayload, providerUsed };
  }

  // 4. Construct System Prompt & Call Gemini
  logStepStart("LLM generation", "Gemini 2.5 Flash");
  let history = await getRecentHistory(sessionId);
  
  // Clean history length for simple greetings to keep it focused
  if (parsedIntent.intent === "general_chat" && (parsedIntent.chat_subtype === "greeting" || parsedIntent.chat_subtype === "thanks" || parsedIntent.chat_subtype === "goodbye")) {
     history = history.slice(-2);
  }
  
  if (parsedIntent.intent === "general_chat") {
     await addMessage(sessionId, "user", message);
  }

  const memoryState = {
    ...getShoppingContext(sessionId),
    ...(memory || {})
  };

  // Extract products list if search results are present
  let productsList = [];
  if (result && (Array.isArray(result) || result.products || result.product)) {
    productsList = Array.isArray(result) ? result : (result.products || [result.product]);
  }

  // Gift Planner Block: Force empty products when mission is collecting information
  if (giftPlannerBlocking?.blocked && productsList.length > 0) {
    logStepDone("ResponseEngine", `GiftPlanner BLOCKED: Suppressed ${productsList.length} products from reaching LLM (reason: ${giftPlannerBlocking.blockedReason})`);
    productsList = [];
  }

  // Gift Planner Products Hook: Inject the current active category search results into the LLM context
  // and track whether the search is FRESH (happened this turn) to decide if product_grid should be returned.
  //
  // KEY DISTINCTION:
  //   - Fresh search (lastSearchedAt within 10s): orchestrator ran this turn → show product_grid
  //   - Stale cache (lastSearchedAt > 10s ago): follow-up conversational message → LLM context only, no product_grid
  //
  // This prevents cached phones (or any old search) from reappearing on unrelated conversational turns.
  const isGiftPlannerActive = userState?.shoppingMission && ["SEARCHING", "SELECTING_PRODUCTS"].includes(userState.shoppingMission.status);
  let giftPlannerFreshSearch = false; // true only when the orchestrator ran a NEW search in THIS turn
  if (isGiftPlannerActive && productsList.length === 0 && !giftPlannerBlocking?.blocked) {
    const mission = userState.shoppingMission;
    // Find the currently active searched item (latest unselected searched item)
    const unselectedSearched = mission.missionItems?.filter(item => item.searchCompleted && !item.selectedProduct) || [];
    unselectedSearched.sort((a, b) => (b.lastSearchedAt || 0) - (a.lastSearchedAt || 0));
    const activeItem = unselectedSearched[0];
    if (activeItem && Array.isArray(activeItem.recommendedProducts) && activeItem.recommendedProducts.length > 0) {
      // Validate search results against active item metadata using Reference Index as single source of truth
      const verified = verifyProductsMatchCategory(activeItem.recommendedProducts, activeItem);
      if (verified.length > 0) {
        productsList = verified;
        // A search is considered "fresh" if it happened within the last 10 seconds.
        // The orchestrator sets lastSearchedAt = Date.now() immediately before returning,
        // so a same-turn search will always be well within this window.
        const searchAgeMs = Date.now() - (activeItem.lastSearchedAt || 0);
        giftPlannerFreshSearch = searchAgeMs < 10000;
        if (giftPlannerFreshSearch) {
          logStepDone("ResponseEngine", `GiftPlanner: Fresh search — grounded "${activeItem.category}" products into payload (age: ${searchAgeMs}ms)`);
        } else {
          logStepDone("ResponseEngine", `GiftPlanner: Stale cache — injecting "${activeItem.category}" products into LLM context only (age: ${searchAgeMs}ms, no product_grid)`);
        }
      } else {
        logStepDone("ResponseEngine", `GiftPlanner: Results failed validation for active category "${activeItem.category}" - empty productsList`);
      }
    }
  }

  // Ensure recommendation templates execute only when grounded products exist (Requirement 5)
  if (productsList.length === 0 && responseLibraryContext && (responseLibraryContext.module === "shopping" || responseLibraryContext.category === "recommendations" || responseLibraryContext.category === "search")) {
    responseLibraryContext = null;
    logStepDone("ResponseEngine", "Suppressed recommendation/search template since no grounded products exist");
  }

  // Extract tracking details if tracking results are present
  let trackingContext = null;
  if (result && (result.type === "order_tracking" || result.type === "order_tracking_error" || result.tracking)) {
    trackingContext = result.tracking || { status: "Error", error: result.message || "Unknown error" };
  }

  const runtimeContext = constructRuntimeData({
    decision,
    userState,
    memory,
    memoryState,
    deliverySession,
    pendingOrder,
    voiceMode,
    message,
    resolvedReference,
    products: productsList,
    tracking: trackingContext,
    responseLibrary: responseLibraryContext
  });

  let llmResult;
  const llmStart = Date.now();

  if (isStream) {
    llmResult = await chatWithLLMStream({ 
      message, 
      history, 
      memory: memoryState, 
      memoryContext: "", 
      runtimeContext,
      onChunk: (chunk) => {
        if (onChunk) onChunk(chunk);
      }
    });

    // If search products and products list exists, stream recommendation summary formatted
    if (parsedIntent.intent === "search_products" && productsList.length > 0) {
      if (onChunk) onChunk("\n\n");
      const formattedIntro = await formatRecommendationsStream(message, productsList, history, voiceMode, (chunk) => {
         if (onChunk) onChunk(chunk);
      });
      llmResult = (llmResult || "") + "\n\n" + formattedIntro;
    }
  } else {
    llmResult = await chatWithLLM({ message, history, memory: memoryState, memoryContext: "", runtimeContext });
    if (parsedIntent.intent === "search_products" && productsList.length > 0) {
      const formattedProducts = await formatRecommendations(message, productsList, history, voiceMode);
      llmResult = (llmResult || "") + "\n\n" + formattedProducts;
    }
  }

  const llmMs = Date.now() - llmStart;
  logStepDone("LLM generation", `${llmMs}ms`);

  let responseText = typeof llmResult === "string" ? llmResult : "How can I help you today?";
  if (shouldAddReminder) {
    responseText = reminderText + responseText;
  }

  await addMessage(sessionId, "assistant", responseText);

  // 5. Structure final return payload based on intent type or resolved reference
  let finalPayload;
  if (resolvedReference && resolvedReference.success) {
    let referencedProducts = [];
    if (resolvedReference.action === "PRODUCT_SELECTED" && resolvedReference.internalProduct) {
      referencedProducts = [resolvedReference.internalProduct];
    } else if (resolvedReference.action === "COMPARE_PRODUCTS" && resolvedReference.internalProducts) {
      referencedProducts = resolvedReference.internalProducts;
    } else if (resolvedReference.action === "SHOW_ALL_PRODUCTS" && resolvedReference.internalProducts) {
      referencedProducts = resolvedReference.internalProducts;
    }

    if (referencedProducts.length > 0) {
      finalPayload = {
        type: "product_grid",
        text: responseText,
        products: referencedProducts,
        source: "response_engine"
      };
      if (userState?.shoppingMission) {
        finalPayload.shoppingMission = userState.shoppingMission;
      }
      return { finalPayload, providerUsed };
    }
  }

  if (parsedIntent.intent === "delivery_flow_input" || parsedIntent.intent === "check_delivery") {
    if (result) {
      result.text = responseText;
      finalPayload = { ...result, source: "response_engine" };
    } else {
      finalPayload = { type: "text", text: responseText, source: "response_engine" };
    }
  } else if ((parsedIntent.intent === "search_products" || giftPlannerFreshSearch) && productsList.length > 0 && !giftPlannerBlocking?.blocked) {
    // Return product_grid for:
    //   (a) explicit search_products intent (regular product search)
    //   (b) gift planner fresh search (orchestrator ran a NEW search in this turn, within the last 10s)
    // Stale gift planner cache + conversational messages are excluded by giftPlannerFreshSearch = false.
    finalPayload = {
      type: "product_grid",
      text: responseText,
      products: productsList,
      source: "response_engine",
      // isGiftPlannerGrid lets the frontend know this product grid came from the gift planner
      // orchestrator, NOT a regular user search. Without it, the frontend would wrongly use
      // activeMissionProducts (stale phones) instead of msg.products (the actual search results).
      ...(giftPlannerFreshSearch && { isGiftPlannerGrid: true }),
    };
  } else if (parsedIntent.intent === "track_order" && trackingContext) {
    finalPayload = { type: "order_tracking", text: responseText, tracking: trackingContext, source: "response_engine" };
  } else {
    finalPayload = { type: "text", text: responseText, source: "response_engine" };
  }

  if (userState?.shoppingMission && finalPayload) {
    finalPayload.shoppingMission = userState.shoppingMission;
  }

  return { finalPayload, providerUsed };
};

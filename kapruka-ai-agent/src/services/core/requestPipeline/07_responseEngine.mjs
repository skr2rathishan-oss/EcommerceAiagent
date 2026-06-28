import { chatWithLLM } from "../../../services/ai/llm.service.mjs";
import { chatWithLLMStream, formatRecommendationsStream } from "../../../services/ai/llmStream.service.mjs";
import { formatRecommendations } from "../../../utils/formatters/recommendationFormatter.js";
import { getRecentHistory, addMessage } from "../../../services/memory/chatMemory.service.mjs";
import { getShoppingContext } from "../../../agent/memoryManager.mjs";
import { constructRuntimeData } from "../../../agent/builders/runtimeBuilder.mjs";
import { routeIntent } from "../../../agent/intentRouter.mjs";
import { selectResponseWithFallback } from "../../../services/responseService.mjs";
import { logStepStart, logStepDone, logStepError } from "../../../utils/velora.console.mjs";

export const executeResponseEngine = async (reqBody, parsedIntent, contextData, decision, resolvedReference, shouldAddReminder, reminderText, isStream, onChunk) => {
  const { message, voiceMode } = reqBody;
  const { sessionId, memory, userState, deliverySession, pendingOrder, currentLang } = contextData;
  const lowerMsg = message ? message.toLowerCase().trim() : "";

  let providerUsed = "";
  let finalPayload;
  let result;
  
  if (parsedIntent.intent === "general_chat") {
    logStepStart("LLM generation", "Gemini 2.5 Flash");
    let history = await getRecentHistory(sessionId);
    if (parsedIntent.chat_subtype === "greeting" || parsedIntent.chat_subtype === "thanks" || parsedIntent.chat_subtype === "goodbye") {
       history = history.slice(-2); // Limit history for simple greetings to avoid over-contextualizing
    }
    await addMessage(sessionId, "user", message);
    const memoryState = {
      ...getShoppingContext(sessionId),
      ...(memory || {})
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
    if (isStream) {
      result = await chatWithLLMStream({ 
        message, 
        history, 
        memory: memoryState, 
        memoryContext: "", 
        runtimeContext,
        onChunk: (chunk) => {
          if (onChunk) onChunk(chunk);
        }
      });
    } else {
      result = await chatWithLLM({ message, history, memory: memoryState, memoryContext: "", runtimeContext });
    }
    const llmMs = Date.now() - llmStart;

    if (typeof result === "string") {
      await addMessage(sessionId, "assistant", result);
      logStepDone("LLM generation", `${llmMs}ms`);
      providerUsed = "gemini";
    } else if (result?.error) {
      logStepError("LLM generation", result.message);
      return { error: true, message: result.message || "Failed to process AI request" };
    }
    
    // Priority 8: Ensure we simply return the natural LLM response
    if (shouldAddReminder && typeof result === "string") {
      result = reminderText + result;
    }
    return { finalPayload: { type: "text", text: result, source: "response_engine" }, providerUsed: "gemini" };

  } else {
    // MCP / routeIntent
    logStepStart("Routing intent", parsedIntent.intent);
    try {
      result = await routeIntent(parsedIntent.intent, parsedIntent.parameters, sessionId, null, currentLang);
      logStepDone("Intent handler", `${parsedIntent.intent}`);
      providerUsed = "gemini";
    } catch (err) {
      logStepError("Intent handler", err.message);
      return { error: true, message: err.message || "Catalog service unavailable" };
    }
  }

  if (result?.error) {
    return { error: true, message: result.message || "Operation failed" };
  }

  if (parsedIntent.intent === "delivery_flow_input" || parsedIntent.intent === "check_delivery") {
      // The result is directly a serviceResult like { status: 'success', text: '...', ... }
      if (result) {
        if (result.status) {
          // Prepend formatting if necessary via selectResponse (we can port the logic later, for now we will just assume routeIntent does not format it yet, wait actually routeIntent returned the raw serviceResult. Let's format it.)
          // Actually, in the old flow, handleAddressInput etc return serviceResult and the controller formats it with selectResponse.
          // I will temporarily let Response Engine format it like the legacy pipeline did.
          
          let textResponse = "";
          let prefix = "";
          if (result.prefixStatus) {
            const prefixDecision = {
              ...decision,
              module: result.prefixModule || "delivery",
              category: result.prefixStatus,
              response: { module: result.prefixModule || "delivery", category: result.prefixStatus },
              llm_response: false
            };
            const prefixRes = selectResponseWithFallback(prefixDecision, result.prefixContext || {}, sessionId);
            prefix = prefixRes?.text ? prefixRes.text + "\\n\\n" : "";
          }

          const serviceDecision = {
            ...decision,
            module: result.module || "delivery",
            category: result.status,
            response: { module: result.module || "delivery", category: result.status },
            llm_response: false
          };
          
          const mergedContext = { ...decision.variables, ...(result.context || {}) };
          
          const mainRes = selectResponseWithFallback(serviceDecision, mergedContext, sessionId);
          let mainText = mainRes?.text || "";
          if (!mainText && result.status) {
              mainText = result.status;
          }
          
          if (!mainText && result.status) {
              // fallback if Response library failed.
              mainText = result.status;
          }

          let perishableWarning = "";
          if (result.perishableStatus) {
            const perishableDecision = {
              ...decision,
              module: result.perishableModule || "delivery",
              category: result.perishableStatus,
              response: { module: result.perishableModule || "delivery", category: result.perishableStatus },
              llm_response: false
            };
          const mergedPerishableContext = { ...decision.variables, ...(result.perishableContext || {}) };
          const perishableRes = selectResponseWithFallback(perishableDecision, mergedPerishableContext, sessionId);
          perishableWarning = perishableRes?.text ? "\n\n" + perishableRes.text : "";
        }

          let nextPrompt = "";
          if (result.nextPromptStatus) {
            const nextDecision = {
              ...decision,
              module: result.nextPromptModule || "delivery",
              category: result.nextPromptStatus,
              response: { module: result.nextPromptModule || "delivery", category: result.nextPromptStatus },
              llm_response: false
            };
          const mergedNextPromptContext = { ...decision.variables, ...(result.nextPromptContext || {}) };
          const nextRes = selectResponseWithFallback(nextDecision, mergedNextPromptContext, sessionId);
          nextPrompt = nextRes?.text ? "\n\n" + nextRes.text : "";
        }

          let detailsText = "";
          if (result.detailsText) {
            detailsText = "\\n\\n" + result.detailsText;
          }

          let confirmPrompt = "";
          if (result.confirmStatus) {
            const confirmDecision = {
              ...decision,
              module: result.confirmModule || "delivery",
              category: result.confirmStatus,
              response: { module: result.confirmModule || "delivery", category: result.confirmStatus },
              llm_response: false
            };
          const mergedConfirmContext = { ...decision.variables, ...(result.confirmContext || {}) };
          const confirmRes = selectResponseWithFallback(confirmDecision, mergedConfirmContext, sessionId);
          confirmPrompt = confirmRes?.text ? "\n\n" + confirmRes.text : "";
        }

          let paymentPrompt = "";
          if (result.paymentStatus) {
            const paymentDecision = {
              ...decision,
              module: result.paymentModule || "delivery",
              category: result.paymentStatus,
              response: { module: result.paymentModule || "delivery", category: result.paymentStatus },
              llm_response: false
            };
          const mergedPaymentContext = { ...decision.variables, ...(result.paymentContext || {}) };
          const paymentRes = selectResponseWithFallback(paymentDecision, mergedPaymentContext, sessionId);
          paymentPrompt = paymentRes?.text ? "\n\n" + paymentRes.text : "";
        }

          textResponse = prefix + mainText + perishableWarning + detailsText + confirmPrompt + nextPrompt + paymentPrompt;
          result.text = textResponse;
        }

        if (result.text && isStream && onChunk) {
            onChunk(result.text);
        }
        await addMessage(sessionId, "assistant", result.text || "");
        result.source = "response_engine";
        return { finalPayload: result, providerUsed: "delivery_state_machine" };
      } else {
        const errorDecision = {
          ...decision,
          response: { module: "recovery", category: "temporary_error" },
          llm_response: false
        };
        const errorResponse = selectResponseWithFallback(errorDecision, decision.variables, sessionId);
        const errorMsg = errorResponse?.text;
        if (errorMsg && isStream && onChunk) onChunk(errorMsg);
        return { finalPayload: { type: "text", text: errorMsg, source: "response_engine" }, providerUsed: "response_library" };
      }
  } else if (parsedIntent.intent === "search_products" || parsedIntent.intent === "select_product" || parsedIntent.intent === "get_product_details") {
      
      // If we got an error object from commerce services
      if (result && result.error) {
         // Feed this to the LLM so it generates the error securely in the preferred language.
         const memoryState = {
            ...getShoppingContext(sessionId),
            ...(memory || {})
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
         
         const history = await getRecentHistory(sessionId);
         await addMessage(sessionId, "user", message);

         let sysErrorMsg = "Tell the user we encountered an error.";
         if (result.code === "MISSING_QUERY") {
            sysErrorMsg = "Ask the user what kind of products they are looking for (e.g., cakes, flowers, electronics, etc.). Keep it very brief.";
         } else if (result.code === "PRODUCT_NOT_FOUND") {
            sysErrorMsg = "Tell the user you couldn't find that product and ask them to select it again.";
         } else if (result.code === "MISSING_PRODUCT_ID") {
            sysErrorMsg = "Tell the user you need a product ID to fetch details and ask them to select a product first.";
         } else if (result.code === "PRODUCT_DETAILS_FAILED") {
            sysErrorMsg = "Tell the user you couldn't load the full product details right now and to try again shortly.";
         }

         const llmResult = await chatWithLLM({
            message: `SYSTEM ERROR/INSTRUCTION (Respond to user naturally in their language, incorporating this): ${sysErrorMsg}`,
            history,
            memory: memoryState,
            memoryContext: "",
            runtimeContext
         });

         const responseText = typeof llmResult === "string" ? llmResult : "Something went wrong.";
         await addMessage(sessionId, "assistant", responseText);

         return { finalPayload: { type: "text", text: responseText, source: "response_engine" }, providerUsed: "gemini" };
      }

      if (parsedIntent.intent === "select_product" && result && result.type === "product_selected") {
         // Format pure structured data
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
         return { finalPayload: result, providerUsed };
      }

      if (parsedIntent.intent === "get_product_details" && result && result.name) {
          // It's a formatted product object
          result.source = "response_engine";
          return { finalPayload: result, providerUsed };
      }
  }

  // Formatting
  if (Array.isArray(result)) {
    await addMessage(sessionId, "user", message);
    const history = await getRecentHistory(sessionId);
    let text;
    logStepStart("Formatting results");
    // Do not auto-format stream for simple arrays, let LLM run via the block below if it's product grid
    text = "Here are the products I found.";
    logStepDone("Formatting done", `${result.length} products`);
    
    if (shouldAddReminder) {
      text = reminderText + text;
    }
    await addMessage(sessionId, "assistant", text);
    finalPayload = { type: "product_grid", text, products: result };
  } else if (result?.type) {
    if (result.type === "product_grid") {
      await addMessage(sessionId, "user", message);
      let productsList = result.products || [];
      
      const history = await getRecentHistory(sessionId);
      const memoryState = {
        ...getShoppingContext(sessionId),
        ...(memory || {})
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

      if (isStream) {
        logStepStart("LLM stream", "Product search response");
        let accumulatedText = "";
        
        const llmStreamResult = await chatWithLLMStream({
          message,
          history,
          memory: memoryState,
          memoryContext: "",
          runtimeContext,
          onChunk: (chunk) => {
            accumulatedText += chunk;
            if (onChunk) onChunk(chunk);
          }
        });

        if (productsList.length > 0) {
           if (onChunk) onChunk("\n\n");
           const formattedIntro = await formatRecommendationsStream(message, productsList, history, voiceMode, (chunk) => {
              if (onChunk) onChunk(chunk);
           });
           accumulatedText += "\n\n" + formattedIntro;
        }
        
        result.text = accumulatedText;
        logStepDone("LLM stream", "Completed");

      } else {
        logStepStart("LLM generation", "Product search response");
        const llmStart = Date.now();
        const llmResult = await chatWithLLM({
          message,
          history,
          memory: memoryState,
          memoryContext: "",
          runtimeContext
        });
        const llmMs = Date.now() - llmStart;
        logStepDone("LLM generation", `${llmMs}ms`);

        let responseText = typeof llmResult === "string" ? llmResult : "Here are the products I found.";
        
        const formattedProducts = formatRecommendations(productsList);
        
        if (shouldAddReminder) {
           responseText = reminderText + responseText;
        }

        result.text = responseText;
      }
      
      if (shouldAddReminder) {
        result.text = reminderText + result.text;
      }
      await addMessage(sessionId, "assistant", result.text || "");
    }
    if (shouldAddReminder && result.text && result.type !== "product_grid") {
      result.text = reminderText + result.text;
    }
    finalPayload = { ...result, source: "response_engine" };
  } else if (typeof result === "string") {
    let text = result;
    if (shouldAddReminder) {
      text = reminderText + text;
    }
    finalPayload = { type: "text", text, source: "response_engine" };
  } else {
    finalPayload = { ...result, source: "response_engine" };
  }

  return { finalPayload, providerUsed };
};

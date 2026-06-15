import { detectIntent, chatWithLLM } from "../services/llm.service.mjs";
import { recordIntentDetection, recordMemoryLoad, recordQwenResponse, recordMcpSearch, recordFormatting, recordTotal } from "../services/performance.service.mjs";
import { routeIntent } from "../agent/intentRouter.mjs";
import { getRecentHistory, addMessage } from "../services/chatMemory.service.mjs";
import { formatRecommendations } from "../utils/formatters/recommendationFormatter.js";
import { getShoppingContext, updateMemory } from "../agent/memoryManager.mjs";
import { saveMessage } from "../services/conversation.service.mjs";
import { checkAndTriggerSummarization } from "../services/memory.service.mjs";
import { buildPersonalizedContext, shouldUseMemory, getMessageIntent } from "../services/contextBuilder.service.mjs";
import { shouldBypassQwen, getFastPathType } from "../agent/fastPathRouter.mjs";
import logger from "../utils/logger.mjs";
import { getContext, printRequestReport } from "../services/logger.service.mjs";
import { redisService } from "../services/redis.service.mjs";

function localDetectLanguage(text) {
  if (!text || typeof text !== "string") return "en";
  if (/[\u0D80-\u0DFF]/.test(text)) return "si";
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta";
  return "en";
}

function detectLanguageFromHistory(history) {
  if (!history || history.length === 0) return "en";
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === "user") {
      return localDetectLanguage(history[i].content);
    }
  }
  return "en";
}


// Helper to extract message content from assistant response payload
function extractText(payload) {
  if (!payload) return "";
  if (typeof payload === "string") return payload;
  if (payload.text) return payload.text;
  if (payload.message) return payload.message;
  if (payload.content) return payload.content;
  return "";
}

// Translation helper removed: regional languages are supported natively by the LLM



export const chat = async (req, res) => {
  const context = getContext();
  const t = context?.telemetry;

  if (t) {
    res.on("finish", () => {
      t.workflow.responseSent = true;
      t.performance.totalTime = Date.now() - t.startTime;
      printRequestReport(t);
    });
  }

  let logs = [];
  try {
    const { message, commerceState } = req.body;

    // Resolve session ID from header, body, or fall back to a default key
    const sessionId = req.headers["x-session-id"] || req.body.sessionId || "default";

    if (commerceState) {
      const { cart, wishlist, saved } = commerceState;
      let cartSummary = "Current Cart is empty.";
      if (cart && cart.length > 0) {
        const itemsText = cart.map(item => `${item.quantity}x ${item.name} - Rs.${item.price}`).join("\n");
        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        cartSummary = `Current Cart:\n${itemsText}\n\nTotal:\nRs.${total}`;
      }

      updateMemory(sessionId, {
        cart: cart || [],
        wishlist: wishlist || [],
        savedProducts: saved || [],
        cartSummary
      });
    }

    if (!message || typeof message !== "string" || message.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Message is required and must be a non-empty string."
      });
    }

    if (t) {
      t.userInput.message = message;
    }

    // Detect user language locally
    const langStart = Date.now();
    const detectedLang = localDetectLanguage(message);
    const langDuration = Date.now() - langStart;

    if (t) {
      t.language.detected = detectedLang === "en" ? "English" : detectedLang === "si" ? "Sinhala" : "Tamil";
      t.language.confidence = 1.0;
      t.language.translationUsed = "No";
      t.workflow.languageDetected = true;
      t.performance.langDetection = langDuration;
    }

    // Save user message (non-blocking) - save the original version
    saveMessage(sessionId, "user", message).catch(err => {
      logger.error("[Persistence Error] Failed to save user message:", err);
    });

    // ── Direct-intent fast path ───────────────────────────────────────────
    // When the frontend sends an explicit `intent` field (e.g. for product
    // selection or detail fetch), skip LLM detection and route directly.
    if (req.body.intent) {
      logger.info(`[CONTROLLER] Direct intent from frontend: ${req.body.intent}`);
      const directParameters = {
        ...(req.body.parameters || {}),
        ...(req.body.product ? { product: req.body.product } : {}),
        ...(req.body.productId ? { productId: req.body.productId } : {}),
      };

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      res.write(`data: ${JSON.stringify({
        type: "progress",
        step: "UNDERSTANDING",
        message: "Processing request...",
        logs: [
          { id: "UNDERSTANDING", title: "Processing request", status: "completed", details: [] }
        ]
      })}\n\n`);

      const history = await getRecentHistory(sessionId);
      const directLang = detectLanguageFromHistory(history);

      const directResult = await routeIntent(req.body.intent, directParameters, sessionId, null, directLang);
      logger.info(`[CONTROLLER] Direct intent result type: ${directResult?.type}`);

      // Save assistant response (non-blocking)
      const assistantText = extractText(directResult);
      if (assistantText) {
        saveMessage(sessionId, "assistant", assistantText)
          .then((updatedConvo) => {
            if (updatedConvo) {
              checkAndTriggerSummarization(sessionId, updatedConvo.messages.length).catch(err => {
                logger.error("[Background Summarization Error] Trigger failed in direct intent path:", err);
              });
            }
          })
          .catch(err => {
            logger.error("[Persistence Error] Failed to save assistant message in direct intent path:", err);
          });
      }

      res.write(`data: ${JSON.stringify({
        type: "complete",
        data: directResult
      })}\n\n`);
      res.end();
      return;
    }
    // ─────────────────────────────────────────────────────────────────────

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    logs = [
      { id: "UNDERSTANDING", title: "Understanding request", status: "active", details: [] }
    ];

    const updateProgress = (stepId, status, details = null) => {
      for (const step of logs) {
        if (step.id === stepId) {
          step.status = status;
          if (details !== null) step.details = details;
        }
      }
      if (status === "active" || status === "completed") {
        let index = logs.findIndex(s => s.id === stepId);
        for (let i = 0; i < index; i++) {
          if (logs[i].status !== "completed") {
            logs[i].status = "completed";
          }
        }
      }
      const activeStep = logs.find(s => s.status === "active") || logs.find(s => s.id === stepId);
      const activeMsg = activeStep ? (activeStep.id === "READY" ? "Recommendations ready" : activeStep.title + "...") : "Recommendations ready";

      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({
          type: "progress",
          step: activeStep ? activeStep.id : stepId,
          message: activeMsg,
          logs: logs
        })}\n\n`);
      }
    };

    // Initial progress stream
    updateProgress("UNDERSTANDING", "active");

    let intentResult;
    let parsedIntent = { intent: "general_chat", parameters: {} };

    try {
      logger.info(`Classifying user intent for message: "${message.substring(0, 40)}..."`);
      const intentDetectStart = Date.now();
      intentResult = await detectIntent(message);
      const intentTime = Date.now() - intentDetectStart;
      recordIntentDetection(intentTime);
      parsedIntent = JSON.parse(intentResult);

      if (t) {
        t.intent.type = parsedIntent.intent;
        t.intent.confidence = 0.95;
        t.intent.routeDecision = parsedIntent.intent === "general_chat" ? "LLM Handler" : "MCP Service";
        t.workflow.intentClassified = true;
        t.performance.intentClassification = intentTime;
      }
    } catch (parseErr) {
      logger.warn("Failed to parse intent JSON, falling back to general_chat context", { error: parseErr.message });
      parsedIntent = { intent: "general_chat", parameters: {} };
      if (t) {
        t.intent.type = "general_chat";
        t.intent.confidence = 0.5;
        t.intent.routeDecision = "LLM Handler";
        t.workflow.intentClassified = true;
      }
    }

    // Determine fast path status
    const isFastPath = shouldBypassQwen(parsedIntent.intent, message);
    const pathType = getFastPathType(parsedIntent.intent, message);

    if (t) {
      t.cache.redisStatus = redisService.isConnected() ? "Online" : "Fallback In-Memory";
      t.workflow.cacheChecked = true;
      t.performance.redisAccess = 3; // Estimated base access
    }

    // Determine the intentType for logging and memory check
    let intentType = parsedIntent.intent;
    if (intentType === "general_chat") {
      intentType = getMessageIntent(message, intentType);
    } else {
      if (intentType === "search_products") intentType = "product_search";
      else if (intentType === "check_delivery") intentType = "delivery_queries";
      else if (intentType === "get_product_details") intentType = "product_search";
    }

    let memoryLoaded = false;
    let memoryContext = "";

    const memoryStart = Date.now();
    if (shouldUseMemory(intentType)) {
      memoryContext = await buildPersonalizedContext(sessionId);
      if (memoryContext) {
        memoryLoaded = true;
      }
    }
    const memoryDuration = Date.now() - memoryStart;

    if (t) {
      t.memory.loaded = memoryLoaded ? "Yes" : "No";
      t.memory.summaryLoaded = memoryContext ? "Yes" : "No";
      t.prompt.memoryContextLength = memoryContext ? memoryContext.length : 0;
      
      const sessionContext = getShoppingContext(sessionId);
      t.prompt.retrievedSummaryLength = sessionContext?.currentSummary ? sessionContext.currentSummary.length : 0;
      t.workflow.memoryLoaded = true;
      t.performance.memoryRetrieval = memoryDuration;
    }

    // Extract details from parsed intent filters
    const intentDetails = [];
    if (parsedIntent.intent === "search_products" && parsedIntent.parameters?.filters) {
      const filters = parsedIntent.parameters.filters;
      if (filters.category) intentDetails.push(`Category: ${filters.category}`);
      if (filters.brand) intentDetails.push(`Brand: ${filters.brand}`);
      if (filters.color) intentDetails.push(`Color: ${filters.color}`);
      if (filters.size) intentDetails.push(`Size: ${filters.size}`);
      if (filters.gender) intentDetails.push(`Gender: ${filters.gender}`);
      if (filters.type) intentDetails.push(`Type: ${filters.type}`);
      if (filters.flavor) intentDetails.push(`Flavor: ${filters.flavor}`);
      if (filters.weight) intentDetails.push(`Weight: ${filters.weight}`);
      if (filters.priceMin && filters.priceMax) {
        intentDetails.push(`Budget: Rs. ${filters.priceMin} - Rs. ${filters.priceMax}`);
      } else if (filters.priceMin) {
        intentDetails.push(`Budget: Above Rs. ${filters.priceMin}`);
      } else if (filters.priceMax) {
        intentDetails.push(`Budget: Under Rs. ${filters.priceMax}`);
      }
    } else if (parsedIntent.intent === "track_order" && parsedIntent.parameters?.orderNumber) {
      intentDetails.push(`Order Number: ${parsedIntent.parameters.orderNumber}`);
    } else if (parsedIntent.intent === "get_product_details") {
      intentDetails.push(`Product ID: ${parsedIntent.parameters?.productId || parsedIntent.parameters?.product_id || "Selected Product"}`);
    }

    // Initialize full logs structure based on detected intent
    if (parsedIntent.intent === "search_products") {
      logs = [
        { id: "UNDERSTANDING", title: "Understanding request", status: "completed", details: intentDetails },
        { id: "SEARCHING", title: "Searching catalog", status: "active", details: [] },
        { id: "FILTERING", title: "Applying filters", status: "pending", details: [] },
        { id: "RANKING", title: "Ranking products", status: "pending", details: [] },
        { id: "READY", title: "Recommendations ready", status: "pending", details: [] }
      ];
    } else {
      logs = [
        { id: "UNDERSTANDING", title: "Understanding request", status: "completed", details: intentDetails },
        { id: "READY", title: "Preparing response", status: "active", details: [] }
      ];
    }

    // Update progress transition
    const nextStepId = parsedIntent.intent === "search_products" ? "SEARCHING" : "READY";
    const nextMessage = parsedIntent.intent === "search_products" ? "Searching products..." : "Preparing response...";
    res.write(`data: ${JSON.stringify({
      type: "progress",
      step: nextStepId,
      message: nextMessage,
      logs: logs
    })}\n\n`);

    let result;
    if (parsedIntent.intent === "general_chat") {
      const history = await getRecentHistory(sessionId);
      await addMessage(sessionId, "user", message);
      const memory = getShoppingContext(sessionId);

      result = await chatWithLLM({ message: message, history, memory, memoryContext, detectedLang });

      if (typeof result === "string") {
        await addMessage(sessionId, "assistant", result);
      }

      if (result && typeof result === "object" && result.error) {
        const activeStep = logs.find(s => s.status === "active") || logs[logs.length - 1];
        if (activeStep) {
          activeStep.status = "error";
          activeStep.details = [result.message || "Failed to process AI request"];
        }
        res.write(`data: ${JSON.stringify({
          type: "progress",
          step: "ERROR",
          message: "AI processing failed",
          logs: logs,
          error: true
        })}\n\n`);
        res.end();
        return;
      }
    } else {
      const searchStart = Date.now();
      try {
        result = await routeIntent(
          parsedIntent.intent,
          parsedIntent.parameters,
          sessionId,
          updateProgress
        );
        const searchTime = Date.now() - searchStart;
        if (t) {
          t.search.query = parsedIntent.parameters?.query || parsedIntent.parameters?.q || message;
          t.search.filters = parsedIntent.parameters?.filters || {};
          t.search.category = parsedIntent.parameters?.filters?.category || "All";
          t.search.budget = (parsedIntent.parameters?.filters?.priceMin || parsedIntent.parameters?.filters?.priceMax)
            ? `${parsedIntent.parameters.filters.priceMin || 0} - ${parsedIntent.parameters.filters.priceMax || "Max"}`
            : "Any";
          
          t.performance.productSearch = searchTime;
          t.workflow.productSearchCompleted = true;
          
          // Count products
          const productsArr = Array.isArray(result) ? result : (result?.products || []);
          t.search.retrieved = productsArr.length;
          t.search.ranked = productsArr.length;
          t.search.returned = productsArr.length;
        }
      } catch (err) {
        const activeStep = logs.find(s => s.status === "active") || logs[logs.length - 1];
        if (activeStep) {
          activeStep.status = "error";
          activeStep.details = [err.message || "Catalog service unavailable"];
        }
        res.write(`data: ${JSON.stringify({
          type: "progress",
          step: "ERROR",
          message: "Search failed",
          logs: logs,
          error: true
        })}\n\n`);
        res.end();
        return;
      }
    }

    if (result && typeof result === "object" && result.error) {
      const activeStep = logs.find(s => s.status === "active") || logs[logs.length - 1];
      if (activeStep) {
        activeStep.status = "error";
        activeStep.details = [result.message || "Operation failed"];
      }
      res.write(`data: ${JSON.stringify({
        type: "progress",
        step: "ERROR",
        message: "Operation failed",
        logs: logs,
        error: true
      })}\n\n`);
      res.end();
      return;
    }

    let finalPayload;
    if (Array.isArray(result)) {
      await addMessage(sessionId, "user", message);
      const history = await getRecentHistory(sessionId);
      let text;
      if (isFastPath) {
        if (detectedLang === "ta") {
          text = "உங்கள் கோரிக்கைக்குப் பொருத்தமான சில சிறந்த தயாரிப்புகளை நான் கண்டறிந்துள்ளேன்! கீழே பார்த்து, உங்கள் கவனத்தை ஈர்ப்பது எது என்பதை எனக்குத் தெரியப்படுத்துங்கள். 😊";
        } else if (detectedLang === "si") {
          text = "ඔබගේ ඉල්ලීමට ගැලපෙන හොඳම නිෂ්පාදන කිහිපයක් මම සොයාගත්තා! පහතින් බලලා ඔබ කැමති එක මොකක්ද කියලා මට කියන්න. 😊";
        } else {
          text = "I found some great options matching your request! Take a look below and let me know which one catches your eye. 😊";
        }
      } else {
        text = await formatRecommendations(message, result, history, detectedLang);
      }
      await addMessage(sessionId, "assistant", text);
      finalPayload = {
        type: "product_grid",
        text,
        products: result
      };
    } else if (result && typeof result === "object" && result.type) {
      if (result.type === "product_grid") {
        await addMessage(sessionId, "user", message);
        await addMessage(sessionId, "assistant", result.text || "");
      }
      finalPayload = result;
    } else if (typeof result === "string") {
      finalPayload = {
        type: "text",
        text: result
      };
    } else {
      finalPayload = result;
    }

    // Complete the final step
    updateProgress("READY", "completed");

    // Save assistant response (non-blocking)
    const assistantText = extractText(finalPayload);
    if (assistantText) {
      saveMessage(sessionId, "assistant", assistantText)
        .then((updatedConvo) => {
          if (updatedConvo) {
            checkAndTriggerSummarization(sessionId, updatedConvo.messages.length).catch(err => {
              logger.error("[Background Summarization Error] Trigger failed:", err);
            });
          }
        })
        .catch(err => {
          logger.error("[Persistence Error] Failed to save assistant message:", err);
        });
    }

    res.write(`data: ${JSON.stringify({
      type: "complete",
      data: finalPayload
    })}\n\n`);
    res.end();

  } catch (error) {
    if (t) {
      t.error = {
        serviceName: "ChatController",
        errorType: error.name || "RuntimeError",
        errorMessage: error.message,
        stackTrace: error.stack,
        recoveryAction: "Returned 500 status message to UI",
        fallbackModel: "None"
      };
    }
    logger.error("Unhandled error in chat controller", { error: error.message, stack: error.stack });

    const activeStep = logs.find(s => s.status === "active") || logs.find(s => s.status === "pending") || logs[logs.length - 1];
    if (activeStep) {
      activeStep.status = "error";
      activeStep.details = [error.message || "Internal Server Error"];
    }

    try {
      res.write(`data: ${JSON.stringify({
        type: "progress",
        step: "ERROR",
        message: "Internal Server Error",
        logs: logs,
        error: true
      })}\n\n`);
      res.end();
    } catch (sendErr) {
      logger.error("Could not write error to response stream", { error: sendErr.message });
    }
  }
};
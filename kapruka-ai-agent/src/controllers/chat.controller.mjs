import { detectIntent, chatWithLLM } from "../services/llm.service.mjs";
import { recordIntentDetection, recordMemoryLoad, recordQwenResponse, recordMcpSearch, recordFormatting, recordTotal } from "../services/performance.service.mjs";
import { routeIntent } from "../agent/intentRouter.mjs";
import { getRecentHistory, addMessage } from "../services/chatMemory.service.mjs";
import { formatRecommendations } from "../utils/formatters/recommendationFormatter.js";
import { getShoppingContext } from "../agent/memoryManager.mjs";
import { saveMessage } from "../services/conversation.service.mjs";
import { checkAndTriggerSummarization } from "../services/memory.service.mjs";
import { buildPersonalizedContext, shouldUseMemory, getMessageIntent } from "../services/contextBuilder.service.mjs";
import { shouldBypassQwen, getFastPathType } from "../agent/fastPathRouter.mjs";
import logger from "../utils/logger.mjs";


// Helper to extract message content from assistant response payload
function extractText(payload) {
  if (!payload) return "";
  if (typeof payload === "string") return payload;
  if (payload.text) return payload.text;
  if (payload.message) return payload.message;
  if (payload.content) return payload.content;
  return "";
}



export const chat = async (req, res) => {
  let logs = [];
  try {
    const { message } = req.body;

    // Resolve session ID from header, body, or fall back to a default key
    const sessionId = req.headers["x-session-id"] || req.body.sessionId || "default";

    if (!message || typeof message !== "string" || message.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Message is required and must be a non-empty string."
      });
    }

    // Save user message (non-blocking)
    saveMessage(sessionId, "user", message).catch(err => {
      console.error("[Persistence Error] Failed to save user message:", err);
    });

    // ── Direct-intent fast path ───────────────────────────────────────────
    // When the frontend sends an explicit `intent` field (e.g. for product
    // selection or detail fetch), skip LLM detection and route directly.
    if (req.body.intent) {
      console.log("[CONTROLLER] Direct intent from frontend:", req.body.intent);
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

      const directResult = await routeIntent(req.body.intent, directParameters, sessionId);
      console.log("[CONTROLLER] Direct intent result type:", directResult?.type);

      // Save assistant response (non-blocking)
      const assistantText = extractText(directResult);
      if (assistantText) {
        saveMessage(sessionId, "assistant", assistantText)
          .then((updatedConvo) => {
            if (updatedConvo) {
              checkAndTriggerSummarization(sessionId, updatedConvo.messages.length).catch(err => {
                console.error("[Background Summarization Error] Trigger failed in direct intent path:", err);
              });
            }
          })
          .catch(err => {
            console.error("[Persistence Error] Failed to save assistant message in direct intent path:", err);
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

    // TEMP DEBUG LOG - SAFE TO REMOVE LATER
    console.log("\n==================================================");
    console.log("[REQUEST] Incoming chat request (SSE)");
    console.log("[REQUEST] Session ID:", sessionId);
    console.log("[REQUEST] User message:", message);
    console.log("[REQUEST] Timestamp:", new Date().toISOString());
    console.log("==================================================");

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
      console.log("[INTENT] Detecting intent for message:", message);
      const intentDetectStart = Date.now();
      intentResult = await detectIntent(message);
      recordIntentDetection(Date.now() - intentDetectStart);
      console.log("[INTENT] Raw intent result:", intentResult);
      parsedIntent = JSON.parse(intentResult);
    } catch (parseErr) {
      console.warn("Failed to parse intent JSON, falling back to general chat:", parseErr);
      parsedIntent = { intent: "general_chat", parameters: {} };
    }

    // Determine fast path status
    const isFastPath = shouldBypassQwen(parsedIntent.intent, message);
    const pathType = getFastPathType(parsedIntent.intent, message);

    if (isFastPath) {
      console.log(JSON.stringify({
        sessionId,
        fastPath: true,
        pathType: pathType
      }));
    } else {
      console.log(JSON.stringify({
        sessionId,
        fastPath: false,
        model: "Qwen"
      }));
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

    if (shouldUseMemory(intentType)) {
      memoryContext = await buildPersonalizedContext(sessionId);
      if (memoryContext) {
        memoryLoaded = true;
      }
    }

    // Lightweight log: sessionId, memoryLoaded (true/false), intentType. Do not log profile/summaries/messages
    console.log(`[Memory Context Log] sessionId: ${sessionId} | memoryLoaded: ${memoryLoaded} | intentType: ${intentType}`);

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

      result = await chatWithLLM({ message, history, memory, memoryContext });

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
      try {
        result = await routeIntent(
          parsedIntent.intent,
          parsedIntent.parameters,
          sessionId,
          updateProgress
        );
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
        text = "I found some great options matching your request! Take a look below and let me know which one catches your eye. 😊";
      } else {
        text = await formatRecommendations(message, result, history);
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
              console.error("[Background Summarization Error] Trigger failed:", err);
            });
          }
        })
        .catch(err => {
          console.error("[Persistence Error] Failed to save assistant message:", err);
        });
    }

    res.write(`data: ${JSON.stringify({
      type: "complete",
      data: finalPayload
    })}\n\n`);
    res.end();

  } catch (error) {
    console.error("[ERROR] Unhandled error in chat controller:", error.message);
    console.error("[ERROR] Stack trace:", error.stack);

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
      console.error("Could not write error to response stream:", sendErr);
    }
  }
};
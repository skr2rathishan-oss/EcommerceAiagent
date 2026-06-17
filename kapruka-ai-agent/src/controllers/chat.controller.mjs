import { detectIntent, chatWithLLM } from "../services/ai/llm.service.mjs";
import {
  recordIntentDetection,
  recordMemoryLoad,
  recordQwenResponse,
  recordMcpSearch,
  recordFormatting,
  recordTotal
} from "../services/core/performance.service.mjs";
import { routeIntent }              from "../agent/intentRouter.mjs";
import { getRecentHistory, addMessage } from "../services/memory/chatMemory.service.mjs";
import { formatRecommendations }    from "../utils/formatters/recommendationFormatter.js";
import { getShoppingContext, updateMemory } from "../agent/memoryManager.mjs";
import { saveMessage }              from "../services/memory/conversation.service.mjs";
import { checkAndTriggerSummarization } from "../services/memory/memory.service.mjs";
import { buildPersonalizedContext, shouldUseMemory, getMessageIntent } from "../memory/contextEngine.mjs";
import { memoryExtractor }          from "../memory/memoryExtractor.mjs";
import { mergeToProfile }           from "../memory/memoryStore.mjs";
import { shouldBypassQwen, getFastPathType } from "../agent/fastPathRouter.mjs";
import { getContext }               from "../services/core/logger.service.mjs";
import { cacheService }             from "../cache/cacheService.mjs";
import { localDetectLanguage, detectLanguageFromHistory } from "../utils/language.utils.mjs";
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
  logRequestFooter,
  logCacheHit,
  logBackground,
  logError,
} from "../utils/velora.console.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// CHAT CONTROLLER  — with live step-by-step terminal logging
// ─────────────────────────────────────────────────────────────────────────────
export const chat = async (req, res) => {
  const requestStart = Date.now();
  const context = getContext();

  let logs = [];
  let intentLabel = "—";
  let providerUsed  = "";

  try {
    const { message, commerceState } = req.body;
    const sessionId = req.headers["x-session-id"] || req.body.sessionId || "default";

    // ── Validate ─────────────────────────────────────────────────────────────
    if (!message || typeof message !== "string" || message.trim() === "") {
      return res.status(400).json({ success: false, message: "Message is required." });
    }

    // ── Cart state update (non-blocking, silent) ──────────────────────────────
    if (commerceState) {
      const { cart, wishlist, saved } = commerceState;
      let cartSummary = "Current Cart is empty.";
      if (cart?.length > 0) {
        const itemsText = cart.map(i => `${i.quantity}x ${i.name} - Rs.${i.price}`).join("\n");
        const total = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
        cartSummary = `Current Cart:\n${itemsText}\n\nTotal:\nRs.${total}`;
      }
      updateMemory(sessionId, { cart: cart||[], wishlist: wishlist||[], savedProducts: saved||[], cartSummary });
    }

    // ── Step 1: Log incoming message ───────────────────────────────────────────
    // Language detection is now handled natively by Gemini via the system prompt.
    // We still do a quick Unicode check for logging purposes only.
    const logLang = localDetectLanguage(message);
    logIncomingMessage(sessionId, message, logLang);
    logStepDone("Language detected", logLang === "si" ? "Sinhala" : logLang === "ta" ? "Tamil" : "English");

    // ── Step 2: Persist user message (background) ─────────────────────────────
    saveMessage(sessionId, "user", message).catch(() => {});

    // ── Step 3: Memory extraction (background) ────────────────────────────────
    const extracted = memoryExtractor.extractFromText(message);
    const hasEntities = extracted.recipients.length || extracted.occasions.length ||
      extracted.budget !== null || extracted.categories.length;
    if (hasEntities) {
      mergeToProfile(sessionId, extracted).catch(() => {});
    }

    // ── Step 4: Direct intent from frontend (fast path) ───────────────────────
    if (req.body.intent) {
      logStepDone("Intent (direct)", req.body.intent);
      intentLabel = req.body.intent;

      setSSEHeaders(res);
      const updateProgress = createProgressUpdater(res, [
        { id: "UNDERSTANDING", title: "Processing request", status: "active", details: [] }
      ]);
      updateProgress("UNDERSTANDING", "completed");

      const history = await getRecentHistory(sessionId);
      const directLang = detectLanguageFromHistory(history);
      const directResult = await routeIntent(req.body.intent, req.body.parameters || {}, sessionId, null, directLang);

      const assistantText = extractText(directResult);
      if (assistantText) {
        saveMessage(sessionId, "assistant", assistantText)
          .then((u) => { if (u) checkAndTriggerSummarization(sessionId, u.messages.length).catch(() => {}); })
          .catch(() => {});
      }
      logRequestFooter(intentLabel, Date.now() - requestStart, "—");
      return sendCompleteAndEnd(res, directResult);
    }

    // ── Step 5: Intent Detection ──────────────────────────────────────────────
    setSSEHeaders(res);
    let parsedIntent = { intent: "general_chat", parameters: {} };

    // Initial SSE progress placeholder
    res.write(`data: ${JSON.stringify({
      type: "progress",
      step: "UNDERSTANDING",
      message: "Understanding request...",
      logs: [{ id: "UNDERSTANDING", title: "Understanding request", status: "active", details: [] }]
    })}\n\n`);

    logStepStart("Intent detection");
    let intentMs = 0;
    try {
      const intentStart = Date.now();
      const intentResult = await detectIntent(message);
      intentMs = Date.now() - intentStart;
      recordIntentDetection(intentMs);

      // Strip markdown code fences Gemini sometimes adds (```json ... ```)
      const cleanIntent = intentResult
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/,   "")
        .trim();

      parsedIntent = JSON.parse(cleanIntent);
      intentLabel = parsedIntent.intent;
      logStepDone("Intent detection", `${parsedIntent.intent}  (${intentMs}ms)`);
    } catch (parseErr) {
      logStepError("Intent detection", parseErr.message);
      parsedIntent = { intent: "general_chat", parameters: {} };
    }

    const isFastPath = shouldBypassQwen(parsedIntent.intent, message);
    let intentType = parsedIntent.intent;
    if (intentType === "general_chat") intentType = getMessageIntent(message, intentType);
    else if (intentType === "search_products" || intentType === "get_product_details") intentType = "product_search";
    else if (intentType === "check_delivery") intentType = "delivery_queries";

    // ── Step 6: Memory load ───────────────────────────────────────────────────
    logStepStart("Memory retrieval");
    let memoryContext = "";
    const memoryStart = Date.now();
    if (shouldUseMemory(intentType)) {
      memoryContext = await buildPersonalizedContext(sessionId, intentType);
    }
    const memoryMs = Date.now() - memoryStart;
    logStepDone("Memory retrieval", `${memoryContext ? "profile loaded" : "no profile"}  (${memoryMs}ms)`);

    // ── Step 7: Cache check (for product searches) ────────────────────────────
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
      const memory = getShoppingContext(sessionId);

      const llmStart = Date.now();
      result = await chatWithLLM({ message, history, memory, memoryContext });
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
        text = "I found some great options matching your request! Take a look below 😊";
      } else {
        logStepStart("Formatting results");
        text = await formatRecommendations(message, result, history);
        logStepDone("Formatting done", `${result.length} products`);
      }
      await addMessage(sessionId, "assistant", text);
      finalPayload = { type: "product_grid", text, products: result };
    } else if (result?.type) {
      if (result.type === "product_grid") {
        await addMessage(sessionId, "user", message);
        await addMessage(sessionId, "assistant", result.text || "");
      }
      finalPayload = result;
    } else if (typeof result === "string") {
      finalPayload = { type: "text", text: result };
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
            checkAndTriggerSummarization(sessionId, u.messages.length).catch(() => {});
          }
        })
        .catch(() => {});
    }

    // ── Final console summary ─────────────────────────────────────────────────
    logRequestFooter(intentLabel, Date.now() - requestStart, providerUsed);

    return sendCompleteAndEnd(res, finalPayload);

  } catch (error) {
    logError("CHAT", `Unhandled error — ${error.message}`);
    return sendErrorAndEnd(res, logs, error.message || "Internal Server Error");
  }
};
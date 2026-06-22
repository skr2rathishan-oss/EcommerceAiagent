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
import { getShoppingContext, updateMemory } from "../agent/memoryManager.mjs";
import { saveMessage } from "../services/memory/conversation.service.mjs";
import { checkAndTriggerSummarization } from "../services/memory/memory.service.mjs";
import { buildPersonalizedContext, shouldUseMemory, getMessageIntent } from "../memory/contextEngine.mjs";
import { memoryExtractor } from "../memory/memoryExtractor.mjs";
import { mergeToProfile } from "../memory/memoryStore.mjs";
import { shouldBypassQwen, getFastPathType } from "../agent/fastPathRouter.mjs";
import { getContext } from "../services/core/logger.service.mjs";
import { cacheService } from "../cache/cacheService.mjs";
import { extractContext as localExtractContext } from "../ai/context/contextExtractor.mjs";
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
  logContextExtracted,
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
      const { cart, wishlist, saved } = commerceState;
      let cartSummary = "Current Cart is empty.";
      if (cart?.length > 0) {
        const itemsText = cart.map(i => `${i.quantity}x ${i.name} - Rs.${i.price}`).join("\n");
        const total = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
        cartSummary = `Current Cart:\n${itemsText}\n\nTotal:\nRs.${total}`;
      }
      updateMemory(sessionId, { cart: cart || [], wishlist: wishlist || [], savedProducts: saved || [], cartSummary });
    }

    // ── Step 1: Log incoming message ───────────────────────────────────────────
    // Language detection is now handled natively by Gemini via the system prompt.
    // We still do a quick Unicode check for logging purposes only.
    const logLang = localDetectLanguage(message);
    logIncomingMessage(sessionId, message, logLang);
    logStepDone("Language detected", logLang === "si" ? "Sinhala" : logLang === "ta" ? "Tamil" : "English");

    // ── Step 2: Persist user message (background) ─────────────────────────────
    saveMessage(sessionId, "user", message).catch(() => { });

    // ── Step 3: Memory extraction (background) ────────────────────────────────
    const extracted = memoryExtractor.extractFromText(message);
    const hasEntities = extracted.recipients.length || extracted.occasions.length ||
      extracted.budget !== null || extracted.categories.length;
    if (hasEntities) {
      mergeToProfile(sessionId, extracted).catch(() => { });
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
          .then((u) => { if (u) checkAndTriggerSummarization(sessionId, u.messages.length).catch(() => { }); })
          .catch(() => { });
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
        .replace(/```\s*$/, "")
        .trim();

      parsedIntent = JSON.parse(cleanIntent);
      intentLabel = parsedIntent.intent;
      logStepDone("Intent detection", `${parsedIntent.intent}  (${intentMs}ms)`);
    } catch (parseErr) {
      logStepError("Intent detection", parseErr.message);
      parsedIntent = { intent: "general_chat", parameters: {} };
    }

    // ── Step 5b: Context Extraction ───────────────────────────────────────────
    logStepStart("Context extraction");

    // Update frontend UI that we are extracting context
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
      
      // Merge deterministic local pattern-based context
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

      // Build detail tags from extracted context for the SSE UI
      const ctxDetails = [];
      if (extractedContext.conversationLanguage) ctxDetails.push(`Language: ${extractedContext.conversationLanguage}`);
      if (extractedContext.recipient) ctxDetails.push(`Recipient: ${extractedContext.recipient}`);
      if (extractedContext.occasion) ctxDetails.push(`Occasion: ${extractedContext.occasion}`);
      if (extractedContext.budget) ctxDetails.push(`Budget: Rs.${extractedContext.budget}`);
      if (extractedContext.productType) ctxDetails.push(`Product: ${extractedContext.productType}`);
      if (extractedContext.deliveryLocation) ctxDetails.push(`Location: ${extractedContext.deliveryLocation}`);
      if (extractedContext.urgency) ctxDetails.push(`Urgency: ${extractedContext.urgency}`);

      // Tell the frontend that context extraction is done
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

      // Merge into parsedIntent
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
      // Still notify frontend to move on
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
      const memory = {
        ...getShoppingContext(sessionId),
        ...(extractedContext || {})
      };

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
            checkAndTriggerSummarization(sessionId, u.messages.length).catch(() => { });
          }
        })
        .catch(() => { });
    }

    // ── Final console summary ─────────────────────────────────────────────────
    logRequestFooter(intentLabel, Date.now() - requestStart, providerUsed);

    return sendCompleteAndEnd(res, finalPayload);

  } catch (error) {
    logError("CHAT", `Unhandled error — ${error.message}`);
    return sendErrorAndEnd(res, logs, error.message || "Internal Server Error");
  }
};
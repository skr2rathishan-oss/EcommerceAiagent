import { detectIntent, chatWithLLM } from "../services/llm.service.mjs";
import { routeIntent } from "../agent/intentRouter.mjs";
import { getRecentHistory, addMessage } from "../services/chatMemory.service.mjs";

export const chat = async (req, res) => {
  try {
    const { message } = req.body;

    // Resolve session ID from header, body, or fall back to a default key
    const sessionId = req.headers["x-session-id"] || req.body.sessionId || "default";

    // ── Direct-intent fast path ───────────────────────────────────────────
    // When the frontend sends an explicit `intent` field (e.g. for product
    // selection or detail fetch), skip LLM detection and route directly.
    // This avoids wasting tokens and keeps product interactions snappy.
    if (req.body.intent) {
      console.log("[CONTROLLER] Direct intent from frontend:", req.body.intent);
      const directParameters = {
        ...(req.body.parameters || {}),
        ...(req.body.product   ? { product:   req.body.product   } : {}),
        ...(req.body.productId ? { productId: req.body.productId } : {}),
      };
      const directResult = await routeIntent(req.body.intent, directParameters, sessionId);
      console.log("[CONTROLLER] Direct intent result type:", directResult?.type);
      return res.json(directResult);
    }
    // ─────────────────────────────────────────────────────────────────────

    // TEMP DEBUG LOG - SAFE TO REMOVE LATER
    console.log("\n==================================================");
    console.log("[REQUEST] Incoming chat request");
    console.log("[REQUEST] Session ID:", sessionId);
    console.log("[REQUEST] User message:", message);
    console.log("[REQUEST] Timestamp:", new Date().toISOString());
    console.log("==================================================");

    if (!message || typeof message !== "string" || message.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Message is required and must be a non-empty string."
      });
    }

    let intentResult;
    let parsedIntent = { intent: "general_chat", parameters: {} };

    try {
      // TEMP DEBUG LOG - SAFE TO REMOVE LATER
      console.log("[INTENT] Detecting intent for message:", message);
      const intentStart = Date.now();

      intentResult = await detectIntent(message);

      // TEMP DEBUG LOG - SAFE TO REMOVE LATER
      console.log("[INTENT] Raw intent result:", intentResult);
      console.log("[INTENT] Intent detection time:", Date.now() - intentStart, "ms");

      parsedIntent = JSON.parse(intentResult);

      // TEMP DEBUG LOG - SAFE TO REMOVE LATER
      console.log("[INTENT] Parsed intent:", JSON.stringify(parsedIntent, null, 2));
    } catch (parseErr) {
      console.warn("Failed to parse intent JSON, falling back to general chat:", parseErr);
      // TEMP DEBUG LOG - SAFE TO REMOVE LATER
      console.log("[INTENT] Falling back to general_chat intent");
      parsedIntent = { intent: "general_chat", parameters: {} };
    }

    // TEMP DEBUG LOG - SAFE TO REMOVE LATER
    console.log("[CONTROLLER] Routing to intent:", parsedIntent.intent);

    let result;
    if (parsedIntent.intent === "general_chat") {
      // Load the most recent conversation history for this session
      const history = getRecentHistory(sessionId);

      // TEMP DEBUG LOG - SAFE TO REMOVE LATER
      console.log("[CHAT MEMORY] Session ID:", sessionId);
      console.log("[CHAT MEMORY] History length (before this turn):", history.length);
      console.log("[CHAT MEMORY] Recent history:", JSON.stringify(history, null, 2));

      // Persist the user's message before calling the LLM
      addMessage(sessionId, "user", message);

      // TEMP DEBUG LOG - SAFE TO REMOVE LATER
      console.log("[LLM REQUEST] Sending to LLM...");
      console.log("[LLM REQUEST] User message:", message);
      console.log("[LLM REQUEST] History being sent:", JSON.stringify(history, null, 2));
      const llmStart = Date.now();

      // Call LLM with full conversation history
      result = await chatWithLLM({ message, history });

      // TEMP DEBUG LOG - SAFE TO REMOVE LATER
      console.log("[LLM RESPONSE] Time taken:", Date.now() - llmStart, "ms");
      console.log("[LLM RESPONSE] Result type:", typeof result);
      console.log("[LLM RESPONSE] Response:", result);

      // Persist the assistant's reply (only when we get a valid string back)
      if (typeof result === "string") {
        addMessage(sessionId, "assistant", result);
        // TEMP DEBUG LOG - SAFE TO REMOVE LATER
        console.log("[CHAT MEMORY] Saved assistant reply to session:", sessionId);
      }
    } else {
      // TEMP DEBUG LOG - SAFE TO REMOVE LATER
      console.log("[CONTROLLER] Routing to intentRouter, intent:", parsedIntent.intent);
      console.log("[CONTROLLER] Intent parameters:", JSON.stringify(parsedIntent.parameters, null, 2));

      result = await routeIntent(
        parsedIntent.intent,
        parsedIntent.parameters,
        sessionId
      );

      // TEMP DEBUG LOG - SAFE TO REMOVE LATER
      console.log("[CONTROLLER] routeIntent result:", JSON.stringify(result, null, 2));
    }
    console.log("Final Result:", result);

    if (result && typeof result === "object" && result.error) {
      return res.status(500).json({
        success: false,
        message: result.message
      });
    }

    // Format the response correctly for the frontend:
    // 1. If result is an array (e.g. products list from search_products), return it directly
    if (Array.isArray(result)) {
      // TEMP DEBUG LOG - SAFE TO REMOVE LATER
      console.log("[FINAL RESPONSE] Sending product array, count:", result.length);
      return res.json(result);
    }

    // 2. If result is a structured object with a type (e.g. order_tracking), return it directly
    if (result && typeof result === "object" && result.type) {
      // TEMP DEBUG LOG - SAFE TO REMOVE LATER
      console.log("[FINAL RESPONSE] Sending structured object, type:", result.type);
      console.log("[FINAL RESPONSE] Payload:", JSON.stringify(result, null, 2));
      return res.json(result);
    }

    // 3. If result is a string, wrap it in a text response structure for the frontend
    if (typeof result === "string") {
      // TEMP DEBUG LOG - SAFE TO REMOVE LATER
      console.log("[FINAL RESPONSE] Sending text response:", result);
      return res.json({
        type: "text",
        text: result
      });
    }

    // TEMP DEBUG LOG - SAFE TO REMOVE LATER
    console.log("[FINAL RESPONSE] Sending raw result:", JSON.stringify(result, null, 2));
    return res.json(result);

  } catch (error) {
    // TEMP DEBUG LOG - SAFE TO REMOVE LATER
    console.error("[ERROR] Unhandled error in chat controller:", error.message);
    console.error("[ERROR] Stack trace:", error.stack);
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
};
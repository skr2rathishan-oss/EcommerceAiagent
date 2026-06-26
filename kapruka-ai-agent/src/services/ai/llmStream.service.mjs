// src/services/ai/llmStream.service.mjs

import { SYSTEM_PROMPT } from "../../agent/systemPrompt.mjs";
import {
  getGeneralChatModel,
  getRecommendationModel,
} from "./modelRouter.mjs";
import logger from "../../utils/logger.mjs";

// Helper to check for Gemini rate limit error
function isRateLimitError(err) {
  const msg = err?.message || "";
  return (
    err?.status === 429 ||
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("quota") ||
    msg.includes("Resource exhausted")
  );
}

/**
 * Helper to handle Gemini streaming with retry on 429.
 */
async function withGeminiStreamRetry(geminiStreamCall, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await geminiStreamCall();
    } catch (err) {
      if (isRateLimitError(err)) {
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s
          logger.warn(`[llmStream] Gemini 429 — retrying stream in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        logger.error("[llmStream] Gemini quota exhausted.");
      }
      throw err;
    }
  }
}

/**
 * Streams the conversational chat response from the LLM.
 *
 * @param {Object} params
 * @param {string} params.message - Current user message
 * @param {Array} params.history - Message history array
 * @param {Object} params.memory - User profile context / cart info
 * @param {string} params.memoryContext - Memory summary text
 * @param {Function} params.onChunk - Callback invoked with each text chunk: (text) => void
 * @returns {Promise<string>} The fully assembled response text.
 */
export const chatWithLLMStream = async ({
  message,
  history = [],
  memory = {},
  memoryContext = "",
  onChunk,
}) => {
  const { client: activeClient, model: selectedModel, provider } = getGeneralChatModel();

  const systemContent = `${SYSTEM_PROMPT}\n\nCustomer Context:\n${JSON.stringify(memory, null, 2)}`;

  let userContent = message;
  if (memoryContext) {
    userContent = `Memory Context:\n${memoryContext}\n\nCurrent User Request:\n${message}`;
  }

  const geminiStreamCall = async () => {
    const contents = [];
    for (const msg of history) {
      if (msg.role === "system") continue;
      const geminiRole = msg.role === "assistant" ? "model" : "user";
      contents.push({ role: geminiRole, parts: [{ text: msg.content }] });
    }
    contents.push({ role: "user", parts: [{ text: userContent }] });

    const responseStream = await activeClient.models.generateContentStream({
      model: selectedModel,
      contents,
      config: {
        systemInstruction: systemContent,
        temperature: 0.8,
        maxOutputTokens: 4096,
      },
    });

    let fullText = "";
    for await (const chunk of responseStream) {
      const text = chunk.text;
      if (text) {
        fullText += text;
        onChunk(text);
      }
    }
    return fullText;
  };

  try {
    return await withGeminiStreamRetry(geminiStreamCall);
  } catch (error) {
    logger.error("chatWithLLMStream failed", { error: error.message, model: selectedModel, provider });
    throw error;
  }
};

/**
 * Streams the formatted recommendation introduction.
 *
 * @param {string} query - User search query
 * @param {Array} products - MCP returned products list
 * @param {Array} history - Message history
 * @param {boolean} voiceMode - If voice dashboard is active
 * @param {Function} onChunk - Callback for each text chunk
 * @returns {Promise<string>} Fully formatted introduction text
 */
export const formatRecommendationsStream = async (query, products, history = [], voiceMode = false, onChunk) => {
  if (!products || products.length === 0) {
    const fallbackText = "I searched but couldn't find any products matching your query.";
    onChunk(fallbackText);
    return fallbackText;
  }

  const voiceInstruction = voiceMode
    ? `\n7. VOICE INTERACTION ENABLED: Since the user is interacting via voice, keep your response extremely brief (exactly 1 short sentence), sound natural as if speaking, and avoid large text blocks so that text-to-speech sounds natural. Do NOT use markdown bold/italic tags like **, and keep the call-to-action minimal or omit it.`
    : "";

  const systemPrompt = `You are a professional luxury shopping concierge. Format your responses with clear spacing and line breaks. Never list or repeat products in text. Detect the customer's language from conversation history and respond in that same language (English, Sinhala, or Tamil).${voiceMode ? " Keep sentences short, conversational, and voice-mode friendly." : ""}`;

  const prompt = `You are Velora, Kapruka's premium AI shopping concierge.
Your task is to generate a short, warm, and highly personalized conversational introduction to be displayed above the product showcase grid for the user's query: "${query}".
 
The conversation history for context:
${JSON.stringify(history.slice(-4), null, 2)}

Please generate a response following these rules strictly:
1. Write a warm, friendly, and professional conversational introduction referencing the user's query or occasion context (e.g., traveling, gifting, birthday, anniversary, budget) from the conversation history if present.
2. Do NOT list any product names, brands, prices, or descriptions in your text response. The products will be displayed in a grid below your response, so listing them here creates duplicate information and a poor experience.
3. Keep the response short and clean:
   - A single personalized introduction paragraph (maximum 2 sentences).
   - A short friendly call-to-action (e.g., "Take a look below and let me know which one catches your eye. 😊").
4. Never mention any technical or system jargon (no "API", "MCP", "database", "results returned", "backend").
5. Use 1-2 suitable emojis naturally (e.g. 🎁, 🎂, 😊).
6. IMPORTANT: Respond in the same language as the customer's most recent message in the conversation history. If the customer wrote in Sinhala or Singlish, respond in Sinhala. If they wrote in Tamil or Tanglish, respond in Tamil. Otherwise respond in English.${voiceInstruction}`;

  const { client: activeClient, model: selectedModel, provider } = getRecommendationModel();

  const geminiStreamCall = async () => {
    const responseStream = await activeClient.models.generateContentStream({
      model: selectedModel,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
        maxOutputTokens: 1000,
      },
    });

    let fullText = "";
    for await (const chunk of responseStream) {
      const text = chunk.text;
      if (text) {
        fullText += text;
        onChunk(text);
      }
    }
    return fullText;
  };

  try {
    return await withGeminiStreamRetry(geminiStreamCall);
  } catch (error) {
    logger.error("Error generating streaming conversational recommendation:", error);
    // Fallback: non-streaming completion
    const fallbackText = "I found a few options that match what you're looking for 😊\n\nTake a look below and let me know which one catches your eye.";
    onChunk(fallbackText);
    return fallbackText;
  }
};

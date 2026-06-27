import { getRecommendationModel, callGeminiSingleTurn } from "../../services/ai/modelRouter.mjs";
import logger from "../../utils/logger.mjs";

/**
 * Formats a conversational product recommendation above the search results grid.
 *
 * @param {string} query - The user's query
 * @param {Array} products - Raw products array from MCP
 * @param {Array} history - Recent conversation history
 * @param {boolean} voiceMode - Whether voice interaction is active
 * @returns {Promise<string>} The formatted conversational recommendation text
 */
export async function formatRecommendations(query, products, history = [], voiceMode = false) {
  if (!products || products.length === 0) {
    return "I searched but couldn't find any products matching your query.";
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

  try {
    const { client, model, provider } = getRecommendationModel();
    
    const text = await callGeminiSingleTurn(client, model, systemPrompt, prompt, {
      temperature: 0.7,
      maxOutputTokens: 1000
    });

    return text.trim();
  } catch (error) {
    logger.error("Error generating conversational recommendation:", error);
    // Fallback: generic English introduction
    return `I found a few options that match what you're looking for 😊\n\nTake a look below and let me know which one catches your eye.`;
  }
}

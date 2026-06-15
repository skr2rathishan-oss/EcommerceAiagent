// RESPONSE FORMATTER
// SAFE TO EXTEND LATER

import OpenAI from "openai";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../../../.env") });

const client = new OpenAI({
    baseURL: "https://integrate.api.nvidia.com/v1",
    apiKey: process.env.NVIDIA_API_KEY,
});

/**
 * Formats a conversational product recommendation above the search results grid.
 *
 * @param {string} query - The user's query
 * @param {Array} products - Raw products array from MCP
 * @param {Array} history - Recent conversation history
 * @returns {Promise<string>} The formatted conversational recommendation text
 */
export async function formatRecommendations(query, products, history = [], detectedLang = "en") {
  if (!products || products.length === 0) {
    if (detectedLang === "ta") {
      return "உங்கள் வினவலுக்குப் பொருத்தமான தயாரிப்புகள் எதையும் என்னால் கண்டுபிடிக்க முடியவில்லை.";
    } else if (detectedLang === "si") {
      return "ඔබගේ ඉල්ලීමට ගැලපෙන කිසිදු නිෂ්පාදනයක් සොයා ගැනීමට මට නොහැකි විය.";
    }
    return "I searched but couldn't find any products matching your query.";
  }

  let langInstruction = "";
  if (detectedLang === "ta") {
    langInstruction = "\n\nCRITICAL LANGUAGE RULE:\n- The customer is speaking in Tamil. You MUST respond ONLY in Tamil. Do not translate or write in English.";
  } else if (detectedLang === "si") {
    langInstruction = "\n\nCRITICAL LANGUAGE RULE:\n- The customer is speaking in Sinhala. You MUST respond ONLY in Sinhala. Do not translate or write in English.";
  } else {
    langInstruction = "\n\nCRITICAL LANGUAGE RULE:\n- The customer is speaking in English. You MUST respond ONLY in English.";
  }

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
5. Use 1-2 suitable emojis naturally (e.g. 🎁, 🎂, 😊).`;

  try {
    const completion = await client.chat.completions.create({
      model: process.env.NVIDIA_MODEL || "qwen/qwen3.5-122b-a10b",
      temperature: 0.7,
      max_tokens: 200,
      messages: [
        {
          role: "system",
          content: `You are a professional luxury shopping concierge. Format your responses with clear spacing and line breaks. Never list or repeat products in text.${langInstruction}`
        },
        {
          role: "user",
          content: prompt
        }
      ]
    });

    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error("Error generating conversational recommendation:", error);
    // Fallback: generate a basic introduction locally
    if (detectedLang === "ta") {
      return "உங்கள் கோரிக்கைக்குப் பொருத்தமான சில தயாரிப்புகளை நான் கண்டறிந்துள்ளேன் 😊\n\nகீழே பார்த்து, உங்கள் கவனத்தை ஈர்ப்பது எது என்பதை எனக்குத் தெரியப்படுத்துங்கள்.";
    } else if (detectedLang === "si") {
      return "ඔබගේ ඉල්ලීමට ගැලපෙන නිෂ්පාදන කිහිපයක් මම සොයාගත්තා 😊\n\nපහතින් බලලා ඔබ කැමති එක මොකක්ද කියලා මට කියන්න.";
    }
    return `I found a few options that match what you're looking for 😊\n\nTake a look below and let me know which one catches your eye.`;
  }
}

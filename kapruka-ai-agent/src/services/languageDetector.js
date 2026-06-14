import { GoogleGenAI } from "@google/genai";
import { LANGUAGE_DETECTION_PROMPT } from "../prompts/translationPrompts.js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure env variables are loaded from the root path (.env is two directories up from src/services/)
dotenv.config({ path: resolve(__dirname, "../../.env") });

// Clean API key of any enclosing quotes or whitespace
const rawApiKey = process.env.GEMINI_API_KEY || "";
const apiKey = rawApiKey.replace(/['"]/g, "").trim();

let ai = null;
try {
  if (apiKey) {
    ai = new GoogleGenAI({ apiKey });
  } else {
    console.warn("[LanguageDetector] GEMINI_API_KEY is not defined in process.env.");
  }
} catch (err) {
  console.error("[LanguageDetector] Failed to initialize GoogleGenAI client:", err);
}

const VALID_LANGUAGES = ["en", "si", "ta", "mixed-si", "mixed-ta"];

/**
 * Detects the language of the provided text using Gemini 2.5 Flash.
 * 
 * @param {string} text - The user message to analyze.
 * @returns {Promise<"en" | "si" | "ta" | "mixed-si" | "mixed-ta">} The classified language code.
 */
export async function detectLanguage(text) {
  if (!text || typeof text !== "string" || text.trim() === "") {
    return "en";
  }

  if (!ai) {
    console.warn("[LanguageDetector] GoogleGenAI client not initialized. Defaulting to 'en'.");
    return "en";
  }

  try {
    const prompt = LANGUAGE_DETECTION_PROMPT(text);
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const code = response.text ? response.text.trim().toLowerCase() : "en";
    
    if (VALID_LANGUAGES.includes(code)) {
      return code;
    }
    
    // In case model returns extra characters or formatting, try to match using substring
    for (const validLang of VALID_LANGUAGES) {
      if (code.includes(validLang)) {
        return validLang;
      }
    }

    console.warn(`[LanguageDetector] Model returned invalid language code: "${code}". Defaulting to 'en'.`);
    return "en";
  } catch (error) {
    console.error("[LanguageDetector] Language detection failed:", error);
    return "en";
  }
}

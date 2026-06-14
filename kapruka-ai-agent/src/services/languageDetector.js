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
 * Local heuristic to determine if text is likely English to skip calling Gemini.
 * Returns true if text contains only Latin characters and no common local slang/Singlish/Tanglish terms.
 * 
 * @param {string} text 
 * @returns {boolean}
 */
export function isLikelyEnglish(text) {
  if (!text || typeof text !== "string") {
    return true;
  }
  const cleaned = text.toLowerCase().trim();

  // 1. If it contains Sinhala Unicode (U+0D80 to U+0DFF) or Tamil Unicode (U+0B80 to U+0BFF) characters, it is NOT English
  const hasSinhalaOrTamil = /[\u0D80-\u0DFF\u0B80-\u0BFF]/.test(text);
  if (hasSinhalaOrTamil) {
    return false;
  }

  // 2. Check for common Singlish / Tanglish words (Romanized Sinhala/Tamil)
  const mixedKeywords = [
    "eka", "thiyenawada", "thiyeda", "nadda", "ganna", "oone", "ooni", "ow", "naa", "ne",
    "iruka", "venum", "enaku", "siri", "panna", "iruku", "illai", "kuda", "enna", "epadi",
    "mokakda", "kohomada", "denna", "karanna", "epako", "ane", "machan", "hondata", "lassana",
    "dapan", "danna", "hoda", "thiyenawa", "gannath", "kiyada"
  ];

  const words = cleaned.split(/\s+/);
  const hasMixedKeyword = words.some(word => {
    const cleanWord = word.replace(/[^a-z]/g, "");
    return mixedKeywords.includes(cleanWord);
  });
  if (hasMixedKeyword) {
    return false;
  }

  // 3. Check if it contains common English words to confirm it's English
  const englishKeywords = [
    "the", "be", "to", "of", "and", "a", "in", "that", "have", "i", "it", "for", "not", "on", "with",
    "you", "do", "at", "this", "but", "from", "they", "we", "say", "or", "an", "will", "my", "one",
    "all", "would", "there", "their", "what", "so", "if", "who", "get", "go", "me", "when", "can",
    "like", "time", "no", "just", "know", "take", "your", "good", "some", "them", "see", "other",
    "then", "now", "look", "only", "come", "its", "over", "think", "also", "back", "how", "our",
    "well", "way", "even", "new", "want", "any", "these", "give", "us", "buy", "cake", "flower",
    "gift", "delivery", "order", "price", "budget", "show", "search", "track", "cart", "checkout", "help",
    "hello", "hi", "hey", "thanks", "please"
  ];

  const hasEnglishKeyword = words.some(word => {
    const cleanWord = word.replace(/[^a-z]/g, "");
    return englishKeywords.includes(cleanWord);
  });

  return hasEnglishKeyword;
}

/**
 * Runs a promise with a timeout. If it times out, returns the default value.
 */
async function withTimeout(promise, ms, defaultValue) {
  let timeoutId;
  const timeoutPromise = new Promise((resolve) => {
    timeoutId = setTimeout(() => {
      console.warn(`[LanguageDetector] Operation timed out after ${ms}ms. Defaulting to:`, defaultValue);
      resolve(defaultValue);
    }, ms);
  });
  return Promise.race([
    promise.then((val) => {
      clearTimeout(timeoutId);
      return val;
    }),
    timeoutPromise
  ]);
}

/**
 * Detects the language of the provided text using Gemini 2.5 Flash.
 * If language is likely English or Gemini is unavailable/fails/times out, defaults to "en".
 * 
 * @param {string} text - The user message to analyze.
 * @returns {Promise<"en" | "si" | "ta" | "mixed-si" | "mixed-ta">} The classified language code.
 */
export async function detectLanguage(text) {
  if (!text || typeof text !== "string" || text.trim() === "") {
    return "en";
  }

  // Heuristic: If it's likely English, bypass Gemini completely
  if (isLikelyEnglish(text)) {
    return "en";
  }

  if (!ai) {
    console.warn("[LanguageDetector] GoogleGenAI client not initialized. Defaulting to 'en'.");
    return "en";
  }

  try {
    const prompt = LANGUAGE_DETECTION_PROMPT(text);
    
    // Wrap Gemini call with a 2000ms timeout
    const geminiCall = ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const response = await withTimeout(geminiCall, 2000, null);

    if (!response || !response.text) {
      console.warn("[LanguageDetector] No response or timeout from Gemini. Defaulting to 'en'.");
      return "en";
    }

    const code = response.text.trim().toLowerCase();
    
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

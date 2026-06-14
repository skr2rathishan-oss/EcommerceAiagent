import { GoogleGenAI } from "@google/genai";
import {
  TRANSLATE_TO_ENGLISH,
  TRANSLATE_TO_SINHALA,
  TRANSLATE_TO_TAMIL,
} from "../prompts/translationPrompts.js";
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
    console.warn("[TranslationService] GEMINI_API_KEY is not defined in process.env.");
  }
} catch (err) {
  console.error("[TranslationService] Failed to initialize GoogleGenAI client:", err);
}

/**
 * Runs a promise with a timeout. If it times out, returns the default value.
 */
async function withTimeout(promise, ms, defaultValue) {
  let timeoutId;
  const timeoutPromise = new Promise((resolve) => {
    timeoutId = setTimeout(() => {
      console.warn(`[TranslationService] Operation timed out after ${ms}ms. Returning original text.`);
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
 * Translates Sinhala, Tamil, Tanglish, or mixed shopping requests into English.
 * 
 * @param {string} text - The input text to translate to English.
 * @returns {Promise<string>} The translated English text, or the original text on failure.
 */
export async function translateToEnglish(text) {
  if (!text || typeof text !== "string" || text.trim() === "") {
    return text;
  }

  if (!ai) {
    console.warn("[TranslationService] GoogleGenAI client not initialized. Returning original text.");
    return text;
  }

  try {
    const prompt = TRANSLATE_TO_ENGLISH(text);
    const geminiCall = ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const response = await withTimeout(geminiCall, 2500, null);

    if (response && response.text) {
      return response.text.trim();
    }
    return text;
  } catch (error) {
    console.error(`[TranslationService] Failed to translate to English:`, error);
    return text;
  }
}

/**
 * Localizes English shopping responses into natural conversational Sinhala.
 * 
 * @param {string} text - The English text to translate to Sinhala.
 * @returns {Promise<string>} The translated Sinhala text, or the original text on failure.
 */
export async function translateToSinhala(text) {
  if (!text || typeof text !== "string" || text.trim() === "") {
    return text;
  }

  if (!ai) {
    console.warn("[TranslationService] GoogleGenAI client not initialized. Returning original text.");
    return text;
  }

  try {
    const prompt = TRANSLATE_TO_SINHALA(text);
    const geminiCall = ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const response = await withTimeout(geminiCall, 2500, null);

    if (response && response.text) {
      return response.text.trim();
    }
    return text;
  } catch (error) {
    console.error(`[TranslationService] Failed to translate to Sinhala:`, error);
    return text;
  }
}

/**
 * Localizes English shopping responses into natural everyday Sri Lankan Tamil.
 * 
 * @param {string} text - The English text to translate to Tamil.
 * @returns {Promise<string>} The translated Tamil text, or the original text on failure.
 */
export async function translateToTamil(text) {
  if (!text || typeof text !== "string" || text.trim() === "") {
    return text;
  }

  if (!ai) {
    console.warn("[TranslationService] GoogleGenAI client not initialized. Returning original text.");
    return text;
  }

  try {
    const prompt = TRANSLATE_TO_TAMIL(text);
    const geminiCall = ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const response = await withTimeout(geminiCall, 2500, null);

    if (response && response.text) {
      return response.text.trim();
    }
    return text;
  } catch (error) {
    console.error(`[TranslationService] Failed to translate to Tamil:`, error);
    return text;
  }
}

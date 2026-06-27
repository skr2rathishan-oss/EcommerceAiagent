// ─────────────────────────────────────────────────────────────────────────────
// src/services/ai/modelRouter.mjs
//
// Reads AI_MODE from .env (or runtime override) and returns the correct
// client + model for each role.
//
// All model selection flows through this file — nothing is hardcoded elsewhere.
//
// Usage:
//   import { getGeneralChatModel, getIntentModel, ... } from "../ai/modelRouter.mjs";
//   const { client, model, provider } = getGeneralChatModel();
// ─────────────────────────────────────────────────────────────────────────────

import "../../config/loadEnv.mjs";
import { GoogleGenAI } from "@google/genai";
import { getActiveEnvironment, setRuntimeMode, clearRuntimeMode } from "../../config/aiEnvironment.mjs";
import logger from "../../utils/logger.mjs";

let _geminiClient = null;

/** Lazily created — only required when AI_MODE uses Gemini providers. */
export function getGeminiClient() {
  if (_geminiClient) return _geminiClient;

  const project = process.env.GOOGLE_CLOUD_PROJECT;
  if (!project) {
    throw new Error(
      "[ModelRouter] GOOGLE_CLOUD_PROJECT is not set. Required for Gemini AI."
    );
  }

  _geminiClient = new GoogleGenAI({
    vertexai: {
      project,
      location: process.env.GOOGLE_CLOUD_LOCATION || "global",
    }
  });
  return _geminiClient;
}

// ── Provider → Client resolution ──────────────────────────────────────────────

function resolveClient(provider, role) {
  // We only use Gemini now.
  return getGeminiClient();
}

// ── Role Getters ──────────────────────────────────────────────────────────────

/**
 * Returns { client, model, provider, displayName, mode } for the given role.
 * @param {"generalChat"|"recommendations"|"intentDetect"|"deliveryRecovery"|"checkout"|"summary"} role
 */
function getModelForRole(role) {
  const { mode, config } = getActiveEnvironment();
  const roleConfig = config[role];

  if (!roleConfig) {
    throw new Error(`[ModelRouter] Unknown role: "${role}"`);
  }

  return {
    client:      resolveClient(roleConfig.provider, role),
    model:       roleConfig.model,
    provider:    roleConfig.provider,
    displayName: roleConfig.displayName,
    mode,
  };
}

export const getGeneralChatModel    = () => getModelForRole("generalChat");
export const getRecommendationModel = () => getModelForRole("recommendations");
export const getIntentModel         = () => getModelForRole("intentDetect");
export const getContextExtractorModel = () => getModelForRole("contextExtractor");
export const getDeliveryModel       = () => getModelForRole("deliveryRecovery");
export const getCheckoutModel       = () => getModelForRole("checkout");
export const getSummaryModel        = () => getModelForRole("summary");

// ── Runtime mode management (forwarded from aiEnvironment) ────────────────────
export { setRuntimeMode, clearRuntimeMode };

// ── Retry + Fallback Helpers ──────────────────────────────────────────────────

/**
 * Returns true if the error is a Gemini quota/rate-limit error (HTTP 429).
 */
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
 * Retries a Gemini call up to maxRetries times with exponential backoff.
 *
 * @param {Function} geminiCall   - async () => string
 * @param {number}   maxRetries   - default 2
 * @returns {Promise<string>}
 */
async function withGeminiRetry(geminiCall, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await geminiCall();
    } catch (err) {
      if (isRateLimitError(err)) {
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s
          logger.warn(`[ModelRouter] Gemini 429 — retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        logger.error("[ModelRouter] Gemini quota exhausted after retries.");
      }
      throw err; // Non-429 error or exhausted retries — re-throw
    }
  }
}

const LLM_TIMEOUT_MS = parseInt(process.env.LLM_TIMEOUT_MS || "60000", 10);

/**
 * Rejects if the wrapped promise does not settle within `ms`.
 */
export function withTimeout(promise, ms = LLM_TIMEOUT_MS, label = "LLM request") {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]);
}

// ── Environment summary (for startup banner & admin API) ──────────────────────
export function getEnvironmentSummary() {
  const { mode, config } = getActiveEnvironment();
  return {
    mode,
    label:  config.label,
    badge:  config.badge,
    models: {
      generalChat:      config.generalChat.displayName,
      recommendations:  config.recommendations.displayName,
      intentDetect:     config.intentDetect.displayName,
      contextExtractor: config.contextExtractor.displayName,
      deliveryRecovery: config.deliveryRecovery.displayName,
      checkout:         config.checkout.displayName,
      summary:          config.summary.displayName,
    },
    providers: {
      generalChat:      config.generalChat.provider,
      recommendations:  config.recommendations.provider,
      intentDetect:     config.intentDetect.provider,
      contextExtractor: config.contextExtractor.provider,
      deliveryRecovery: config.deliveryRecovery.provider,
      checkout:         config.checkout.provider,
    },
    logging: config.logging,
  };
}

// ── Gemini multi-turn call ────────────────────────────────────────────────────
/**
 * Calls Gemini generateContent with retry.
 *
 * @param {GoogleGenAI}                      client
 * @param {string}                           model
 * @param {string}                           systemPrompt
 * @param {Array<{role: string, content: string}>} messages  - OpenAI-style history
 * @param {string}                           userMessage
 * @returns {Promise<string>} Response text
 */
export async function callGemini(client, model, systemPrompt, messages, userMessage) {
  const contents = [];
  for (const msg of messages) {
    if (msg.role === "system") continue;
    const geminiRole = msg.role === "assistant" ? "model" : "user";
    contents.push({ role: geminiRole, parts: [{ text: msg.content }] });
  }
  contents.push({ role: "user", parts: [{ text: userMessage }] });

  const geminiCall = () => withTimeout(
    client.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: systemPrompt,
        temperature:       0.8,
        maxOutputTokens:   4096,
      },
    }),
    LLM_TIMEOUT_MS,
    "Gemini chat"
  ).then(r => r.text);

  return withGeminiRetry(geminiCall);
}

// ── Gemini single-turn call (intent detection, summaries, insights) ────────────
/**
 * Calls Gemini single-turn with retry.
 *
 * @param {GoogleGenAI} client
 * @param {string}      model
 * @param {string}      systemPrompt
 * @param {string}      userPrompt
 * @param {Object}      options  - { temperature, maxOutputTokens }
 * @returns {Promise<string>}
 */
export async function callGeminiSingleTurn(client, model, systemPrompt, userPrompt, options = {}) {
  const geminiCall = () => withTimeout(
    client.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction: systemPrompt,
        temperature:       options.temperature    ?? 0,
        maxOutputTokens:   options.maxOutputTokens ?? 1000,
      },
    }),
    LLM_TIMEOUT_MS,
    "Gemini single-turn"
  ).then(r => r.text);

  return withGeminiRetry(geminiCall);
}

// ─────────────────────────────────────────────────────────────────────────────
// src/services/modelRouter.mjs
//
// Reads AI_MODE from .env (or runtime override) and returns the correct
// client + model for each role.
//
// All model selection flows through this file — nothing is hardcoded elsewhere.
//
// Usage:
//   import { getGeneralChatModel, getIntentModel, ... } from "./modelRouter.mjs";
//   const { client, model, provider } = getGeneralChatModel();
// ─────────────────────────────────────────────────────────────────────────────

import "../config/loadEnv.mjs";
import OpenAI        from "openai";
import { GoogleGenAI } from "@google/genai";
import { getActiveEnvironment, setRuntimeMode, clearRuntimeMode } from "../config/aiEnvironment.mjs";

// ── Client Singletons ─────────────────────────────────────────────────────────
// One instance per external provider — reused across requests.

const nvidiaApiKey = process.env.NVIDIA_API_KEY;
const generalChatApiKey = process.env.GENERAL_CHAT_API_KEY || nvidiaApiKey;

if (!nvidiaApiKey) {
  throw new Error(
    "[ModelRouter] NVIDIA_API_KEY is not set. Copy kapruka-ai-agent/.env.example to .env and add your NVIDIA API key."
  );
}

const nvidiaClient = new OpenAI({
  baseURL: "https://integrate.api.nvidia.com/v1",
  apiKey:  nvidiaApiKey,
});

// Separate NVIDIA key for general-chat quota isolation
const nvidiaGeneralClient = new OpenAI({
  baseURL: "https://integrate.api.nvidia.com/v1",
  apiKey:  generalChatApiKey,
});

let _geminiClient = null;

/** Lazily created — only required when AI_MODE uses Gemini providers. */
export function getGeminiClient() {
  if (_geminiClient) return _geminiClient;

  const project = process.env.GOOGLE_CLOUD_PROJECT;
  if (!project) {
    throw new Error(
      "[ModelRouter] GOOGLE_CLOUD_PROJECT is not set. Required when AI_MODE is staging or production."
    );
  }

  _geminiClient = new GoogleGenAI({
    vertexai: true,
    project,
    location: process.env.GOOGLE_CLOUD_LOCATION || "global",
  });
  return _geminiClient;
}

// ── Provider → Client resolution ──────────────────────────────────────────────

function resolveClient(provider, role) {
  if (provider === "gemini") return getGeminiClient();
  // For NVIDIA: general-chat uses its own quota key
  if (role === "generalChat") return nvidiaGeneralClient;
  return nvidiaClient;
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
export const getDeliveryModel       = () => getModelForRole("deliveryRecovery");
export const getCheckoutModel       = () => getModelForRole("checkout");
export const getSummaryModel        = () => getModelForRole("summary");

// ── Runtime mode management (forwarded from aiEnvironment) ────────────────────
export { setRuntimeMode, clearRuntimeMode };

// ── Raw client exports (for health checks etc.) ───────────────────────────────
export { nvidiaClient, nvidiaGeneralClient };

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
      deliveryRecovery: config.deliveryRecovery.displayName,
      checkout:         config.checkout.displayName,
      summary:          config.summary.displayName,
    },
    providers: {
      generalChat:      config.generalChat.provider,
      recommendations:  config.recommendations.provider,
      intentDetect:     config.intentDetect.provider,
      deliveryRecovery: config.deliveryRecovery.provider,
      checkout:         config.checkout.provider,
    },
    logging: config.logging,
  };
}

// ── Gemini multi-turn call ────────────────────────────────────────────────────
/**
 * Calls Gemini generateContent with a system prompt + OpenAI-style messages array.
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
    if (msg.role === "system") continue; // handled via systemInstruction
    const geminiRole = msg.role === "assistant" ? "model" : "user";
    contents.push({ role: geminiRole, parts: [{ text: msg.content }] });
  }

  contents.push({ role: "user", parts: [{ text: userMessage }] });

  const response = await withTimeout(
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
  );

  return response.text;
}

// ── Gemini single-turn call (intent detection, summaries, insights) ────────────
/**
 * Calls Gemini with a simple single-turn prompt — no conversation history.
 *
 * @param {GoogleGenAI} client
 * @param {string}      model
 * @param {string}      systemPrompt
 * @param {string}      userPrompt
 * @param {Object}      options  - { temperature, maxOutputTokens }
 * @returns {Promise<string>}
 */
export async function callGeminiSingleTurn(client, model, systemPrompt, userPrompt, options = {}) {
  const response = await withTimeout(
    client.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction: systemPrompt,
        temperature:       options.temperature    ?? 0,
        maxOutputTokens:   options.maxOutputTokens ?? 200,
      },
    }),
    LLM_TIMEOUT_MS,
    "Gemini single-turn"
  );

  return response.text;
}

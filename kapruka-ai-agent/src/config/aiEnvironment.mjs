// ─────────────────────────────────────────────────────────────────────────────
// src/config/aiEnvironment.mjs
//
// Single source of truth for all AI environment configurations.
// Add new providers/models here — no other files need to change.
//
// Environments:
//   development  → NVIDIA NIM  (Llama general chat, Qwen for everything else)
//   staging      → Gemini 2.5 Flash (Vertex AI)  — production-like
//   production   → Gemini 2.5 Flash (Vertex AI)  — real users, minimal logging
//
// Controlled via .env:
//   AI_MODE=development | staging | production
// ─────────────────────────────────────────────────────────────────────────────

// ── Gemini Model Identifiers ──────────────────────────────────────────────────
export const GEMINI_MODELS = {
  flash25: "gemini-2.5-flash",
};

// ── Environment Definitions ───────────────────────────────────────────────────
export const AI_ENVIRONMENTS = {

  // ── Development ─────────────────────────────────────────────────────────────
  // Purpose: Local development, feature testing, debugging.
  // Provider: Gemini 2.5 Flash (Vertex AI)
  development: {
    label: "Development",
    badge: "[DEV MODE]",

    generalChat: {
      provider: "gemini",
      model: GEMINI_MODELS.flash25,
      displayName: "Gemini 2.5 Flash (Vertex AI)",
    },
    recommendations: {
      provider: "gemini",
      model: GEMINI_MODELS.flash25,
      displayName: "Gemini 2.5 Flash (Vertex AI)",
    },
    intentDetect: {
      provider: "gemini",
      model: GEMINI_MODELS.flash25,
      displayName: "Gemini 2.5 Flash (Vertex AI)",
    },
    contextExtractor: {
      provider: "gemini",
      model: GEMINI_MODELS.flash25,
      displayName: "Gemini 2.5 Flash (Vertex AI)",
    },
    deliveryRecovery: {
      provider: "gemini",
      model: GEMINI_MODELS.flash25,
      displayName: "Gemini 2.5 Flash (Vertex AI)",
    },
    checkout: {
      provider: "gemini",
      model: GEMINI_MODELS.flash25,
      displayName: "Gemini 2.5 Flash (Vertex AI)",
    },
    summary: {
      provider: "gemini",
      model: GEMINI_MODELS.flash25,
      displayName: "Gemini 2.5 Flash (Vertex AI)",
    },

    logging: {
      verbose: true,
      promptDebug: true,
      toolLogs: true,
      tokenLogs: true,
      consoleTrace: true,
    },
  },
};

// ── Runtime override store ────────────────────────────────────────────────────
let _runtimeMode = null;

/**
 * Overrides the active AI mode at runtime (set by admin API).
 * @param {string|null} mode - "development" or null to clear
 */
export function setRuntimeMode(mode) {
  if (mode === null) {
    _runtimeMode = null;
    return;
  }
  const normalised = mode.toLowerCase().trim();
  if (normalised !== "development") {
    throw new Error(`Only development mode is supported. Valid values: development.`);
  }
  _runtimeMode = normalised;
}

/** Clears the runtime override. */
export function clearRuntimeMode() {
  _runtimeMode = null;
}

/**
 * Returns the active AI environment config.
 * Always resolves to development config since other environments are removed.
 *
 * @returns {{ mode: string, config: Object }}
 */
export function getActiveEnvironment() {
  return { mode: "development", config: AI_ENVIRONMENTS.development };
}

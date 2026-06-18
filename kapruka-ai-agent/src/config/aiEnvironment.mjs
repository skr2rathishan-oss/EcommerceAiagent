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

// ── NVIDIA NIM Model Identifiers ─────────────────────────────────────────────
export const NVIDIA_MODELS = {
  llama: "meta/llama-3.1-8b-instruct",
  qwen: "qwen/qwen3.5-122b-a10b",
  gpt: "openai/gpt-oss-20b",
  nemotron: "nvidia/nemotron-3-nano-30b-a3b",
};

// ── Gemini Model Identifiers ──────────────────────────────────────────────────
export const GEMINI_MODELS = {
  flash25: "gemini-2.5-flash",
};

// ── Environment Definitions ───────────────────────────────────────────────────
export const AI_ENVIRONMENTS = {

  // ── Development ─────────────────────────────────────────────────────────────
  // Purpose: Local development, feature testing, debugging, cost optimisation.
  // Provider: NVIDIA NIM (cheap inference, verbose logging, no Gemini quota usage)
  development: {
    label: "Development",
    badge: "[DEV MODE]",

    generalChat: {
      provider: "nvidia",
      model: NVIDIA_MODELS.llama,
      displayName: "Llama 3.1 8B (NVIDIA NIM)",
    },
    recommendations: {
      provider: "nvidia",
      model: NVIDIA_MODELS.qwen,
      displayName: "Qwen 3.5 122B (NVIDIA NIM)",
    },
    intentDetect: {
      provider: "nvidia",
      model: NVIDIA_MODELS.qwen,
      displayName: "Qwen 3.5 122B (NVIDIA NIM)",
    },
    contextExtractor: {
      provider: "nvidia",
      model: NVIDIA_MODELS.qwen,
      displayName: "Qwen 3.5 122B (NVIDIA NIM)",
    },
    deliveryRecovery: {
      provider: "nvidia",
      model: NVIDIA_MODELS.qwen,
      displayName: "Qwen 3.5 122B (NVIDIA NIM)",
    },
    checkout: {
      provider: "nvidia",
      model: NVIDIA_MODELS.qwen,
      displayName: "Qwen 3.5 122B (NVIDIA NIM)",
    },
    summary: {
      provider: "nvidia",
      model: NVIDIA_MODELS.llama,
      displayName: "Llama 3.1 8B (NVIDIA NIM)",
    },

    logging: {
      verbose: true,
      promptDebug: true,
      toolLogs: true,
      tokenLogs: true,
      consoleTrace: true,
    },
  },

  // ── Staging ──────────────────────────────────────────────────────────────────
  // Purpose: Pre-production testing with production-like Gemini models.
  staging: {
    label: "Staging",
    badge: "[STAGING MODE]",

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
      verbose: false,
      promptDebug: false,
      toolLogs: true,
      tokenLogs: true,
      consoleTrace: false,
    },
  },

  // ── Production ───────────────────────────────────────────────────────────────
  // Purpose: Real users — Kapruka demo & production deployment.
  production: {
    label: "Production",
    badge: "[PRODUCTION MODE]",

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
      verbose: false,
      promptDebug: false,
      toolLogs: false,
      tokenLogs: false,
      consoleTrace: false,
    },
  },
};

// ── Runtime override store ────────────────────────────────────────────────────
// Set by the Admin API to allow hot-switching without a server restart.
let _runtimeMode = null;

/**
 * Overrides the active AI mode at runtime (set by admin API).
 * @param {string|null} mode - "development" | "staging" | "production" | null to clear
 */
export function setRuntimeMode(mode) {
  if (mode === null) {
    _runtimeMode = null;
    return;
  }
  const normalised = mode.toLowerCase().trim();
  if (!AI_ENVIRONMENTS[normalised]) {
    throw new Error(`Unknown AI mode: "${mode}". Valid values: development, staging, production.`);
  }
  _runtimeMode = normalised;
}

/** Clears the runtime override, falling back to the .env AI_MODE value. */
export function clearRuntimeMode() {
  _runtimeMode = null;
}

/**
 * Returns the active AI environment config.
 * Priority: runtime override → AI_MODE env var → "development"
 *
 * @returns {{ mode: string, config: Object }}
 */
export function getActiveEnvironment() {
  const envMode = (process.env.AI_MODE || "development").toLowerCase().trim();
  const mode = _runtimeMode || envMode;

  if (!AI_ENVIRONMENTS[mode]) {
    console.warn(`[AI ENV] Unknown AI_MODE "${mode}". Falling back to "development".`);
    return { mode: "development", config: AI_ENVIRONMENTS.development };
  }

  return { mode, config: AI_ENVIRONMENTS[mode] };
}

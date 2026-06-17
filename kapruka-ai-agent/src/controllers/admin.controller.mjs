import AIMode               from "../database/AIMode.mjs";
import { setRuntimeMode, clearRuntimeMode } from "../services/modelRouter.mjs";
import { AI_ENVIRONMENTS, getActiveEnvironment } from "../config/aiEnvironment.mjs";
import logger                from "../utils/logger.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/ai-mode
// Returns the current AI environment summary, model assignments, and
// provider connection status indicators.
// ─────────────────────────────────────────────────────────────────────────────
export const getAIMode = async (req, res) => {
  try {
    const { mode, config } = getActiveEnvironment();

    // Load persisted setting from MongoDB (for display only)
    const persisted = await AIMode.findOne({ settingKey: "global" }).lean();

    return res.json({
      success: true,
      current: {
        mode,
        label:  config.label,
        badge:  config.badge,
        source: persisted?.mode === mode ? "persisted" : "env_var",
      },
      models: {
        generalChat:      { displayName: config.generalChat.displayName,      provider: config.generalChat.provider,      model: config.generalChat.model      },
        recommendations:  { displayName: config.recommendations.displayName,  provider: config.recommendations.provider,  model: config.recommendations.model  },
        intentDetect:     { displayName: config.intentDetect.displayName,     provider: config.intentDetect.provider,     model: config.intentDetect.model     },
        deliveryRecovery: { displayName: config.deliveryRecovery.displayName, provider: config.deliveryRecovery.provider, model: config.deliveryRecovery.model },
        checkout:         { displayName: config.checkout.displayName,         provider: config.checkout.provider,         model: config.checkout.model         },
        summary:          { displayName: config.summary.displayName,          provider: config.summary.provider,          model: config.summary.model          },
      },
      availableModes: Object.keys(AI_ENVIRONMENTS).map(key => ({
        key,
        label: AI_ENVIRONMENTS[key].label,
        badge: AI_ENVIRONMENTS[key].badge,
        active: key === mode,
      })),
      logging: config.logging,
    });
  } catch (error) {
    logger.error("[Admin] Failed to get AI mode", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to retrieve AI mode configuration." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/ai-mode
// Body: { mode: "development" | "staging" | "production" }
//
// Switches the active AI mode at runtime (no restart needed) and persists
// the selection to MongoDB so it survives future restarts.
// ─────────────────────────────────────────────────────────────────────────────
export const setAIMode = async (req, res) => {
  try {
    const { mode } = req.body;

    if (!mode || typeof mode !== "string") {
      return res.status(400).json({ success: false, message: "mode is required (development | staging | production)." });
    }

    const normalised = mode.toLowerCase().trim();

    if (!AI_ENVIRONMENTS[normalised]) {
      return res.status(400).json({
        success: false,
        message: `Unknown mode "${mode}". Valid values: development, staging, production.`
      });
    }

    // 1. Update runtime override immediately (zero-downtime switch)
    setRuntimeMode(normalised);

    // 2. Persist to MongoDB so restarts retain the setting
    await AIMode.findOneAndUpdate(
      { settingKey: "global" },
      { mode: normalised, updatedBy: req.user?.id || req.headers["x-session-id"] || "admin" },
      { upsert: true, new: true }
    );

    const { config } = getActiveEnvironment();

    logger.info(`[Admin] AI mode switched to "${normalised}"`, {
      previousMode: req.body._prevMode,
      newMode:      normalised,
    });

    return res.json({
      success: true,
      message: `AI mode switched to ${config.label} ${config.badge}`,
      mode:    normalised,
      label:   config.label,
      badge:   config.badge,
      models: {
        generalChat:      config.generalChat.displayName,
        recommendations:  config.recommendations.displayName,
        intentDetect:     config.intentDetect.displayName,
        deliveryRecovery: config.deliveryRecovery.displayName,
        checkout:         config.checkout.displayName,
        summary:          config.summary.displayName,
      },
    });

  } catch (error) {
    logger.error("[Admin] Failed to set AI mode", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to switch AI mode." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/ai-mode/reset
// Clears the runtime override — reverts to the AI_MODE env var.
// ─────────────────────────────────────────────────────────────────────────────
export const resetAIMode = async (req, res) => {
  try {
    clearRuntimeMode();

    // Remove MongoDB override
    await AIMode.deleteOne({ settingKey: "global" });

    const envMode = (process.env.AI_MODE || "development").toLowerCase().trim();
    const { config } = getActiveEnvironment();

    logger.info(`[Admin] AI mode reset to env var: "${envMode}"`);

    return res.json({
      success: true,
      message: `AI mode reset to env var: ${envMode}`,
      mode:    envMode,
      label:   config.label,
    });
  } catch (error) {
    logger.error("[Admin] Failed to reset AI mode", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to reset AI mode." });
  }
};

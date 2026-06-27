import mongoose          from "mongoose";
import fs                from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { cacheService }  from "../../cache/cacheService.mjs";
import { getMcpClient }  from "../integration/mcp.client.mjs";
import { searchProducts }  from "../integration/mcp.service.mjs";
import { listDeliveryCities } from "../commerce/delivery.service.mjs";
import { validateApiKey, getCoordinates, findNearbyLocations } from "../integration/googleMapsService.mjs";
import { ElevenLabsClient } from "elevenlabs";
import {
  getGeminiClient,
  getEnvironmentSummary,
  withTimeout,
} from "../ai/modelRouter.mjs";
import { GEMINI_MODELS, getActiveEnvironment } from "../../config/aiEnvironment.mjs";
import logger from "../../utils/logger.mjs";

// Import Pipeline & Commerce Modules for validation
import { understandConversation } from "../ai/conversationUnderstanding.service.mjs";
import { buildDecision } from "../ai/decisionBuilder.mjs";
import { selectResponse } from "../responseEngine.service.mjs";
import { clearConversationState } from "../commerce/conversationStateService.mjs";
import { memoryManager } from "../memory/memoryManager.service.mjs";
import * as llmStream from "../ai/llmStream.service.mjs";
import * as voiceService from "../media/voiceService.js";

// Commerce Engine components
import { startDeliveryFlow, handleCheckoutConfirmation } from "../commerce/deliveryFlowService.mjs";
import { parseAddress } from "../commerce/addressService.mjs";
import { createOrder } from "../commerce/order.service.mjs";
import { handleDeliveryFailure } from "../commerce/deliveryRecoveryService.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const LIBRARY_ROOT = join(__dirname, "../../ai/context/responseLibrary");

/**
 * Validates the Response Library modules and their JSON templates
 */
export const validateResponseLibrary = () => {
  const status = {
    common: "PASS",
    shopping: "PASS",
    delivery: "PASS",
    order: "PASS",
    recovery: "PASS",
    interruption: "PASS",
    languageTemplates: "PASS"
  };
  const errors = [];
  const modulesToCheck = ["common", "shopping", "delivery", "order", "recovery", "interruption"];

  for (const mod of modulesToCheck) {
    const dirPath = join(LIBRARY_ROOT, mod);
    if (!fs.existsSync(dirPath)) {
      status[mod] = "FAIL";
      errors.push(`Directory missing for module: ${mod}`);
      continue;
    }

    try {
      const files = fs.readdirSync(dirPath).filter(f => f.endsWith(".json"));
      if (files.length === 0) {
        status[mod] = "FAIL";
        errors.push(`No JSON files found in module: ${mod}`);
        continue;
      }

      for (const file of files) {
        const filePath = join(dirPath, file);
        try {
          const content = fs.readFileSync(filePath, "utf-8");
          const parsed = JSON.parse(content);
          
          // Verify language keys exist in JSON values
          for (const key of Object.keys(parsed)) {
            const val = parsed[key];
            if (typeof val === "object" && val !== null) {
              const keys = Object.keys(val);
              const hasLanguage = keys.some(k => ["english", "sinhala_mix", "tamil_mix"].includes(k));
              if (!hasLanguage) {
                status.languageTemplates = "FAIL";
                errors.push(`Language template missing in ${mod}/${file} under key: ${key}`);
              }
            }
          }
        } catch (err) {
          status[mod] = "FAIL";
          errors.push(`Failed to parse ${mod}/${file}: ${err.message}`);
        }
      }
    } catch (err) {
      status[mod] = "FAIL";
      errors.push(`Error reading module ${mod}: ${err.message}`);
    }
  }

  // Check language.utils.mjs existence
  try {
    const langUtilsPath = join(__dirname, "../../utils/language.utils.mjs");
    if (!fs.existsSync(langUtilsPath)) {
      status.languageTemplates = "FAIL";
      errors.push(`Language utility file missing at: ${langUtilsPath}`);
    }
  } catch (err) {
    status.languageTemplates = "FAIL";
    errors.push(`Language utility validation error: ${err.message}`);
  }

  return { status, errors };
};

/**
 * Performs programmatic validation of the Environment Variables
 */
export function validateEnv() {
  const errors = [];
  const warnings = [];

  // Critical
  if (!process.env.GOOGLE_CLOUD_PROJECT) {
    errors.push("Missing critical GOOGLE_CLOUD_PROJECT");
  }
  if (!process.env.MONGO_URI && !process.env.MONGODB_URI) {
    errors.push("Missing critical MONGO_URI / MONGODB_URI");
  }

  // Optional/Warnings
  if (!process.env.GOOGLE_MAPS_API_KEY && !process.env.GOOGLEMAP_API) {
    warnings.push("Missing GOOGLE_MAPS_API_KEY (Google Maps checks will be bypassed)");
  }
  if (!process.env.ELEVENLABS_API_KEY) {
    warnings.push("Missing ELEVENLABS_API_KEY (ElevenLabs voice generation will be skipped)");
  }

  return {
    status: errors.length > 0 ? "FAIL" : "PASS",
    errors,
    warnings
  };
}

/**
 * Validates MongoDB Connection
 */
export async function validateMongoDB() {
  let status = "FAIL";
  let latency = null;
  let errorMsg = "";

  try {
    const t0 = Date.now();
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.admin().ping();
      latency = Date.now() - t0;
      status = "CONNECTED";
    } else {
      errorMsg = "Connection readyState is not active";
    }
  } catch (err) {
    errorMsg = err.message;
  }

  return { status, latency, error: errorMsg };
}

/**
 * Validates Cache & Redis Connection
 */
export async function validateCache() {
  let status = "FAIL";
  let latency = null;
  let detail = "Memory Cache Active";

  try {
    const t0 = Date.now();
    if (cacheService.isConnected()) {
      await cacheService.ping();
      latency = Date.now() - t0;
      status = "CONNECTED";
      detail = cacheService.isRedisActive() ? "Upstash Redis" : "In-Memory Cache";
    } else {
      status = "WARNING";
      detail = "Falling back to memory";
    }
  } catch {
    status = "WARNING";
    detail = "Falling back to memory";
  }

  return { status, latency, detail };
}

/**
 * Validates Gemini API Connection
 */
export async function validateGemini() {
  let status = "FAIL";
  let latency = null;
  let errorMsg = "";

  const gcpProject = process.env.GOOGLE_CLOUD_PROJECT;
  if (!gcpProject) {
    return { status: "FAIL", latency: null, error: "GOOGLE_CLOUD_PROJECT not set" };
  }

  try {
    const geminiClient = getGeminiClient();
    const t0 = Date.now();
    await withTimeout(geminiClient.models.generateContent({
      model: GEMINI_MODELS.flash25 || "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: "ping" }] }],
      config: { maxOutputTokens: 5, temperature: 0 },
    }), 3500, "Gemini check");
    
    latency = Date.now() - t0;
    status = "CONNECTED";
  } catch (err) {
    if (err.message?.includes("429") || err.message?.includes("RESOURCE_EXHAUSTED")) {
      status = "WARNING";
      errorMsg = "Quota limit hit";
    } else {
      status = "FAIL";
      errorMsg = err.message;
    }
  }

  return { status, latency, error: errorMsg };
}

/**
 * Validates MCP Connection
 */
export async function validateMCP() {
  let status = "FAIL";
  let latency = null;
  let errorMsg = "";

  try {
    const t0 = Date.now();
    const mcpClient = await getMcpClient();
    if (mcpClient) {
      latency = Date.now() - t0;
      status = "CONNECTED";
    } else {
      errorMsg = "MCP client is null";
    }
  } catch (err) {
    errorMsg = err.message;
  }

  return { status, latency, error: errorMsg };
}

/**
 * Checks Google Speech API setup
 */
export function validateGoogleSpeech() {
  let status = "FAIL";
  let errorMsg = "";

  try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      status = "CONNECTED";
    } else {
      status = "WARNING";
      errorMsg = "GOOGLE_APPLICATION_CREDENTIALS not set";
    }
  } catch (err) {
    errorMsg = err.message;
  }

  return { status, error: errorMsg };
}

/**
 * Checks ElevenLabs Voice setup
 */
export async function validateElevenLabs() {
  let status = "SKIPPED";
  let errorMsg = "";

  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    return { status: "SKIPPED", error: "ELEVENLABS_API_KEY not set" };
  }

  try {
    const client = new ElevenLabsClient({ apiKey: key });
    await client.voices.getAll();
    status = "CONNECTED";
  } catch (err) {
    status = "WARNING";
    errorMsg = err.message;
  }

  return { status, error: errorMsg };
}

/**
 * Programmatic checks of all Conversation Pipeline functions
 */
export function validateConversationPipeline() {
  const checks = {
    understanding: typeof understandConversation === "function",
    decisionBuilder: typeof buildDecision === "function",
    responseEngine: typeof selectResponse === "function",
    stateManager: typeof clearConversationState === "function",
    memoryManager: typeof memoryManager?.enforceHistoryLimit === "function",
    streamingEngine: typeof llmStream?.streamChatResponse === "function" || typeof llmStream === "object",
    voicePipeline: typeof voiceService?.generateSpeech === "function"
  };

  const allPassed = Object.values(checks).every(Boolean);

  return {
    status: allPassed ? "READY" : "FAILED",
    details: checks
  };
}

/**
 * Programmatic checks of all Commerce Engine functions
 */
export function validateCommerceEngine() {
  const checks = {
    productSearch: typeof searchProducts === "function",
    deliveryFlow: typeof startDeliveryFlow === "function",
    addressService: typeof parseAddress === "function",
    orderFlow: typeof createOrder === "function",
    checkoutFlow: typeof handleCheckoutConfirmation === "function",
    recoveryEngine: typeof handleDeliveryFailure === "function",
    interruptionManager: typeof clearConversationState === "function"
  };

  const allPassed = Object.values(checks).every(Boolean);

  return {
    status: allPassed ? "READY" : "FAILED",
    details: checks
  };
}

/**
 * Main diagnostics orchestrator running all health checks and compiling results.
 */
export const runStartupChecks = async () => {
  logger.info("[STARTUP] Running diagnostics...");

  const results = {
    systemInfo: {
      env: process.env.NODE_ENV || "development",
      version: "2.0.0",
      nodeVersion: process.version,
      platform: `${process.platform} ${process.arch}`,
      port: process.env.PORT || 5000,
      pid: process.pid,
      startTime: new Date().toISOString(),
      uptime: 0
    },
    env: null,
    mongoDB: null,
    cache: null,
    gemini: null,
    mcp: null,
    googleSpeech: null,
    elevenLabs: null,
    responseLibrary: null,
    conversationPipeline: null,
    commerceEngine: null,
    criticalFailures: 0
  };

  // Run health checks
  results.env = validateEnv();
  if (results.env.status === "FAIL") results.criticalFailures++;

  results.mongoDB = await validateMongoDB();
  if (results.mongoDB.status === "FAIL") results.criticalFailures++;

  results.cache = await validateCache();
  // Cache check is warning-only

  results.gemini = await validateGemini();
  if (results.gemini.status === "FAIL") results.criticalFailures++;

  results.mcp = await validateMCP();
  if (results.mcp.status === "FAIL") results.criticalFailures++;

  results.googleSpeech = validateGoogleSpeech();
  results.elevenLabs = await validateElevenLabs();

  results.responseLibrary = validateResponseLibrary();
  const resLibFailed = Object.values(results.responseLibrary.status).some(s => s === "FAIL");
  if (resLibFailed) results.criticalFailures++;

  results.conversationPipeline = validateConversationPipeline();
  if (results.conversationPipeline.status === "FAILED") results.criticalFailures++;

  results.commerceEngine = validateCommerceEngine();
  if (results.commerceEngine.status === "FAILED") results.criticalFailures++;

  logger.info(`[STARTUP] Diagnostics complete. Critical failures: ${results.criticalFailures}`);

  return results;
};

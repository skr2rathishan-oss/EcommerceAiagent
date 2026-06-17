import mongoose          from "mongoose";
import { redisService }  from "./redis.service.mjs";
import { getMcpClient }  from "./mcp.client.mjs";
import { searchProducts }  from "./mcp.service.mjs";
import { listDeliveryCities } from "./delivery.service.mjs";
import { validateApiKey, getCoordinates, findNearbyLocations } from "./googleMapsService.mjs";
import { ElevenLabsClient } from "elevenlabs";
import { GoogleGenAI }   from "@google/genai";
import {
  nvidiaClient,
  nvidiaGeneralClient,
  getGeminiClient,
  getEnvironmentSummary,
} from "./modelRouter.mjs";
import { NVIDIA_MODELS, GEMINI_MODELS, getActiveEnvironment } from "../config/aiEnvironment.mjs";
import logger from "../utils/logger.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// Startup Health Checks
// Verifies all external services and AI model endpoints before the server opens
// for traffic. Results are displayed in the startup console output.
// ─────────────────────────────────────────────────────────────────────────────

export const runStartupChecks = async () => {
  logger.info("[STARTUP] Initializing health diagnostics...");

  const { mode, config } = getActiveEnvironment();
  const results = {
    mapsKey:     false,
    mongodb:     false,
    redis:       false,
    elevenlabs:  false,
    llama:       false,
    qwen:        false,
    gemini:      false,
    mcpSearch:   false,
    mcpDelivery: false,
    geocoding:   false,
    places:      false,
  };

  // 1. Google Maps API Key
  try {
    const key = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLEMAP_API;
    if (key) {
      await validateApiKey();
      results.mapsKey = true;
      logger.info("[GOOGLE MAPS] API Key Loaded");
    } else {
      logger.error("[GOOGLE MAPS] Google Maps API Key Missing");
    }
  } catch (err) {
    logger.error(`[GOOGLE MAPS] API key invalid: ${err.message}`);
  }

  // 2. MongoDB
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.admin().ping();
      results.mongodb = true;
    }
  } catch (err) {
    logger.error(`[STARTUP] MongoDB check failed: ${err.message}`);
  }

  // 3. Redis
  try {
    if (redisService.isConnected()) results.redis = true;
  } catch (err) {
    logger.error(`[STARTUP] Redis check failed: ${err.message}`);
  }

  // 4. ElevenLabs
  try {
    const key = process.env.ELEVENLABS_API_KEY;
    if (key) {
      const elevenClient = new ElevenLabsClient({ apiKey: key });
      const voices = await elevenClient.voices.getAll();
      if (voices) results.elevenlabs = true;
    }
  } catch (err) {
    logger.error(`[STARTUP] ElevenLabs check failed: ${err.message}`);
  }

  // 5. Llama (NVIDIA NIM)
  try {
    const response = await nvidiaClient.chat.completions.create({
      model:    NVIDIA_MODELS.llama,
      messages: [{ role: "user", content: "Ping" }],
      max_tokens: 5,
    });
    if (response) results.llama = true;
  } catch (err) {
    logger.error(`[STARTUP] Llama health check failed: ${err.message}`);
  }

  // 6. Qwen (NVIDIA NIM)
  try {
    const response = await nvidiaClient.chat.completions.create({
      model:    NVIDIA_MODELS.qwen,
      messages: [{ role: "user", content: "Ping" }],
      max_tokens: 5,
    });
    if (response) results.qwen = true;
  } catch (err) {
    logger.error(`[STARTUP] Qwen health check failed: ${err.message}`);
  }

  // 7. Gemini (Vertex AI) — only attempt if credentials are configured
  try {
    const gcpProject = process.env.GOOGLE_CLOUD_PROJECT;
    if (gcpProject) {
      const resp = await getGeminiClient().models.generateContent({
        model:    GEMINI_MODELS.flash25,
        contents: [{ role: "user", parts: [{ text: "Ping" }] }],
        config:   { maxOutputTokens: 5 },
      });
      if (resp) results.gemini = true;
    } else {
      logger.warn("[STARTUP] GOOGLE_CLOUD_PROJECT not set — Gemini check skipped.");
    }
  } catch (err) {
    logger.error(`[STARTUP] Gemini health check failed: ${err.message}`);
  }

  // 8. Kapruka MCP Search
  try {
    const mcpClient = await getMcpClient();
    if (mcpClient) {
      const prods = await searchProducts("cake");
      if (prods) results.mcpSearch = true;
    }
  } catch (err) {
    logger.error(`[STARTUP] Kapruka MCP Search check failed: ${err.message}`);
  }

  // 9. Kapruka MCP Delivery
  try {
    const cities = await listDeliveryCities("Colombo");
    if (cities) results.mcpDelivery = true;
  } catch (err) {
    logger.error(`[STARTUP] Kapruka MCP Delivery check failed: ${err.message}`);
  }

  // 10. Google Maps Geocoding API
  try {
    if (results.mapsKey) {
      const coords = await getCoordinates("Colombo");
      if (coords) results.geocoding = true;
    }
  } catch (err) {
    logger.error(`[STARTUP] Geocoding API check failed: ${err.message}`);
  }

  // 11. Google Maps Places API
  try {
    if (results.mapsKey) {
      const locations = await findNearbyLocations(6.9271, 79.8612, 10);
      if (locations) results.places = true;
    }
  } catch (err) {
    logger.error(`[STARTUP] Places API check failed: ${err.message}`);
  }

  // ── Render startup diagnostics ────────────────────────────────────────────
  const ok    = (b)  => b ? "✓ CONNECTED  " : "✗ FAILED     ";
  const avail = (b)  => b ? "✓ AVAILABLE  " : "✗ UNAVAILABLE";

  const envSummary = getEnvironmentSummary();

  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║              VELORA AI ENVIRONMENT STATUS                 ║");
  console.log("╚═══════════════════════════════════════════════════════════╝");
  console.log(`\nMode            : ${envSummary.badge}  (${envSummary.label})`);
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log("  VELORA AI ENVIRONMENT");
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  General Chat     : ${envSummary.models.generalChat}`);
  console.log(`  Recommendations  : ${envSummary.models.recommendations}`);
  console.log(`  Intent Detection : ${envSummary.models.intentDetect}`);
  console.log(`  Delivery Recovery: ${envSummary.models.deliveryRecovery}`);
  console.log(`  Checkout Assist  : ${envSummary.models.checkout}`);
  console.log(`  Summarisation    : ${envSummary.models.summary}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  console.log("[ENV]");
  console.log(`  GOOGLE_MAPS_API_KEY  ${ok(results.mapsKey)}`);
  console.log("\n[DATABASE]");
  console.log(`  MongoDB              ${ok(results.mongodb)}`);
  console.log("\n[CACHE]");
  console.log(`  Redis                ${ok(results.redis)}`);
  console.log("\n[VOICE]");
  console.log(`  ElevenLabs           ${ok(results.elevenlabs)}`);
  console.log("\n[LLM - NVIDIA NIM]");
  console.log(`  Llama 3.1 8B         ${avail(results.llama)}`);
  console.log(`  Qwen 3.5 122B        ${avail(results.qwen)}`);
  console.log("\n[LLM - GOOGLE VERTEX AI]");
  console.log(`  Gemini 2.5 Flash     ${avail(results.gemini)}`);
  console.log("\n[KAPRUKA MCP]");
  console.log(`  Search Products      ${avail(results.mcpSearch)}`);
  console.log(`  Delivery Service     ${avail(results.mcpDelivery)}`);
  console.log("\n[GOOGLE MAPS]");
  console.log(`  Geocoding API        ${avail(results.geocoding)}`);
  console.log(`  Places API           ${avail(results.places)}`);
  console.log("");

  logger.info("[STARTUP] Diagnostics finished.");

  return results;
};

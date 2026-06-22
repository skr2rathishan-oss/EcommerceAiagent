import "./config/loadEnv.mjs";
import express    from "express";
import cors       from "cors";
import mongoose   from "mongoose";
import chatRoutes           from "./routes/chat.routes.mjs";
import productsRoutes       from "./routes/products.routes.mjs";
import deliveryRoutes       from "./routes/delivery.routes.mjs";
import orderTrackingRoutes  from "./routes/orderTracking.routes.mjs";
import orderRoutes          from "./routes/order.routes.mjs";
import voiceRoutes          from "./routes/voice.routes.mjs";
import adminRoutes          from "./routes/admin.routes.mjs";
import { connectDB }        from "./database/mongo.mjs";
import { startAnalyticsScheduler } from "./utils/analyticsScheduler.mjs";
import { cacheService, initCache } from "./cache/cacheService.mjs";
import { getMcpClient }     from "./services/integration/mcp.client.mjs";
import { requestIdMiddleware } from "./middleware/requestId.middleware.mjs";
import { setRuntimeMode, getEnvironmentSummary } from "./services/ai/modelRouter.mjs";
import AIMode               from "./database/AIMode.mjs";
import {
  printBanner,
  askStartupMode,
  printHealthHeader,
  printHealthRow,
  printHealthFooter,
  askProceedDespiteFailures,
  printServerReady,
  logInfo,
  logWarn,
  logError,
  logBackground,
} from "./utils/velora.console.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// STARTUP WIZARD
// ─────────────────────────────────────────────────────────────────────────────

printBanner();

// Ask Production or Development (Bypass interactive prompt to avoid hangs on restart)
const chosenMode = process.env.AI_MODE || "development";
process.env.AI_MODE = chosenMode;
setRuntimeMode(chosenMode);

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH CHECKS
// ─────────────────────────────────────────────────────────────────────────────

printHealthHeader();

let criticalFailures = 0;

// ── 1. MongoDB ─────────────────────────────────────────────────────────────────
let mongoStatus = "fail", mongoLatency = null;
try {
  const t0 = Date.now();
  await connectDB();
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.db.admin().ping();
    mongoLatency = Date.now() - t0;
    mongoStatus = "ok";
  }
} catch (err) {
  criticalFailures++;
}
printHealthRow("MongoDB Database", mongoStatus, mongoLatency, mongoStatus === "fail" ? "Cannot connect" : "");

// ── 2. Cache (Redis / Memory) ──────────────────────────────────────────────────
let cacheStatus = "fail", cacheLatency = null, cacheLabel = "Cache";
try {
  const t0 = Date.now();
  await initCache();
  if (cacheService.isConnected()) {
    await cacheService.ping();
    cacheLatency = Date.now() - t0;
    cacheStatus = "ok";
    cacheLabel = cacheService.isRedisActive() ? "Upstash Redis" : "In-Memory Cache";
  }
} catch {
  cacheStatus = "warn"; // Cache is non-critical
  cacheLabel = "Cache";
}
printHealthRow(cacheLabel, cacheStatus, cacheLatency, cacheStatus === "warn" ? "Falling back to memory" : "");

// ── 3. NVIDIA NIM ──────────────────────────────────────────────────────────────
let nimStatus = "fail", nimLatency = null;
try {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 4000);
  const r = await fetch("https://integrate.api.nvidia.com/v1/models", {
    headers: { Authorization: `Bearer ${process.env.NVIDIA_API_KEY}` },
    signal: ctrl.signal,
  });
  clearTimeout(timeout);
  nimLatency = Date.now() - t0;
  nimStatus = r.ok ? "ok" : "warn";
} catch {
  nimStatus = chosenMode === "development" ? "fail" : "warn";
  if (chosenMode === "development") criticalFailures++;
}
printHealthRow("NVIDIA NIM API", nimStatus, nimLatency, nimStatus === "fail" ? "API unreachable" : "");

// ── 4. Gemini / Vertex AI ──────────────────────────────────────────────────────
let geminiStatus = "fail", geminiLatency = null;
const gcpProject = process.env.GOOGLE_CLOUD_PROJECT;
if (!gcpProject) {
  geminiStatus = chosenMode === "production" ? "fail" : "skip";
  if (chosenMode === "production") criticalFailures++;
  printHealthRow("Gemini 2.5 Flash", geminiStatus, null, chosenMode === "production" ? "GOOGLE_CLOUD_PROJECT not set" : "Not required");
} else {
  try {
    const { getGeminiClient } = await import("./services/ai/modelRouter.mjs");
    const geminiClient = getGeminiClient();
    const t0 = Date.now();
    await geminiClient.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: "ping" }] }],
      config: { maxOutputTokens: 5, temperature: 0 },
    });
    geminiLatency = Date.now() - t0;
    geminiStatus = "ok";
  } catch (err) {
    const msg = err?.message || "";
    if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
      geminiStatus = "warn";
      geminiLatency = null;
      printHealthRow("Gemini 2.5 Flash", "warn", null, "Quota limit hit (NVIDIA fallback active)");
    } else {
      geminiStatus = chosenMode === "production" ? "fail" : "warn";
      if (chosenMode === "production") criticalFailures++;
      printHealthRow("Gemini 2.5 Flash", geminiStatus, null, msg.slice(0, 45));
    }
  }
  if (geminiStatus !== "warn") printHealthRow("Gemini 2.5 Flash", geminiStatus, geminiLatency);
}

// ── 5. Kapruka MCP ─────────────────────────────────────────────────────────────
let mcpStatus = "fail", mcpLatency = null;
try {
  const t0 = Date.now();
  const mcpClient = await getMcpClient();
  if (mcpClient) { mcpLatency = Date.now() - t0; mcpStatus = "ok"; }
} catch { criticalFailures++; }
printHealthRow("Kapruka MCP", mcpStatus, mcpLatency, mcpStatus === "fail" ? "MCP server unreachable" : "");

// ── 6. Kapruka Website ─────────────────────────────────────────────────────────
let extStatus = "warn", extLatency = null;
try {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 4000);
  const r = await fetch("https://www.kapruka.com", { signal: ctrl.signal });
  clearTimeout(timeout);
  extLatency = Date.now() - t0;
  extStatus = r.ok ? "ok" : "warn";
} catch { extStatus = "warn"; }
printHealthRow("Kapruka Website", extStatus, extLatency, extStatus === "warn" ? "May affect product data" : "");

// ── 7. ElevenLabs Voice ────────────────────────────────────────────────────────
let voiceStatus = "skip";
if (process.env.ELEVENLABS_API_KEY) {
  try {
    const { ElevenLabsClient } = await import("elevenlabs");
    const el = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
    await el.voices.getAll();
    voiceStatus = "ok";
  } catch { voiceStatus = "warn"; }
  printHealthRow("ElevenLabs Voice", voiceStatus, null);
} else {
  printHealthRow("ElevenLabs Voice", "skip", null, "ELEVENLABS_API_KEY not set");
}

printHealthFooter(criticalFailures === 0);

// ── Ask to proceed if failures ─────────────────────────────────────────────────
if (criticalFailures > 0) {
  const proceed = await askProceedDespiteFailures();
  if (!proceed) {
    logError("STARTUP", "Aborted by user. Fix the failed services and restart.");
    process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LOAD PERSISTED AI MODE FROM MONGODB (admin override)
// ─────────────────────────────────────────────────────────────────────────────
try {
  const savedMode = await AIMode.findOne({ settingKey: "global" }).lean();
  if (savedMode?.mode && savedMode.mode !== chosenMode) {
    setRuntimeMode(savedMode.mode);
    logInfo("AI ENV", `MongoDB override applied: "${savedMode.mode}" (you chose "${chosenMode}")`);
  }
} catch {
  // Non-critical
}

// Start analytics scheduler
startAnalyticsScheduler();

// Count active sessions for display
let activeSessions = 0;
try {
  if (mongoose.connection.readyState === 1) {
    activeSessions = await mongoose.connection.db.collection("memorysummaries").countDocuments();
  }
} catch {}

// ─────────────────────────────────────────────────────────────────────────────
// EXPRESS APP
// ─────────────────────────────────────────────────────────────────────────────
const app = express();
app.use(requestIdMiddleware);

// CORS
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== "production") {
      return callback(null, true);
    }
    logWarn("CORS", `Blocked request from: ${origin}`);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));

app.use(express.json());

// ── Minimal HTTP access log (non-chat routes only) ────────────────────────────
app.use((req, res, next) => {
  // Chat messages are logged in the controller for rich step-by-step output
  if (!req.path.startsWith("/api/chat")) {
    const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
    res.on("finish", () => {
      const statusColor = res.statusCode >= 400 ? "\x1b[31m" : "\x1b[32m";
      process.stdout.write(
        `\x1b[90m  [${ts}]\x1b[0m  \x1b[34mHTTP\x1b[0m  ${req.method} \x1b[36m${req.originalUrl}\x1b[0m  ${statusColor}${res.statusCode}\x1b[0m\n`
      );
    });
  }
  next();
});

// ── Health endpoint ────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  const isHealthy = mongoose.connection.readyState === 1;
  return res.status(isHealthy ? 200 : 500).json({
    status: isHealthy ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    services: {
      mongodb: isHealthy ? "connected" : "disconnected",
      cache: cacheService.isConnected() ? "connected" : "warning",
    },
  });
});

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use("/api/chat",     chatRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/delivery", deliveryRoutes);
app.use("/api/orders",   orderTrackingRoutes);
app.use("/api/orders",   orderRoutes);
app.use("/api/voice",    voiceRoutes);
app.use("/api/admin",    adminRoutes);

// ── Global error handler ───────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  logError("SERVER", `${req.method} ${req.originalUrl} — ${err.message}`);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "An unexpected error occurred.",
  });
});

// ── Listen ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const aiEnv = getEnvironmentSummary();

app.listen(PORT, "0.0.0.0", () => {
  printServerReady(PORT, process.env.NODE_ENV || "development", chosenMode);
});

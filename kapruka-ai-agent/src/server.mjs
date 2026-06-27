import "./config/loadEnv.mjs";
if (process.stdout._handle && typeof process.stdout._handle.setBlocking === "function") {
  process.stdout._handle.setBlocking(true);
}
if (process.stderr._handle && typeof process.stderr._handle.setBlocking === "function") {
  process.stderr._handle.setBlocking(true);
}
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
  printOperationsConsole,
  logInfo,
  logWarn,
  logError,
  logBackground,
} from "./utils/velora.console.mjs";
import { runStartupChecks } from "./services/core/startupHealthService.mjs";
import { initializePromptCache } from "./agent/core/promptCache.mjs";
import { getPromptInformation } from "./agent/core/promptLoader.mjs";


// ─────────────────────────────────────────────────────────────────────────────
// STARTUP WIZARD & DIAGNOSTICS
// ─────────────────────────────────────────────────────────────────────────────

printBanner();

const chosenMode = process.env.AI_MODE || "development";
process.env.AI_MODE = chosenMode;
setRuntimeMode(chosenMode);

// Initialize DB and Cache before diagnostics
try {
  await connectDB();
} catch (err) {
  logError("STARTUP", `MongoDB connect error: ${err.message}`);
}

try {
  await initCache();
} catch (err) {
  logError("STARTUP", `Cache init error: ${err.message}`);
}

try {
  initializePromptCache();
} catch (err) {
  logError("STARTUP", `Prompt Cache init error: ${err.message}`);
}

// Run modular diagnostic checks
const diagnostics = await runStartupChecks();

// Check critical failures and warnings
if (diagnostics.criticalFailures > 0) {
  printOperationsConsole(diagnostics);
  
  // Log the reasons for the critical failures
  if (diagnostics.env.status === "FAIL") {
    diagnostics.env.errors.forEach(err => logError("STARTUP - ENV", err));
  }
  if (diagnostics.mongoDB.status === "FAIL") {
    logError("STARTUP - MONGODB", diagnostics.mongoDB.error || "Failed to connect to MongoDB.");
  }
  if (diagnostics.gemini.status === "FAIL") {
    logError("STARTUP - GEMINI", diagnostics.gemini.error || "Gemini authentication failed.");
  }
  if (diagnostics.mcp.status === "FAIL") {
    logError("STARTUP - MCP", diagnostics.mcp.error || "Kapruka MCP server is offline.");
  }
  const resLibFailed = Object.values(diagnostics.responseLibrary.status).some(s => s === "FAIL");
  if (resLibFailed) {
    diagnostics.responseLibrary.errors.forEach(err => logError("STARTUP - RESPONSE LIBRARY", err));
  }
  if (diagnostics.conversationPipeline.status === "FAILED") {
    logError("STARTUP - PIPELINE", "One or more conversation pipeline modules failed validation");
  }
  if (diagnostics.commerceEngine.status === "FAILED") {
    logError("STARTUP - COMMERCE", "One or more commerce engine modules failed validation");
  }

  logError("STARTUP", "Critical components failed validation. Startup aborted.");
  process.exit(1);
}

// Log warnings for optional component failures
if (diagnostics.cache.status === "WARNING" || diagnostics.cache.status === "FAIL") {
  logWarn("STARTUP - CACHE", diagnostics.cache.detail || "Redis cache offline, falling back to memory.");
}
if (diagnostics.googleSpeech.status === "WARNING" || diagnostics.googleSpeech.status === "FAIL") {
  logWarn("STARTUP - SPEECH", diagnostics.googleSpeech.error || "Google Speech credentials not set.");
}
if (diagnostics.elevenLabs.status === "WARNING") {
  logWarn("STARTUP - ELEVENLABS", diagnostics.elevenLabs.error || "ElevenLabs Voice authentication failed.");
}
if (diagnostics.env.warnings.length > 0) {
  diagnostics.env.warnings.forEach(warn => logWarn("STARTUP - ENV", warn));
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
  printOperationsConsole(diagnostics);

  const promptInfo = getPromptInformation();
  console.log(`
══════════════════════════════════════════════════════════════════════════════
                      PROMPT OPERATING SYSTEM DIAGNOSTICS
══════════════════════════════════════════════════════════════════════════════
   Prompt Operating System : ${promptInfo.name}
   Version                 : ${promptInfo.version}
   Modules                 : ${promptInfo.promptModules}
   Runtime Modules         : ${promptInfo.runtimeModules}
   Status                  : Production
   Prompt Cache            : READY
══════════════════════════════════════════════════════════════════════════════
`);
});

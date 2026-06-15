import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure env variables are loaded from root path
dotenv.config({ path: resolve(__dirname, "../.env") });

import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import chatRoutes from "./routes/chat.routes.mjs";
import productsRoutes from "./routes/products.routes.mjs";
import deliveryRoutes from "./routes/delivery.routes.mjs";
import orderTrackingRoutes from "./routes/orderTracking.routes.mjs";
import voiceRoutes from "./routes/voice.routes.mjs";
import { connectDB } from "./database/mongo.mjs";
import { startAnalyticsScheduler } from "./utils/analyticsScheduler.mjs";
import { initRedis, redisService } from "./services/redis.service.mjs";
import logger from "./utils/logger.mjs";
import { drawStartupDashboard } from "./services/logger.service.mjs";
import { getMcpClient } from "./services/mcp.client.mjs";
import { requestIdMiddleware } from "./middleware/requestId.middleware.mjs";

// Initialize databases
await connectDB();
await initRedis();
startAnalyticsScheduler();

// Run Diagnostics & Health Checks
const mongoStart = Date.now();
let mongoStatus = "disconnected";
let mongoLatency = null;
if (mongoose.connection.readyState === 1) {
  try {
    await mongoose.connection.db.admin().ping();
    mongoStatus = "connected";
    mongoLatency = Date.now() - mongoStart;
  } catch {
    mongoStatus = "warning";
  }
}

const redisStart = Date.now();
let redisStatus = redisService.isConnected() ? "connected" : "warning";
let redisLatency = redisService.isConnected() ? (Date.now() - redisStart) : null;

// Ping NVIDIA NIM API
const nimStart = Date.now();
let nimStatus = "offline";
let nimLatency = null;
try {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  const response = await fetch("https://integrate.api.nvidia.com/v1/models", {
    headers: { "Authorization": `Bearer ${process.env.NVIDIA_API_KEY}` },
    signal: controller.signal
  });
  clearTimeout(timeout);
  nimStatus = response.ok ? "connected" : "warning";
  nimLatency = Date.now() - nimStart;
} catch (err) {
  nimStatus = "offline";
}

// Ping NVIDIA NIM API for GPT Model (General Chat)
const gptStart = Date.now();
let gptStatus = "offline";
let gptLatency = null;
try {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  const response = await fetch("https://integrate.api.nvidia.com/v1/models", {
    headers: { "Authorization": `Bearer ${process.env.GENERAL_CHAT_API_KEY || process.env.NVIDIA_API_KEY}` },
    signal: controller.signal
  });
  clearTimeout(timeout);
  gptStatus = response.ok ? "connected" : "warning";
  gptLatency = Date.now() - gptStart;
} catch (err) {
  gptStatus = "offline";
}

// Ping MCP
const mcpStart = Date.now();
let mcpStatus = "offline";
let mcpLatency = null;
try {
  const client = await getMcpClient();
  if (client) {
    mcpStatus = "connected";
    mcpLatency = Date.now() - mcpStart;
  }
} catch (err) {
  mcpStatus = "offline";
}

// Ping External
const extStart = Date.now();
let extStatus = "offline";
let extLatency = null;
try {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  const response = await fetch("https://www.kapruka.com", { signal: controller.signal });
  clearTimeout(timeout);
  extStatus = response.ok ? "connected" : "warning";
  extLatency = Date.now() - extStart;
} catch {
  extStatus = "offline";
}

// Count sessions from DB
let activeSessions = 1;
try {
  activeSessions = await mongoose.connection.db.collection("memorysummaries").countDocuments();
} catch {}

const formatUptime = (seconds) => {
  const pad = (s) => (s < 10 ? "0" : "") + s;
  const hrs = Math.floor(seconds / (60 * 60));
  const mins = Math.floor((seconds % (60 * 60)) / 60);
  const secs = Math.floor(seconds % 60);
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
};

const mem = process.memoryUsage();
const cpu = process.cpuUsage();

drawStartupDashboard({
  env: process.env.NODE_ENV || "development",
  version: "1.0.0",
  uptime: formatUptime(process.uptime()),
  memory: `${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB / ${(mem.heapTotal / 1024 / 1024).toFixed(1)} MB`,
  cpu: `${(cpu.user / 1000000).toFixed(2)}s cpu time`,
  activeSessions
}, [
  { name: "MongoDB Database", status: mongoStatus, latency: mongoLatency },
  { name: "Redis Cache", status: redisStatus, latency: redisLatency },
  { name: "NVIDIA NIM API Gateway", status: nimStatus, latency: nimLatency },
  { name: "Qwen 3.5 Model", status: nimStatus, latency: nimLatency },
  { name: "Llama 3.1 Model", status: nimStatus, latency: nimLatency },
  { name: "GPT Model (General Chat)", status: gptStatus, latency: gptLatency },
  { name: "Gemini Translate API", status: "decommissioned", latency: null },
  { name: "Kapruka MCP Service", status: mcpStatus, latency: mcpLatency },
  { name: "External Kapruka Web Server", status: extStatus, latency: extLatency }
]);

const app = express();
app.use(requestIdMiddleware);

// ── Secure CORS Configuration ────────────────────────────────────────────────
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== "production") {
      return callback(null, true);
    } else {
      logger.warn("CORS blocked request from origin: " + origin);
      return callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));

app.use(express.json());

// ── Observability & Latency Middleware ───────────────────────────────────────
app.use((req, res, next) => {
  const start = performance.now();
  
  // Log request arrival
  logger.info(`Incoming request: ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    method: req.method,
    url: req.originalUrl
  });

  res.on("finish", () => {
    const duration = performance.now() - start;
    logger.info(`Request completed: ${req.method} ${req.originalUrl}`, {
      status: res.statusCode,
      latencyMs: parseFloat(duration.toFixed(2))
    });
  });

  next();
});

// ── Health Check Endpoint ───────────────────────────────────────────────────
app.get("/health", (req, res) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  const redisStatus = redisService.isConnected() ? "connected" : "fallback-memory";
  
  const isHealthy = mongoStatus === "connected";
  
  return res.status(isHealthy ? 200 : 500).json({
    status: isHealthy ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    services: {
      mongodb: mongoStatus,
      redis: redisStatus
    }
  });
});

// ── API Routes ──────────────────────────────────────────────────────────────
app.use("/api/chat", chatRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/delivery", deliveryRoutes);
app.use("/api/orders", orderTrackingRoutes);
app.use("/api/voice", voiceRoutes);

// ── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error("Global Server Error", {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl
  });
  
  res.status(500).json({
    success: false,
    message: "An unexpected error occurred on the server."
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  logger.info(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV || "development"} mode`);
});

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
import { connectDB } from "./database/mongo.mjs";
import { startAnalyticsScheduler } from "./utils/analyticsScheduler.mjs";
import { initRedis, redisService } from "./services/redis.service.mjs";
import logger from "./utils/logger.mjs";

// Initialize databases
await connectDB();
await initRedis();
startAnalyticsScheduler();

const app = express();

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

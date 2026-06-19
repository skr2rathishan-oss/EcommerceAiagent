// src/cache/redisCache.mjs
// Upstash / Redis implementation

import { createClient } from "redis";
import logger from "../utils/logger.mjs";

let client = null;
let connected = false;

export const redisCache = {
  async init(url) {
    try {
      client = createClient({
        url,
        socket: {
          tls: url.includes("upstash.io"), // Auto-enable TLS for upstash
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.warn("[REDIS] Max retries (10) reached, falling back to memory.");
              connected = false;
              return false; // Stop reconnecting
            }
            // Exponential backoff with jitter: 500ms, 1s, 2s, 4s... capped at 15s
            const baseDelay = Math.min(Math.pow(2, retries) * 500, 15000);
            const jitter = Math.floor(Math.random() * 500);
            const delay = baseDelay + jitter;
            logger.info(`[REDIS] Reconnecting... attempt ${retries}/10 (next in ${delay}ms)`);
            return delay;
          }
        }
      });

      client.on("error", (err) => {
        // Only log at error level for non-transient issues; socket close is expected during reconnection
        if (err.message && err.message.includes("Socket closed unexpectedly")) {
          logger.warn(`[REDIS] Connection lost: ${err.message} — reconnect strategy will handle recovery.`);
        } else {
          logger.error(`[REDIS] Connection Error: ${err.message}`);
        }
        connected = false;
      });

      client.on("ready", () => {
        logger.info("[REDIS] Successfully connected to Upstash/Redis.");
        connected = true;
      });

      client.on("reconnecting", () => {
        logger.info("[REDIS] Attempting to reconnect...");
      });

      // Non-blocking connection attempt
      client.connect().catch((err) => {
        logger.warn(`[REDIS] Initial connection failed: ${err.message}`);
        connected = false;
      });

      // Wait briefly for connection
      await new Promise(resolve => {
        const timeout = setTimeout(resolve, 3000);
        client.once("ready", () => {
          clearTimeout(timeout);
          resolve();
        });
      });

    } catch (err) {
      logger.error(`[REDIS] Initialization failed: ${err.message}`);
      connected = false;
    }
  },

  async get(key) {
    if (!connected || !client) return null;
    try {
      const val = await client.get(key);
      return val ? JSON.parse(val) : null;
    } catch (err) {
      logger.error(`[REDIS] GET Error (${key}): ${err.message}`);
      return null;
    }
  },

  async set(key, value, ttlSeconds = 86400) {
    if (!connected || !client) return false;
    try {
      await client.setEx(key, ttlSeconds, JSON.stringify(value));
      return true;
    } catch (err) {
      logger.error(`[REDIS] SET Error (${key}): ${err.message}`);
      return false;
    }
  },

  async del(key) {
    if (!connected || !client) return false;
    try {
      await client.del(key);
      return true;
    } catch (err) {
      return false;
    }
  },

  async invalidatePattern(pattern) {
    if (!connected || !client) return 0;
    try {
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(keys);
      }
      return keys.length;
    } catch (err) {
      return 0;
    }
  },

  async clearAll() {
    if (!connected || !client) return false;
    await client.flushDb();
    return true;
  },

  isConnected() {
    return connected;
  },

  async ping() {
    if (!connected || !client) throw new Error("Not connected");
    await client.ping();
    return true;
  },

  async stats() {
    if (!connected || !client) return null;
    try {
      const info = await client.info("memory");
      return { type: "redis", info };
    } catch (err) {
      return null;
    }
  }
};

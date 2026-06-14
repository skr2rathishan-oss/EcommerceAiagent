import { createClient } from "redis";
import logger from "../utils/logger.mjs";

let client = null;
let isRedisConnected = false;
const fallbackStore = new Map();

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

export const initRedis = async () => {
  let connectionAttemptsStartedAt = Date.now();
  let fallbackLogged = false;

  try {
    client = createClient({
      url: REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          const elapsed = Date.now() - connectionAttemptsStartedAt;
          if (elapsed > 30000) {
            if (!fallbackLogged) {
              logger.warn("Redis reconnection attempts exceeded 30 seconds. Operating in fallback in-memory mode.");
              fallbackLogged = true;
            }
            isRedisConnected = false;
            return false; // Stop reconnecting, operate in fallback
          }
          return 3000; // Retry every 3 seconds
        }
      }
    });

    client.on("error", (err) => {
      // Only log connection error if we were previously connected to prevent console flooding during startup
      if (isRedisConnected) {
        logger.error("Redis connection lost", { error: err.message });
        isRedisConnected = false;
      }
    });

    client.on("connect", () => {
      // Attempting to connect silently
    });

    client.on("ready", () => {
      logger.info("✅ Redis Client Ready and Connected");
      isRedisConnected = true;
    });

    // Connect asynchronously in the background so it doesn't block server startup
    client.connect().catch((error) => {
      if (!fallbackLogged) {
        logger.warn("⚠️ Failed to initialize Redis. Operating in fallback in-memory mode.", { error: error.message });
        fallbackLogged = true;
      }
      isRedisConnected = false;
      client = null;
    });
  } catch (error) {
    if (!fallbackLogged) {
      logger.warn("⚠️ Failed to initialize Redis. Operating in fallback in-memory mode.", { error: error.message });
      fallbackLogged = true;
    }
    isRedisConnected = false;
    client = null;
  }
};

// Auto initialize on startup
initRedis().catch(err => {
  logger.error("Redis auto initialization failed", { error: err.message });
});

export const redisService = {
  /**
   * Get cached item
   */
  get: async (key) => {
    if (isRedisConnected && client) {
      try {
        const value = await client.get(key);
        return value ? JSON.parse(value) : null;
      } catch (err) {
        logger.error("Error reading from Redis key: " + key, { error: err.message });
      }
    }
    // Fallback in-memory read
    const entry = fallbackStore.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      fallbackStore.delete(key);
      return null;
    }
    return entry.value;
  },

  /**
   * Set cached item with TTL (in seconds)
   */
  set: async (key, value, ttlSeconds = 86400) => {
    if (isRedisConnected && client) {
      try {
        await client.set(key, JSON.stringify(value), {
          EX: ttlSeconds
        });
        return true;
      } catch (err) {
        logger.error("Error writing to Redis key: " + key, { error: err.message });
      }
    }
    // Fallback in-memory write
    fallbackStore.set(key, {
      value,
      expiresAt: Date.now() + (ttlSeconds * 1000)
    });
    return true;
  },

  /**
   * Delete cached item
   */
  del: async (key) => {
    if (isRedisConnected && client) {
      try {
        await client.del(key);
        return true;
      } catch (err) {
        logger.error("Error deleting Redis key: " + key, { error: err.message });
      }
    }
    fallbackStore.delete(key);
    return true;
  },

  /**
   * Clear all (for tests/resets)
   */
  clearAll: async () => {
    if (isRedisConnected && client) {
      try {
        await client.flushAll();
        return true;
      } catch (err) {
        logger.error("Error flushing Redis", { error: err.message });
      }
    }
    fallbackStore.clear();
    return true;
  },

  /**
   * Connection status
   */
  isConnected: () => isRedisConnected
};

// src/cache/cacheService.mjs
// Unified Cache interface delegating to Redis or Memory automatically

import { memoryCache } from "./memoryCache.mjs";
import { redisCache } from "./redisCache.mjs";
import logger from "../utils/logger.mjs";

let primaryCache = memoryCache; // default
const REDIS_URL = process.env.REDIS_URL;

export const initCache = async () => {
  if (REDIS_URL) {
    logger.info("[CACHE] Initializing Redis connection...");
    await redisCache.init(REDIS_URL);
    if (redisCache.isConnected()) {
      primaryCache = redisCache;
      logger.info("[CACHE] Redis successfully activated as primary cache.");
    } else {
      logger.warn("[CACHE] Redis unavailable. Falling back to native Memory cache.");
      primaryCache = memoryCache;
    }
  } else {
    logger.info("[CACHE] No REDIS_URL found. Using native Memory cache.");
  }
};

export const cacheService = {
  get: async (key) => {
    // Attempt primary
    let val = await primaryCache.get(key);
    if (!val && primaryCache === redisCache && !redisCache.isConnected()) {
      // Dynamic fallback if redis drops
      val = await memoryCache.get(key);
    }
    return val;
  },

  set: async (key, value, ttlSeconds = 86400) => {
    const success = await primaryCache.set(key, value, ttlSeconds);
    if (!success && primaryCache === redisCache) {
      await memoryCache.set(key, value, ttlSeconds);
    }
    return true;
  },

  del: async (key) => {
    await primaryCache.del(key);
    if (primaryCache === redisCache) await memoryCache.del(key);
    return true;
  },

  invalidatePattern: async (pattern) => {
    return await primaryCache.invalidatePattern(pattern);
  },

  clearAll: async () => {
    await memoryCache.clearAll();
    await redisCache.clearAll();
    return true;
  },

  isConnected: () => primaryCache.isConnected(),

  ping: async () => primaryCache.ping(),

  stats: async () => primaryCache.stats(),
  
  isRedisActive: () => primaryCache === redisCache
};

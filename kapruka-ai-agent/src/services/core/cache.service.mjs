// src/services/cache.service.mjs
// Generic in-memory cache replacing Redis

const store = new Map();

export const cacheService = {
  /**
   * Get cached item
   */
  get: async (key) => {
    const entry = store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      store.delete(key);
      return null;
    }
    return entry.value;
  },

  /**
   * Set cached item with TTL (in seconds)
   */
  set: async (key, value, ttlSeconds = 86400) => {
    store.set(key, {
      value,
      expiresAt: Date.now() + (ttlSeconds * 1000)
    });
    return true;
  },

  /**
   * Delete cached item
   */
  del: async (key) => {
    store.delete(key);
    return true;
  },

  /**
   * Clear all (for tests/resets)
   */
  clearAll: async () => {
    store.clear();
    return true;
  },

  /**
   * Connection status (always true for in-memory)
   */
  isConnected: () => true,

  /**
   * Ping database (always responds for in-memory)
   */
  ping: async () => {
    return true;
  }
};

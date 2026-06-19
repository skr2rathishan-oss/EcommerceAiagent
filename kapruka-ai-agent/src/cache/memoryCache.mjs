// src/cache/memoryCache.mjs
// Native Map-based caching fallback with TTL support

const store = new Map();

export const memoryCache = {
  async get(key) {
    const entry = store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      store.delete(key);
      return null;
    }
    return entry.value;
  },

  async set(key, value, ttlSeconds = 86400) {
    store.set(key, {
      value,
      expiresAt: Date.now() + (ttlSeconds * 1000)
    });
    return true;
  },

  async del(key) {
    store.delete(key);
    return true;
  },

  async invalidatePattern(pattern) {
    const regex = new RegExp(pattern.replace(/\*/g, ".*"));
    let count = 0;
    for (const key of store.keys()) {
      if (regex.test(key)) {
        store.delete(key);
        count++;
      }
    }
    return count;
  },

  async clearAll() {
    store.clear();
    return true;
  },

  isConnected() {
    return true;
  },

  async ping() {
    return true;
  },

  async stats() {
    return { keys: store.size, type: "memory" };
  }
};

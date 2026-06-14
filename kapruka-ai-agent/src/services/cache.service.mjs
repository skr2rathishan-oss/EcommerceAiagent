// Simple in‑memory cache with TTL (10 minutes)
// Stores arbitrary data keyed by `${sessionId}:${key}`

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const cache = new Map(); // key -> {value, expiresAt}

function getKey(sessionId, key) {
  return `${sessionId}:${key}`;
}

export function getCache(sessionId, key) {
  const mapKey = getKey(sessionId, key);
  const entry = cache.get(mapKey);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(mapKey);
    return null;
  }
  return entry.value;
}

export function setCache(sessionId, key, value) {
  const mapKey = getKey(sessionId, key);
  cache.set(mapKey, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
}

export function clearCache(sessionId, key) {
  const mapKey = getKey(sessionId, key);
  cache.delete(mapKey);
}

export function clearAll() {
  cache.clear();
}

import ShoppingContext from "../../database/ShoppingContext.mjs";
import logger from "../../utils/logger.mjs";

export async function createShoppingContext(sessionId, query, category = "", filters = {}) {
  try {
    const contextId = `ctx-${Math.random().toString(36).substring(2, 11)}`;
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours expiration by default

    const ctx = await ShoppingContext.create({
      contextId,
      sessionId,
      searchQuery: query,
      category,
      filters,
      status: "ACTIVE",
      expiresAt
    });

    logger.info(`[ShoppingContext] Created active context ${contextId} for session ${sessionId}`);
    return ctx.toObject();
  } catch (err) {
    logger.error(`[ShoppingContext] createShoppingContext failed: ${err.message}`);
    return null;
  }
}

export async function pauseShoppingContext(sessionId, contextId) {
  try {
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // Paused expires in 2 hours
    const updated = await ShoppingContext.findOneAndUpdate(
      { contextId, sessionId },
      { status: "PAUSED", expiresAt },
      { new: true }
    );
    if (updated) {
      logger.info(`[ShoppingContext] Paused context ${contextId}`);
    }
    return updated?.toObject() || null;
  } catch (err) {
    logger.error(`[ShoppingContext] pauseShoppingContext failed: ${err.message}`);
    return null;
  }
}

export async function resumeShoppingContext(sessionId, contextId) {
  try {
    const updated = await ShoppingContext.findOneAndUpdate(
      { contextId, sessionId },
      { status: "ACTIVE", expiresAt: null },
      { new: true }
    );
    if (updated) {
      logger.info(`[ShoppingContext] Resumed context ${contextId}`);
    }
    return updated?.toObject() || null;
  } catch (err) {
    logger.error(`[ShoppingContext] resumeShoppingContext failed: ${err.message}`);
    return null;
  }
}

export async function completeShoppingContext(sessionId, contextId) {
  try {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // Completed deletes after 24 hours
    const updated = await ShoppingContext.findOneAndUpdate(
      { contextId, sessionId },
      { status: "COMPLETED", expiresAt },
      { new: true }
    );
    if (updated) {
      logger.info(`[ShoppingContext] Completed context ${contextId}`);
    }
    return updated?.toObject() || null;
  } catch (err) {
    logger.error(`[ShoppingContext] completeShoppingContext failed: ${err.message}`);
    return null;
  }
}

export async function expireShoppingContext(sessionId, contextId) {
  try {
    const updated = await ShoppingContext.findOneAndUpdate(
      { contextId, sessionId },
      { status: "EXPIRED", expiresAt: new Date() },
      { new: true }
    );
    return updated?.toObject() || null;
  } catch (err) {
    logger.error(`[ShoppingContext] expireShoppingContext failed: ${err.message}`);
    return null;
  }
}

export async function findMatchingContext(sessionId, query) {
  if (!query) return null;
  const normalizedQuery = query.toLowerCase().trim();
  
  try {
    const contexts = await ShoppingContext.find({
      sessionId,
      status: { $in: ["PAUSED", "RESUMABLE", "ACTIVE"] }
    }).lean();

    for (const ctx of contexts) {
      const ctxQuery = (ctx.searchQuery || "").toLowerCase();
      if (ctxQuery.includes(normalizedQuery) || normalizedQuery.includes(ctxQuery)) {
        return ctx;
      }
      const ctxWords = ctxQuery.split(/\s+/).filter(w => w.length > 3);
      const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 3);
      const commonWords = ctxWords.filter(w => queryWords.includes(w));
      if (commonWords.length > 0) {
        return ctx;
      }
    }
    return null;
  } catch (err) {
    logger.error(`[ShoppingContext] findMatchingContext failed: ${err.message}`);
    return null;
  }
}

export async function restoreShoppingContext(sessionId, contextId) {
  return await resumeShoppingContext(sessionId, contextId);
}

export async function updateShoppingContextInDB(contextId, updates) {
  try {
    const updated = await ShoppingContext.findOneAndUpdate(
      { contextId },
      { $set: updates },
      { new: true }
    );
    return updated?.toObject() || null;
  } catch (err) {
    logger.error(`[ShoppingContext] updateShoppingContextInDB failed: ${err.message}`);
    return null;
  }
}

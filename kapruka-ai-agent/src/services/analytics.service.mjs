// src/services/analytics.service.mjs
// Phase 6 – Analytics Engine
// Aggregates platform-level data from ProductInteractions, UserProfiles, and MemorySummaries
// into daily snapshots. All functions are read-heavy aggregations — zero request-path impact.

import DailyAnalytics from "../database/DailyAnalytics.mjs";
import ProductInteraction from "../database/ProductInteraction.mjs";
import UserProfile from "../database/UserProfile.mjs";
import MemorySummary from "../database/MemorySummary.mjs";

// ─── Internal Helpers ──────────────────────────────────────────────────────────

/**
 * Returns today's UTC date as "YYYY-MM-DD" string.
 * @returns {string}
 */
function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Aggregates top N categories from ProductInteraction by purchase count.
 * @param {number} limit
 * @returns {Promise<Array<{name: string, count: number}>>}
 */
async function aggregateTopCategories(limit = 10) {
  const results = await ProductInteraction.aggregate([
    { $group: { _id: "$category", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
    { $project: { _id: 0, name: "$_id", count: 1 } }
  ]).exec();
  return results;
}

/**
 * Aggregates top N purchased products from ProductInteraction.
 * @param {number} limit
 * @returns {Promise<Array<{productId: string, productName: string, count: number}>>}
 */
async function aggregateTopProducts(limit = 10) {
  const results = await ProductInteraction.aggregate([
    { $match: { action: "purchase" } },
    { $group: {
        _id: "$productId",
        productName: { $first: "$productName" },
        count: { $sum: 1 }
    }},
    { $sort: { count: -1 } },
    { $limit: limit },
    { $project: { _id: 0, productId: "$_id", productName: 1, count: 1 } }
  ]).exec();
  return results;
}

/**
 * Computes average non-null budget across all UserProfile docs.
 * @returns {Promise<number|null>}
 */
async function aggregateAverageOrderValue() {
  const result = await UserProfile.aggregate([
    { $match: { averageBudget: { $ne: null, $gt: 0 } } },
    { $group: { _id: null, avg: { $avg: "$averageBudget" } } }
  ]).exec();
  return result.length > 0 ? Math.round(result[0].avg) : null;
}

// ─── Core Functions ────────────────────────────────────────────────────────────

/**
 * Generates and upserts today's DailyAnalytics document.
 * Idempotent — safe to call multiple times per day (overwrites with fresh data).
 *
 * Logs: analyticsGenerated, recordsProcessed.
 * Never logs session IDs, messages, or profile content.
 *
 * @returns {Promise<void>}
 */
export async function generateDailyAnalytics() {
  const date = todayUTC();

  try {
    // Run all aggregations in parallel
    const [
      totalUsers,
      totalSessions,
      totalSearches,
      totalPurchases,
      topCategories,
      topProducts,
      averageOrderValue
    ] = await Promise.all([
      // Total distinct users (UserProfile count)
      UserProfile.countDocuments(),

      // Total distinct sessions with any interaction
      ProductInteraction.distinct("sessionId").then(ids => ids.length),

      // Total searches = view + details interactions
      ProductInteraction.countDocuments({ action: { $in: ["view", "details"] } }),

      // Total purchases
      ProductInteraction.countDocuments({ action: "purchase" }),

      // Top categories across all interactions
      aggregateTopCategories(10),

      // Top purchased products
      aggregateTopProducts(10),

      // Average order value across profiles
      aggregateAverageOrderValue()
    ]);

    const recordsProcessed = totalUsers + totalSessions + totalSearches + totalPurchases;

    // Upsert — one doc per date, overwrites with fresh aggregation
    await DailyAnalytics.findOneAndUpdate(
      { date },
      {
        $set: {
          totalUsers,
          totalSessions,
          totalSearches,
          totalPurchases,
          topCategories,
          topProducts,
          averageOrderValue,
          generatedAt: new Date()
        }
      },
      { upsert: true, new: true }
    );

    // Structured log — per spec: analyticsGenerated + recordsProcessed only
    console.log(JSON.stringify({
      analyticsGenerated: new Date().toISOString(),
      date,
      recordsProcessed
    }));
  } catch (err) {
    console.error(`[Analytics Service Error] generateDailyAnalytics failed for date ${date}:`, err);
  }
}

/**
 * Retrieves DailyAnalytics documents within an optional date range.
 * Returns lean objects for dashboard consumption.
 *
 * @param {string} [startDate] - "YYYY-MM-DD", inclusive
 * @param {string} [endDate]   - "YYYY-MM-DD", inclusive
 * @returns {Promise<Array>}
 */
export async function getAnalytics(startDate, endDate) {
  try {
    const query = {};
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate)   query.date.$lte = endDate;
    }
    return await DailyAnalytics.find(query).sort({ date: -1 }).lean().exec();
  } catch (err) {
    console.error("[Analytics Service Error] getAnalytics failed:", err);
    return [];
  }
}

/**
 * Returns the current top categories by interaction count across all ProductInteractions.
 * @param {number} [limit=10]
 * @returns {Promise<Array<{name: string, count: number}>>}
 */
export async function getTopCategories(limit = 10) {
  try {
    return await aggregateTopCategories(limit);
  } catch (err) {
    console.error("[Analytics Service Error] getTopCategories failed:", err);
    return [];
  }
}

/**
 * Returns the current top purchased products.
 * @param {number} [limit=10]
 * @returns {Promise<Array<{productId: string, productName: string, count: number}>>}
 */
export async function getTopProducts(limit = 10) {
  try {
    return await aggregateTopProducts(limit);
  } catch (err) {
    console.error("[Analytics Service Error] getTopProducts failed:", err);
    return [];
  }
}

// ─── Dashboard Helpers ─────────────────────────────────────────────────────────

/**
 * Returns the most common recipients across all UserProfiles, sorted by frequency.
 * @param {number} [limit=10]
 * @returns {Promise<Array<{name: string, count: number}>>}
 */
export async function getTopRecipients(limit = 10) {
  try {
    const results = await UserProfile.aggregate([
      { $unwind: "$favoriteRecipients" },
      { $match: { favoriteRecipients: { $ne: "" } } },
      { $group: { _id: "$favoriteRecipients", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
      { $project: { _id: 0, name: "$_id", count: 1 } }
    ]).exec();
    return results;
  } catch (err) {
    console.error("[Analytics Service Error] getTopRecipients failed:", err);
    return [];
  }
}

/**
 * Returns the most common occasions across all UserProfiles, sorted by frequency.
 * @param {number} [limit=10]
 * @returns {Promise<Array<{name: string, count: number}>>}
 */
export async function getTopOccasions(limit = 10) {
  try {
    const results = await UserProfile.aggregate([
      { $unwind: "$favoriteOccasions" },
      { $match: { favoriteOccasions: { $ne: "" } } },
      { $group: { _id: "$favoriteOccasions", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
      { $project: { _id: 0, name: "$_id", count: 1 } }
    ]).exec();
    return results;
  } catch (err) {
    console.error("[Analytics Service Error] getTopOccasions failed:", err);
    return [];
  }
}

/**
 * Buckets UserProfile averageBudgets into ranges and returns counts per bucket.
 * Ranges (LKR): 0–1000 | 1001–3000 | 3001–5000 | 5001–10000 | 10001+
 * @returns {Promise<Array<{range: string, count: number}>>}
 */
export async function getTopBudgetRanges() {
  try {
    const results = await UserProfile.aggregate([
      { $match: { averageBudget: { $ne: null, $gt: 0 } } },
      {
        $bucket: {
          groupBy: "$averageBudget",
          boundaries: [0, 1001, 3001, 5001, 10001],
          default: "10001+",
          output: { count: { $sum: 1 } }
        }
      },
      {
        $project: {
          _id: 0,
          range: {
            $switch: {
              branches: [
                { case: { $eq: ["$_id", 0]     }, then: "0–1000"      },
                { case: { $eq: ["$_id", 1001]   }, then: "1001–3000"   },
                { case: { $eq: ["$_id", 3001]   }, then: "3001–5000"   },
                { case: { $eq: ["$_id", 5001]   }, then: "5001–10000"  },
                { case: { $eq: ["$_id", 10001]  }, then: "10001+"      }
              ],
              default: "10001+"
            }
          },
          count: 1
        }
      }
    ]).exec();
    return results;
  } catch (err) {
    console.error("[Analytics Service Error] getTopBudgetRanges failed:", err);
    return [];
  }
}

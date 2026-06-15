// src/utils/analyticsScheduler.mjs
// Phase 6 – Analytics Engine Background Scheduler
//
// Uses native Node.js setInterval — zero external dependencies.
// Fires generateDailyAnalytics() every 6 hours.
// Also fires once on startup (after a 5-second delay to let MongoDB settle).
// All errors are caught internally — never crashes the process.

import { generateDailyAnalytics } from "../services/analytics.service.mjs";
import logger from "./logger.mjs";

const SIX_HOURS_MS   = 6 * 60 * 60 * 1000; // 21,600,000 ms
const STARTUP_DELAY  = 5 * 1000;            // 5,000 ms — let DB connection stabilize

/**
 * Runs one analytics generation cycle with full error isolation.
 */
async function runAnalyticsCycle() {
  try {
    await generateDailyAnalytics();
  } catch (err) {
    // Catch anything generateDailyAnalytics didn't already handle
    logger.error("[Analytics Scheduler] Unhandled error in analytics cycle:", err);
  }
}

/**
 * Starts the analytics background scheduler.
 * Call once after DB connects in server.mjs.
 *
 * Behavior:
 *  - Fires once after STARTUP_DELAY (5s) so the first run doesn't delay boot
 *  - Repeats every SIX_HOURS_MS (6 hours)
 */
export function startAnalyticsScheduler() {
  logger.info("[Analytics Scheduler] Starting — will run every 6 hours.");

  // One-time startup run (non-blocking)
  setTimeout(() => {
    logger.info("[Analytics Scheduler] Running startup analytics cycle...");
    runAnalyticsCycle();
  }, STARTUP_DELAY);

  // Recurring 6-hour interval
  const interval = setInterval(() => {
    logger.info("[Analytics Scheduler] Running scheduled analytics cycle...");
    runAnalyticsCycle();
  }, SIX_HOURS_MS);

  // Prevent the interval from keeping the process alive if nothing else is running
  if (interval.unref) {
    interval.unref();
  }
}

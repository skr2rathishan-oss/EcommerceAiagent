// src/utils/analyticsScheduler.mjs
// Phase 6 – Analytics Engine Background Scheduler

import { generateDailyAnalytics } from "../services/analytics/analytics.service.mjs";
import { logBackground, logError } from "./velora.console.mjs";

const SIX_HOURS_MS  = 6 * 60 * 60 * 1000;
const STARTUP_DELAY = 5 * 1000;

async function runAnalyticsCycle() {
  try {
    await generateDailyAnalytics();
    logBackground("Analytics", "Cycle complete");
  } catch (err) {
    logError("Analytics", err.message);
  }
}

export function startAnalyticsScheduler() {
  // One-time startup run (non-blocking)
  setTimeout(() => {
    logBackground("Analytics", "Startup cycle starting...");
    runAnalyticsCycle();
  }, STARTUP_DELAY);

  // Recurring 6-hour interval
  const interval = setInterval(() => {
    logBackground("Analytics", "Scheduled cycle running...");
    runAnalyticsCycle();
  }, SIX_HOURS_MS);

  if (interval.unref) interval.unref();
}


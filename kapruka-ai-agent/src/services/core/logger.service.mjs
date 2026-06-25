import { AsyncLocalStorage } from "async_hooks";
import chalk from "chalk";
import Table from "cli-table3";

// Storage for request-scoped correlation IDs
export const asyncLocalStorage = new AsyncLocalStorage();

export const getContext = () => {
  return asyncLocalStorage.getStore() || {};
};

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

const getLogLevel = () => {
  const envLevel = (process.env.LOG_LEVEL || "INFO").toUpperCase();
  return LOG_LEVELS[envLevel] !== undefined ? LOG_LEVELS[envLevel] : LOG_LEVELS.INFO;
};

// Helper to format timestamps
const getTimestamp = () => {
  return new Date().toISOString();
};

// Log mask helper for security (hides sensitive fields)
const maskSecrets = (obj) => {
  if (!obj || typeof obj !== "object") return obj;

  // Fix: Handle Error objects so they don't stringify to {}
  if (obj instanceof Error) {
    return {
      message: obj.message,
      name: obj.name,
      stack: obj.stack,
      ...maskSecrets(Object.assign({}, obj))
    };
  }

  const copy = { ...obj };
  const sensitiveKeys = ["api_key", "apikey", "password", "token", "jwt", "secret", "authorization", "key"];
  
  for (const key of Object.keys(copy)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      copy[key] = "********";
    } else if (typeof copy[key] === "object" && copy[key] !== null) {
      copy[key] = maskSecrets(copy[key]);
    }
  }
  return copy;
};

// Core logger formatting
// INFO and DEBUG are suppressed in console output — velora.console.mjs handles display.
// WARN and ERROR always print (system-level issues the dev must see).
const writeLog = (levelName, msg, meta = null) => {
  const currentThreshold = getLogLevel();
  const targetLevel = LOG_LEVELS[levelName];
  if (targetLevel < currentThreshold) return;

  // Only show WARN and ERROR in the terminal (INFO is shown via velora.console.mjs step logs)
  if (targetLevel < LOG_LEVELS.WARN) return;

  const timestamp = chalk.gray(`[${getTimestamp()}]`);
  
  let styledLevel = `[${levelName}]`;
  if (levelName === "WARN")  styledLevel = chalk.yellow(styledLevel);
  if (levelName === "ERROR") styledLevel = chalk.red.bold(styledLevel);

  const { requestId, sessionId } = getContext();
  const trackingStr = requestId ? chalk.cyan(`[Req:${requestId.slice(-6)}]`) : "";

  let metaStr = "";
  if (meta) {
    const masked = maskSecrets(meta);
    metaStr = `\n${chalk.gray(JSON.stringify(masked, null, 2))}`;
  }

  console.log(`  ${timestamp} ${styledLevel} ${trackingStr} ${msg}${metaStr}`);
};


export const logger = {
  debug: (msg, meta) => writeLog("DEBUG", msg, meta),
  info: (msg, meta) => writeLog("INFO", msg, meta),
  warn: (msg, meta) => writeLog("WARN", msg, meta),
  error: (msg, meta) => writeLog("ERROR", msg, meta),
  
  // Specialised logging groups
  cart: (msg, meta) => writeLog("INFO", `${chalk.bold.yellow("[CART]")} ${msg}`, meta),
  delivery: (msg, meta) => writeLog("INFO", `${chalk.bold.cyan("[DELIVERY]")} ${msg}`, meta),
  recommendation: (msg, meta) => writeLog("INFO", `${chalk.bold.magenta("[RECOMMENDATION]")} ${msg}`, meta),
  checkout: (msg, meta) => writeLog("INFO", `${chalk.bold.blue("[CHECKOUT]")} ${msg}`, meta),
  order: (msg, meta) => writeLog("INFO", `${chalk.bold.green("[ORDER]")} ${msg}`, meta),
  payment: (msg, meta) => writeLog("INFO", `${chalk.bold.green("[PAYMENT]")} ${msg}`, meta),
  tracking: (msg, meta) => writeLog("INFO", `${chalk.bold.yellow("[TRACKING]")} ${msg}`, meta),

  // Direct console utility for custom styled logs bypassing prefix formats
  raw: (msg) => console.log(msg)
};

// ─────────────────────────────────────────────────────────────────────────────
// Startup dashboard and request report — replaced by velora.console.mjs
// Stubs kept so no other file needs an import change
// ─────────────────────────────────────────────────────────────────────────────
export const drawStartupDashboard = (_sysInfo, _services, _ai) => {
  const cyanLine = chalk.cyan;

  // 1. ASCII banner
  logger.raw(cyanLine("\n┌──────────────────────────────────────────────────────────────────────────┐"));
  logger.raw(cyanLine("│                      VELORA AI OPERATIONS CONSOLE                       │"));
  logger.raw(cyanLine("└──────────────────────────────────────────────────────────────────────────┘"));

  // 2. System info table
  const sysTable = new Table({
    head: [chalk.bold.blue("Metric"), chalk.bold.blue("Value")],
    colWidths: [22, 50],
    style: { head: [], border: [] }
  });

  sysTable.push(
    ["Environment", sysInfo.env === "production" ? chalk.red.bold("Production") : chalk.yellow("Development")],
    ["Server Version", sysInfo.version || "1.0.0"],
    ["Uptime", sysInfo.uptime],
    ["Memory Usage", sysInfo.memory],
    ["CPU Load", sysInfo.cpu],
    ["Active Sessions", sysInfo.activeSessions]
  );

  logger.raw(`\n${chalk.bold.cyan("── SYSTEM CONFIGURATION ──")}`);
  logger.raw(sysTable.toString());

  // 3. AI Environment table (shown only when aiEnvironment is provided)
  if (aiEnvironment) {
    const modeBadgeColors = {
      development: chalk.yellow.bold,
      staging:     chalk.cyan.bold,
      production:  chalk.red.bold,
    };
    const colorFn = modeBadgeColors[aiEnvironment.mode] || chalk.white.bold;

    const aiTable = new Table({
      head: [chalk.bold.magenta("Role"), chalk.bold.magenta("Model Assignment")],
      colWidths: [22, 50],
      style: { head: [], border: [] }
    });

    aiTable.push(
      ["AI Mode",         colorFn(`${aiEnvironment.badge}  (${aiEnvironment.label})`)],
      ["General Chat",    aiEnvironment.models.generalChat],
      ["Recommendations", aiEnvironment.models.recommendations],
      ["Intent Detection",aiEnvironment.models.intentDetect],
      ["Delivery Recovery",aiEnvironment.models.deliveryRecovery],
      ["Checkout Assist", aiEnvironment.models.checkout],
      ["Summarisation",   aiEnvironment.models.summary],
    );

    logger.raw(`\n${chalk.bold.magenta("── VELORA AI ENVIRONMENT ──")}`);
    logger.raw(aiTable.toString());
  }

  // 4. Health check table
  const healthTable = new Table({
    head: [chalk.bold.blue("Service Connection"), chalk.bold.blue("Latency (ms)"), chalk.bold.blue("Health State")],
    colWidths: [30, 20, 22],
    style: { head: [], border: [] }
  });

  for (const service of servicesHealth) {
    let statusText = chalk.red.bold("OFFLINE");
    if (service.status === "connected")     statusText = chalk.green("CONNECTED / OK");
    else if (service.status === "warning")  statusText = chalk.yellow("WARNING / DEGRADED");
    else if (service.status === "decommissioned") statusText = chalk.gray("BYPASS / DISABLED");

    healthTable.push([
      service.name,
      service.latency !== null ? `${service.latency} ms` : "N/A",
      statusText
    ]);
  }

  logger.raw(`\n${chalk.bold.cyan("── SERVICE HEALTH MONITOR ──")}`);
  logger.raw(healthTable.toString());
  logger.raw("\n");
};

// Request Console Telemetry Report — replaced by velora.console.mjs step logging
export const printRequestReport = (_t) => { /* no-op: velora.console.mjs handles this */ };


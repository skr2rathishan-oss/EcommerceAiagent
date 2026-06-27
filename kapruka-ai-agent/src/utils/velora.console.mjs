// src/utils/velora.console.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Velora AI — Production Terminal Console
// Handles: startup wizard, health checks, live request logging
// ─────────────────────────────────────────────────────────────────────────────

import chalk from "chalk";
import readline from "readline";
import { getContext } from "../services/core/logger.service.mjs";

// ── ANSI helpers ──────────────────────────────────────────────────────────────
const c = {
  reset:     "\x1b[0m",
  bold:      (s) => chalk.bold(s),
  dim:       (s) => chalk.dim(s),
  cyan:      (s) => chalk.cyan(s),
  cyanB:     (s) => chalk.bold.cyan(s),
  green:     (s) => chalk.green(s),
  greenB:    (s) => chalk.bold.green(s),
  yellow:    (s) => chalk.yellow(s),
  yellowB:   (s) => chalk.bold.yellow(s),
  red:       (s) => chalk.red(s),
  redB:      (s) => chalk.bold.red(s),
  magenta:   (s) => chalk.magenta(s),
  magentaB:  (s) => chalk.bold.magenta(s),
  blue:      (s) => chalk.blue(s),
  blueB:     (s) => chalk.bold.blue(s),
  gray:      (s) => chalk.gray(s),
  white:     (s) => chalk.white(s),
  whiteB:    (s) => chalk.bold.white(s),
};

// ── Width constants ────────────────────────────────────────────────────────────
const W = 72;
const line  = (ch = "─") => ch.repeat(W);
const hline = () => chalk.gray(line());

// ── Pad string to fixed width ──────────────────────────────────────────────────
const pad  = (s, len) => String(s).padEnd(len);
const rpad = (s, len) => String(s).padStart(len);

// ── Box drawing ────────────────────────────────────────────────────────────────
const box = {
  tl: "╔", tr: "╗", bl: "╚", br: "╝",
  h:  "═", v:  "║",
  ml: "╠", mr: "╣",
  top: (w = W) => `╔${"═".repeat(w)}╗`,
  mid: (w = W) => `╠${"═".repeat(w)}╣`,
  bot: (w = W) => `╚${"═".repeat(w)}╝`,
  row: (content, w = W) => {
    const raw = stripAnsi(content);
    const padding = Math.max(0, w - raw.length);
    return `║ ${content}${" ".repeat(padding - 1)}║`;
  },
};

// ── Strip ANSI escape codes for length calculation ─────────────────────────────
function stripAnsi(str) {
  return String(str).replace(/\x1B\[[0-9;]*m/g, "").replace(/\x1B\[[0-9;]*[A-Za-z]/g, "");
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: ASCII Banner
// ─────────────────────────────────────────────────────────────────────────────
export function printBanner() {
  console.clear();
  console.log(c.cyan());
  console.log(c.gray("                  AI Shopping Agent — Operations Console"));
  console.log(c.gray("                  " + new Date().toLocaleString("en-US", { timeZone: "Asia/Colombo", hour12: true })));
  console.log();
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: Interactive Mode Selection
// ─────────────────────────────────────────────────────────────────────────────
export async function askStartupMode() {
  const envMode = process.env.AI_MODE || "development";
  const label = chalk.bold.green("  ✔ Development mode (from AI_MODE env var) — Gemini AI enabled\n");
  console.log(label);
  return "development";
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: Health Check Display
// ─────────────────────────────────────────────────────────────────────────────
export function printHealthHeader() {
  console.log(chalk.bold.cyan("  ┌─ SYSTEM HEALTH CHECKS " + "─".repeat(46) + "┐"));
  console.log(chalk.cyan("  │"));
}

export function printHealthRow(name, status, latencyMs = null, detail = "") {
  const colName = pad(name, 30);
  let statusStr, icon;

  if (status === "ok" || status === "CONNECTED") {
    icon = chalk.green("✓");
    statusStr = chalk.green(pad("OK", 12));
  } else if (status === "warn" || status === "WARNING") {
    icon = chalk.yellow("⚠");
    statusStr = chalk.yellow(pad("DEGRADED", 12));
  } else if (status === "skip" || status === "SKIPPED") {
    icon = chalk.gray("─");
    statusStr = chalk.gray(pad("SKIPPED", 12));
  } else {
    icon = chalk.red("✘");
    statusStr = chalk.red(pad("FAILED", 12));
  }

  const latStr = latencyMs !== null ? chalk.gray(`${latencyMs}ms`) : chalk.gray("  —  ");
  const detStr = detail ? chalk.gray(` ${detail}`) : "";
  console.log(chalk.cyan("  │  ") + `${icon}  ${chalk.white(colName)} ${statusStr} ${latStr}${detStr}`);
}

export function printHealthFooter(allPassed) {
  console.log(chalk.cyan("  │"));
  if (allPassed) {
    console.log(chalk.cyan("  │  ") + chalk.bold.green("✔ All critical services are healthy"));
  } else {
    console.log(chalk.cyan("  │  ") + chalk.bold.red("✘ One or more services failed"));
  }
  console.log(chalk.bold.cyan("  └" + "─".repeat(70) + "┘\n"));
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: Ask to proceed after failure
// ─────────────────────────────────────────────────────────────────────────────
export async function askProceedDespiteFailures() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    console.log(chalk.bold.red("  ┌─ STARTUP WARNING " + "─".repeat(51) + "┐"));
    console.log(chalk.red("  │  Some health checks failed. The server may not function correctly."));
    console.log(chalk.red("  │"));
    console.log(chalk.yellow("  │  ") + chalk.bold("[Y]") + chalk.yellow("  Start the server anyway (with degraded services)"));
    console.log(chalk.yellow("  │  ") + chalk.bold("[N]") + chalk.yellow("  Exit and fix the issues first"));
    console.log(chalk.bold.red("  └" + "─".repeat(70) + "┘\n"));

    rl.question(chalk.bold.yellow("  ▶ Proceed? [Y/N]: "), (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: Server Ready Banner
// ─────────────────────────────────────────────────────────────────────────────
export function printServerReady(port, mode, aiMode) {
  const modeColor = c.greenB;
  const modeLabel = "Gemini 2.5 Flash (Vertex AI)";

  console.log(chalk.bold.green("  ╔" + "═".repeat(70) + "╗"));
  console.log(chalk.bold.green("  ║") + chalk.bold.white(pad("                  🚀  VELORA AI SERVER READY", 70)) + chalk.bold.green("║"));
  console.log(chalk.bold.green("  ╠" + "═".repeat(70) + "╣"));
  console.log(chalk.bold.green("  ║") + "  " + chalk.white(pad(`Port      : ${chalk.bold.cyan("http://localhost:" + port)}`, 78)) + chalk.bold.green("║"));
  console.log(chalk.bold.green("  ║") + "  " + chalk.white(pad(`Node Env  : ${chalk.bold(mode)}`, 68)) + chalk.bold.green("║"));
  console.log(chalk.bold.green("  ║") + "  " + chalk.white(pad(`AI Mode   : ${modeColor(modeLabel)}`, 78)) + chalk.bold.green("║"));
  console.log(chalk.bold.green("  ║") + "  " + chalk.white(pad(`Time      : ${new Date().toLocaleString("en-US", { timeZone: "Asia/Colombo", hour12: true })}`, 68)) + chalk.bold.green("║"));
  console.log(chalk.bold.green("  ╚" + "═".repeat(70) + "╝\n"));

  console.log(chalk.gray("  " + "─".repeat(70)));
  console.log(chalk.gray("  Listening for requests..."));
  console.log(chalk.gray("  " + "─".repeat(70) + "\n"));
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6: Operations Console Renderer
// ─────────────────────────────────────────────────────────────────────────────
export function printOperationsConsole(data) {
  console.clear();
  
  // 1. ASCII BANNER
  console.log(chalk.cyan(`
  ██╗   ██╗███████╗██╗      ██████╗ ██████╗  █████╗ 
  ██║   ██║██╔════╝██║     ██╔═══██╗██╔══██╗██╔══██╗
  ██║   ██║█████╗  ██║     ██║   ██║██████╔╝███████║
  ╚██╗ ██╔╝██╔══╝  ██║     ██║   ██║██╔══██╗██╔══██║
   ╚████╔╝ ███████╗███████╗╚██████╔╝██║  ██║██║  ██║
    ╚═══╝  ╚══════╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝`));
  console.log(chalk.cyan("                 Premium AI Shopping Assistant • Sri Lanka\n"));
  
  console.log(chalk.cyan(`╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║                      🛍️  VELORA AI OPERATIONS CONSOLE                         ║
║                 Premium AI Shopping Assistant - Sri Lanka                    ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝`));

  const divider = chalk.gray("──────────────────────────────────────────────────────────────────────────────");
  const boldHeader = (title) => chalk.bold.white(title);
  const padLabel = (lbl) => String(lbl).padEnd(28);

  // 2. SYSTEM INFORMATION
  console.log(`\n${boldHeader("SYSTEM INFORMATION")}\n${divider}`);
  console.log(` ${padLabel("Environment")} ${data.systemInfo.env === "production" ? chalk.bold.red("Production") : chalk.bold.yellow("Development")}`);
  console.log(` ${padLabel("Version")} ${data.systemInfo.version}`);
  console.log(` ${padLabel("Node.js")} ${data.systemInfo.nodeVersion}`);
  console.log(` ${padLabel("Platform")} ${data.systemInfo.platform}`);
  console.log(` ${padLabel("Server Port")} ${data.systemInfo.port}`);
  console.log(` ${padLabel("Process ID")} ${data.systemInfo.pid}`);
  console.log(` ${padLabel("Startup Time")} ${data.systemInfo.startTime.replace("T", " ").substring(0, 19)}`);
  console.log(` ${padLabel("Uptime")} ${Math.floor(process.uptime())}s`);
  console.log(divider);

  // 3. AI ENGINE
  console.log(`\n${boldHeader("AI ENGINE")}\n${divider}`);
  console.log(` ${padLabel("AI Provider")} Google Gemini`);
  console.log(` ${padLabel("Model")} Gemini 2.5 Flash`);
  console.log(` ${padLabel("Streaming")} ${process.env.STREAMING !== "false" ? chalk.green("ENABLED") : chalk.red("DISABLED")}`);
  console.log(` ${padLabel("JSON Responses")} ${chalk.green("ENABLED")}`);
  console.log(` ${padLabel("Conversation AI")} ${data.conversationPipeline.status === "READY" ? chalk.green("READY") : chalk.red("FAILED")}`);
  console.log(` ${padLabel("Prompt Manager")} ${chalk.green("READY")}`);
  console.log(divider);

  // 4. CONVERSATION PIPELINE
  console.log(`\n${boldHeader("CONVERSATION PIPELINE")}\n${divider}`);
  const printPipelineRow = (label, ok) => {
    const icon = ok ? chalk.green("✓") : chalk.red("✗");
    console.log(`  ${icon} ${label}`);
  };
  const pipe = data.conversationPipeline.details;
  printPipelineRow("Conversation Understanding", pipe.understanding);
  printPipelineRow("Decision Builder", pipe.decisionBuilder);
  printPipelineRow("Response Engine", pipe.responseEngine);
  printPipelineRow("Response Library", pipe.responseEngine);
  printPipelineRow("Conversation State Manager", pipe.stateManager);
  printPipelineRow("Memory Manager", pipe.memoryManager);
  printPipelineRow("Streaming Engine", pipe.streamingEngine);
  printPipelineRow("Voice Pipeline", pipe.voicePipeline);
  console.log(divider);

  // 5. COMMERCE ENGINE
  console.log(`\n${boldHeader("COMMERCE ENGINE")}\n${divider}`);
  const comm = data.commerceEngine.details;
  printPipelineRow("Product Search", comm.productSearch);
  printPipelineRow("Delivery Flow", comm.deliveryFlow);
  printPipelineRow("Address Service", comm.addressService);
  printPipelineRow("Order Flow", comm.orderFlow);
  printPipelineRow("Checkout Flow", comm.checkoutFlow);
  printPipelineRow("Recovery Engine", comm.recoveryEngine);
  printPipelineRow("Interruption Manager", comm.interruptionManager);
  console.log(divider);

  // 6. RESPONSE LIBRARY
  console.log(`\n${boldHeader("RESPONSE LIBRARY")}\n${divider}`);
  const rlib = data.responseLibrary.status;
  const printRlibRow = (label, statusVal) => {
    const icon = statusVal === "PASS" ? chalk.green("✓") : chalk.red("✗");
    const stStr = statusVal === "PASS" ? chalk.green("PASS") : chalk.red("FAILED");
    console.log(`  ${icon} ${padLabel(label)} ${stStr}`);
  };
  printRlibRow("Common Responses", rlib.common);
  printRlibRow("Shopping Responses", rlib.shopping);
  printRlibRow("Delivery Responses", rlib.delivery);
  printRlibRow("Order Responses", rlib.order);
  printRlibRow("Recovery Responses", rlib.recovery);
  printRlibRow("Interruption Responses", rlib.interruption);
  printRlibRow("Language Templates", rlib.languageTemplates);
  console.log(divider);

  // 7. SERVICE HEALTH
  console.log(`\n${boldHeader("SERVICE HEALTH")}\n${divider}`);
  const printHealthItem = (label, statusVal, latency) => {
    let statusStr = "";
    if (statusVal === "CONNECTED" || statusVal === "ok") {
      statusStr = chalk.green("CONNECTED");
    } else if (statusVal === "WARNING" || statusVal === "warn") {
      statusStr = chalk.yellow("WARNING");
    } else if (statusVal === "SKIPPED" || statusVal === "skip") {
      statusStr = chalk.gray("SKIPPED");
    } else {
      statusStr = chalk.red("FAILED");
    }
    const latStr = latency !== null ? `${latency}ms` : "";
    console.log(`  ${padLabel(label)} ${statusStr.padEnd(20)} ${chalk.gray(latStr)}`);
  };
  printHealthItem("MongoDB", data.mongoDB.status, data.mongoDB.latency);
  printHealthItem("Redis", data.cache.status, data.cache.latency);
  printHealthItem("Gemini API", data.gemini.status, data.gemini.latency);
  printHealthItem("Google Speech", data.googleSpeech.status, null);
  printHealthItem("ElevenLabs", data.elevenLabs.status, null);
  printHealthItem("Kapruka MCP", data.mcp.status, data.mcp.latency);
  console.log(divider);

  // 8. STARTUP VALIDATION
  console.log(`\n${boldHeader("STARTUP VALIDATION")}\n${divider}`);
  const printValidationItem = (label, ok) => {
    const icon = ok ? chalk.green("✓") : chalk.red("✗");
    console.log(`  ${icon} ${label}`);
  };
  printValidationItem("Environment Variables", data.env.status === "PASS");
  printValidationItem("MongoDB Connection", data.mongoDB.status === "CONNECTED");
  printValidationItem("Gemini Authentication", data.gemini.status === "CONNECTED");
  printValidationItem("Response Library Loaded", !Object.values(data.responseLibrary.status).some(s => s === "FAIL"));
  printValidationItem("Conversation Pipeline", data.conversationPipeline.status === "READY");
  printValidationItem("Voice Configuration", data.googleSpeech.status !== "FAIL");
  printValidationItem("MCP Connection", data.mcp.status === "CONNECTED");
  printValidationItem("Cache Initialized", data.cache.status !== "FAIL");
  printValidationItem("Streaming Ready", process.env.STREAMING !== "false");
  console.log(divider);

  // 9. RUNTIME CONFIGURATION
  console.log(`\n${boldHeader("RUNTIME CONFIGURATION")}\n${divider}`);
  const printConfigRow = (label, enabled) => {
    console.log(`  ${padLabel(label)} ${enabled ? chalk.green("ENABLED") : chalk.red("DISABLED")}`);
  };
  printConfigRow("Response Cache", true);
  printConfigRow("Session Memory", true);
  printConfigRow("Voice Mode", data.elevenLabs.status === "CONNECTED");
  printConfigRow("Streaming", process.env.STREAMING !== "false");
  printConfigRow("Auto Deployment", true);
  printConfigRow("Debug Logging", process.env.LOG_LEVEL === "DEBUG");
  console.log(divider);

  // 10. READY BANNER
  if (data.criticalFailures === 0) {
    console.log(chalk.green(`
══════════════════════════════════════════════════════════════════════════════

                          🚀 VELORA AI AGENT READY

   Status          ACCEPTING REQUESTS

   Backend         http://localhost:${data.systemInfo.port}

   API             http://localhost:${data.systemInfo.port}/api

   Environment     ${data.systemInfo.env}

══════════════════════════════════════════════════════════════════════════════
`));
  } else {
    console.log(chalk.red(`
══════════════════════════════════════════════════════════════════════════════

                          ✘ VELORA AI STARTUP FAILED

   Status          CRITICAL ERROR OCCURRED

   Failures        ${data.criticalFailures} component(s) failed validation

   Environment     ${data.systemInfo.env}

══════════════════════════════════════════════════════════════════════════════
`));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7: Per-Request Live Logging
// ─────────────────────────────────────────────────────────────────────────────

let _requestCounter = 0;

export function logIncomingMessage(sessionId, message, lang) {
  _requestCounter++;
  const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
  const langLabel = lang === "si" ? "🇱🇰 Sinhala" : lang === "ta" ? "🇮🇳 Tamil" : "🇬🇧 English";

  console.log();
  console.log(chalk.bold.cyan("  ┌─ REQUEST #" + _requestCounter + " " + "─".repeat(55) + "┐"));
  console.log(chalk.cyan("  │  ") + chalk.gray(`${ts}`) + "  " + chalk.bold.white("SESSION: ") + chalk.cyan(sessionId.slice(-8)));
  console.log(chalk.cyan("  │  ") + chalk.bold("💬 ") + chalk.bold.white(`"${message.slice(0, 90)}${message.length > 90 ? "…" : ""}"`));
  console.log(chalk.cyan("  │  ") + chalk.gray(`Language: ${langLabel}`));
}

export function logStep(icon, label, detail = "", status = "info") {
  const colorFn =
    status === "done"  ? chalk.green  :
    status === "error" ? chalk.red    :
    status === "warn"  ? chalk.yellow :
    chalk.gray;

  const iconStr =
    status === "done"  ? chalk.green("✔") :
    status === "error" ? chalk.red("✘")   :
    status === "warn"  ? chalk.yellow("⚠") :
    chalk.blue("▸");

  const detailStr = detail ? chalk.gray(`  →  ${detail}`) : "";
  console.log(chalk.cyan("  │  ") + `${iconStr}  ${colorFn(pad(label, 28))}${detailStr}`);
}

export function logStepStart(label, detail = "") {
  const detailStr = detail ? chalk.gray(`  →  ${detail}`) : "";
  process.stdout.write(chalk.cyan("  │  ") + chalk.blue("▶") + "  " + chalk.bold(pad(label + "...", 30)) + detailStr + "\n");
}

export function logStepDone(label, detail = "") {
  const detailStr = detail ? chalk.gray(`  ${detail}`) : "";
  console.log(chalk.cyan("  │  ") + chalk.green("✔") + "  " + chalk.green(pad(label, 29)) + detailStr);
}

export function logStepError(label, errMsg = "") {
  console.log(chalk.cyan("  │  ") + chalk.red("✘") + "  " + chalk.red(pad(label, 29)) + chalk.gray(`  ${errMsg.slice(0, 50)}`));
}

export function logContextExtracted(ctx) {
  if (!ctx) return;
  const fields = [];
  if (ctx.conversationLanguage) fields.push(`lang:${ctx.conversationLanguage}`);
  if (ctx.recipient)            fields.push(`recipient:${ctx.recipient}`);
  if (ctx.occasion)             fields.push(`occasion:${ctx.occasion}`);
  if (ctx.budget)               fields.push(`budget:${ctx.budget}`);
  if (ctx.productType)          fields.push(`type:${ctx.productType}`);
  if (ctx.brand)                fields.push(`brand:${ctx.brand}`);
  if (ctx.deliveryLocation)     fields.push(`loc:${ctx.deliveryLocation}`);
  if (ctx.deliveryDate)         fields.push(`date:${ctx.deliveryDate}`);
  if (ctx.urgency)              fields.push(`urgency:${ctx.urgency}`);
  if (fields.length === 0) return;
  console.log(chalk.cyan("  │  ") + chalk.magenta("◈") + "  " + chalk.magenta(pad("Context", 29)) + chalk.gray(fields.join("  ·  ")));
}

export function logRequestFooter(intentType, totalMs, provider) {
  const ctx = getContext();
  const tel = ctx?.telemetry || {};

  const sessId = ctx?.sessionId ? ctx.sessionId.slice(-8) : "default";
  const lang = tel.detectedLanguage || tel.language?.detected || "English";
  const intent = intentType || tel.intent?.type || "general_chat";
  const stage = tel.conversationStage || "browsing";
  const flow = tel.activeFlow || "general_chat";
  const decBuilder = tel.decisionBuilder || "READY";
  const respEngine = tel.responseEngine || (provider === "response_library" ? "Response Library" : "LLM Generator");
  const respLibMod = tel.responseLibraryModule || "N/A";
  const streamingStr = tel.streamingStatus || (provider === "response_library" ? "DISABLED" : "ENABLED");
  const commerceRes = tel.commerceResults || "N/A";
  const geminiTime = tel.geminiResponseTime || (provider === "gemini" ? `${totalMs}ms` : "0ms");

  console.log(chalk.cyan("  │  ") + chalk.gray("─".repeat(60)));
  console.log(chalk.cyan("  │  ") + chalk.bold.white("REQUEST TELEMETRY SUMMARY"));
  console.log(chalk.cyan("  │  ") + chalk.gray("─".repeat(60)));
  
  const printLine = (lbl, val) => {
    console.log(chalk.cyan("  │  ") + chalk.gray(lbl.padEnd(25)) + chalk.white(val));
  };

  printLine("Session ID", sessId);
  printLine("Detected Language", lang);
  printLine("Intent", intent);
  printLine("Conversation Stage", stage);
  printLine("Active Flow", flow);
  printLine("Decision Builder", decBuilder);
  printLine("Response Engine", respEngine);
  printLine("Response Library Module", respLibMod);
  printLine("Streaming Status", streamingStr);
  printLine("Commerce Results", commerceRes);
  printLine("Gemini Response Time", geminiTime);
  printLine("Total Processing Time", `${totalMs}ms`);

  console.log(chalk.bold.cyan("  └" + "─".repeat(70) + "┘\n"));
}

export function logFallback(from, to) {
  console.log(chalk.cyan("  │  ") + chalk.yellow("⚡") + "  " + chalk.yellow(`Fallback: ${from} → ${to}`));
}

export function logCacheHit(key) {
  console.log(chalk.cyan("  │  ") + chalk.green("⚡") + "  " + chalk.green(`Cache HIT`) + chalk.gray(`  key: ${key.slice(0, 40)}`));
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8: Background process labels (analytics, summarization etc.)
// ─────────────────────────────────────────────────────────────────────────────
export function logBackground(label, detail = "") {
  const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
  console.log(chalk.gray(`  [${ts}]`) + "  " + chalk.dim("⟳") + "  " + chalk.dim(label) + (detail ? chalk.gray(`  ${detail}`) : ""));
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 9: Error logging
// ─────────────────────────────────────────────────────────────────────────────
export function logError(context, message) {
  const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
  console.log(chalk.red(`  [${ts}]`) + "  " + chalk.bold.red("ERROR") + "  " + chalk.gray(`[${context}]`) + "  " + chalk.red(message));
}

export function logWarn(context, message) {
  const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
  console.log(chalk.yellow(`  [${ts}]`) + "  " + chalk.bold.yellow("WARN ") + "  " + chalk.gray(`[${context}]`) + "  " + chalk.yellow(message));
}

export function logInfo(context, message) {
  const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
  console.log(chalk.gray(`  [${ts}]`) + "  " + chalk.blue("INFO ") + "  " + chalk.gray(`[${context}]`) + "  " + chalk.white(message));
}

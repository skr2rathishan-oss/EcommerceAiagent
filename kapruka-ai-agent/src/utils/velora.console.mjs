// src/utils/velora.console.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Velora AI — Production Terminal Console
// Handles: startup wizard, health checks, live request logging
// ─────────────────────────────────────────────────────────────────────────────

import chalk from "chalk";
import readline from "readline";

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
  console.log(c.cyan(`
  ██╗   ██╗███████╗██╗      ██████╗ ██████╗  █████╗ 
  ██║   ██║██╔════╝██║     ██╔═══██╗██╔══██╗██╔══██╗
  ██║   ██║█████╗  ██║     ██║   ██║██████╔╝███████║
  ╚██╗ ██╔╝██╔══╝  ██║     ██║   ██║██╔══██╗██╔══██║
   ╚████╔╝ ███████╗███████╗╚██████╔╝██║  ██║██║  ██║
    ╚═══╝  ╚══════╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝`));
  console.log(c.gray("                  AI Shopping Agent — Operations Console"));
  console.log(c.gray("                  " + new Date().toLocaleString("en-US", { timeZone: "Asia/Colombo", hour12: true })));
  console.log();
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: Interactive Mode Selection
// ─────────────────────────────────────────────────────────────────────────────
export async function askStartupMode() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    console.log(chalk.bold.cyan("  ┌─ STARTUP CONFIGURATION " + "─".repeat(45) + "┐"));
    console.log(chalk.cyan("  │"));
    console.log(chalk.cyan("  │  ") + chalk.bold("Select Operating Mode:"));
    console.log(chalk.cyan("  │"));
    console.log(chalk.cyan("  │  ") + chalk.bold.green("  [1]") + chalk.green("  Production  ") + chalk.gray("— Gemini 2.5 Flash · Minimal logging · Live users"));
    console.log(chalk.cyan("  │  ") + chalk.bold.yellow("  [2]") + chalk.yellow("  Development ") + chalk.gray("— NVIDIA NIM      · Verbose logging  · Testing"));
    console.log(chalk.cyan("  │"));
    console.log(chalk.bold.cyan("  └" + "─".repeat(70) + "┘"));
    console.log();

    const prompt = chalk.bold.cyan("  ▶ Enter choice [1/2]: ");
    rl.question(prompt, (answer) => {
      const choice = answer.trim();
      rl.close();
      if (choice === "1") {
        console.log(chalk.bold.green("\n  ✔ Production mode selected — Gemini AI enabled\n"));
        resolve("production");
      } else {
        console.log(chalk.bold.yellow("\n  ✔ Development mode selected — NVIDIA NIM enabled\n"));
        resolve("development");
      }
    });
  });
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

  if (status === "ok") {
    icon = chalk.green("✔");
    statusStr = chalk.green(pad("OK", 12));
  } else if (status === "warn") {
    icon = chalk.yellow("⚠");
    statusStr = chalk.yellow(pad("DEGRADED", 12));
  } else if (status === "skip") {
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
  const modeColor = aiMode === "production" ? c.redB : c.yellowB;
  const modeLabel = aiMode === "production"
    ? "Gemini 2.5 Flash (Vertex AI)"
    : "NVIDIA NIM (Development)";

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
// SECTION 6: Per-Request Live Logging
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

export function logRequestFooter(intentType, totalMs, provider) {
  const providerLabel = provider?.includes("gemini") ? "Gemini" :
                        provider ? "NVIDIA NIM" : "—";
  console.log(chalk.cyan("  │  ") + chalk.gray("─".repeat(60)));
  console.log(chalk.cyan("  │  ") +
    chalk.gray("Intent: ") + chalk.white(pad(intentType || "—", 22)) +
    chalk.gray("Provider: ") + chalk.white(pad(providerLabel, 14)) +
    chalk.gray("Total: ") + chalk.bold.white(totalMs + "ms")
  );
  console.log(chalk.bold.cyan("  └" + "─".repeat(70) + "┘\n"));
}

export function logFallback(from, to) {
  console.log(chalk.cyan("  │  ") + chalk.yellow("⚡") + "  " + chalk.yellow(`Fallback: ${from} → ${to}`));
}

export function logCacheHit(key) {
  console.log(chalk.cyan("  │  ") + chalk.green("⚡") + "  " + chalk.green(`Cache HIT`) + chalk.gray(`  key: ${key.slice(0, 40)}`));
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7: Background process labels (analytics, summarization etc.)
// ─────────────────────────────────────────────────────────────────────────────
export function logBackground(label, detail = "") {
  const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
  console.log(chalk.gray(`  [${ts}]`) + "  " + chalk.dim("⟳") + "  " + chalk.dim(label) + (detail ? chalk.gray(`  ${detail}`) : ""));
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8: Error logging
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

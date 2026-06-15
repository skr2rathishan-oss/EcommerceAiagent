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
const writeLog = (levelName, msg, meta = null) => {
  const currentThreshold = getLogLevel();
  const targetLevel = LOG_LEVELS[levelName];
  if (targetLevel < currentThreshold) return;

  const timestamp = chalk.gray(`[${getTimestamp()}]`);
  
  // Style levels
  let styledLevel = `[${levelName}]`;
  if (levelName === "INFO") styledLevel = chalk.green(styledLevel);
  else if (levelName === "WARN") styledLevel = chalk.yellow(styledLevel);
  else if (levelName === "ERROR") styledLevel = chalk.red.bold(styledLevel);
  else if (levelName === "DEBUG") styledLevel = chalk.magenta(styledLevel);

  // Request correlation IDs from AsyncLocalStorage
  const { requestId, sessionId, userId } = getContext();
  const trackingStr = requestId 
    ? chalk.cyan(`[Req: ${requestId}] [Sess: ${sessionId || "N/A"}]`)
    : "";

  let metaStr = "";
  if (meta) {
    const masked = maskSecrets(meta);
    metaStr = `\n${chalk.gray(JSON.stringify(masked, null, 2))}`;
  }

  console.log(`${timestamp} ${styledLevel} ${trackingStr} ${msg}${metaStr}`);
};

export const logger = {
  debug: (msg, meta) => writeLog("DEBUG", msg, meta),
  info: (msg, meta) => writeLog("INFO", msg, meta),
  warn: (msg, meta) => writeLog("WARN", msg, meta),
  error: (msg, meta) => writeLog("ERROR", msg, meta),
  
  // Direct console utility for custom styled logs bypassing prefix formats
  raw: (msg) => console.log(msg)
};

// Startup Dashboard Drawer
export const drawStartupDashboard = (sysInfo, servicesHealth) => {
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

  // 3. Health check table
  const healthTable = new Table({
    head: [chalk.bold.blue("Service Connection"), chalk.bold.blue("Latency (ms)"), chalk.bold.blue("Health State")],
    colWidths: [30, 20, 22],
    style: { head: [], border: [] }
  });

  for (const service of servicesHealth) {
    let statusText = chalk.red.bold("OFFLINE");
    if (service.status === "connected") statusText = chalk.green("CONNECTED / OK");
    else if (service.status === "warning") statusText = chalk.yellow("WARNING / DEGRADED");
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

// Request Console Telemetry Report
export const printRequestReport = (t) => {
  if (!t) return;
  const raw = logger.raw;
  const blueLine = chalk.blue;
  const grayLine = chalk.gray;

  raw(blueLine("\n┌" + "─".repeat(74) + "┐"));
  raw(blueLine("│" + chalk.bold.white("                      AI AGENT RUN REPORT - OPERATIONS CONSOLE            ") + "│"));
  raw(blueLine("├" + "─".repeat(74) + "┤"));

  // 1. User Input
  raw(`${chalk.bold.yellow(" [USER INPUT]")}`);
  raw(`  Request ID  : ${chalk.cyan(t.userInput.requestId)}`);
  raw(`  User ID     : ${t.userInput.userId}`);
  raw(`  Session ID  : ${t.userInput.sessionId}`);
  raw(`  Timestamp   : ${t.userInput.timestamp}`);
  raw(`  Message     : "${chalk.italic.green(t.userInput.message)}"`);
  raw(grayLine("  " + "─".repeat(70)));

  // 2. Language Analysis
  raw(`${chalk.bold.yellow(" [LANGUAGE ANALYSIS]")}`);
  raw(`  Detected Language : ${t.language.detected}`);
  raw(`  Confidence        : ${t.language.confidence}`);
  raw(`  Translation Used  : ${t.language.translationUsed}`);
  raw(grayLine("  " + "─".repeat(70)));

  // 3. Intent Analysis
  raw(`${chalk.bold.yellow(" [INTENT ANALYSIS]")}`);
  raw(`  Intent Type       : ${t.intent.type}`);
  raw(`  Confidence        : ${t.intent.confidence}`);
  raw(`  Route Decision    : ${t.intent.routeDecision}`);
  raw(grayLine("  " + "─".repeat(70)));

  // 4. Model Router
  raw(`${chalk.bold.yellow(" [MODEL ROUTER]")}`);
  raw(`  Candidate Scores  :`);
  for (const model of t.router.scores) {
    const dots = ".".repeat(30 - model.name.length);
    raw(`    ${model.name} ${dots} Score: ${chalk.cyan(model.score)}`);
  }
  raw(`  Selected Model    : ${chalk.bold.green(t.router.selectedModel)}`);
  raw(`  Reason            : ${t.router.reason}`);
  raw(grayLine("  " + "─".repeat(70)));

  // 5. System Prompt Monitor
  raw(`${chalk.bold.yellow(" [SYSTEM PROMPT MONITOR]")}`);
  raw(`  Prompt Version     : ${t.prompt.version}`);
  raw(`  Prompt Length      : ${t.prompt.length} chars`);
  raw(`  Active Prompt      : ${t.prompt.activeSystemPrompt.substring(0, 80)}...`);
  raw(`  Memory Context Lng : ${t.prompt.memoryContextLength} chars`);
  raw(`  Retrieved Summary  : ${t.prompt.retrievedSummaryLength} chars`);
  raw(grayLine("  " + "─".repeat(70)));

  // 6. LLM Execution
  raw(`${chalk.bold.yellow(" [LLM EXECUTION]")}`);
  raw(`  Provider           : ${t.llm.provider}`);
  raw(`  Model              : ${t.llm.model}`);
  raw(`  TTFT               : ${t.llm.ttft} ms`);
  raw(`  Completion Time    : ${t.llm.completionTime} ms`);
  raw(`  Prompt Tokens      : ${t.llm.promptTokens}`);
  raw(`  Completion Tokens  : ${t.llm.completionTokens}`);
  raw(`  Total Tokens       : ${t.llm.totalTokens}`);
  raw(`  Estimated Cost     : $${t.llm.estimatedCost.toFixed(5)}`);
  raw(grayLine("  " + "─".repeat(70)));

  // 7. Cache System
  raw(`${chalk.bold.yellow(" [CACHE SYSTEM]")}`);
  raw(`  Redis Status       : ${t.cache.redisStatus}`);
  raw(`  Cache Hit/Miss     : ${t.cache.hitMiss === "Hit" ? chalk.green("HIT") : chalk.red("MISS")}`);
  raw(`  Cache Key          : ${t.cache.key}`);
  raw(`  Saved Latency      : ${t.cache.savedLatency} ms`);
  raw(grayLine("  " + "─".repeat(70)));

  // 8. Memory System
  raw(`${chalk.bold.yellow(" [MEMORY SYSTEM]")}`);
  raw(`  Memory Loaded      : ${t.memory.loaded}`);
  raw(`  Summary Loaded     : ${t.memory.summaryLoaded}`);
  raw(`  Memory Updated     : ${t.memory.updated}`);
  raw(`  Summary Regenerated: ${t.memory.summaryRegenerated}`);
  raw(`  MongoDB Write Time : ${t.memory.mongoWriteTime} ms`);
  raw(grayLine("  " + "─".repeat(70)));

  // 9. Product Search Pipeline (Only if search was performed)
  if (t.search.query !== "N/A" || t.search.retrieved > 0) {
    raw(`${chalk.bold.yellow(" [PRODUCT SEARCH PIPELINE]")}`);
    raw(`  Search Query       : "${t.search.query}"`);
    raw(`  Filters            : ${JSON.stringify(t.search.filters)}`);
    raw(`  Category           : ${t.search.category}`);
    raw(`  Budget             : ${t.search.budget}`);
    raw(`  Products Retrieved : ${t.search.retrieved}`);
    raw(`  Products Ranked    : ${t.search.ranked}`);
    raw(`  Products Returned  : ${t.search.returned}`);
    raw(grayLine("  " + "─".repeat(70)));
  }

  // 10. Workflow Tracker
  raw(`${chalk.bold.yellow(" [WORKFLOW TRACKER]")}`);
  const showStep = (check, label) => {
    return check ? chalk.green(`  ✓ ${label}`) : chalk.red(`  ✗ ${label}`);
  };
  raw(showStep(t.workflow.requestReceived, "Request Received"));
  raw(showStep(t.workflow.languageDetected, "Language Detected"));
  raw(showStep(t.workflow.intentClassified, "Intent Classified"));
  raw(showStep(t.workflow.memoryLoaded, "Memory Loaded"));
  raw(showStep(t.workflow.cacheChecked, "Cache Checked"));
  raw(showStep(t.workflow.modelSelected, "Model Selected"));
  if (t.search.query !== "N/A" || t.search.retrieved > 0) {
    raw(showStep(t.workflow.productSearchCompleted, "Product Search Completed"));
  }
  raw(showStep(t.workflow.responseGenerated, "Response Generated"));
  raw(showStep(t.workflow.analyticsSaved, "Analytics Saved"));
  raw(showStep(t.workflow.responseSent, "Response Sent"));
  raw(grayLine("  " + "─".repeat(70)));

  // 11. Performance Breakdown
  raw(`${chalk.bold.yellow(" [PERFORMANCE BREAKDOWN]")}`);
  const perfTable = new Table({
    head: [chalk.bold.blue("Phase"), chalk.bold.blue("Duration (ms)")],
    colWidths: [35, 25],
    style: { head: [], border: [] }
  });
  perfTable.push(
    ["Language Detection", `${t.performance.langDetection} ms`],
    ["Intent Classification", `${t.performance.intentClassification} ms`],
    ["Memory Retrieval", `${t.performance.memoryRetrieval} ms`],
    ["Redis Access", `${t.performance.redisAccess} ms`],
    ["Product Search Pipeline", `${t.performance.productSearch} ms`],
    ["LLM Time to First Token", `${t.performance.llmTtft} ms`],
    ["LLM Output Generation", `${t.performance.llmGeneration} ms`],
    [chalk.bold("Total Request Duration"), chalk.bold(`${t.performance.totalTime} ms`)]
  );
  raw(perfTable.toString());

  // 12. Error Console (if errors occurred)
  if (t.error) {
    raw(grayLine("  " + "─".repeat(70)));
    raw(`${chalk.bold.red(" [ERROR CONSOLE]")}`);
    const errTable = new Table({
      head: [chalk.bold.red("Field"), chalk.bold.red("Details")],
      colWidths: [20, 50],
      style: { head: [], border: [] }
    });
    errTable.push(
      ["Service Name", t.error.serviceName || "Unknown"],
      ["Error Type", t.error.errorType || "Fatal"],
      ["Error Message", chalk.red(t.error.errorMessage)],
      ["Recovery Action", t.error.recoveryAction || "None"],
      ["Fallback Used", t.error.fallbackModel || "None"]
    );
    raw(errTable.toString());
    if (t.error.stackTrace) {
      raw(`\n${chalk.bold.red("Stack Trace:")}`);
      raw(chalk.gray(t.error.stackTrace));
    }
  }

  raw(blueLine("└" + "─".repeat(74) + "┘\n"));
};

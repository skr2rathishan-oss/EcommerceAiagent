// src/test/console.test.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Test suite for Velora AI Operations Console & Startup Diagnostics
// ─────────────────────────────────────────────────────────────────────────────

import {
  validateEnv,
  validateMongoDB,
  validateCache,
  validateResponseLibrary,
  validateConversationPipeline,
  validateCommerceEngine,
  runStartupChecks
} from "../services/core/startupHealthService.mjs";
import { printOperationsConsole, logRequestFooter } from "../utils/velora.console.mjs";
import assert from "assert";

async function runTests() {
  console.log("=== RUNNING OPERATIONS CONSOLE TESTS ===\n");

  // 1. Test validateEnv
  console.log("Testing validateEnv...");
  const envRes = validateEnv();
  assert.ok(envRes.status === "PASS" || envRes.status === "FAIL");
  assert.ok(Array.isArray(envRes.errors));
  assert.ok(Array.isArray(envRes.warnings));
  console.log("✔ validateEnv passed\n");

  // 2. Test validateResponseLibrary
  console.log("Testing validateResponseLibrary...");
  const resLib = validateResponseLibrary();
  assert.ok(resLib.status);
  assert.ok(typeof resLib.status.common === "string");
  assert.ok(typeof resLib.status.languageTemplates === "string");
  assert.ok(Array.isArray(resLib.errors));
  console.log("✔ validateResponseLibrary passed\n");

  // 3. Test validateConversationPipeline
  console.log("Testing validateConversationPipeline...");
  const pipe = validateConversationPipeline();
  assert.ok(pipe.status === "READY" || pipe.status === "FAILED");
  assert.ok(pipe.details);
  assert.strictEqual(typeof pipe.details.understanding, "boolean");
  console.log("✔ validateConversationPipeline passed\n");

  // 4. Test validateCommerceEngine
  console.log("Testing validateCommerceEngine...");
  const comm = validateCommerceEngine();
  assert.ok(comm.status === "READY" || comm.status === "FAILED");
  assert.ok(comm.details);
  assert.strictEqual(typeof comm.details.productSearch, "boolean");
  console.log("✔ validateCommerceEngine passed\n");

  // 5. Test printOperationsConsole with mock data
  console.log("Testing printOperationsConsole rendering (non-throwing)...");
  const mockData = {
    systemInfo: {
      env: "development",
      version: "2.0.0",
      nodeVersion: process.version,
      platform: process.platform,
      port: 5000,
      pid: process.pid,
      startTime: new Date().toISOString(),
      uptime: 10
    },
    env: { status: "PASS", errors: [], warnings: [] },
    mongoDB: { status: "CONNECTED", latency: 15, error: "" },
    cache: { status: "CONNECTED", latency: 5, detail: "In-Memory Cache" },
    gemini: { status: "CONNECTED", latency: 250, error: "" },
    mcp: { status: "CONNECTED", latency: 45, error: "" },
    googleSpeech: { status: "CONNECTED", error: "" },
    elevenLabs: { status: "SKIPPED", error: "" },
    responseLibrary: {
      status: {
        common: "PASS",
        shopping: "PASS",
        delivery: "PASS",
        order: "PASS",
        recovery: "PASS",
        interruption: "PASS",
        languageTemplates: "PASS"
      },
      errors: []
    },
    conversationPipeline: pipe,
    commerceEngine: comm,
    criticalFailures: 0
  };

  // Ensure calling printOperationsConsole does not throw any exceptions
  try {
    printOperationsConsole(mockData);
    console.log("\n✔ printOperationsConsole rendered successfully\n");
  } catch (err) {
    console.error("✘ printOperationsConsole threw an error:", err);
    process.exit(1);
  }

  // 6. Test logRequestFooter with mock context
  console.log("Testing logRequestFooter rendering...");
  try {
    logRequestFooter("search_products", 350, "gemini");
    console.log("✔ logRequestFooter rendered successfully\n");
  } catch (err) {
    console.error("✘ logRequestFooter threw an error:", err);
    process.exit(1);
  }

  console.log("=== ALL CONSOLE TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});

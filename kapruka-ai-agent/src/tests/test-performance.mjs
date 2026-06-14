// test-performance.mjs
// Simulates API pipeline stages and records timing metrics for 20 test runs.

import {
  recordIntentDetection,
  recordMemoryLoad,
  recordMongoRead,
  recordQwenResponse,
  recordMcpSearch,
  recordFormatting,
  recordTotal,
  getAllAverages,
  resetMetrics
} from "../services/performance.service.mjs";

console.log("\n=== STARTING PERFORMANCE TEST ===\n");

resetMetrics();

const TEST_RUNS = 20;

for (let i = 1; i <= TEST_RUNS; i++) {
  console.log(`Running Test ${i}/${TEST_RUNS}`);

  const requestStart = Date.now();

  // Intent Detection
  const intentTime = 20 + Math.random() * 40;
  recordIntentDetection(intentTime);

  // Memory Load
  const memoryTime = 5 + Math.random() * 15;
  recordMemoryLoad(memoryTime);

  // Mongo Read
  const mongoTime = 3 + Math.random() * 10;
  recordMongoRead(mongoTime);

  // Qwen LLM Response
  const qwenTime = 2000 + Math.random() * 2000;
  recordQwenResponse(qwenTime);

  // MCP Product Search
  const mcpTime = 200 + Math.random() * 500;
  recordMcpSearch(mcpTime);

  // Formatting
  const formatTime = 5 + Math.random() * 20;
  recordFormatting(formatTime);

  const total =
    intentTime +
    memoryTime +
    mongoTime +
    qwenTime +
    mcpTime +
    formatTime;

  recordTotal(total);

  console.log(`  → Total Request Time: ${Math.round(total)}ms`);
}

console.log("\n=== PERFORMANCE SUMMARY ===\n");

const averages = getAllAverages();

console.table({
  "Intent Detection": `${averages.averageIntentDetection.toFixed(2)} ms`,
  "Memory Load":      `${averages.averageMemoryLoad.toFixed(2)} ms`,
  "Mongo Read":       `${averages.averageMongoRead.toFixed(2)} ms`,
  "Qwen Response":    `${averages.averageQwenResponse.toFixed(2)} ms`,
  "MCP Search":       `${averages.averageMcpSearch.toFixed(2)} ms`,
  "Formatting":       `${averages.averageFormatting.toFixed(2)} ms`,
  "Total Request":    `${averages.averageTotalRequest.toFixed(2)} ms`
});

console.log("\n=== TEST COMPLETE ===\n");

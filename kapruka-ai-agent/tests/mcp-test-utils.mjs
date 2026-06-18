// ============================================================
// tests/mcp-test-utils.mjs
// Shared helper utilities for the Phase 2 MCP backend tests.
// ============================================================

import { getMcpClient } from "../src/services/integration/mcp.client.mock.mjs";

// ─── colour helpers (works in cmd.exe too via simple ANSI) ──────────────────
const c = {
  reset:  "\x1b[0m",
  green:  "\x1b[32m",
  red:    "\x1b[31m",
  yellow: "\x1b[33m",
  cyan:   "\x1b[36m",
  bold:   "\x1b[1m",
  dim:    "\x1b[2m",
};

const PASS = `${c.green}${c.bold}PASS${c.reset}`;
const FAIL = `${c.red}${c.bold}FAIL${c.reset}`;

// ─── result accumulator ──────────────────────────────────────────────────────
export const results = [];   // { tool, caseName, type, passed, resp, args }

// ─── core call wrapper ────────────────────────────────────────────────────────
/**
 * Call an MCP tool and capture detailed response information.
 *
 * Returns:
 *   raw       – raw string content (may be empty)
 *   parsed    – JSON‑parsed object if possible, null otherwise
 *   error     – error message string if the call threw (or response.error exists)
 *   stack     – stack trace if available
 *   status    – HTTP‑style status code (mock may not supply one)
 *   statusText – HTTP‑style status text
 *   rawResult – the full raw result object returned by callTool
 */
export async function callMcpTool(toolName, args) {
  const client = await getMcpClient();
  try {
    const rawResult = await client.callTool({ name: toolName, arguments: args });

    // The mock puts error info directly on the result object
    if (rawResult?.error) {
      const errMsg = typeof rawResult.error === "object"
        ? rawResult.error.message
        : String(rawResult.error);
      return {
        raw: null,
        parsed: null,
        error: errMsg,
        stack: null,
        status: rawResult?.status,
        statusText: rawResult?.statusText,
        rawResult,
      };
    }

    const raw =
      rawResult?.structuredContent?.result ??
      rawResult?.content?.[0]?.text ??
      "";

    let parsed = null;
    try { parsed = JSON.parse(raw); } catch (_) { /* keep null */ }

    return {
      raw,
      parsed,
      error: null,
      stack: null,
      status: rawResult?.status,
      statusText: rawResult?.statusText,
      rawResult,
    };
  } catch (e) {
    return {
      raw: null,
      parsed: null,
      error: e.message,
      stack: e.stack,
      status: undefined,
      statusText: undefined,
      rawResult: null,
    };
  }
}

// ─── test helpers ─────────────────────────────────────────────────────────────

/**
 * expectSuccess – the tool must return a non‑error response.
 *   Positive test: success → PASS, error → FAIL
 */
export async function expectSuccess(toolName, args, caseName = toolName) {
  const resp = await callMcpTool(toolName, args);

  // Log raw MCP response
  console.log(`\n${c.dim}[Raw MCP response for ${toolName} / ${caseName}]${c.reset}`);
  console.log(JSON.stringify(resp.rawResult, null, 2));

  const passed = !resp.error;
  _logResult(toolName, caseName, "positive", args, resp, passed);
  results.push({ tool: toolName, caseName, type: "positive", passed, resp, args });
  return passed;
}

/**
 * expectFailure – the tool must return an error response.
 *   Negative test: error → PASS, success → FAIL
 */
export async function expectFailure(toolName, args, caseName = toolName) {
  const resp = await callMcpTool(toolName, args);

  // Log raw MCP response
  console.log(`\n${c.dim}[Raw MCP response for ${toolName} / ${caseName}]${c.reset}`);
  console.log(JSON.stringify(resp.rawResult, null, 2));

  const passed = !!resp.error;
  _logResult(toolName, caseName, "negative", args, resp, passed);
  results.push({ tool: toolName, caseName, type: "negative", passed, resp, args });
  return passed;
}

// ─── internal logging ─────────────────────────────────────────────────────────

function _logResult(toolName, caseName, type, args, resp, passed) {
  const statusLabel  = passed ? PASS : FAIL;
  const typeLabel    = type === "negative" ? "(negative – expects error)" : "(positive – expects success)";
  const errorNote    = resp.error ? `Error: ${resp.error}` : "ok";

  console.log(`\n${c.bold}${toolName}${c.reset} › ${c.cyan}${caseName}${c.reset} ${typeLabel}`);
  console.log(`Result: ${statusLabel}   ${c.dim}(${errorNote})${c.reset}`);

  if (!passed) {
    console.log(`\n${c.yellow}─── Failure Detail ───────────────────────────────${c.reset}`);
    console.log(`Tool:       ${toolName}`);
    console.log(`Test case:  ${caseName}`);
    console.log(`Test type:  ${type === "negative" ? "Negative (expected an error)" : "Positive (expected success)"}`);

    console.log(`\nInput parameters:`);
    console.log(JSON.stringify(args, null, 2));

    if (type === "negative") {
      console.log(`\nExpected:  Validation / rejection error from MCP`);
      console.log(`Actual:    ${resp.error ? `Error – ${resp.error}` : "Success (no error returned)"}`);
    } else {
      console.log(`\nExpected:  Successful response`);
      console.log(`Actual:    ${resp.error ? `Error – ${resp.error}` : "Unknown failure"}`);
    }

    console.log(`\nRaw MCP response body:`);
    console.log(resp.raw ?? "(empty)");

    if (resp.error)     console.log(`\nError message:\n  ${resp.error}`);
    if (resp.stack)     console.log(`\nStack trace:\n${resp.stack}`);
    if (resp.status !== undefined)
                        console.log(`\nHTTP Status:     ${resp.status}`);
    if (resp.statusText)
                        console.log(`HTTP StatusText: ${resp.statusText}`);

    console.log(`${c.yellow}──────────────────────────────────────────────────${c.reset}`);
  }
}

// ─── final report ─────────────────────────────────────────────────────────────

export function printFinalReport() {
  console.log(`\n\n${c.bold}════════════════════════════════════════${c.reset}`);
  console.log(`${c.bold}        MCP INTEGRATION TEST REPORT     ${c.reset}`);
  console.log(`${c.bold}════════════════════════════════════════${c.reset}\n`);

  // Group by tool
  const byTool = {};
  for (const r of results) {
    if (!byTool[r.tool]) byTool[r.tool] = { positive: [], negative: [] };
    byTool[r.tool][r.type].push(r);
  }

  const suspectedBugs = [];

  for (const [tool, groups] of Object.entries(byTool)) {
    const posPass  = groups.positive.filter(r => r.passed).length;
    const posFail  = groups.positive.filter(r => !r.passed).length;
    const negPass  = groups.negative.filter(r => r.passed).length;
    const negFail  = groups.negative.filter(r => !r.passed).length;
    const total    = groups.positive.length + groups.negative.length;
    const totalPass = posPass + negPass;

    const allOk = totalPass === total;
    const toolStatus = allOk ? `${c.green}✔${c.reset}` : `${c.red}✘${c.reset}`;

    console.log(`${toolStatus} ${c.bold}${tool}${c.reset}`);
    console.log(`   Positive tests : ${posPass} PASS / ${posFail} FAIL  (of ${groups.positive.length})`);
    console.log(`   Negative tests : ${negPass} PASS / ${negFail} FAIL  (of ${groups.negative.length})`);
    console.log();

    // Flag suspected bugs (positive test failed = MCP rejected valid input)
    for (const r of groups.positive) {
      if (!r.passed) {
        suspectedBugs.push({
          tool,
          caseName: r.caseName,
          reason: `Valid input was rejected — Error: ${r.resp.error ?? "unknown"}`,
        });
      }
    }
  }

  // Overall totals
  const totalPass  = results.filter(r => r.passed).length;
  const totalFail  = results.filter(r => !r.passed).length;
  console.log(`${c.bold}Total: ${totalPass} PASS / ${totalFail} FAIL  (${results.length} tests)${c.reset}`);

  // Suspected MCP bugs section
  if (suspectedBugs.length) {
    console.log(`\n${c.red}${c.bold}═══ SUSPECTED MCP BUGS ═══${c.reset}`);
    console.log(`${c.dim}(valid input that caused an unexpected failure)${c.reset}\n`);
    for (const bug of suspectedBugs) {
      console.log(`  ${c.red}✘${c.reset} ${bug.tool} › ${bug.caseName}`);
      console.log(`    ${bug.reason}`);
    }
  } else {
    console.log(`\n${c.green}No suspected MCP bugs detected.${c.reset}`);
  }

  console.log(`\n${c.bold}════════════════════════════════════════${c.reset}\n`);
}

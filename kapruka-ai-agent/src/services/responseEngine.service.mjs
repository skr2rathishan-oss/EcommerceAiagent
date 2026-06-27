/**
 * responseEngine.service.mjs
 *
 * Response Engine for Velora AI Agent.
 *
 * Reads the Decision Object produced by conversationUnderstanding.service.mjs
 * and selects the appropriate response template from the Response Library.
 *
 * Response Library structure:
 *   ai/context/responseLibrary/
 *     common/       greeting.json, small_talk.json, confused.json, …
 *     shopping/     search.json, recommendations.json, product_details.json, …
 *     delivery/     ask_delivery_address.json, address_confirmed.json, …
 *     order/        payment.json, order_confirmation.json, …
 *     recovery/     recovery.json, …
 *     interruption/ interruption.json, …
 *
 * Each JSON file has the shape:
 *   { "<category>": { "english": [...], "sinhala_mix": [...], "tamil_mix": [...] } }
 *
 * Usage:
 *   import { selectResponse } from "../responseEngine.service.mjs";
 *   const text = selectResponse(decision);
 *   // Returns a string from the appropriate language array, or null if no match.
 */

import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join }  from "path";
import fs                 from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// ── Response Library root ─────────────────────────────────────────────────────
const LIBRARY_ROOT = join(
  __dirname,
  "../ai/context/responseLibrary"
);

// ── In-memory cache for loaded JSON files ────────────────────────────────────
const _cache = new Map();

/**
 * loadResponseFile(module, category)
 * Loads the JSON response file for the given module and category.
 * Returns the array of response strings for the given language,
 * or null if the file / language / category is not found.
 */
function loadResponseFile(module, category) {
  const cacheKey = `${module}/${category}`;
  if (_cache.has(cacheKey)) return _cache.get(cacheKey);

  // Try exact filename match first, then partial match
  const dir = join(LIBRARY_ROOT, module);
  if (!fs.existsSync(dir)) {
    _cache.set(cacheKey, null);
    return null;
  }

  const exactPath = join(dir, `${category}.json`);
  if (fs.existsSync(exactPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(exactPath, "utf-8"));
      _cache.set(cacheKey, data);
      return data;
    } catch {
      _cache.set(cacheKey, null);
      return null;
    }
  }

  // Fallback: find a file whose name starts with the category
  const files = fs.readdirSync(dir);
  const match = files.find(f => f.replace(".json", "") === category);
  if (match) {
    try {
      const data = JSON.parse(fs.readFileSync(join(dir, match), "utf-8"));
      _cache.set(cacheKey, data);
      return data;
    } catch {
      _cache.set(cacheKey, null);
      return null;
    }
  }

  _cache.set(cacheKey, null);
  return null;
}

/**
 * pickRandom(arr)
 * Picks a random element from an array.
 */
function pickRandom(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

// Keep track of the last returned response per user session and category to prevent duplicates
const lastReturnedResponses = new Map();

/**
 * selectResponse(decision)
 *
 * Selects a response string from the Response Library based on the Decision Object
 * and returns a standardized response object.
 *
 * @param {object} decision - Decision Object
 * @param {object} [variables] - Optional variable map to inject into the template
 * @param {string|null} [sessionId] - Optional session ID for duplicate prevention
 * @returns {object|null} - A response object, or null if no library match.
 */
function logExit({ category, template, fallbackUsed, llmUsed, streaming, duration }) {
  console.log(`
=========================
RESPONSE ENGINE EXIT
=========================

Response Category: ${category || "N/A"}

Template: ${template || "None"}

Fallback Used: ${fallbackUsed ? "yes" : "no"}

LLM Used: ${llmUsed ? "yes" : "no"}

Streaming: ${streaming ? "yes" : "no"}

Duration: ${duration}ms

=========================
  `.trim());
}

export function selectResponse(decision, variables = {}, sessionId = null, workflowDecision = null) {
  const startTime = Date.now();
  const stack = new Error().stack || "";
  const isStream = stack.includes("chatStream");
  const controller = isStream ? "chatStream.controller" : "chat.controller";
  const intent = decision?.intent?.value || "N/A";
  const workflow = workflowDecision?.workflow || decision?.response?.module || "N/A";
  const reference = decision?.variables?.product_id || decision?.variables?.product_name || "N/A";

  console.log(`
=========================
RESPONSE ENGINE ENTRY
=========================

Endpoint:
/api/chat

Controller:
${controller}

Intent:
${intent}

Workflow:
${workflow}

Reference:
${reference}

Calling Response Engine...

=========================
  `.trim());

  const result = _selectResponseInternal(decision, variables, sessionId, workflowDecision);

  const duration = Date.now() - startTime;
  const isLlm = decision?.llm_response === true || (result === null && decision?.llm_response !== false);
  const isFallback = result === null;

  logExit({
    category: result ? result.category : (decision?.category || "N/A"),
    template: result ? result.text : null,
    fallbackUsed: isFallback && !isLlm,
    llmUsed: isLlm,
    streaming: isStream,
    duration
  });

  return result;
}

function _selectResponseInternal(decision, variables = {}, sessionId = null, workflowDecision = null) {
  let resolvedDecision = decision;

  if (workflowDecision) {
    let module = "common";
    let category = "small_talk";
    let llm_response = false;

    if (workflowDecision.action === "clarify") {
      module = "common";
      category = "confused";
    } else {
      switch (workflowDecision.workflow) {
        case "greeting":
          module = "common";
          category = "greeting";
          break;
        case "product_search":
          module = "shopping";
          category = "search";
          llm_response = true;
          break;
        case "product_details":
          module = "shopping";
          category = "product_details";
          llm_response = true;
          break;
        case "delivery":
          module = "delivery";
          category = "ask_delivery_address";
          break;
        case "checkout":
          module = "order";
          category = "payment";
          break;
        case "order_tracking":
          module = "order";
          category = "order_confirmation";
          llm_response = true;
          break;
        case "recovery":
          module = "recovery";
          category = "recovery";
          llm_response = true;
          break;
        default:
          module = "common";
          category = "small_talk";
          llm_response = true;
      }
    }

    resolvedDecision = {
      ...decision,
      module,
      category,
      llm_response: (decision && typeof decision.llm_response === "boolean") ? decision.llm_response : llm_response,
      response: { module, category }
    };
  }

  if (!resolvedDecision) return null;

  // If Decision Object says LLM should respond, don't use the library.
  if (resolvedDecision.llm_response === true) return null;

  const module = resolvedDecision.response?.module || resolvedDecision.module;
  const category = resolvedDecision.response?.category || resolvedDecision.category;
  if (!module || !category) return null;

  const language = decision.language;
  const langCode = language?.detected || "english";

  // Normalize language to one of the three supported variants in JSON files
  const langKey =
    langCode === "sinhala_mix" || langCode === "sinhala" ? "sinhala_mix" :
    langCode === "tamil_mix"   || langCode === "tamil"   ? "tamil_mix"   :
    "english";

  // Load the JSON file
  const data = loadResponseFile(module, category);
  if (!data) return null;

  // JSON files have shape: { "<category>": { "english": [...], ... } }
  const section = data[category];
  if (!section) return null;

  const variants = section[langKey] || section["english"];
  if (!variants || variants.length === 0) return null;

  // ── Duplicate Prevention ──────────────────────────────────────────────────
  let responseText = null;
  if (variants.length > 1 && sessionId) {
    const lastKey = `${sessionId}:${category}`;
    const lastVal = lastReturnedResponses.get(lastKey);
    const alternatives = variants.filter(v => v !== lastVal);
    if (alternatives.length > 0) {
      responseText = pickRandom(alternatives);
    }
  }
  if (!responseText) {
    responseText = pickRandom(variants);
  }

  if (sessionId) {
    lastReturnedResponses.set(`${sessionId}:${category}`, responseText);
  }

  // ── Variable injection ────────────────────────────────────────────────────
  // Replace {{variable_name}} and {variable_name} placeholders with actual values.
  const allVars = { ...(decision.variables || {}), ...variables };
  if (responseText && Object.keys(allVars).length > 0) {
    // Double curly braces {{var}}
    responseText = responseText.replace(/\{\{(\w+)\}\}/g, (_, key) =>
      allVars[key] !== undefined ? String(allVars[key]) : `{{${key}}}`
    );
    // Single curly braces {var}
    responseText = responseText.replace(/\{(\w+)\}/g, (_, key) =>
      allVars[key] !== undefined ? String(allVars[key]) : `{${key}}`
    );
  }

  return {
    text: responseText,
    module,
    category,
    language: langCode,
    source: "response_library"
  };
}

/**
 * selectResponseWithFallback(decision, variables, sessionId)
 *
 * Same as selectResponse but falls back to the "common/small_talk" library
 * if the specific module/category has no match and llm_response is false.
 */
export function selectResponseWithFallback(decision, variables = {}, sessionId = null) {
  const primary = selectResponse(decision, variables, sessionId);
  if (primary) return primary;

  // Fallback to common/small_talk
  const fallbackDecision = {
    ...decision,
    response: {
      module: "common",
      category: "small_talk"
    },
    module: "common",
    category: "small_talk",
    llm_response: false,
  };
  return selectResponse(fallbackDecision, variables, sessionId);
}

/**
 * clearResponseCache()
 * Clears the in-memory JSON cache. Useful in tests or hot-reload scenarios.
 */
export function clearResponseCache() {
  _cache.clear();
}

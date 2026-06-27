import "../config/loadEnv.mjs";
import { getPromptCache, initializePromptCache, getPromptCacheInfo } from "../agent/core/promptCache.mjs";
import { buildRuntimeContext } from "../agent/builders/runtimeBuilder.mjs";
import { buildSystemPrompt, buildPromptPackage } from "../agent/system/buildSystemPrompt.mjs";
import { validatePrompt } from "../agent/validators/promptValidator.mjs";
import { compressPrompt } from "../agent/validators/promptCompressor.mjs";
import { getPromptInformation } from "../agent/core/promptLoader.mjs";

async function runTest() {
  console.log("=== Testing Prompt OS Components ===");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // 1. Test Cache Initialization
    console.log("\n--- Test 1: Prompt Cache ---");
    initializePromptCache();
    const info = getPromptCacheInfo();
    assert(info.cached === true, "Prompt Cache is initialized and cached is true");
    assert(info.size > 0, `Prompt OS size is greater than 0: ${info.size} chars`);

    const cachedPrompt = getPromptCache();
    assert(cachedPrompt.includes("VELORA PROMPT OPERATING SYSTEM"), "Cached prompt contains headers");

    // 2. Test Runtime Builder
    console.log("\n--- Test 2: Runtime Builder ---");
    const mockContext = {
      decision: {
        language: { code: "si", detected: "Sinhala" },
        intent: { value: "search_products" },
        emotion: "celebration",
        conversationStage: "browsing"
      },
      conversationState: {
        activeFlow: "shopping",
        currentStep: "searching",
        isInterrupted: false
      },
      memory: {
        cart: [{ name: "Chocolate Cake", price: 3500, quantity: 1 }],
        customerPreferences: ["likes dark chocolate"]
      },
      latestMessage: "I want a chocolate cake"
    };

    const runtime = buildRuntimeContext(mockContext);
    assert(runtime.prompt !== undefined, "Runtime prompt generated");
    assert(runtime.prompt.includes("VELORA RUNTIME CONTEXT"), "Runtime prompt contains header");
    assert(runtime.prompt.includes("Language             : si"), "Runtime prompt contains language 'si'");
    assert(runtime.prompt.includes("Active Workflow      : shopping"), "Runtime prompt contains workflow 'shopping'");

    // 3. Test System Prompt Builder
    console.log("\n--- Test 3: System Prompt Builder ---");
    const systemPrompt = buildSystemPrompt(mockContext);
    assert(systemPrompt.includes("VELORA AI SYSTEM PROMPT"), "System prompt contains AI system prompt header");
    assert(systemPrompt.includes("VELORA RUNTIME CONTEXT"), "System prompt contains runtime context header");
    assert(systemPrompt.includes("LATEST CUSTOMER MESSAGE"), "System prompt contains latest customer message header");

    // 4. Test Prompt Validator
    console.log("\n--- Test 4: Prompt Validator ---");
    const validationSuccess = validatePrompt(systemPrompt);
    assert(validationSuccess.valid === true, "Validator correctly validates the generated system prompt");
    assert(validationSuccess.errors.length === 0, "Validator returns no errors for a valid prompt");

    const validationFail = validatePrompt("This is an invalid prompt");
    assert(validationFail.valid === false, "Validator correctly rejects an invalid prompt");
    assert(validationFail.errors.length > 0, "Validator returns error list for invalid prompt");

    // 5. Test Prompt Compressor
    console.log("\n--- Test 5: Prompt Compressor ---");
    const originalText = "Hello  \n\n\n\nWorld   \n";
    const compressed = compressPrompt(originalText);
    assert(compressed === "Hello\n\nWorld", `Compressor removes trailing space and collapses blank lines: ${JSON.stringify(compressed)}`);

    // 6. Test Prompt Loader
    console.log("\n--- Test 6: Prompt Loader ---");
    const loaderInfo = getPromptInformation();
    assert(loaderInfo.version === "2.0.0", "Prompt Loader returns version 2.0.0");
    assert(loaderInfo.promptModules === 19, "Prompt Loader returns total of 19 prompt modules");
    assert(loaderInfo.runtimeModules === 6, "Prompt Loader returns total of 6 runtime modules");

    console.log(`\n==================================================`);
    console.log(`Results: ${passed} passed, ${failed} failed`);

  } catch (err) {
    console.error("Test execution failed:", err);
    failed++;
  }

  process.exit(failed > 0 ? 1 : 0);
}

runTest();

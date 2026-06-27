import "../config/loadEnv.mjs";
import { connectDB } from "../database/mongo.mjs";
import mongoose from "mongoose";
import { detectLanguageExtended, runHeuristicDetection } from "../utils/language.utils.mjs";
import { understandConversation } from "../services/ai/conversationUnderstanding.service.mjs";
import { buildDecision } from "../services/ai/decisionBuilder.mjs";

async function runTests() {
  console.log("=== RUNNING STATEFUL LANGUAGE INTELLIGENCE ENGINE TESTS ===");
  
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

  // ── Test Case 1: Simple Heuristic Detection ──────────────────────────────────
  console.log("\n--- Test 1: Heuristic Scoring & Scripts ---");
  
  const case1_si = runHeuristicDetection("කොහොමද ඔයාට?");
  assert(case1_si.language === "sinhala" && case1_si.confidence === 1.0, "Sinhala script detected directly");

  const case1_ta = runHeuristicDetection("வணக்கம்");
  assert(case1_ta.language === "tamil" && case1_ta.confidence === 1.0, "Tamil script detected directly");

  const case1_singlish = runHeuristicDetection("machan cake ekak one");
  assert(case1_singlish.language === "sinhala_mix" && case1_singlish.confidence > 0.7, "Romanized Singlish detected with high confidence");

  const case1_tanglish = runHeuristicDetection("anna laptop venum");
  assert(case1_tanglish.language === "tamil_mix" && case1_tanglish.confidence > 0.7, "Romanized Tanglish detected with high confidence");


  // ── Test Case 2: Short Message Stickiness ───────────────────────────────────
  console.log("\n--- Test 2: Short Message Stickiness ---");
  // We simulate a session where preferred language is set to tamil_mix.
  // The user sends "thanks" (which has low confidence/is short). It should stay tamil_mix.
  const sessionState2 = {
    preferredLanguage: "tamil_mix",
    consecutiveMessagesInSameLanguage: 5
  };
  const result2 = await detectLanguageExtended("thanks", [], sessionState2);
  assert(result2.language === "tamil_mix", `Short message 'thanks' stuck to preferred language: ${result2.language}`);
  assert(result2.reason === "sticky_preferred_language", `Reason matches expected sticky label: ${result2.reason}`);


  // ── Test Case 3: Gradual Language Switch ─────────────────────────────────────
  console.log("\n--- Test 3: Gradual Language Switch ---");
  // Preferred language is tamil_mix. User suddenly sends 3 substantive English messages.
  // Message 1 (English, substantive): should not switch preferredLanguage yet, but returns preferred (tamil_mix).
  const sessionState3 = {
    preferredLanguage: "tamil_mix",
    consecutiveMessagesInSameLanguage: 4
  };
  const history3 = [];

  const r3_1 = await detectLanguageExtended("show me birthday cakes", history3, sessionState3);
  assert(r3_1.language === "tamil_mix", `Message 1 didn't trigger switch (remained: ${r3_1.language})`);
  history3.push({ role: "user", content: "show me birthday cakes" });

  // Message 2 (English, substantive): should not switch yet (remains tamil_mix).
  const r3_2 = await detectLanguageExtended("deliver this item tomorrow", history3, sessionState3);
  assert(r3_2.language === "tamil_mix", `Message 2 didn't trigger switch (remained: ${r3_2.language})`);
  history3.push({ role: "user", content: "deliver this item tomorrow" });

  // Message 3 (English, substantive): should switch to english now because history has 2 previous English messages.
  const r3_3 = await detectLanguageExtended("what is the total price?", history3, sessionState3);
  assert(r3_3.language === "english", `Message 3 triggered switch to english (got: ${r3_3.language})`);
  assert(sessionState3.preferredLanguage === "english", `Preferred language in session state is now english`);


  // ── Test Case 4: LLM Fallback (Low confidence) ──────────────────────────────
  console.log("\n--- Test 4: LLM Fallback ---");
  // We run a low confidence message (mix of words like "compare this phone").
  // Since we pass a mock LLM fallback resolver that returns "tamil_mix", it should return tamil_mix.
  const mockLLM = async (msg) => {
    console.log(`    [Mock LLM called for: "${msg}"]`);
    return "tamil_mix";
  };
  
  const sessionState4 = {
    preferredLanguage: "english",
    consecutiveMessagesInSameLanguage: 0
  };

  // We use a query that yields low confidence heuristics
  const result4 = await detectLanguageExtended("machan unga cake item today", [], sessionState4, mockLLM);
  assert(result4.language === "tamil_mix", `LLM fallback was successfully triggered and classified as: ${result4.language}`);
  assert(result4.reason === "llm_fallback", `Reason is llm_fallback: ${result4.reason}`);

  console.log(`\n==================================================`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(e => {
  console.error("Test execution failed:", e);
  process.exit(1);
});

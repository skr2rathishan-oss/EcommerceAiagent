import assert from "assert";
import { 
  isSimpleConversation, 
  selectModel, 
  detectIntent,
  PRIMARY_MODEL, 
  GENERAL_MODEL, 
  LLAMA_MODEL 
} from "../services/llm.service.mjs";

console.log("\n=== STARTING MODEL ROUTING UNIT TESTS ===\n");

let passed = 0;
let failed = 0;

function testAssert(label, condition) {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

(async () => {
  // 1. Test isSimpleConversation
  console.log("--- Test 1: Greeting / General Chat detection (isSimpleConversation) ---");
  testAssert("Exact hi is simple conversation", isSimpleConversation("hi"));
  testAssert("Exact hello is simple conversation", isSimpleConversation("hello"));
  testAssert("Punctuation-stripped 'hi, how are you?' is simple conversation", isSimpleConversation("hi, how are you?"));
  testAssert("Punctuation-stripped 'How are you doing?!' is simple conversation", isSimpleConversation("How are you doing?!"));
  testAssert("Punctuation-stripped 'thanks so much' is simple conversation", isSimpleConversation("thanks"));
  testAssert("Shopping query is NOT simple conversation", !isSimpleConversation("Recommend a birthday cake"));
  testAssert("Product query is NOT simple conversation", !isSimpleConversation("Do you have chocolate cakes under 5000?"));

  // 2. Test selectModel (GPT language detection based routing)
  console.log("\n--- Test 2: Model Selection (selectModel via GPT Language Detection) ---");
  testAssert("Simple greeting routes to GENERAL_MODEL (GPT)", (await selectModel("hi")) === GENERAL_MODEL);
  testAssert("Simple greeting 'hi how are you' routes to GENERAL_MODEL (GPT)", (await selectModel("hi how are you")) === GENERAL_MODEL);
  testAssert("English query in general chat routes to GENERAL_MODEL (GPT)", (await selectModel("Recommend a birthday cake", "en")) === GENERAL_MODEL);
  testAssert("Sinhala query in general chat routes to PRIMARY_MODEL (Qwen)", (await selectModel("මට කේක් එකක් ඕනේ", "si")) === PRIMARY_MODEL);
  testAssert("Singlish query in general chat routes to PRIMARY_MODEL (Qwen)", (await selectModel("kohomada oyata", "en")) === PRIMARY_MODEL);
  testAssert("Tamil query in general chat routes to PRIMARY_MODEL (Qwen)", (await selectModel("எனக்கு கேக் வேண்டும்", "ta")) === PRIMARY_MODEL);
  testAssert("French query in general chat routes to GENERAL_MODEL (GPT)", (await selectModel("Recommander un gâteau", "fr")) === GENERAL_MODEL);

  console.log("\n=== MODEL ROUTING UNIT TESTS COMPLETE ===");
  console.log(`Passed: ${passed} | Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
})();

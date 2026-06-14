import { detectLanguage } from "../services/languageDetector.js";
import {
  translateToEnglish,
  translateToSinhala,
  translateToTamil,
} from "../services/translationService.js";

async function runTests() {
  console.log("==========================================");
  console.log("🧪 Starting Translation Layer Tests");
  console.log("==========================================\n");

  // 1. Test Language Detection
  const detectionTestCases = [
    { text: "hello, I want to buy a chocolate cake", expected: "en" },
    { text: "මට චොකලට් කේක් එකක් ගන්න ඕනෙ", expected: "si" },
    { text: "எனக்கு ஒரு சாக்லேட் கேக் வாங்க வேண்டும்", expected: "ta" },
    { text: "budget eka Rs 5000 cake thiyenawada?", expected: "mixed-si" },
    { text: "enaku Rs 5000 budget la cake iruka?", expected: "mixed-ta" },
  ];

  console.log("📡 Testing Language Detector...");
  for (const { text, expected } of detectionTestCases) {
    try {
      const result = await detectLanguage(text);
      const passed = result === expected ? "✅ PASS" : "❌ FAIL";
      console.log(`[Detect] Input: "${text}" => Detected: "${result}" (Expected: "${expected}") | ${passed}`);
    } catch (err) {
      console.error(`[Detect] Error testing "${text}":`, err);
    }
  }
  console.log("");

  // 2. Test Translation to English
  const toEnglishTestCases = [
    "මට චොකලට් කේක් එකක් ගන්න ඕනෙ",
    "எனக்கு ஒரு சாக்லேட் கேக் வாங்க வேண்டும்",
    "budget eka Rs 5000 cake thiyenawada?",
    "enaku Rs 5000 budget la cake iruka?",
  ];

  console.log("🔀 Testing Translation to English...");
  for (const text of toEnglishTestCases) {
    try {
      const result = await translateToEnglish(text);
      console.log(`[To English] Original: "${text}"\n             Translated: "${result}"\n`);
    } catch (err) {
      console.error(`[To English] Error:`, err);
    }
  }

  // 3. Test Translation to Sinhala/Tamil
  const assistantResponse = "I found 3 delicious chocolate cakes within your budget of Rs. 5000. Would you like to check their delivery times?";
  
  console.log("🔄 Testing Localization of Assistant Responses...");
  try {
    const sinhalaTranslation = await translateToSinhala(assistantResponse);
    console.log(`[To Sinhala] Original: "${assistantResponse}"\n             Sinhala: "${sinhalaTranslation}"\n`);
    
    const tamilTranslation = await translateToTamil(assistantResponse);
    console.log(`[To Tamil] Original: "${assistantResponse}"\n             Tamil: "${tamilTranslation}"\n`);
  } catch (err) {
    console.error(`[Localization] Error:`, err);
  }

  console.log("==========================================");
  console.log("🎉 Translation Layer Tests Finished");
  console.log("==========================================");
}

runTests();

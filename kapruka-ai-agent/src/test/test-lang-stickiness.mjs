import "dotenv/config";
import { executeLanguageDetection } from "../services/core/requestPipeline/01_5_languageDetection.mjs";

const turns = [
  "epdi irukka machchan",
  "nalla iruken",
  "show laptops",
  "buy this",
  "tomorrow deliver pannalama",
  "thanks"
];

let conversationState = {
  preferredLanguage: "english",
  consecutiveMessagesInSameLanguage: 0,
  lastDetectedLanguage: "english",
  languageConfidence: 1.0
};

console.log("==========================================");
console.log("Language Stickiness Simulation (Tanglish)");
console.log("==========================================\n");

for (const message of turns) {
  console.log(`User: "${message}"`);
  
  // Simulated Language Detection
  const languageData = executeLanguageDetection(message, conversationState);
  console.log(`  Engine Result -> Lang: ${languageData.language}, Conf: ${languageData.confidence}, Method: ${languageData.method}`);
  
  // Simulated CUL stickiness application (from 02_conversationUnderstanding.mjs logic)
  let finalLang = languageData.language;
  let finalConf = languageData.confidence;
  
  const isShort = message.split(" ").length <= 2 || message.length <= 4;
  
  if (languageData.method === "explicit_switch") {
      conversationState.preferredLanguage = languageData.language;
      conversationState.consecutiveMessagesInSameLanguage = 1;
  } else if (languageData.method === "stickiness") {
      // already sticky
      conversationState.consecutiveMessagesInSameLanguage++;
  } else if (languageData.language !== conversationState.preferredLanguage && languageData.confidence >= 0.90) {
      if (!isShort) {
          // In real CUL it requires 3 consecutive, but let's see what happens here.
          // Wait, CUL says: "if langLabel !== preferredLanguage ... require 3 consecutive".
          // The instruction says "Do NOT let the CUL redetect language unless confidence is below a configurable threshold."
          // And "The Response Engine must trust the detected language."
          conversationState.preferredLanguage = languageData.language;
          conversationState.consecutiveMessagesInSameLanguage = 1;
      } else {
          finalLang = conversationState.preferredLanguage;
      }
  } else {
      finalLang = conversationState.preferredLanguage;
      conversationState.consecutiveMessagesInSameLanguage++;
  }

  conversationState.lastDetectedLanguage = finalLang;
  
  console.log(`  Final Applied Language: ${finalLang}\n`);
}

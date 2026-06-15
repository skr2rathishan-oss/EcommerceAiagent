// llm_test.mjs
// Simple script to test the LLM service routing and models.
import { chatWithLLM } from "../services/llm.service.mjs";

(async () => {
  try {
    console.log("--- TEST 1: English (Should select Qwen) ---");
    const response1 = await chatWithLLM({
      message: "Hello, can you recommend a birthday cake?",
      history: [],
      memory: {},
      memoryContext: "",
      detectedLang: "en"
    });
    console.log("Response 1:", response1);

    console.log("\n--- TEST 2: French/Other (Should select GPT-OSS-20b) ---");
    const response2 = await chatWithLLM({
      message: "Bonjour, recommandation de gâteau d'anniversaire s'il vous plaît.",
      history: [],
      memory: {},
      memoryContext: "",
      detectedLang: "fr"
    });
    console.log("Response 2:", response2);

  } catch (err) {
    console.error("Error during LLM test:", err);
  }
})();


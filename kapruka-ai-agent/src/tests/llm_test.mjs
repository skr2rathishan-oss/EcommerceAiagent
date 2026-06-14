// llm_test.mjs
// Simple script to test the LLM service.
import { chatWithLLM } from "../services/llm.service.mjs";

(async () => {
  try {
    const message = "Hello, can you recommend a birthday cake?";
    const response = await chatWithLLM({
      message,
      history: [],
      memory: {},
      memoryContext: ""
    });
    console.log("LLM Response:", response);
  } catch (err) {
    console.error("Error during LLM test:", err);
  }
})();

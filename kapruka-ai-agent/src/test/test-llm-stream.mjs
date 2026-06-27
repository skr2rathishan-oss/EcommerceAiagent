import "../config/loadEnv.mjs";
import { chatWithLLMStream, formatRecommendationsStream } from "../services/ai/llmStream.service.mjs";

async function runTest() {
  console.log("=== Testing chatWithLLMStream ===");
  try {
    let accumulated = "";
    await chatWithLLMStream({
      message: "Hello! Who are you and how can you help me today?",
      history: [],
      memory: {},
      onChunk: (chunk) => {
        process.stdout.write(chunk);
        accumulated += chunk;
      }
    });
    console.log("\n\nCompleted Chat Stream successfully. Length:", accumulated.length);

    console.log("\n=== Testing formatRecommendationsStream ===");
    let recAccumulated = "";
    await formatRecommendationsStream(
      "birthday cake for mom",
      [{ id: "1", name: "Premium Chocolate Cake", price: 3500 }],
      [],
      false,
      (chunk) => {
        process.stdout.write(chunk);
        recAccumulated += chunk;
      }
    );
    console.log("\n\nCompleted Recommendations Stream successfully. Length:", recAccumulated.length);
  } catch (err) {
    console.error("\nTest Failed:", err);
    process.exit(1);
  }
}

runTest();

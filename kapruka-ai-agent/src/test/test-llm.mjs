import dotenv from "dotenv";
import { chatWithLLM } from "../services/llm.service.mjs";

dotenv.config();

async function runTest() {
  console.log("=== Testing LLM Response ===");
  const testMessage = "Hello, what items do you recommend for my mother's birthday?";
  
  console.log(`Sending message: "${testMessage}"...`);
  const startTime = Date.now();
  
  try {
    // Send standard request with simulated context to test injection as well
    const response = await chatWithLLM({
      message: testMessage,
      history: [],
      memory: {},
      memoryContext: "User Profile:\n* Favorite Categories: Cakes, Flowers\n* Average Budget: 4500 LKR\n* Preferred Recipient: Mother\n* Preferred Occasion: Birthday\n\nMemory Summary:\nUser frequently purchases birthday gifts and prefers cakes and flower arrangements."
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\nResponse received in ${duration}s:`);
    console.log("----------------------------------------");
    console.log(response);
    console.log("----------------------------------------");
    
    if (response && !response.error && typeof response === "string") {
      console.log("\n✅ Success: LLM is responding properly!");
    } else {
      console.error("\n❌ Error: Received invalid response from LLM.", response);
    }
  } catch (error) {
    console.error("\n❌ Error running LLM test:", error);
  }
}

runTest();

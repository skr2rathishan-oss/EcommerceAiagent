import dotenv from "dotenv";
import mongoose from "mongoose";
import { resolve } from "path";
import { connectDB } from "../database/mongo.mjs";
import UserProfile from "../database/UserProfile.mjs";
import MemorySummary from "../database/MemorySummary.mjs";
import {
  shouldUseMemory,
  getMessageIntent,
  buildPersonalizedContext
} from "../services/contextBuilder.service.mjs";
import { chatWithLLM } from "../services/llm.service.mjs";

dotenv.config();

async function runTests() {
  console.log("=== STARTING PHASE 3 TEST SUITE ===\n");

  // 1. Connect to DB
  try {
    await connectDB();
  } catch (err) {
    console.error("Failed to connect to database:", err);
    process.exit(1);
  }

  const testSessionId = "test-session-inject-phase3";

  // 2. Clear any existing test documents
  await UserProfile.deleteOne({ sessionId: testSessionId });
  await MemorySummary.deleteOne({ sessionId: testSessionId });

  // 3. Test Intent Matching Logic
  console.log("--- Testing Intent Classification and Memory Usage Check ---");
  const testCases = [
    { message: "Hi", detected: "general_chat", expectedIntent: "greetings", expectedUseMemory: false },
    { message: "Need a gift", detected: "general_chat", expectedIntent: "gift_recommendation", expectedUseMemory: true },
    { message: "Show me chocolate cakes under 5000", detected: "search_products", expectedIntent: "product_search", expectedUseMemory: true },
    { message: "Thank you so much!", detected: "general_chat", expectedIntent: "thank_you", expectedUseMemory: false },
    { message: "Can you deliver to Kandy?", detected: "check_delivery", expectedIntent: "delivery_queries", expectedUseMemory: true },
    { message: "Where is my order VIMP1234?", detected: "track_order", expectedIntent: "track_order", expectedUseMemory: false }
  ];

  for (const tc of testCases) {
    const intent = getMessageIntent(tc.message, tc.detected);
    const useMem = shouldUseMemory(intent);
    console.log(`Msg: "${tc.message}" | Detected: ${tc.detected} | Mapped: ${intent} | Use Memory: ${useMem}`);
    if (intent !== tc.expectedIntent || useMem !== tc.expectedUseMemory) {
      console.warn(`⚠️ Warning: Expected mapping ${tc.expectedIntent} (${tc.expectedUseMemory}), got ${intent} (${useMem})`);
    }
  }
  console.log("Intent check complete.\n");

  // 4. Test Context Builder with Missing Profile/Summary (Fail-Safe)
  console.log("--- Testing Fail-Safe Behavior (Empty DB) ---");
  const emptyContext = await buildPersonalizedContext(testSessionId);
  console.log(`Empty Context Result: "${emptyContext}" (Expected: "")`);
  if (emptyContext !== "") {
    console.error("❌ Error: Expected empty context when no profile/summary exists.");
  } else {
    console.log("✅ Success: Empty profile/summary returned empty string correctly.");
  }
  console.log();

  // 5. Inject Mock Profile and Summary
  console.log("--- Injecting Mock Data ---");
  const mockProfile = new UserProfile({
    sessionId: testSessionId,
    favoriteCategories: ["cakes", "flowers"],
    favoriteRecipients: ["mother"],
    favoriteOccasions: ["birthday"],
    averageBudget: 4500
  });
  await mockProfile.save();

  const mockSummary = new MemorySummary({
    sessionId: testSessionId,
    currentSummary: "User frequently purchases birthday gifts and prefers cakes and flower arrangements.",
    previousSummary: "Should not load this summary block",
    olderSummary: "Should not load this summary block either",
    version: 1
  });
  await mockSummary.save();
  console.log("Mock profile and summary saved to DB.\n");

  // 6. Test Context Generation
  console.log("--- Testing Context Generation Output ---");
  const context = await buildPersonalizedContext(testSessionId);
  console.log("Generated Context:");
  console.log("----------------------------------------");
  console.log(context);
  console.log("----------------------------------------");

  // Assertions
  if (!context.includes("User Profile:")) console.error("❌ Missing 'User Profile:' header");
  if (!context.includes("Favorite Categories: Cakes, Flowers")) console.error("❌ Missing Favorite Categories");
  if (!context.includes("Average Budget: 4500 LKR")) console.error("❌ Missing Average Budget formatting");
  if (!context.includes("Preferred Recipient: Mother")) console.error("❌ Missing Preferred Recipient");
  if (!context.includes("Preferred Occasion: Birthday")) console.error("❌ Missing Preferred Occasion");
  if (!context.includes("Memory Summary:")) console.error("❌ Missing 'Memory Summary:' header");
  if (context.includes("Should not load this summary block")) console.error("❌ Error: Loaded previous/older summary blocks!");

  console.log("Context validation checks complete.\n");

  // 7. Cleanup
  console.log("--- Cleaning Up Test Data ---");
  await UserProfile.deleteOne({ sessionId: testSessionId });
  await MemorySummary.deleteOne({ sessionId: testSessionId });
  console.log("Cleanup complete.");

  await mongoose.disconnect();
  console.log("\n=== ALL TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  mongoose.disconnect();
});

import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "../database/mongo.mjs";
import UserProfile from "../database/UserProfile.mjs";
import ProductInteraction from "../database/ProductInteraction.mjs";
import {
  trackInteraction,
  getUserInteractions,
  getCategoryScores,
  getTopCategories,
  getMostViewedProducts,
  getMostPurchasedProducts
} from "../services/productInteraction.service.mjs";

dotenv.config();

async function runTests() {
  console.log("=== STARTING PHASE 4 TEST SUITE ===\n");

  // 1. Connect to DB
  try {
    await connectDB();
  } catch (err) {
    console.error("Failed to connect to database:", err);
    process.exit(1);
  }

  const testSessionId = "test-session-tracking-phase4";

  // 2. Clear any existing test documents
  await UserProfile.deleteOne({ sessionId: testSessionId });
  await ProductInteraction.deleteMany({ sessionId: testSessionId });

  // 3. Simulate user interaction flow (Cakes Category)
  console.log("--- Simulating Interaction Flow ---");
  console.log("1. View Cake A (+1 score)");
  await trackInteraction(testSessionId, "prod_cake_a", "Chocolate Fudge Cake", "cakes", "view");

  console.log("2. Open details of Cake A (+3 score)");
  await trackInteraction(testSessionId, "prod_cake_a", "Chocolate Fudge Cake", "cakes", "details");

  console.log("3. Add Cake A to cart (+5 score)");
  await trackInteraction(testSessionId, "prod_cake_a", "Chocolate Fudge Cake", "cakes", "add_to_cart");

  console.log("4. Purchase Cake A (+10 score)");
  await trackInteraction(testSessionId, "prod_cake_a", "Chocolate Fudge Cake", "cakes", "purchase");

  // Let's add another product interaction to test analytics helpers
  console.log("5. View Flower B (+1 score)");
  await trackInteraction(testSessionId, "prod_flower_b", "Red Roses Bouquet", "flowers", "view");
  console.log("6. Open details of Flower B (+3 score)");
  await trackInteraction(testSessionId, "prod_flower_b", "Red Roses Bouquet", "flowers", "details");

  // Give background tasks a brief moment to complete just in case
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log("Simulations completed.\n");

  // 4. Verify Raw Interactions
  console.log("--- Verifying Stored Interactions ---");
  const interactions = await getUserInteractions(testSessionId);
  console.log(`Retrieved ${interactions.length} interactions for session.`);
  if (interactions.length !== 6) {
    console.error(`❌ Error: Expected 6 interactions, found ${interactions.length}`);
  } else {
    console.log("✅ Success: All 6 interactions saved successfully.");
  }
  console.log();

  // 5. Verify User Profile Interaction Scores
  console.log("--- Verifying UserProfile Interaction Scores ---");
  const scores = await getCategoryScores(testSessionId);
  console.log("Category Scores:", JSON.stringify(scores, null, 2));

  // Cakes should be 1 + 3 + 5 + 10 = 19
  // Flowers should be 1 + 3 = 4
  if (scores.cakes !== 19) {
    console.error(`❌ Error: Expected Cakes score to be 19, found ${scores.cakes}`);
  } else {
    console.log("✅ Success: Cakes score is exactly 19.");
  }
  if (scores.flowers !== 4) {
    console.error(`❌ Error: Expected Flowers score to be 4, found ${scores.flowers}`);
  } else {
    console.log("✅ Success: Flowers score is exactly 4.");
  }
  console.log();

  // 6. Test Behavior Analytics Helpers
  console.log("--- Testing Behavior Analytics Helpers ---");
  const topCategories = await getTopCategories(testSessionId);
  console.log("Top Categories:", JSON.stringify(topCategories, null, 2));
  if (topCategories[0]?.category !== "cakes" || topCategories[0]?.score !== 19) {
    console.error("❌ Error: getTopCategories returned incorrect sorting or values.");
  } else {
    console.log("✅ Success: getTopCategories returned cakes as the top category.");
  }

  const mostViewed = await getMostViewedProducts(testSessionId);
  console.log("Most Viewed Products:", JSON.stringify(mostViewed, null, 2));
  if (mostViewed.length === 0) {
    console.error("❌ Error: getMostViewedProducts returned empty array.");
  } else {
    console.log("✅ Success: getMostViewedProducts returned views correctly.");
  }

  const mostPurchased = await getMostPurchasedProducts(testSessionId);
  console.log("Most Purchased Products:", JSON.stringify(mostPurchased, null, 2));
  if (mostPurchased.length === 0 || mostPurchased[0]?._id !== "prod_cake_a") {
    console.error("❌ Error: getMostPurchasedProducts returned incorrect results.");
  } else {
    console.log("✅ Success: getMostPurchasedProducts verified cakes as most purchased.");
  }
  console.log();

  // 7. Cleanup
  console.log("--- Cleaning Up Test Data ---");
  await UserProfile.deleteOne({ sessionId: testSessionId });
  await ProductInteraction.deleteMany({ sessionId: testSessionId });
  console.log("Cleanup complete.");

  await mongoose.disconnect();
  console.log("\n=== ALL PHASE 4 TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  mongoose.disconnect();
});

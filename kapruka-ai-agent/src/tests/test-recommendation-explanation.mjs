import dotenv from "dotenv";
import mongoose from "mongoose";
import UserProfile from "../database/UserProfile.mjs";
import UserInsights from "../database/UserInsights.mjs";
import ProductInteraction from "../database/ProductInteraction.mjs";
import RecommendationCache from "../database/RecommendationCache.mjs";
import { explainRecommendation, generateRecommendationReasons } from "../services/recommendationExplanation.service.mjs";
import { refreshRecommendationCache } from "../services/recommendationCache.service.mjs";

dotenv.config();

console.log("\n=== STARTING RECOMMENDATION EXPLANATION TEST ===\n");

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

async function runTests() {
  const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/Velora";
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB.");
  } catch (dbErr) {
    console.error("Could not connect to MongoDB:", dbErr.message);
    process.exit(1);
  }

  const sessionId = `test-explanation-session-${Date.now()}`;

  try {
    // 0. Cleanup
    await Promise.all([
      UserProfile.deleteOne({ sessionId }),
      UserInsights.deleteOne({ sessionId }),
      ProductInteraction.deleteMany({ sessionId }),
      RecommendationCache.deleteOne({ sessionId })
    ]);

    // --- Test 1: Fail Safe Behavior (No User Data) ---
    console.log("\n--- Test 1: Fail Safe Behavior ---");
    const cakeProduct = { id: "p_cake_1", name: "Fudge Cake", price: 3500, category: "cakes" };
    const reasonsNoData = await explainRecommendation(cakeProduct, sessionId);
    assert("Returns empty array instead of throwing when no user data exists", Array.isArray(reasonsNoData) && reasonsNoData.length === 0);

    // --- Test 2: generateRecommendationReasons Logic ---
    console.log("\n--- Test 2: generateRecommendationReasons Logic ---");
    
    // Set up mock profile data
    const mockProfile = {
      topCategories: ["cakes"],
      affinityScores: {
        cakes: { view: 12, purchase: 0 },
        flowers: { view: 5, purchase: 2 }
      },
      preferredBudget: 4000,
      preferredOccasions: ["birthday", "anniversary"],
      preferredRecipients: ["mother"]
    };

    // Case A: Product matches budget and category affinity
    const prodA = { name: "Anniversary Chocolate Cake", price: 3000, category: "cakes", occasion: "anniversary" };
    const reasonsA = generateRecommendationReasons(prodA, mockProfile);
    
    assert("Reasons A is array", Array.isArray(reasonsA));
    assert("Reasons A contains budget match", reasonsA.includes("Matches your typical budget range"));
    assert("Reasons A contains occasion match", reasonsA.includes("Fits anniversary gifting preferences"));
    assert("Reasons A contains view affinity reason", reasonsA.includes("Frequently viewed cakes"));
    assert("Reasons A has max 3 reasons", reasonsA.length <= 3);

    // Case B: Product matches purchased affinity and recipient
    const prodB = { name: "Red Roses Bouquet", price: 4500, category: "flowers", recipient: "mother" };
    const reasonsB = generateRecommendationReasons(prodB, mockProfile);
    
    assert("Reasons B contains purchase affinity reason", reasonsB.includes("Frequently purchased flowers"));
    assert("Reasons B contains recipient match", reasonsB.includes("Matches gifting preferences for mother"));
    assert("Reasons B does NOT contain budget match (price is 4500, budget is 4000)", !reasonsB.includes("Matches your typical budget range"));

    // --- Test 3: explainRecommendation Integration with Cache & Logging ---
    console.log("\n--- Test 3: explainRecommendation Cache & Logging ---");

    // Populate mock DB data
    const userProfileDoc = new UserProfile({
      sessionId,
      favoriteCategories: ["cakes"],
      favoriteRecipients: ["mother"],
      favoriteOccasions: ["birthday"],
      averageBudget: 4000,
      interactionScores: { cakes: 10 }
    });
    await userProfileDoc.save();

    // Cache refresh to create RecommendationCache document
    await refreshRecommendationCache(sessionId);

    // Capture console output to verify logging compliance
    let loggedSessionId = null;
    let loggedEvent = false;
    let loggedUserContent = false;

    const originalLog = console.log;
    console.log = function (msg) {
      try {
        const parsed = JSON.parse(msg);
        if (parsed.explanationGenerated) {
          loggedSessionId = parsed.sessionId;
          loggedEvent = true;
          // Check for leakages
          if (parsed.profile || parsed.message) {
            loggedUserContent = true;
          }
        }
      } catch (e) {
        // Not JSON or other logs
      }
      originalLog.apply(console, arguments);
    };

    const finalReasons = await explainRecommendation(cakeProduct, sessionId);
    
    // Restore console.log
    console.log = originalLog;

    assert("Explanations returned successfully from integrated service", finalReasons.length > 0);
    assert("Explanation contains category affinity reason", finalReasons.includes("Strong category affinity detected"));
    assert("Explanation contains budget match", finalReasons.includes("Matches your typical budget range"));
    
    // Verify Logging (Part 7)
    assert("Logging event fired", loggedEvent);
    assert("Logged the correct sessionId", loggedSessionId === sessionId);
    assert("No user profile or message content leaked in logs", !loggedUserContent);

    // Cleanup
    await Promise.all([
      UserProfile.deleteOne({ sessionId }),
      UserInsights.deleteOne({ sessionId }),
      ProductInteraction.deleteMany({ sessionId }),
      RecommendationCache.deleteOne({ sessionId })
    ]);

  } catch (error) {
    console.error("Test execution failed:", error);
  } finally {
    await mongoose.connection.close();
    console.log("\n=== TEST COMPLETE ===");
    console.log(`Passed: ${passed} | Failed: ${failed}`);
    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

runTests();

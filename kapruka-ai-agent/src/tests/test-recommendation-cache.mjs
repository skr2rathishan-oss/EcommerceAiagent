import dotenv from "dotenv";
import mongoose from "mongoose";
import UserProfile from "../database/UserProfile.mjs";
import UserInsights from "../database/UserInsights.mjs";
import ProductInteraction from "../database/ProductInteraction.mjs";
import RecommendationCache from "../database/RecommendationCache.mjs";
import { getUserRecommendationProfile } from "../services/recommendation.service.mjs";
import {
  getCachedRecommendations,
  generateRecommendationProfile,
  refreshRecommendationCache
} from "../services/recommendationCache.service.mjs";
import { trackInteraction, updateInteractionScores } from "../services/productInteraction.service.mjs";

dotenv.config();

console.log("\n=== STARTING RECOMMENDATION CACHE TEST ===\n");

// Assertion helpers
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

  const sessionId = `test-cache-session-${Date.now()}`;

  try {
    // 0. Cleanup any existing data for this session
    await Promise.all([
      UserProfile.deleteOne({ sessionId }),
      UserInsights.deleteOne({ sessionId }),
      ProductInteraction.deleteMany({ sessionId }),
      RecommendationCache.deleteOne({ sessionId })
    ]);

    // ─── Test 1: Cache Miss & Fail-Safe Behavior ─────────────────────────────────
    console.log("\n--- Test 1: Cache Miss & Fail-Safe Behavior ---");
    
    // Attempt to retrieve profile when no cache and no DB records exist
    let profile = await getUserRecommendationProfile(sessionId);
    assert("Returns null when no user data exists", profile === null);

    // Create a UserProfile to test fallback without cache
    const testProfile = new UserProfile({
      sessionId,
      favoriteCategories: ["cakes", "flowers"],
      favoriteRecipients: ["mother"],
      favoriteOccasions: ["birthday"],
      averageBudget: 4500,
      interactionScores: {}
    });
    await testProfile.save();

    profile = await getUserRecommendationProfile(sessionId);
    assert("Returns normal profile on cache miss (Fail Safe)", profile !== null);
    assert("favoriteCategories matches", profile.favoriteCategories.includes("cakes"));
    assert("averageBudget matches", profile.averageBudget === 4500);

    // Wait a brief moment for the background cache refresh to finish (from the miss fallback)
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify cache has been populated asynchronously
    const cacheDocAfterMiss = await RecommendationCache.findOne({ sessionId });
    assert("Cache was populated asynchronously after miss", cacheDocAfterMiss !== null);
    assert("Cache contains precomputed topCategories", cacheDocAfterMiss.recommendationProfile.topCategories.includes("cakes"));

    // Clean cache for subsequent test phases
    await RecommendationCache.deleteOne({ sessionId });

    // ─── Test 2: Cache Service Functions & Precomputation ───────────────────────
    console.log("\n--- Test 2: Cache Service Functions & Precomputation ---");

    // Add some test interactions to check precomputation of affinityScores
    const viewInteraction = new ProductInteraction({
      sessionId,
      productId: "prod_cake_1",
      productName: "Chocolate Fudge Cake",
      category: "cakes",
      action: "view"
    });
    const purchaseInteraction = new ProductInteraction({
      sessionId,
      productId: "prod_flower_1",
      productName: "Red Roses",
      category: "flowers",
      action: "purchase"
    });
    await Promise.all([viewInteraction.save(), purchaseInteraction.save()]);

    // Manually refresh cache
    const refreshed = await refreshRecommendationCache(sessionId);
    assert("refreshRecommendationCache runs successfully", refreshed !== null);

    const cacheDoc = await RecommendationCache.findOne({ sessionId }).lean().exec();
    assert("Cache document created in DB", cacheDoc !== null);
    assert("Contains recommendationProfile field", cacheDoc.recommendationProfile !== undefined);
    
    const precomputed = cacheDoc.recommendationProfile;
    assert("Precomputed profile has topCategories", Array.isArray(precomputed.topCategories));
    assert("Precomputed profile has affinityScores", typeof precomputed.affinityScores === 'object');
    assert("Precomputed affinityScores for cakes contains view count", precomputed.affinityScores.cakes?.view === 1);
    assert("Precomputed affinityScores for flowers contains purchase count", precomputed.affinityScores.flowers?.purchase === 1);
    assert("Precomputed profile has preferredBudget", precomputed.preferredBudget === 4500);
    assert("Precomputed profile has preferredOccasions", precomputed.preferredOccasions.includes("birthday"));
    assert("Precomputed profile has preferredRecipients", precomputed.preferredRecipients.includes("mother"));

    // ─── Test 3: Cache Hit & Fast Path (<5ms Latency) ───────────────────────────
    console.log("\n--- Test 3: Cache Hit & Fast Path Latency ---");

    const start = performance.now();
    const cachedProfile = await getUserRecommendationProfile(sessionId);
    const end = performance.now();
    const duration = end - start;

    assert("Cached profile retrieved", cachedProfile !== null);
    assert("Cached profile mapped correctly to favoriteCategories", cachedProfile.favoriteCategories.includes("cakes"));
    assert("Cached profile mapped correctly to interactionScores", cachedProfile.interactionScores.cakes !== undefined);
    assert("Cached profile averageBudget matches", cachedProfile.averageBudget === 4500);
    
    console.log(`  ℹ Retrieval Latency: ${duration.toFixed(3)} ms`);
    assert("Latency is under 5ms", duration < 5);

    // ─── Test 4: Cache Triggers ──────────────────────────────────────────────────
    console.log("\n--- Test 4: Cache Triggers ---");

    // Fetch current cache generatedAt
    const cacheBefore = await RecommendationCache.findOne({ sessionId }).lean().exec();
    const timeBefore = cacheBefore.generatedAt.getTime();

    // Trigger 1: Track a new purchase
    console.log("  → Simulating new purchase trigger...");
    await trackInteraction(sessionId, "prod_cake_2", "Vanilla Cake", "cakes", "purchase");
    
    // Wait for async triggers to complete
    await new Promise(resolve => setTimeout(resolve, 300));
    
    let cacheAfter = await RecommendationCache.findOne({ sessionId }).lean().exec();
    assert("Cache refreshed on purchase (generatedAt updated)", cacheAfter.generatedAt.getTime() > timeBefore);
    assert("Affinity purchase count updated in cache", cacheAfter.recommendationProfile.affinityScores.cakes.purchase === 1);

    const timeAfterPurchase = cacheAfter.generatedAt.getTime();

    // Trigger 2: Track significant interaction score change
    console.log("  → Simulating significant interaction score trigger (add_to_cart)...");
    await trackInteraction(sessionId, "prod_flower_2", "Lilies", "flowers", "add_to_cart");

    // Wait for async triggers to complete
    await new Promise(resolve => setTimeout(resolve, 300));

    cacheAfter = await RecommendationCache.findOne({ sessionId }).lean().exec();
    assert("Cache refreshed on significant interaction (generatedAt updated)", cacheAfter.generatedAt.getTime() > timeAfterPurchase);
    assert("Affinity view/details count updated in cache", cacheAfter.recommendationProfile.affinityScores.flowers.view >= 1);

    // Clean up
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

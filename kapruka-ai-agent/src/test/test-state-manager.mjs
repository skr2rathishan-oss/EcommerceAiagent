import "../config/loadEnv.mjs";
import { connectDB } from "../database/mongo.mjs";
import mongoose from "mongoose";
import {
  loadConversationState,
  transitionTo,
  pauseCurrentFlow,
  resumeFlow,
  clearConversationState,
  saveConversationState
} from "../services/commerce/conversationStateService.mjs";
import { updateDeliverySession, getDeliverySession } from "../memory/memoryStore.mjs";

async function runTest() {
  console.log("=== Connecting to MongoDB ===");
  await connectDB();

  const testSessionId = `test_csm_session_${Date.now()}`;
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // Test 1: Initialize / Load Session State
    // -------------------------------------------------------------
    console.log("\n--- Test 1: Initialize Session ---");
    let state = await loadConversationState(testSessionId);
    assert(state !== null, "Successfully loaded conversation state object");
    assert(state.sessionId === testSessionId, "Session ID matches");
    assert(state.activeFlow.type === "general_chat", "Default activeFlow type is general_chat");
    assert(state.activeFlow.currentStep === "browsing", "Default activeFlow step is browsing");

    // -------------------------------------------------------------
    // Test 2: Transition Flow
    // -------------------------------------------------------------
    console.log("\n--- Test 2: Transition to Shopping ---");
    state = await transitionTo(testSessionId, "shopping", "searching");
    assert(state.activeFlow.type === "shopping", "Flow transitioned to shopping");
    assert(state.activeFlow.currentStep === "searching", "Step set to searching");
    assert(state.activeFlow.status === "active", "Status is active");

    // -------------------------------------------------------------
    // Test 3: Legacy Fields Auto-Sync
    // -------------------------------------------------------------
    console.log("\n--- Test 3: Legacy Fields Auto-Sync ---");
    // Verify updates from legacy fields updates activeFlow (Inverse sync)
    state = await saveConversationState(testSessionId, { active_delivery_session: testSessionId });
    assert(state.activeFlow.type === "delivery", "Inverse sync: activeFlow changed to delivery when legacy active_delivery_session set");
    assert(state.activeFlow.currentStep === "waiting_address", "Inverse sync: step defaulted to waiting_address");
    assert(state.active_delivery_session === testSessionId, "Forward sync: active_delivery_session is set to sessionId");

    // -------------------------------------------------------------
    // Test 4: Flow Interruption (Delivery -> Shopping Search)
    // -------------------------------------------------------------
    console.log("\n--- Test 4: Interruption (Transition delivery -> shopping) ---");
    // Now active flow is delivery. We transition to shopping.
    // This should automatically pause the current delivery flow and store it in pausedFlows.
    state = await transitionTo(testSessionId, "shopping", "searching");
    assert(state.activeFlow.type === "shopping", "Active flow is now shopping");
    assert(state.activeFlow.currentStep === "searching", "Active step is searching");
    
    const pausedDelivery = state.pausedFlows.find(f => f.type === "delivery");
    assert(pausedDelivery !== undefined, "Delivery flow moved to pausedFlows stack");
    assert(pausedDelivery?.currentStep === "waiting_address", "Paused delivery step preserved (waiting_address)");
    assert(state.active_delivery_session === null, "Legacy active_delivery_session cleared to bypass blocks");

    // -------------------------------------------------------------
    // Test 5: Flow Resume
    // -------------------------------------------------------------
    console.log("\n--- Test 5: Resume delivery flow ---");
    state = await resumeFlow(testSessionId, "delivery");
    assert(state.activeFlow.type === "delivery", "Active flow restored to delivery");
    assert(state.activeFlow.currentStep === "waiting_address", "Active step restored to waiting_address");
    assert(state.active_delivery_session === testSessionId, "Legacy active_delivery_session restored");
    assert(!state.pausedFlows.some(f => f.type === "delivery"), "Delivery flow removed from pausedFlows");

    // -------------------------------------------------------------
    // Test 6: Delivery Session update propagation to ConversationState
    // -------------------------------------------------------------
    console.log("\n--- Test 6: Delivery Session propagation ---");
    // Update DeliverySession state through updateDeliverySession helper.
    // This triggers the ConversationState hook/propagation.
    const deliverySession = await getDeliverySession(testSessionId);
    await updateDeliverySession(testSessionId, { state: "WAITING_FOR_DATE" }, deliverySession.session_version);
    
    state = await loadConversationState(testSessionId);
    assert(state.activeFlow.type === "delivery", "Flow is still delivery");
    assert(state.activeFlow.currentStep === "delivery_date", "Step propagated to delivery_date (WAITING_FOR_DATE)");

    // -------------------------------------------------------------
    // Test 7: Clear State
    // -------------------------------------------------------------
    console.log("\n--- Test 7: Clear State ---");
    state = await clearConversationState(testSessionId);
    assert(state.activeFlow.type === "general_chat", "Cleared flow type back to general_chat");
    assert(state.pausedFlows.length === 0, "Cleared pausedFlows list");
    assert(state.active_delivery_session === null, "Cleared legacy delivery session");

    console.log(`\n==================================================`);
    console.log(`Results: ${passed} passed, ${failed} failed`);
    
    // Clean up DB
    await mongoose.connection.db.collection("conversationstates").deleteOne({ sessionId: testSessionId });
    await mongoose.connection.db.collection("deliverysessions").deleteOne({ sessionId: testSessionId });
    console.log("Cleaned up test DB records.");

  } catch (err) {
    console.error("Unit test failed with error:", err);
    failed++;
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTest();

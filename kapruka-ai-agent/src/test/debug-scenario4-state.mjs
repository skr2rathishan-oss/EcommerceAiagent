import mongoose from "mongoose";
import dotenv from "dotenv";
import ConversationState from "../database/ConversationState.mjs";
import DeliverySession from "../database/DeliverySession.mjs";

dotenv.config();

const CHAT_URL = "http://127.0.0.1:5000/api/chat";

async function sendMessage(sessionId, message, intent = null, parameters = null) {
  const body = { message };
  if (intent) body.intent = intent;
  if (parameters) body.parameters = parameters;

  const response = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-session-id": sessionId
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from chat endpoint`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalData = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.trim().startsWith("data: ")) {
        try {
          const parsed = JSON.parse(line.trim().substring(6));
          if (parsed.type === "complete") finalData = parsed.data;
        } catch (_) {}
      }
    }
  }

  if (buffer.trim().startsWith("data: ")) {
    try {
      const parsed = JSON.parse(buffer.trim().substring(6));
      if (parsed.type === "complete") finalData = parsed.data;
    } catch (_) {}
  }

  return finalData;
}

async function printDBState(sessionId, stepLabel) {
  const state = await ConversationState.findOne({ sessionId }).lean();
  const delivery = await DeliverySession.findOne({ sessionId }).lean();
  console.log(`\n=== STATE AFTER STEP: ${stepLabel} ===`);
  console.log("ConversationState.activeFlow:", state?.activeFlow);
  console.log("ConversationState.active_delivery_session:", state?.active_delivery_session);
  console.log("ConversationState.pending_order:", state?.pending_order);
  console.log("ConversationState.awaitingConfirmation:", state?.awaitingConfirmation);
  console.log("ConversationState.waitingForPhoneNumber:", state?.waitingForPhoneNumber);
  console.log("ConversationState.workflowContext.awaitingConfirmation:", state?.workflowContext?.awaitingConfirmation);
  console.log("ConversationState.currentWorkflow:", state?.currentWorkflow);
  console.log("ConversationState.workflowContext.currentWorkflow:", state?.workflowContext?.currentWorkflow);
  console.log("DeliverySession.state:", delivery?.state);
  console.log("=====================================\n");
}

async function debugScenario4() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to DB");

  const sessionId = "debug-s4-db-" + Date.now();
  console.log("Session ID:", sessionId);

  // 1. Check delivery
  await sendMessage(sessionId, "Check delivery", "check_delivery", { productId: "EF_PC_ELEC0V701POD00603" });
  await printDBState(sessionId, "1. Check delivery");

  // 2. Address
  await sendMessage(sessionId, "No 25 Temple Road Colombo 01");
  await printDBState(sessionId, "2. Address Input");

  // 3. A
  await sendMessage(sessionId, "A");
  await printDBState(sessionId, "3. Address Confirm (A)");

  // 4. tomorrow
  await sendMessage(sessionId, "tomorrow");
  await printDBState(sessionId, "4. Date Input (tomorrow)");

  // 5. Rathishan
  await sendMessage(sessionId, "Rathishan");
  await printDBState(sessionId, "5. Contact Name (Rathishan)");

  // 6. 0771234567
  await sendMessage(sessionId, "0771234567");
  await printDBState(sessionId, "6. Contact Phone (0771234567)");

  // 7. Search for laptops
  await sendMessage(sessionId, "Search for laptops");
  await printDBState(sessionId, "7. Search for laptops");

  // 8. Search for phones
  await sendMessage(sessionId, "Search for phones");
  await printDBState(sessionId, "8. Search for phones");

  // 9. Yes
  let res = await sendMessage(sessionId, "Yes");
  console.log("AI response to Yes:", res?.text || res);
  await printDBState(sessionId, "9. Yes");

  // 10. Search for laptops after confirm
  res = await sendMessage(sessionId, "Search for laptops after confirm");
  console.log("AI response to Search after confirm:", res?.text || res);
  await printDBState(sessionId, "10. Search after confirm");

  // 11. cancel
  res = await sendMessage(sessionId, "cancel");
  console.log("AI response to cancel:", res?.text || res);
  await printDBState(sessionId, "11. cancel");

  // 12. Search for laptops after cancel
  res = await sendMessage(sessionId, "Search for laptops after cancel");
  console.log("AI response to Search after cancel:", res?.text || res);
  await printDBState(sessionId, "12. Search after cancel");

  await mongoose.disconnect();
}

debugScenario4().catch(console.error);

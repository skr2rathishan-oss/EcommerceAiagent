import { parseReference } from "../agent/reference/02_referenceParser.mjs";

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

function text(payload) {
  if (!payload) return "";
  if (typeof payload === "string") return payload;
  if (payload.text) return payload.text;
  if (payload.message) return payload.message;
  return "";
}

async function debugScenario4() {
  const sessionId = "debug-s4-" + Date.now();
  console.log("Session ID:", sessionId);

  // 1. Check delivery
  console.log("\n1. Check delivery");
  let r = await sendMessage(sessionId, "Check delivery", "check_delivery", { productId: "EF_PC_ELEC0V701POD00603" });
  console.log("AI Response:", text(r));

  // 2. Address
  console.log("\n2. No 25 Temple Road Colombo 01");
  r = await sendMessage(sessionId, "No 25 Temple Road Colombo 01");
  console.log("AI Response:", text(r));

  // 3. A
  console.log("\n3. A");
  r = await sendMessage(sessionId, "A");
  console.log("AI Response:", text(r));

  // 4. tomorrow
  console.log("\n4. tomorrow");
  r = await sendMessage(sessionId, "tomorrow");
  console.log("AI Response:", text(r));

  // 5. Rathishan
  console.log("\n5. Rathishan");
  r = await sendMessage(sessionId, "Rathishan");
  console.log("AI Response:", text(r));

  // 6. 0771234567
  console.log("\n6. 0771234567");
  r = await sendMessage(sessionId, "0771234567");
  console.log("AI Response:", text(r));
}

debugScenario4().catch(console.error);

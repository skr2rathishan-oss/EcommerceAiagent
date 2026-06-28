import { TextDecoder } from "util";

async function sendMessage(sessionId, msgText) {
  const response = await fetch("http://localhost:5000/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-session-id": sessionId
    },
    body: JSON.stringify({
      message: msgText,
      voiceMode: false
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith("data: ")) {
        try {
          const data = JSON.parse(trimmed.slice(6));
          if (data.type === "chunk") {
            fullText += data.text;
          }
        } catch (e) {
          // ignore parsing errors
        }
      }
    }
  }
  return fullText.trim();
}

async function run() {
  const sessionId = "test-flow-" + Date.now();
  console.log(`Starting multi-turn conversation simulation with Session ID: ${sessionId}\n`);

  const turns = [
    { input: "Hi", desc: "Greeting" },
    { input: "find a laptop", desc: "Product Search" },
    { input: "compare HP and ASUS", desc: "Reference/Compare" },
    { input: "tell me more about ASUS", desc: "Product details" },
    { input: "buy ASUS", desc: "Initiate Checkout" },
    { input: "check delivery", desc: "Start Delivery Flow" },
    { input: "No 25 Temple Road Colombo 01", desc: "Address input" },
    { input: "A", desc: "Address confirmation" },
    { input: "tomorrow", desc: "Date input" },
    { input: "Rathishan", desc: "Name input" },
    { input: "0771234567", desc: "Phone input" },
    { input: "confirm", desc: "Final order confirmation" }
  ];

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    console.log(`[Turn ${i + 1}/${turns.length}] Sending: "${turn.input}" (${turn.desc})...`);
    try {
      const response = await sendMessage(sessionId, turn.input);
      console.log(`[Turn ${i + 1} Response]: ${response}\n`);
      // Wait 1.5 seconds between turns to allow async DB/session operations to settle
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (err) {
      console.error(`[Turn ${i + 1} Error]: ${err.message}\n`);
    }
  }
  console.log("Flow simulation complete! You can now check the logs/debug-requests.log file for the pipeline traces.");
}

run();

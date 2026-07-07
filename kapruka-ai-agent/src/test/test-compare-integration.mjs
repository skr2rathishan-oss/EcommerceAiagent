import { TextDecoder } from "util";

const sessionId = "test_compare_integration_session_" + Date.now();

async function postMessage(message) {
  console.log(`\n--- Sending Message: "${message}" ---`);
  const response = await fetch("http://127.0.0.1:5000/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-session-id": sessionId
    },
    body: JSON.stringify({
      message,
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
            process.stdout.write(data.text);
            fullText += data.text;
          } else if (data.type === "complete") {
            console.log("\n[Complete] Payload Type:", data.data.type);
            if (data.data.products) {
              console.log("[Complete] Products returned in grid:", data.data.products.map(p => `${p.name} (${p.price})`));
            }
          }
        } catch (e) {
          // ignore parsing error for non-json data
        }
      }
    }
  }
}

async function run() {
  try {
    // Step 1: Search for products
    await postMessage("show me smartphones above 100000 samsung smartphones");
    
    // Step 2: Compare 2nd and 3rd
    await postMessage("can you sompare 2nd and 3rd mobile which one is best");
    
    // Step 3: Compare 2nd and 4th
    await postMessage("i like 2nd and 4th which is best from that");
  } catch (err) {
    console.error("Integration test failed:", err);
  }
}

run();

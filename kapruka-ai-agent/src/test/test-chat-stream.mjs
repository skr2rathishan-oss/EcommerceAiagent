import { TextDecoder } from "util";

async function runTest() {
  console.log("=== Testing Chat Stream HTTP SSE Endpoint ===");
  try {
    const response = await fetch("http://localhost:5000/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-id": "test_stream_session_123"
      },
      body: JSON.stringify({
        message: "Hi Velora, tell me a 1-sentence greeting.",
        voiceMode: false
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    console.log("SSE Stream connected. Reading chunks...\n");

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
            if (data.type === "progress") {
              console.log(`\n[Progress] ${data.step}: ${data.message}`);
            } else if (data.type === "chunk") {
              process.stdout.write(data.text);
            } else if (data.type === "complete") {
              console.log("\n\n[Complete] Payload Type:", data.data.type);
              console.log("[Complete] Text content:", data.data.text);
            }
          } catch (e) {
            console.log("\nFailed to parse line:", trimmed);
          }
        }
      }
    }

    console.log("\nStream finished successfully.");
  } catch (err) {
    console.error("Test error:", err);
    process.exit(1);
  }
}

runTest();

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
  let finalData = null;

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
          } else if (data.type === "complete") {
            finalData = data.data;
          }
        } catch (e) {
          // ignore parsing errors
        }
      }
    }
  }
  return { text: fullText.trim(), data: finalData };
}

async function run() {
  const sessionId = "test-products-" + Date.now();
  console.log(`Starting search products simulation with Session ID: ${sessionId}\n`);

  try {
    const res = await sendMessage(sessionId, "smartphones under 100000");
    console.log("[Text Response]:");
    console.log(res.text);
    console.log("\n[Payload Data]:");
    console.log(JSON.stringify(res.data, null, 2));

    if (res.data && res.data.type === "product_grid" && Array.isArray(res.data.products) && res.data.products.length > 0) {
      console.log("\nSUCCESS: Products found and returned in payload!");
      console.log(`Product count: ${res.data.products.length}`);
    } else {
      console.error("\nFAILURE: Products not found or empty in final payload.");
      process.exitCode = 1;
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
  }
}

run();

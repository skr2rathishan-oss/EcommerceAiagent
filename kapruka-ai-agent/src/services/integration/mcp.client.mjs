import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

let client = null;

export const getMcpClient = async () => {
  if (client) return client;

  const transport = new StreamableHTTPClientTransport(
    new URL("https://mcp.kapruka.com/mcp")
  );

  client = new Client({
    name: "kapruka-ai-agent",
    version: "1.0.0"
  });

  try {
    // Add a 3-second timeout to prevent blocking server startup
    await Promise.race([
      client.connect(transport),
      new Promise((_, reject) => setTimeout(() => reject(new Error("MCP Connection Timeout")), 3000))
    ]);
    console.log("✅ Connected to Kapruka MCP");
  } catch (err) {
    console.warn("⚠️ Failed to connect to Kapruka MCP (Offline)");
    client = null;
    throw err;
  }

  return client;
};
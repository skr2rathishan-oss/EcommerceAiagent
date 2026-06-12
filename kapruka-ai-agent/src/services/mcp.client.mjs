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

  await client.connect(transport);

  console.log("✅ Connected to Kapruka MCP");

  return client;
};
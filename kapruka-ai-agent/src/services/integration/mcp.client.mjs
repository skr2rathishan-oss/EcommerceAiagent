import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { getContext } from "../core/logger.service.mjs";

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

    // Centralized logging for all tool calls
    const originalCallTool = client.callTool.bind(client);
    client.callTool = async (args) => {
      const context = getContext();
      const sessionId = context.sessionId || "default";
      const workflow = context.workflow || (args.name === "kapruka_track_order" ? "order_tracking" : "shopping");

      console.log("--------------------------------------------------");
      console.log("[MCP] Calling Tool");
      console.log(`Tool: ${args.name}`);
      console.log(`Session: ${sessionId}`);
      console.log(`Workflow: ${workflow}`);
      console.log("Request:");
      console.log(JSON.stringify(args.arguments || {}, null, 2));
      console.log("--------------------------------------------------");

      const startTime = Date.now();
      try {
        const response = await originalCallTool(args);
        const executionTime = Date.now() - startTime;

        console.log("--------------------------------------------------");
        console.log("[MCP] Tool Response");
        console.log(`Tool: ${args.name}`);
        console.log(`Success: true`);
        console.log(`Execution Time: ${executionTime}ms`);
        console.log("Response:");
        console.log(JSON.stringify(response, null, 2));
        console.log("--------------------------------------------------");

        return response;
      } catch (error) {
        console.log("--------------------------------------------------");
        console.log("[MCP] Tool Error");
        console.log(`Tool: ${args.name}`);
        console.log("Request:");
        console.log(JSON.stringify(args.arguments || {}, null, 2));
        console.log("Error:");
        console.log(error.message);
        console.log("Stack:");
        console.log(error.stack || "N/A");
        console.log("--------------------------------------------------");

        throw error;
      }
    };

  } catch (err) {
    console.warn("⚠️ Failed to connect to Kapruka MCP (Offline)");
    client = null;
    throw err;
  }

  return client;
};
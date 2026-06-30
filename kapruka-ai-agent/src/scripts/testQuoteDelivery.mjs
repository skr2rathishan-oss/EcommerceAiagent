import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const transport = new StreamableHTTPClientTransport(
  new URL("https://mcp.kapruka.com/mcp")
);

const client = new Client(
  {
    name: "kapruka-mcp-test",
    version: "1.0.0",
  },
  {
    capabilities: {},
  }
);

try {
  console.log("Connecting to MCP...");
  await client.connect(transport);

  console.log("Connected!");

  // List available tools
  const tools = await client.listTools();

  console.log("\nAvailable Tools:");
  console.dir(tools, { depth: null });

  // Find the delivery tool
  const deliveryTool =
    tools.tools.find(t => t.name === "kapruka_check_delivery") ||
    tools.tools.find(t => t.name.includes("delivery"));

  if (!deliveryTool) {
    console.log("Delivery tool not found.");
    process.exit(0);
  }

  console.log("\nDelivery Tool Schema:");
  console.dir(deliveryTool, { depth: null });

  console.log("\nCalling kapruka_check_delivery...\n");

  const response = await client.callTool({
    name: deliveryTool.name,
    arguments: {
      params: {
        city: "Colombo 05",
        delivery_date: "2026-07-05",
        product_id: null,
        response_format: "json"
      }
    }
  });

  console.log("Response:");
  console.dir(response, { depth: null });

} catch (err) {
  console.error(err);
} finally {
  process.exit();
}
import { getMcpClient } from "./services/integration/mcp.client.mjs";

try {
  const client = await getMcpClient();
  const tools = await client.listTools();
  console.log(JSON.stringify(tools, null, 2));
} catch (error) {
  console.error("Error listing tools:", error);
}

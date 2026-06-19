import { getMcpClient } from "./services/integration/mcp.client.mjs";

try {
  const client = await getMcpClient();

  const result = await client.callTool({
    name: "kapruka_search_products",
    arguments: {
      params: {
        q: "chocolate cake",
        response_format: "json"
      }
    }
  });

  console.log(JSON.stringify(result, null, 2));

} catch (error) {
  console.error("MCP Error:", error);
}
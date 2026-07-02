import { getMcpClient } from './kapruka-ai-agent/src/services/integration/mcp.client.mjs';

async function main() {
  console.log('Checking Kapruka MCP connectivity...');
  try {
    const client = await getMcpClient();
    const toolsResponse = await client.listTools();
    const toolNames = Array.isArray(toolsResponse?.tools)
      ? toolsResponse.tools.map((tool) => tool?.name || tool?.title || 'unknown')
      : [];

    console.log('STATUS: SUCCESS');
    console.log(`Connected to: https://mcp.kapruka.com/mcp`);
    console.log(`Available tools: ${toolNames.length}`);
    console.log(JSON.stringify(toolNames, null, 2));
  } catch (error) {
    console.error('STATUS: FAILED');
    console.error(`Error: ${error?.message || error}`);
    process.exitCode = 1;
  }
}

main();

import { getMcpClient } from './kapruka-ai-agent/src/services/integration/mcp.client.mjs';

async function main() {
  console.log('Testing live MCP tool response values...');
  try {
    const client = await getMcpClient();
    const result = await client.callTool({
      name: 'kapruka_search_products',
      arguments: {
        params: {
          q: 'phone',
          response_format: 'json',
          in_stock_only: true,
          limit: 5
        }
      }
    });

    const raw = result?.structuredContent?.result ?? result?.content?.[0]?.text ?? '';
    console.log('STATUS: TOOL_RESPONSE_RECEIVED');
    console.log('Raw response preview:');
    console.log(raw.slice(0, 2000));
  } catch (error) {
    console.error('STATUS: TOOL_CALL_FAILED');
    console.error(error?.message || error);
    process.exitCode = 1;
  }
}

main();

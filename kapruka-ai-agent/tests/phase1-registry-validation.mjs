import { getMcpClient } from '../src/services/integration/mcp.client.mjs';
import chalk from 'chalk';

const EXPECTED_TOOLS = [
  'kapruka_search_products',
  'kapruka_get_product',
  'kapruka_list_categories',
  'kapruka_list_delivery_cities',
  'kapruka_check_delivery',
  'kapruka_create_order',
  'kapruka_track_order'
];

async function runPhase1() {
  console.log(chalk.cyan('--- PHASE 1: TOOL REGISTRY VALIDATION ---\n'));
  try {
    const client = await getMcpClient();
    if (!client) {
      console.log(chalk.red('FAIL: Could not connect to MCP server.'));
      process.exit(1);
    }
    
    console.log('Connected to MCP. Fetching tools...\n');
    const toolsResponse = await client.listTools();
    const availableTools = toolsResponse.tools;
    
    let allPassed = true;
    
    for (const expectedTool of EXPECTED_TOOLS) {
      const tool = availableTools.find(t => t.name === expectedTool);
      
      if (!tool) {
        console.log(chalk.red(`[FAIL] ${expectedTool}: Not found in registry`));
        allPassed = false;
        continue;
      }
      
      let toolPassed = true;
      const errors = [];
      
      if (!tool.name) { toolPassed = false; errors.push('Missing tool name'); }
      if (!tool.description) { toolPassed = false; errors.push('Missing description'); }
      if (!tool.inputSchema || !tool.inputSchema.properties) { 
        toolPassed = false; 
        errors.push('Missing inputSchema or properties'); 
      }
      
      if (toolPassed) {
        console.log(chalk.green(`[PASS] ${expectedTool}`));
        // Optionally print properties for verification
        // console.log(`       Props: ${Object.keys(tool.inputSchema.properties).join(', ')}`);
      } else {
        console.log(chalk.red(`[FAIL] ${expectedTool}: ${errors.join(', ')}`));
        allPassed = false;
      }
    }
    
    console.log('\n--- PHASE 1 COMPLETE ---');
    if (allPassed) {
      console.log(chalk.green.bold('STATUS: ALL TOOLS VALIDATED SUCCESSFULLY'));
    } else {
      console.log(chalk.red.bold('STATUS: SOME TOOLS FAILED VALIDATION'));
    }
    
    process.exit(0);
  } catch (err) {
    console.error(chalk.red('Error during Phase 1:'), err);
    process.exit(1);
  }
}

runPhase1();

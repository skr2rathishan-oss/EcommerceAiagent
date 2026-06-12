import { getMcpClient } from "./mcp.client.mjs";

export const checkDelivery = async (city, deliveryDate, productId) => {
  const client = await getMcpClient();

  // TEMP DEBUG LOG - SAFE TO REMOVE LATER
  console.log("\n[DELIVERY QUOTE] Checking delivery for city:", city, "date:", deliveryDate, "productId:", productId);
  console.log("[MCP REQUEST] Tool: kapruka_check_delivery");
  console.log("[MCP REQUEST] Arguments:", JSON.stringify({ city, delivery_date: deliveryDate, product_id: productId }, null, 2));
  const mcpStart = Date.now();

  const result = await client.callTool({
    name: "kapruka_check_delivery",
    arguments: {
      params: {
        city: city,
        delivery_date: deliveryDate || null,
        product_id: productId || null,
        response_format: "json"
      }
    }
  });

  // TEMP DEBUG LOG - SAFE TO REMOVE LATER
  console.log("[MCP RESPONSE] Tool: kapruka_check_delivery");
  console.log("[MCP RESPONSE] Duration:", Date.now() - mcpStart, "ms");
  console.log("[MCP RESPONSE] Raw result:", JSON.stringify(result, null, 2));

  const data = JSON.parse(result.structuredContent.result);

  const deliveryResult = {
    available: data.available,
    city: data.city,
    deliveryDate: data.checked_date,
    deliveryCharge: data.rate || 0,
    warning: data.perishable_warning || data.reason || null
  };

  // TEMP DEBUG LOG - SAFE TO REMOVE LATER
  console.log("[DELIVERY QUOTE] Delivery check result:", JSON.stringify(deliveryResult, null, 2));

  return deliveryResult;
};

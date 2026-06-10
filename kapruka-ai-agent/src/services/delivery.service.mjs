import { getMcpClient } from "./mcp.client.mjs";

export const checkDelivery = async (city, deliveryDate, productId) => {
  const client = await getMcpClient();

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

  const data = JSON.parse(result.structuredContent.result);

  return {
    available: data.available,
    city: data.city,
    deliveryDate: data.checked_date,
    deliveryCharge: data.rate || 0,
    warning: data.perishable_warning || data.reason || null
  };
};

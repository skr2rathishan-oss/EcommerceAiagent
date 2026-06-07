import { getMcpClient } from "./mcp.client.mjs";

export const searchProducts = async (query) => {
  const client = await getMcpClient();

  const result = await client.callTool({
    name: "kapruka_search_products",
    arguments: {
      params: {
        q: query,
        response_format: "json",
        in_stock_only: true
      }
    }
  });

  const data = JSON.parse(result.structuredContent.result);

    return data.results.map(product => ({
        id: product.id,
        name: product.name,
        price: product.price.amount,
        currency: product.price.currency,
        image: product.image_url,
        url: product.url,
        inStock: product.in_stock
    }));
};

export const processMessage = async (message) => {
  return await searchProducts(message);
};
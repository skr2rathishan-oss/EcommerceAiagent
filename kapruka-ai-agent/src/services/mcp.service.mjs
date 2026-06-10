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

export const getProductDetails = async (productId) => {
  const client = await getMcpClient();

  const result = await client.callTool({
    name: "kapruka_get_product",
    arguments: {
      params: {
        product_id: productId,
        response_format: "json"
      }
    }
  });

  const data = JSON.parse(result.structuredContent.result);

  return {
    id: data.id,
    name: data.name,
    description: data.description || data.summary || "",
    price: data.price ? data.price.amount : 0,
    currency: data.price ? data.price.currency : "LKR",
    images: data.images || [],
    stock: data.in_stock,
    shippingInfo: data.shipping ? `Ships from ${data.shipping.ships_from}` : "Standard shipping",
    url: data.url
  };
};
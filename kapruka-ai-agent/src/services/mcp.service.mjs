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

  // Safely extract the raw string — prefer structuredContent, fall back to content text
  const raw =
    result?.structuredContent?.result ??
    result?.content?.[0]?.text ??
    "";

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    // MCP returned a plain-text message like "No products found"
    console.warn("[MCP] searchProducts: non-JSON response:", raw);
    return [];
  }

  if (!data?.results || !Array.isArray(data.results)) {
    return [];
  }

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

  const raw =
    result?.structuredContent?.result ??
    result?.content?.[0]?.text ??
    "";

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    console.warn("[MCP] getProductDetails: non-JSON response:", raw);
    throw new Error("Product details not available");
  }

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
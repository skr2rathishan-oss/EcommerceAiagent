import { getMcpClient } from "../integration/mcp.client.mjs";
import { trackOrder } from "../commerce/orderTracking.service.mjs";
import logger from "../../utils/logger.mjs";

export const searchProducts = async (query) => {
  const client = await getMcpClient();

  logger.info(`[PRODUCT SEARCH] Initiating product search for query: "${query}"`, {
    tool: "kapruka_search_products",
    arguments: { q: query, in_stock_only: true }
  });
  const mcpStart = Date.now();

  const result = await client.callTool({
    name: "kapruka_search_products",
    arguments: {
      params: {
        q: query,
        response_format: "json",
        in_stock_only: true,
        limit: 50          // default is 10; max is 50
      }
    }
  });

  const durationMs = Date.now() - mcpStart;

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
    logger.warn(`[MCP] searchProducts: non-JSON response: ${raw.substring(0, 100)}...`);
    return [];
  }

  if (!data?.results || !Array.isArray(data.results)) {
    return [];
  }

  const mappedResults = data.results.map(product => ({
    id: product.id,
    name: product.name,
    price: product.price.amount,
    currency: product.price.currency,
    image: product.image_url,
    url: product.url,
    inStock: product.in_stock,
    description: product.description || product.summary || product.shortDesc || "",
    brand: product.brand || "",
    category: product.category || "",
    color: product.color || "",
    size: product.size || "",
    gender: product.gender || "",
    type: product.type || "",
    flavor: product.flavor || product.flavour || "",
    weight: product.weight || ""
  }));

  logger.info(`[PRODUCT SEARCH] Mapped ${mappedResults.length} results from MCP`, {
    durationMs,
    resultsCount: mappedResults.length
  });
  return mappedResults;
};

export const processMessage = async (message) => {
  const lowerMsg = message.toLowerCase();
  const match = message.match(/(VIMP[A-Z0-9]+|KAP-\d+-\d+)/i);

  if ((lowerMsg.includes("track") || lowerMsg.includes("status") || lowerMsg.includes("where")) && match) {
    const orderNumber = match[1];
    try {
      const trackingData = await trackOrder(orderNumber);
      return {
        type: "order_tracking",
        tracking: trackingData
      };
    } catch (error) {
      return {
        type: "order_tracking_error",
        message: error.message || "Unable to retrieve order status",
        orderNumber
      };
    }
  }

  return await searchProducts(message);
};

export const getProductDetails = async (productId) => {
  const client = await getMcpClient();

  logger.info(`[MCP REQUEST] Tool: kapruka_get_product for product ID: ${productId}`, {
    tool: "kapruka_get_product",
    arguments: { product_id: productId }
  });
  const mcpStart = Date.now();

  const result = await client.callTool({
    name: "kapruka_get_product",
    arguments: {
      params: {
        product_id: productId,
        response_format: "json"
      }
    }
  });

  const durationMs = Date.now() - mcpStart;

  const raw =
    result?.structuredContent?.result ??
    result?.content?.[0]?.text ??
    "";

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    logger.warn(`[MCP] getProductDetails: non-JSON response: ${raw.substring(0, 100)}...`);
    throw new Error("Product details not available");
  }

  logger.info(`[MCP RESPONSE] Tool: kapruka_get_product completed in ${durationMs}ms`, {
    durationMs,
    productId
  });

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

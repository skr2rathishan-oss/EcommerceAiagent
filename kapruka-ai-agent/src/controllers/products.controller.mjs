import { getProductDetails, searchProducts } from "../services/mcp.service.mjs";
import { trackInteraction } from "../services/productInteraction.service.mjs";
import { redisService } from "../services/redis.service.mjs";
import logger from "../utils/logger.mjs";

export const MOCK_PRODUCTS = {
  p1: {
    id: "p1",
    name: "SoundFlow Pro X",
    description: "Experience audio like never before with the SoundFlow Pro X. Featuring advanced Active Noise Cancellation, 40-hour battery life, and Hi-Res audio certification, these headphones deliver studio-quality sound in any environment. The ergonomic over-ear design ensures comfort during extended listening sessions.",
    price: 89.99,
    currency: "USD",
    images: [
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800&q=80",
      "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800&q=80"
    ],
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800&q=80",
    stock: true,
    shippingInfo: "Free delivery in 2–3 business days",
    url: "",
    brand: "SoundFlow",
    category: "Electronics",
    color: "Black",
    type: "Headphones"
  },
  p2: {
    id: "p2",
    name: "Vega S2 Smart Watch",
    description: "The Vega S2 redefines what a smartwatch can do. With a stunning 1.4\" AMOLED display, built-in GPS, ECG monitoring, SpO2 sensor, and 7-day battery life, it's the perfect companion for an active lifestyle. Compatible with iOS and Android.",
    price: 199.00,
    currency: "USD",
    images: [
      "https://images.unsplash.com/photo-1631863552122-3072cf599a46?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800&q=80",
      "https://images.unsplash.com/photo-1542541864-4abf21a55761?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800&q=80"
    ],
    image: "https://images.unsplash.com/photo-1631863552122-3072cf599a46?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800&q=80",
    stock: true,
    shippingInfo: "Free delivery in 1–2 business days",
    url: "",
    brand: "Vega",
    category: "Wearables",
    color: "Black",
    type: "Smart Watch"
  },
  p3: {
    id: "p3",
    name: "AirStep Runner 2.0",
    description: "The AirStep Runner 2.0 is engineered for performance and comfort. Built with a breathable mesh upper and energy-returning foam midsole, these shoes provide the perfect blend of cushioning and speed. Ideal for road running, gym workouts, and everyday wear.",
    price: 119.00,
    currency: "USD",
    images: [
      "https://images.unsplash.com/photo-1560769629-975ec94e6a86?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800&q=80",
      "https://images.unsplash.com/photo-1608231387042-66d1773070a5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800&q=80"
    ],
    image: "https://images.unsplash.com/photo-1560769629-975ec94e6a86?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800&q=80",
    stock: true,
    shippingInfo: "Free delivery in 3–5 business days",
    url: "",
    brand: "AirStep",
    category: "Footwear",
    color: "Orange",
    type: "Shoes"
  },
  p4: {
    id: "p4",
    name: "ProBook Ultra 14",
    description: "The ProBook Ultra 14 packs desktop-class performance into a 14mm slim chassis. Powered by the latest M-class processor, 16GB unified memory, and a 2K IPS display with 100% sRGB coverage, it's built for professionals who demand the best. Whisper-quiet, all-day battery life.",
    price: 1099.00,
    currency: "USD",
    images: [
      "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800&q=80",
      "https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800&q=80"
    ],
    image: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800&q=80",
    stock: true,
    shippingInfo: "Free delivery in 2–4 business days",
    url: "",
    brand: "ProBook",
    category: "Computers",
    color: "Grey",
    type: "Laptop"
  },
  p5: {
    id: "p5",
    name: "ClearSound Buds Pro",
    description: "ClearSound Buds Pro deliver immersive stereo sound in a compact form factor. With IPX5 water resistance, 8hr bud battery plus 24hr from the case, and seamless device switching, they're perfect for commuters, gym-goers, and remote workers alike.",
    price: 49.99,
    currency: "USD",
    images: [
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800&q=80",
      "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800&q=80"
    ],
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800&q=80",
    stock: true,
    shippingInfo: "Free delivery in 1–2 business days",
    url: "",
    brand: "ClearSound",
    category: "Electronics",
    color: "Cream",
    type: "Earbuds"
  },
  p6: {
    id: "p6",
    name: "Flux 3 Mechanical Keyboard",
    description: "The Flux 3 is a tenkeyless mechanical keyboard built for typists and gamers. Hot-swappable switch sockets let you tune the feel without soldering. Full per-key RGB, PBT double-shot keycaps, and a gasket-mounted plate deliver a premium tactile and auditory experience.",
    price: 129.99,
    currency: "USD",
    images: [
      "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800&q=80",
      "https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800&q=80"
    ],
    image: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800&q=80",
    stock: true,
    shippingInfo: "Free delivery in 3–5 business days",
    url: "",
    brand: "Flux",
    category: "Accessories",
    color: "Black",
    type: "Keyboard"
  }
};

export const getProduct = async (req, res) => {
  logger.info("[CONTROLLER] Entry: getProduct", { params: req.params });

  try {
    const { id } = req.params;

    if (!id || typeof id !== "string" || id.trim() === "") {
      logger.warn("[ERROR] Missing or invalid ID in getProduct");
      return res.status(400).json({
        success: false,
        message: "Valid product ID is required"
      });
    }

    const trimmedId = id.trim();
    if (MOCK_PRODUCTS[trimmedId]) {
      logger.info("[CONTROLLER] Returning mock product details for ID", { trimmedId });
      return res.json(MOCK_PRODUCTS[trimmedId]);
    }

    // Try fetching from cache
    const cacheKey = `product_detail:${trimmedId}`;
    const cachedDetails = await redisService.get(cacheKey);
    if (cachedDetails) {
      logger.info("[CONTROLLER] Returning cached product details for ID", { trimmedId });
      return res.json(cachedDetails);
    }

    const details = await getProductDetails(trimmedId);

    if (!details || !details.id) {
      logger.warn("[ERROR] Product details not found or invalid response for ID", { id });
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // Save to cache
    await redisService.set(cacheKey, details, 3600); // Cache for 1 hour

    // Track "details" interaction in the background asynchronously
    const sessionId = req.headers["x-session-id"] || "default";
    trackInteraction(sessionId, details.id, details.name, details.category, "details").catch(err => {
      logger.error("[Background Tracking Error] Direct detail tracking failed", { error: err.message, stack: err.stack });
    });

    logger.info("[FINAL RESPONSE] getProduct Success", { productId: details.id });
    return res.json(details);

  } catch (error) {
    logger.error("[ERROR] Failed in getProduct", { error: error.message, stack: error.stack });
    
    // Check if error is due to product not found from MCP
    const errMsg = error.message || "";
    if (errMsg.includes("product_not_found") || errMsg.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: "Product not found on Kapruka"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
};

export const trackInteractionController = async (req, res) => {
  try {
    const sessionId = req.headers["x-session-id"] || req.body.sessionId || "default";
    const { productId, productName, category, action } = req.body;

    if (!productId || !action) {
      return res.status(400).json({
        success: false,
        message: "productId and action are required"
      });
    }

    // Run tracking asynchronously in the background
    trackInteraction(sessionId, productId, productName, category, action).catch(err => {
      logger.error("[Background Tracking Error] Failed to track action", { error: err.message, stack: err.stack });
    });

    return res.json({ success: true });
  } catch (error) {
    logger.error("[Interaction Controller Error] Failed to process tracking", { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
};

export const getRecommendationsController = async (req, res) => {
  logger.info("[CONTROLLER] Entry: getRecommendationsController");

  try {
    const cacheKey = "top_recommendations_v2";
    const cachedRecs = await redisService.get(cacheKey);
    if (cachedRecs) {
      logger.info("[CONTROLLER] Returning cached recommendations");
      return res.json({ success: true, products: cachedRecs });
    }

    logger.info("[CONTROLLER] Fetching recommendations from MCP");
    
    // Fetch multiple product categories in parallel for a rich recommendations list
    const categories = ["chocolate", "tea", "cake", "toy"];
    const results = await Promise.allSettled(
      categories.map(cat => searchProducts(cat))
    );

    const mergedProducts = [];
    results.forEach(res => {
      if (res.status === "fulfilled" && Array.isArray(res.value)) {
        // Take up to 4 items from each category to ensure diversity
        mergedProducts.push(...res.value.slice(0, 4));
      }
    });

    // Shuffle the combined products list so it feels fresh on load
    const products = mergedProducts.sort(() => Math.random() - 0.5);

    // Cache the recommendations list for 1 hour (3600 seconds)
    await redisService.set(cacheKey, products, 3600);

    logger.info("[CONTROLLER] getRecommendationsController Success", { count: products.length });
    return res.json({ success: true, products });
  } catch (error) {
    logger.error("[ERROR] Failed in getRecommendationsController", { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
};

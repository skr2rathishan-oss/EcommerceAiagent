import { getProductDetails, searchProducts } from "../services/mcp.service.mjs";
import { trackInteraction } from "../services/productInteraction.service.mjs";
import { redisService } from "../services/redis.service.mjs";
import logger from "../utils/logger.mjs";
import { client, PRIMARY_MODEL } from "../services/llm.service.mjs";
import { getMcpClient } from "../services/mcp.client.mjs";

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
    const cacheKey = "top_recommendations_v3";
    const cachedRecs = await redisService.get(cacheKey);
    if (cachedRecs) {
      logger.info("[CONTROLLER] Returning cached recommendations");
      return res.json({ success: true, products: cachedRecs });
    }

    logger.info("[CONTROLLER] Fetching recommendations from MCP");
    
    // Fetch multiple product categories in parallel for a rich recommendations list
    const categories = ["chocolate", "tea", "cake", "toy", "perfume", "flowers", "biscuit", "fruit"];
    const results = await Promise.allSettled(
      categories.map(cat => searchProducts(cat))
    );

    const mergedProducts = [];
    results.forEach(res => {
      if (res.status === "fulfilled" && Array.isArray(res.value)) {
        // Take up to 12 items from each category to ensure diversity
        mergedProducts.push(...res.value.slice(0, 12));
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

// ── Velora AI Recommendation Execution Engine Backend Services ─────────────────

async function runMcpSearch(query, category, budget) {
  try {
    const mcpClient = await getMcpClient();
    let q = query || "gifts";
    if (q.length < 3) q = q + " gift"; // ensure min length is 3

    const searchParams = {
      q,
      in_stock_only: true,
      limit: 20,
      response_format: "json"
    };

    if (category) {
      searchParams.category = category;
    }
    if (budget && !isNaN(Number(budget))) {
      searchParams.max_price = Number(budget);
    }

    const result = await mcpClient.callTool({
      name: "kapruka_search_products",
      arguments: {
        params: searchParams
      }
    });

    const raw =
      result?.structuredContent?.result ??
      result?.content?.[0]?.text ??
      "";

    const data = JSON.parse(raw);
    if (!data?.results || !Array.isArray(data.results)) {
      return [];
    }

    return data.results.map(product => ({
      id: product.id,
      name: product.name,
      price: product.price ? product.price.amount : 0,
      currency: product.price ? product.price.currency : "LKR",
      image: product.image_url || "",
      url: product.url || "",
      inStock: product.in_stock !== undefined ? product.in_stock : true,
      description: product.description || product.summary || "",
      brand: product.brand || "Kapruka",
      category: product.category ? (product.category.name || product.category) : "General"
    }));
  } catch (error) {
    logger.warn(`[runMcpSearch] Failed to fetch or parse results: ${error.message}`);
    return [];
  }
}

async function searchKaprukaProductsInternal(query, category, budget) {
  // Try 1: with category and budget
  let results = await runMcpSearch(query, category, budget);
  if (results && results.length > 0) return results;

  // Try 2: with category only (ignore budget)
  if (budget) {
    logger.info("[KAPRUKA SEARCH] No results found. Retrying without budget limit...");
    results = await runMcpSearch(query, category, null);
    if (results && results.length > 0) return results;
  }

  // Try 3: with query only (ignore category and budget)
  if (category) {
    logger.info("[KAPRUKA SEARCH] No results found. Retrying without category filter...");
    results = await runMcpSearch(query, null, null);
    if (results && results.length > 0) return results;
  }

  // Try 4: fallback to search using just "gifts"
  if (query !== "gifts") {
    logger.info("[KAPRUKA SEARCH] No results found. Retrying with fallback query 'gifts'...");
    results = await runMcpSearch("gifts", null, null);
    if (results && results.length > 0) return results;
  }

  // Try 5: Return empty array if all searches returned empty
  logger.warn("[KAPRUKA SEARCH] All Kapruka searches returned empty. No mock fallback allowed.");
  return [];
}

export const getSearchStrategyController = async (req, res) => {
  const { recipient, occasion, budget, interests } = req.body;
  
  console.log(`\n[RECOMMENDATION]\nPanel Submitted\nRecipient: ${recipient}\nOccasion: ${occasion}\nBudget: ${budget}\n`);
  logger.info("[RECOMMENDATION] Panel Submitted", { recipient, occasion, budget, interests });

  const prompt = `You are an expert shopping strategist for Kapruka (an e-commerce platform in Sri Lanka).
Given the following gift profile:
- Recipient: ${recipient}
- Occasion: ${occasion}
- Budget: Rs. ${budget} LKR
- Interests: ${interests}

Generate an optimized search query and category to find suitable products.
Do NOT recommend specific products.
Instead, respond with a single JSON object (no markdown tags, no code blocks, no backticks, no other text) with these exact keys:
- "query": a 2-3 word search query optimized for product catalogs (e.g. "gardening tools", "mens watch", "chocolates")
- "category": a broad category name suitable for filtering (e.g. "Gifts", "Cakes", "Flowers", "Toys", "Electronics", "Watches")
- "reason": a short, 1-sentence explanation of why this query is suitable for the recipient's interests/occasion.

Example Output:
{
  "query": "gardening gifts",
  "category": "Gifts",
  "reason": "Suitable for a mother interested in gardening"
}
`;

  let strategy = {
    query: `${interests} gifts`,
    category: "Gifts",
    reason: `Gifts suitable for ${recipient} interested in ${interests}`
  };

  try {
    const response = await client.chat.completions.create({
      model: PRIMARY_MODEL,
      temperature: 0.2,
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }]
    });

    const content = response.choices[0].message.content.trim();
    const cleanContent = content.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(cleanContent);
    if (parsed.query && parsed.category && parsed.reason) {
      strategy = parsed;
    }
  } catch (err) {
    logger.error("[getSearchStrategyController] AI search strategy failed, using fallback:", err.message);
  }

  console.log(`[AI]\nGenerated Query:\n${strategy.query}\n`);
  logger.info(`[AI] Generated Query: ${strategy.query}`);

  return res.json(strategy);
};

export const getSearchProductsController = async (req, res) => {
  const { query, category, budget } = req.body;
  const products = await searchKaprukaProductsInternal(query, category, budget);
  
  console.log(`[KAPRUKA]\nProducts Found: ${products.length}\n`);
  logger.info(`[KAPRUKA] Products Found: ${products.length}`);
  
  return res.json(products);
};

export const rankProductsController = async (req, res) => {
  const { products, preferences } = req.body;
  const { recipient, occasion, budget, interests } = preferences || {};

  if (!products || !Array.isArray(products) || products.length === 0) {
    console.log("[RANKING]\nTop Products Selected: 0\n");
    return res.json([]);
  }

  const prompt = `You are an e-commerce ranking assistant.
Rank the following list of products for the gift profile:
- Recipient: ${recipient}
- Occasion: ${occasion}
- Budget: Rs. ${budget} LKR
- Interests: ${interests}

Here is the list of products:
${products.map(p => `- ID: ${p.id}, Name: ${p.name}, Price: ${p.price} LKR, Description: ${p.description}`).join("\n")}

Select the top 5 most suitable products. For each selected product, assign a relevance score (0-100), a recommendationType ("Best Match", "Budget Friendly", "Premium Pick", "Most Popular", or "Alternative Choice"), and a recommendationReason (1-sentence explanation of why it is recommended).

Respond with a single JSON array (no markdown tags, no code blocks, no backticks, no other text) in this exact format:
[
  { "productId": "...", "score": 95, "recommendationType": "Best Match", "recommendationReason": "..." },
  ...
]
`;

  let rankings = [];
  try {
    const response = await client.chat.completions.create({
      model: PRIMARY_MODEL,
      temperature: 0.1,
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }]
    });

    const content = response.choices[0].message.content.trim();
    const cleanContent = content.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    rankings = JSON.parse(cleanContent);
  } catch (err) {
    logger.error("[rankProductsController] AI ranking failed, using fallback:", err.message);
  }

  const validRankings = rankings.filter(r => r.productId && r.score !== undefined && r.recommendationType && r.recommendationReason);
  
  if (validRankings.length === 0) {
    const sortedProducts = [...products].sort((a, b) => a.price - b.price);
    const top5 = products.slice(0, 5);
    
    validRankings.push(...top5.map((p, idx) => {
      let recType = "Alternative Choice";
      let recReason = `Thoughtful choice matching ${interests} for ${recipient}'s ${occasion}.`;
      
      if (idx === 0) {
        recType = "Best Match";
        recReason = `Excellent match for a ${recipient} interested in ${interests} for a ${occasion}.`;
      } else if (p.id === sortedProducts[0]?.id) {
        recType = "Budget Friendly";
        recReason = `Great budget-friendly choice at Rs. ${p.price} matching their interests.`;
      } else if (p.id === sortedProducts[sortedProducts.length - 1]?.id) {
        recType = "Premium Pick";
        recReason = `Premium selection matching their ${interests} interest.`;
      } else if (idx === 1) {
        recType = "Most Popular";
        recReason = `Highly popular item for ${occasion} occasions.`;
      }

      return {
        productId: p.id,
        score: 95 - idx * 5,
        recommendationType: recType,
        recommendationReason: recReason
      };
    }));
  }

  console.log(`[RANKING]\nTop Products Selected: ${validRankings.length}\n`);
  logger.info(`[RANKING] Top Products Selected: ${validRankings.length}`);

  return res.json(validRankings);
};

export const generateRecommendationsController = async (req, res) => {
  const { recipient, occasion, budget, interests } = req.body;

  try {
    console.log(`\n[RECOMMENDATION]\nPanel Submitted\nRecipient: ${recipient}\nOccasion: ${occasion}\nBudget: ${budget}\n`);
    
    // 1. Strategy
    const strategyPrompt = `You are an expert shopping strategist for Kapruka (an e-commerce platform in Sri Lanka).
Given the following gift profile:
- Recipient: ${recipient}
- Occasion: ${occasion}
- Budget: Rs. ${budget} LKR
- Interests: ${interests}

Generate an optimized search query and category to find suitable products.
Do NOT recommend specific products.
Instead, respond with a single JSON object (no markdown tags, no code blocks, no backticks, no other text) with these keys:
- "query": a 2-3 word search query optimized for product catalogs
- "category": a broad category name suitable for filtering
- "reason": a short, 1-sentence explanation of why this query is suitable for the recipient's interests/occasion.
`;

    let strategy = {
      query: `${interests} gifts`,
      category: "Gifts",
      reason: `Gifts suitable for ${recipient} interested in ${interests}`
    };

    try {
      const strategyRes = await client.chat.completions.create({
        model: PRIMARY_MODEL,
        temperature: 0.2,
        max_tokens: 300,
        messages: [{ role: "user", content: strategyPrompt }]
      });
      const cleanContent = strategyRes.choices[0].message.content.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      strategy = JSON.parse(cleanContent);
    } catch (err) {
      logger.error("[generateRecommendationsController] Strategy generation failed, using fallback:", err.message);
    }

    console.log(`[AI]\nGenerated Query:\n${strategy.query}\n`);

    // 2. Search
    const products = await searchKaprukaProductsInternal(strategy.query, strategy.category, budget);
    console.log(`[KAPRUKA]\nProducts Found: ${products.length}\n`);

    // 3. Rank
    let rankings = [];
    if (products.length > 0) {
      const rankPrompt = `You are an e-commerce ranking assistant.
Rank the following list of products for the gift profile:
- Recipient: ${recipient}
- Occasion: ${occasion}
- Budget: Rs. ${budget} LKR
- Interests: ${interests}

Here is the list of products:
${products.map(p => `- ID: ${p.id}, Name: ${p.name}, Price: ${p.price} LKR, Description: ${p.description}`).join("\n")}

Select the top 5 most suitable products. For each selected product, assign a relevance score (0-100), a recommendationType ("Best Match", "Budget Friendly", "Premium Pick", "Most Popular", or "Alternative Choice"), and a recommendationReason (1-sentence explanation of why it is recommended).

Respond with a single JSON array (no markdown tags, no code blocks, no backticks, no other text) in this exact format:
[
  { "productId": "...", "score": 95, "recommendationType": "Best Match", "recommendationReason": "..." },
  ...
]
`;

      try {
        const rankRes = await client.chat.completions.create({
          model: PRIMARY_MODEL,
          temperature: 0.1,
          max_tokens: 1000,
          messages: [{ role: "user", content: rankPrompt }]
        });
        const cleanRankContent = rankRes.choices[0].message.content.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
        rankings = JSON.parse(cleanRankContent);
      } catch (err) {
        logger.error("[generateRecommendationsController] Ranking failed, using fallback:", err.message);
      }
    }

    const validRankings = rankings.filter(r => r.productId && r.score !== undefined && r.recommendationType && r.recommendationReason);
    
    if (validRankings.length === 0) {
      const sortedProducts = [...products].sort((a, b) => a.price - b.price);
      const top5 = products.slice(0, 5);
      validRankings.push(...top5.map((p, idx) => {
        let recType = "Alternative Choice";
        let recReason = `Thoughtful choice matching ${interests} for ${recipient}'s ${occasion}.`;
        
        if (idx === 0) {
          recType = "Best Match";
          recReason = `Excellent match for a ${recipient} interested in ${interests} for a ${occasion}.`;
        } else if (p.id === sortedProducts[0]?.id) {
          recType = "Budget Friendly";
          recReason = `Great budget-friendly choice at Rs. ${p.price} matching their interests.`;
        } else if (p.id === sortedProducts[sortedProducts.length - 1]?.id) {
          recType = "Premium Pick";
          recReason = `Premium selection matching their ${interests} interest.`;
        } else if (idx === 1) {
          recType = "Most Popular";
          recReason = `Highly popular item for ${occasion} occasions.`;
        }

        return {
          productId: p.id,
          score: 95 - idx * 5,
          recommendationType: recType,
          recommendationReason: recReason
        };
      }));
    }

    console.log(`[RANKING]\nTop Products Selected: ${validRankings.length}\n`);

    const finalRecs = validRankings.map(rank => {
      const originalProduct = products.find(p => p.id === rank.productId);
      if (!originalProduct) return null;
      return {
        ...originalProduct,
        productId: rank.productId,
        score: rank.score,
        recommendationType: rank.recommendationType,
        recommendationReason: rank.recommendationReason
      };
    }).filter(Boolean);

    console.log(`[RECOMMENDATION]\nResponse Generated\n`);
    logger.info(`[RECOMMENDATION] Response Generated. Count: ${finalRecs.length}`);

    return res.json({ recommendations: finalRecs });
  } catch (error) {
    logger.error("[ERROR] Failed in generateRecommendationsController", { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
};

import { getProductDetails, searchProducts } from "../services/integration/mcp.service.mjs";
import { trackInteraction } from "../services/commerce/productInteraction.service.mjs";
import { cacheService } from "../cache/cacheService.mjs";
import logger from "../utils/logger.mjs";
import { getRecommendationModel, callGeminiSingleTurn, withTimeout } from "../services/ai/modelRouter.mjs";
import { getMcpClient } from "../services/integration/mcp.client.mjs";

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
    const cachedDetails = await cacheService.get(cacheKey);
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
    await cacheService.set(cacheKey, details, 3600); // Cache for 1 hour

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
    const cachedRecs = await cacheService.get(cacheKey);
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
    await cacheService.set(cacheKey, products, 3600);

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
      arguments: searchParams
    });

    const raw =
      result?.structuredContent?.result ??
      result?.content?.[0]?.text ??
      "";

    // Guard against non-JSON responses (e.g. "No products found")
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      logger.warn(`[runMcpSearch] MCP returned non-JSON response for query "${q}": ${String(raw).substring(0, 120)}`);
      return [];
    }
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
      category: typeof product.category === "object" ? (product.category.name || product.category.id || "General") : (product.category || "General")
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

  const systemPrompt = `You are an expert shopping strategist for Kapruka (an e-commerce platform in Sri Lanka).
Respond with a single JSON object (no markdown, no code blocks, no backticks, no other text) with these exact keys:
- "query": a 2-3 word search query optimized for product catalogs (e.g. "gardening tools", "mens watch", "chocolates")
- "category": a broad category name suitable for filtering (e.g. "Gifts", "Cakes", "Flowers", "Toys", "Electronics", "Watches")
- "reason": a short, 1-sentence explanation of why this query is suitable for the recipient's interests/occasion.`;

  const userPrompt = `Gift profile:
- Recipient: ${recipient}
- Occasion: ${occasion}
- Budget: Rs. ${budget} LKR
- Interests: ${interests}

Generate an optimized search query and category.`;

  let strategy = {
    query: `${interests} gifts`,
    category: "Gifts",
    reason: `Gifts suitable for ${recipient} interested in ${interests}`
  };

  try {
    const { client: activeClient, model, provider } = getRecommendationModel();
    let content;
    if (provider === "gemini") {
      content = await callGeminiSingleTurn(activeClient, model, systemPrompt, userPrompt, { temperature: 0.2, maxOutputTokens: 1000 });
    } else {
      const response = await withTimeout(
        activeClient.chat.completions.create({ model, temperature: 0.2, max_tokens: 1000, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }] }),
        undefined, "Search strategy"
      );
      content = response.choices[0].message.content.trim();
    }
    const cleanContent = content.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(cleanContent);
    if (parsed.query && parsed.category && parsed.reason) strategy = parsed;
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

  const systemPrompt = `You are an e-commerce ranking assistant. Select the top 15 most suitable products from the list provided.
For each selected product assign: a relevance score (0-100), a recommendationType ("Best Match", "Budget Friendly", "Premium Pick", "Most Popular", or "Alternative Choice"), and a recommendationReason (1-sentence).
Respond with a single JSON array (no markdown, no code blocks, no backticks, no other text):
[{ "productId": "...", "score": 95, "recommendationType": "Best Match", "recommendationReason": "..." }]`;

  const userPrompt = `Gift profile:
- Recipient: ${recipient}
- Occasion: ${occasion}
- Budget: Rs. ${budget} LKR
- Interests: ${interests}

Products:
${products.map(p => `- ID: ${p.id}, Name: ${p.name}, Price: ${p.price} LKR, Description: ${p.description}`).join("\n")}`;

  let rankings = [];
  try {
    const { client: activeClient, model, provider } = getRecommendationModel();
    let content;
    if (provider === "gemini") {
      content = await callGeminiSingleTurn(activeClient, model, systemPrompt, userPrompt, { temperature: 0.1, maxOutputTokens: 1000 });
    } else {
      const response = await withTimeout(
        activeClient.chat.completions.create({ model, temperature: 0.1, max_tokens: 1000, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }] }),
        undefined, "Product ranking"
      );
      content = response.choices[0].message.content.trim();
    }
    rankings = JSON.parse(content.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim());
  } catch (err) {
    logger.error("[rankProductsController] AI ranking failed, using fallback:", err.message);
  }

  const validRankings = rankings.filter(r => r.productId && r.score !== undefined && r.recommendationType).map(({ recommendationReason, ...rest }) => rest);
  
  if (validRankings.length === 0) {
    const sortedProducts = [...products].sort((a, b) => a.price - b.price);
    const top15 = products.slice(0, 15);
    
    validRankings.push(...top15.map((p, idx) => {
      let recType = "Alternative Choice";
      
      if (idx === 0) {
        recType = "Best Match";
      } else if (p.id === sortedProducts[0]?.id) {
        recType = "Budget Friendly";
      } else if (p.id === sortedProducts[sortedProducts.length - 1]?.id) {
        recType = "Premium Pick";
      } else if (idx === 1) {
        recType = "Most Popular";
      }

      return {
        productId: p.id,
        score: 95 - idx * 5,
        recommendationType: recType
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
    const strategySystemPrompt = `You are an expert shopping strategist for Kapruka (an e-commerce platform in Sri Lanka).
Respond with a single JSON object (no markdown, no code blocks, no backticks, no other text) with these keys:
- "query": a 2-3 word search query optimized for product catalogs
- "category": a broad category name suitable for filtering
- "reason": a short, 1-sentence explanation of why this query is suitable.`;

    const strategyUserPrompt = `Gift profile:\n- Recipient: ${recipient}\n- Occasion: ${occasion}\n- Budget: Rs. ${budget} LKR\n- Interests: ${interests}\n\nGenerate search query and category.`;

    let strategy = {
      query: `${interests} gifts`,
      category: "Gifts",
      reason: `Gifts suitable for ${recipient} interested in ${interests}`
    };

    try {
      const { client: activeClient, model, provider } = getRecommendationModel();
      let rawStrategy;
      if (provider === "gemini") {
        rawStrategy = await callGeminiSingleTurn(activeClient, model, strategySystemPrompt, strategyUserPrompt, { temperature: 0.2, maxOutputTokens: 1000 });
      } else {
        const strategyRes = await withTimeout(
          activeClient.chat.completions.create({ model, temperature: 0.2, max_tokens: 1000, messages: [{ role: "system", content: strategySystemPrompt }, { role: "user", content: strategyUserPrompt }] }),
          undefined, "Strategy"
        );
        rawStrategy = strategyRes.choices[0].message.content.trim();
      }
      strategy = JSON.parse(rawStrategy.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim());
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
      const rankSystemPrompt = `You are an e-commerce ranking assistant. Select top 5 products for the given profile.
For each product assign: score (0-100), recommendationType ("Best Match"|"Budget Friendly"|"Premium Pick"|"Most Popular"|"Alternative Choice"), recommendationReason (1 sentence).
Return ONLY a JSON array, no markdown, no extra text.`;

      const rankUserPrompt = `Profile: Recipient: ${recipient}, Occasion: ${occasion}, Budget: Rs.${budget}, Interests: ${interests}\n\nProducts:\n${products.map(p => `- ID: ${p.id}, Name: ${p.name}, Price: ${p.price} LKR, Desc: ${p.description}`).join("\n")}`;

      try {
        const { client: activeClient, model, provider } = getRecommendationModel();
        let rawRank;
        if (provider === "gemini") {
          rawRank = await callGeminiSingleTurn(activeClient, model, rankSystemPrompt, rankUserPrompt, { temperature: 0.1, maxOutputTokens: 1000 });
        } else {
          const rankRes = await withTimeout(
            activeClient.chat.completions.create({ model, temperature: 0.1, max_tokens: 1000, messages: [{ role: "system", content: rankSystemPrompt }, { role: "user", content: rankUserPrompt }] }),
            undefined, "Ranking"
          );
          rawRank = rankRes.choices[0].message.content.trim();
        }
        rankings = JSON.parse(rawRank.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim());
      } catch (err) {
        logger.error("[generateRecommendationsController] Ranking failed, using fallback:", err.message);
      }
    }

    const validRankings = rankings.filter(r => r.productId && r.score !== undefined && r.recommendationType && r.recommendationReason);
    
    if (validRankings.length === 0) {
      const sortedProducts = [...products].sort((a, b) => a.price - b.price);
      const top15 = products.slice(0, 15);
      validRankings.push(...top15.map((p, idx) => {
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

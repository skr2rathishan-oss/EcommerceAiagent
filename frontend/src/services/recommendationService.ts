export interface GiftPreferences {
  recipient: string;
  occasion: string;
  budget: number;
  interests: string;
}

export interface SearchStrategy {
  query: string;
  category: string;
  reason: string;
}

export interface RankedProductMetadata {
  productId: string;
  score: number;
  recommendationType: string;
  recommendationReason: string;
}

export interface RecommendationProduct {
  id: string;
  name: string;
  price: number;
  currency: string;
  image: string;
  url: string;
  inStock: boolean;
  description: string;
  brand: string;
  category: string;
  productId?: string;
  score?: number;
  recommendationType?: string;
  recommendationReason?: string;
}

// ── Velora AI Recommendation Execution Engine Service ──────────────────────────

/**
 * Step 1: Generate Search Strategy using Qwen
 */
export async function generateSearchStrategy(preferences: GiftPreferences): Promise<SearchStrategy> {
  const response = await fetch("/api/products/recommendations/strategy", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(preferences),
  });

  if (!response.ok) {
    throw new Error("Failed to generate AI search strategy");
  }

  return response.json();
}

/**
 * Step 2: Search products in Kapruka catalog via MCP tool
 */
export async function searchProducts(query: string, category: string, budget: number): Promise<RecommendationProduct[]> {
  const response = await fetch("/api/products/recommendations/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, category, budget }),
  });

  if (!response.ok) {
    throw new Error("Failed to query Kapruka products");
  }

  return response.json();
}

/**
 * Step 3: Rank products for preferences using Qwen
 */
export async function rankProducts(products: RecommendationProduct[], preferences: GiftPreferences): Promise<RankedProductMetadata[]> {
  const response = await fetch("/api/products/recommendations/rank", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ products, preferences }),
  });

  if (!response.ok) {
    throw new Error("Failed to rank products");
  }

  return response.json();
}

/**
 * Combined Step: Fully coordinated backend strategy generation, search, and ranking
 */
export async function generateRecommendations(preferences: GiftPreferences): Promise<{ recommendations: RecommendationProduct[] }> {
  const response = await fetch("/api/products/recommendations/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(preferences),
  });

  if (!response.ok) {
    throw new Error("Failed to generate gift recommendations");
  }

  return response.json();
}

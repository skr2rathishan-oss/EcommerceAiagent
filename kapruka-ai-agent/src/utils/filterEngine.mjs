// Universal Product Filtering Engine for Velora AI Shopping Agent
// Contains matching, filtering, and suggestion logic for structured product results.

/**
 * Checks if a product matches the extracted filters.
 * Supports structured fields with fallback case-insensitive searching in name/description.
 * Special regex-based whole word matching is used for size tags (S, M, L, etc.) to prevent false matches.
 *
 * @param {Object} product - The product from search results.
 * @param {Object} filters - The extracted universal filters.
 * @returns {boolean} True if product matches all present filters.
 */
export function matchProduct(product, filters) {
  if (!filters) return true;

  // Helper for case-insensitive substring match
  const containsText = (source, target) => {
    if (!source || typeof source !== "string") return false;
    return source.toLowerCase().includes(target.toLowerCase());
  };

  // Helper for case-insensitive whole-word match (useful for size codes like S, M, L)
  const containsWholeWord = (source, target) => {
    if (!source || typeof source !== "string") return false;
    // Escape regex characters
    const escaped = target.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    return regex.test(source);
  };

  // Helper to match string attribute with structured or unstructured fallback
  const matchStringAttribute = (productVal, filterVal, searchInFields = [], isSize = false) => {
    if (!filterVal || String(filterVal).trim() === "") return true; // Filter not present
    
    const filterStr = String(filterVal).trim();

    // 1. Structured Match
    if (productVal && typeof productVal === "string" && productVal.trim() !== "") {
      if (productVal.toLowerCase() === filterStr.toLowerCase()) {
        return true;
      }
    }

    // 2. Unstructured Fallback Search
    for (const fieldVal of searchInFields) {
      if (isSize) {
        if (containsWholeWord(fieldVal, filterStr)) {
          return true;
        }
      } else {
        if (containsText(fieldVal, filterStr)) {
          return true;
        }
      }
    }

    return false;
  };

  // Category synonyms map to handle common query variations
  const CATEGORY_SYNONYMS = {
    mobile: ["mobile", "phone", "iphone", "smartphone"],
    phone: ["mobile", "phone", "iphone", "smartphone"],
    shirt: ["shirt", "t-shirt", "polo"],
    cake: ["cake", "gateau", "gateaux"],
    flower: ["flower", "bouquet", "rose", "blossom"],
  };

  // 1. Category Matching
  if (filters.category && String(filters.category).trim() !== "") {
    const catLower = String(filters.category).toLowerCase().trim();
    const synonyms = CATEGORY_SYNONYMS[catLower] || [catLower];
    
    // Check product.category structured field first
    let matchesCategory = false;
    if (product.category && typeof product.category === "string") {
      if (synonyms.includes(product.category.toLowerCase())) {
        matchesCategory = true;
      }
    }
    
    // Check product name/description if structured check didn't match
    if (!matchesCategory) {
      const searchFields = [product.name, product.description];
      for (const syn of synonyms) {
        for (const field of searchFields) {
          if (containsText(field, syn)) {
            matchesCategory = true;
            break;
          }
        }
        if (matchesCategory) break;
      }
    }

    if (!matchesCategory) return false;
  }

  // 2. Brand Matching (Case-insensitive)
  if (filters.brand && String(filters.brand).trim() !== "") {
    const matched = matchStringAttribute(
      product.brand,
      filters.brand,
      [product.name, product.description]
    );
    if (!matched) return false;
  }

  // 3. Color Matching (Case-insensitive)
  if (filters.color && String(filters.color).trim() !== "") {
    const matched = matchStringAttribute(
      product.color,
      filters.color,
      [product.name, product.description]
    );
    if (!matched) return false;
  }

  // 4. Size Matching (Case-insensitive, whole-word matching to avoid partial substring issues)
  if (filters.size && String(filters.size).trim() !== "") {
    const matched = matchStringAttribute(
      product.size,
      filters.size,
      [product.name, product.description],
      true
    );
    if (!matched) return false;
  }

  // 5. Gender Matching (Case-insensitive)
  if (filters.gender && String(filters.gender).trim() !== "") {
    const matched = matchStringAttribute(
      product.gender,
      filters.gender,
      [product.name, product.description]
    );
    if (!matched) return false;
  }

  // 6. Type Matching (Case-insensitive)
  if (filters.type && String(filters.type).trim() !== "") {
    const matched = matchStringAttribute(
      product.type,
      filters.type,
      [product.name, product.description]
    );
    if (!matched) return false;
  }

  // 7. Flavor Matching (Case-insensitive)
  if (filters.flavor && String(filters.flavor).trim() !== "") {
    const matched = matchStringAttribute(
      product.flavor || product.flavour,
      filters.flavor,
      [product.name, product.description]
    );
    if (!matched) return false;
  }

  // 8. Weight Matching (Case-insensitive)
  if (filters.weight && String(filters.weight).trim() !== "") {
    const matched = matchStringAttribute(
      product.weight,
      filters.weight,
      [product.name, product.description]
    );
    if (!matched) return false;
  }

  // 9. Price Minimum Matching
  const pMin = parseFloat(filters.priceMin);
  if (!isNaN(pMin) && pMin > 0) {
    const prodPrice = parseFloat(product.price);
    if (isNaN(prodPrice) || prodPrice < pMin) {
      return false;
    }
  }

  // 10. Price Maximum Matching
  const pMax = parseFloat(filters.priceMax);
  if (!isNaN(pMax) && pMax > 0) {
    const prodPrice = parseFloat(product.price);
    if (isNaN(prodPrice) || prodPrice > pMax) {
      return false;
    }
  }

  return true;
}

/**
 * Filters a list of products using the universal filter object.
 *
 * @param {Array} products - List of products.
 * @param {Object} filters - Universal filter object.
 * @returns {Array} Filtered list of products.
 */
export function applyFilters(products, filters) {
  if (!products || !Array.isArray(products)) return [];
  if (!filters || Object.keys(filters).length === 0) return products;
  
  return products.filter(product => matchProduct(product, filters));
}

/**
 * Returns suggestions (similar products or nearby price ranges) when no products match.
 * Suggestions will match category/brand but loosen price, color, size constraints.
 * Do not return completely unrelated products.
 *
 * @param {Array} products - List of all searched products.
 * @param {Object} filters - Universal filter object that returned empty.
 * @returns {Array} List of related products to suggest.
 */
export function getSuggestions(products, filters) {
  if (!products || !Array.isArray(products)) return [];
  if (!filters) return products;

  const containsText = (source, target) => {
    if (!source || typeof source !== "string") return false;
    return source.toLowerCase().includes(target.toLowerCase());
  };

  const CATEGORY_SYNONYMS = {
    mobile: ["mobile", "phone", "iphone", "smartphone"],
    phone: ["mobile", "phone", "iphone", "smartphone"],
    shirt: ["shirt", "t-shirt", "polo"],
    cake: ["cake", "gateau", "gateaux"],
    flower: ["flower", "bouquet", "rose", "blossom"],
  };

  return products.filter(product => {
    let isRelated = false;

    // Check category relationship
    if (filters.category && String(filters.category).trim() !== "") {
      const catLower = String(filters.category).toLowerCase().trim();
      const synonyms = CATEGORY_SYNONYMS[catLower] || [catLower];

      if (product.category && typeof product.category === "string" && synonyms.includes(product.category.toLowerCase())) {
        isRelated = true;
      } else {
        for (const syn of synonyms) {
          if (containsText(product.name, syn) || containsText(product.description, syn)) {
            isRelated = true;
            break;
          }
        }
      }
    }

    // Check brand relationship
    if (filters.brand && String(filters.brand).trim() !== "") {
      const brandLower = String(filters.brand).toLowerCase().trim();
      if (product.brand && product.brand.toLowerCase() === brandLower) {
        isRelated = true;
      } else if (containsText(product.name, brandLower) || containsText(product.description, brandLower)) {
        isRelated = true;
      }
    }

    // If neither brand nor category was specified, everything in search results is related
    if (!filters.category && !filters.brand) {
      isRelated = true;
    }

    return isRelated;
  });
}

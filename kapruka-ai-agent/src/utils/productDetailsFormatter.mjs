// ═══════════════════════════════════════════════════════════════════
// PRODUCT DETAILS FORMATTER
// SAFE TO EXTEND LATER
//
// Converts raw product data from MCP into clean, readable
// markdown-formatted text for display in the frontend.
//
// Sections produced:
//   - Product name, price, availability
//   - Clean description (HTML stripped, whitespace normalised)
//   - Available Variations (sizes, colors, models, storage, etc.)
//   - Features
//   - Delivery information
//   - Specifications
// ═══════════════════════════════════════════════════════════════════

// ── HTML Stripper ────────────────────────────────────────────────────────────
// Removes all HTML tags from a string and decodes common HTML entities.
function stripHtml(text) {
  if (!text || typeof text !== "string") return "";

  return text
    // Remove script / style blocks entirely
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/(script|style)>/gi, "")
    // Remove all other HTML tags
    .replace(/<[^>]+>/g, " ")
    // Decode common HTML entities
    .replace(/&amp;/g,  "&")
    .replace(/&lt;/g,   "<")
    .replace(/&gt;/g,   ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&nbsp;/g, " ")
    // Collapse multiple whitespace/newlines into a single space
    .replace(/\s+/g, " ")
    .trim();
}

// ── Paragraph Splitter ───────────────────────────────────────────────────────
// Breaks a long string into readable paragraphs at natural boundaries.
// Max chars per paragraph to prevent giant text blocks.
const MAX_PARA_LEN = 280;

function splitIntoParagraphs(text) {
  if (!text) return [];

  // Split on sentence boundaries first
  const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g) || [text];
  const paragraphs = [];
  let current = "";

  for (const sentence of sentences) {
    if ((current + sentence).length > MAX_PARA_LEN && current.length > 0) {
      paragraphs.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }

  if (current.trim()) paragraphs.push(current.trim());

  return paragraphs;
}

// ── Variation Detector ───────────────────────────────────────────────────────
// Detects known variation fields from a product object and formats them
// as readable bullet lists grouped by type.
//
// SAFE TO EXTEND: Add new variation keys to VARIATION_KEYS as needed.
const VARIATION_KEYS = [
  { key: "sizes",       label: "Available Sizes" },
  { key: "size",        label: "Available Sizes" },
  { key: "colors",      label: "Available Colors" },
  { key: "color",       label: "Available Colors" },
  { key: "models",      label: "Available Models" },
  { key: "model",       label: "Available Models" },
  { key: "editions",    label: "Available Editions" },
  { key: "edition",     label: "Available Editions" },
  { key: "storage",     label: "Available Storage" },
  { key: "capacity",    label: "Available Capacity" },
  { key: "weight",      label: "Available Weights" },
  { key: "flavours",    label: "Available Flavours" },
  { key: "flavors",     label: "Available Flavours" },
  { key: "variants",    label: "Available Variants" },
  { key: "options",     label: "Available Options" },
  { key: "packages",    label: "Package Options" },
];

function extractVariations(product) {
  const sections = [];

  for (const { key, label } of VARIATION_KEYS) {
    const val = product[key];
    if (!val) continue;

    // Accept: array of strings, array of objects with .name/.label/.value,
    // or a comma-separated string
    let items = [];
    if (Array.isArray(val)) {
      items = val.map(v => {
        if (typeof v === "string") return v;
        return v.name || v.label || v.value || v.type || String(v);
      }).filter(Boolean);
    } else if (typeof val === "string") {
      items = val.split(",").map(s => s.trim()).filter(Boolean);
    }

    if (items.length > 0) {
      // Deduplicate label in case both "sizes" and "size" present
      const alreadyHasLabel = sections.some(s => s.label === label);
      if (!alreadyHasLabel) {
        sections.push({ label, items });
      }
    }
  }

  // Also check product.variations (common MCP field that is an array of {type, options[]})
  if (Array.isArray(product.variations)) {
    for (const variation of product.variations) {
      const typeLabel = variation.type
        ? `Available ${variation.type.charAt(0).toUpperCase() + variation.type.slice(1)}s`
        : "Available Options";
      const items = Array.isArray(variation.options)
        ? variation.options.map(o => (typeof o === "string" ? o : o.name || o.value || String(o)))
        : [];
      if (items.length > 0) {
        sections.push({ label: typeLabel, items });
      }
    }
  }

  return sections;
}

// ── Features Extractor ───────────────────────────────────────────────────────
function extractFeatures(product) {
  const features = product.features || product.highlights || product.keyFeatures || [];
  if (Array.isArray(features)) {
    return features.map(f => (typeof f === "string" ? f : f.name || f.label || String(f))).filter(Boolean);
  }
  if (typeof features === "string") {
    return features.split(",").map(s => s.trim()).filter(Boolean);
  }
  return [];
}

// ── Specs Extractor ──────────────────────────────────────────────────────────
function extractSpecs(product) {
  const specs = product.specifications || product.specs || product.details || [];
  if (Array.isArray(specs)) {
    return specs.map(s => {
      if (typeof s === "string") return s;
      const label = s.label || s.name || s.key || "";
      const value = s.value || s.val || "";
      return label && value ? `**${label}:** ${value}` : (label || value || String(s));
    }).filter(Boolean);
  }
  return [];
}

// ── Price Formatter ──────────────────────────────────────────────────────────
function formatPrice(price, currency) {
  if (!price && price !== 0) return "Price not available";
  if (currency === "LKR") return `Rs. ${Number(price).toLocaleString()}`;
  const symbol = currency === "USD" ? "$" : (currency || "");
  return `${symbol} ${Number(price).toFixed(2)}`;
}

// ── Main Formatter ───────────────────────────────────────────────────────────
// Takes a raw product object and returns a structured response object.
//
// @param {Object} product  - raw product data (from MCP or session memory)
// @returns {{ type: string, content: string, product: Object }}
export function formatProductDetails(product) {
  if (!product) {
    return {
      type: "product_details",
      content: "⚠️ Product details are not available.",
      product: null,
    };
  }

  const lines = [];

  // ── Header ──
  lines.push("## 🎁 Product Details\n");

  // ── Name ──
  if (product.name) {
    lines.push(`### ${product.name}\n`);
  }

  // ── Price ──
  const priceStr = formatPrice(product.price, product.currency);
  lines.push(`**💰 Price:** ${priceStr}\n`);

  // ── Availability ──
  if (product.inStock !== undefined || product.stock !== undefined) {
    const inStock = product.inStock ?? (product.stock > 0);
    lines.push(`**📦 Availability:** ${inStock ? "✅ In Stock" : "❌ Out of Stock"}\n`);
  }

  lines.push("---\n");

  // ── Description ──
  const rawDesc = product.description || product.summary || product.shortDesc || "";
  const cleanDesc = stripHtml(rawDesc);
  if (cleanDesc) {
    lines.push("**📝 Description:**\n");
    const paragraphs = splitIntoParagraphs(cleanDesc);
    for (const para of paragraphs) {
      lines.push(`${para}\n`);
    }
    lines.push("---\n");
  }

  // ── Variations ──
  const variations = extractVariations(product);
  if (variations.length > 0) {
    lines.push("**🎨 Available Variations:**\n");
    for (const { label, items } of variations) {
      lines.push(`**${label}:**`);
      for (const item of items) {
        lines.push(`• ${item}`);
      }
      lines.push("");
    }
    lines.push("---\n");
  }

  // ── Features ──
  const features = extractFeatures(product);
  if (features.length > 0) {
    lines.push("**✨ Features:**\n");
    for (const f of features) {
      lines.push(`• ${f}`);
    }
    lines.push("\n---\n");
  }

  // ── Delivery ──
  const deliveryText = product.delivery || product.shippingInfo || product.shipping || "";
  if (deliveryText) {
    const cleanDelivery = stripHtml(typeof deliveryText === "string" ? deliveryText : JSON.stringify(deliveryText));
    lines.push(`**🚚 Delivery Information:**\n${cleanDelivery}\n`);
  }

  // ── Specifications ──
  const specs = extractSpecs(product);
  if (specs.length > 0) {
    lines.push("---\n");
    lines.push("**📋 Specifications:**\n");
    for (const spec of specs) {
      lines.push(`• ${spec}`);
    }
    lines.push("");
  }

  return {
    type: "product_details",
    content: lines.join("\n"),
    product,
  };
}

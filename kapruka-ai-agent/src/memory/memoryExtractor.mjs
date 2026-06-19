// src/memory/memoryExtractor.mjs
// Lightweight Rule-Based Memory Extraction Engine

import { OCCASIONS, RECIPIENTS } from "./memoryTypes.mjs";

export const memoryExtractor = {
  /**
   * Fast rule-based extraction to save LLM tokens.
   * @param {string} text - User input text
   * @returns {Object} Extracted entities
   */
  extractFromText: (text) => {
    const t = text.toLowerCase();
    const result = {
      recipients: [],
      occasions: [],
      budget: null,
      categories: [],
      deliveryCities: []
    };

    // 1. Extract Recipients
    for (const r of RECIPIENTS) {
      if (t.includes(r)) result.recipients.push(r);
    }

    // 2. Extract Occasions
    for (const o of OCCASIONS) {
      if (t.includes(o)) result.occasions.push(o);
    }
    if (t.match(/bday|b-day/)) result.occasions.push("birthday");
    if (t.match(/v-day|valentines/)) result.occasions.push("valentine");

    // 3. Extract Budget (e.g. "under 5000", "rs 3000", "below 4000")
    const budgetMatch = t.match(/(?:under|below|max|rs\.?|lkr)\s*(\d{1,3}(?:,\d{3})*|\d+)/i);
    if (budgetMatch) {
      result.budget = parseInt(budgetMatch[1].replace(/,/g, ''), 10);
    } else {
      // Look for "5000 rs" or "5000 lkr"
      const postfixMatch = t.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*(?:rs|lkr)/i);
      if (postfixMatch) {
        result.budget = parseInt(postfixMatch[1].replace(/,/g, ''), 10);
      }
    }

    // 4. Common Categories mapping
    if (t.match(/cake/)) result.categories.push("Cakes");
    if (t.match(/flower|rose|bouquet/)) result.categories.push("Flowers");
    if (t.match(/chocolat/)) result.categories.push("Chocolates");
    if (t.match(/toy|kids/)) result.categories.push("Toys");
    if (t.match(/grocery|food/)) result.categories.push("Groceries");
    if (t.match(/perfume|fragrance/)) result.categories.push("Perfumes");

    // Deduplicate
    result.recipients = [...new Set(result.recipients)];
    result.occasions = [...new Set(result.occasions)];
    result.categories = [...new Set(result.categories)];

    return result;
  }
};

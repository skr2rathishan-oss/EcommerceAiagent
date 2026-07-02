/**
 * ============================================================
 * Velora AI
 * Reference Parser
 * ------------------------------------------------------------
 * Converts natural language references into structured objects.
 *
 * Examples:
 *
 * "first phone"
 * "2nd mobile"
 * "third one"
 * "show details of the last product"
 * "compare first and second"
 * "this one"
 * "that phone"
 *
 * It DOES NOT resolve products.
 * It only parses user intent.
 * ============================================================
 */

const ORDINAL_WORDS = {
    first: 1,
    second: 2,
    third: 3,
    fourth: 4,
    fifth: 5,
    sixth: 6,
    seventh: 7,
    eighth: 8,
    ninth: 9,
    tenth: 10
};

const PRONOUNS = [
    "this",
    "that",
    "it",
    "this one",
    "that one",
    "this phone",
    "that phone",
    "this mobile",
    "that mobile",
    "selected",
    "chosen"
];

const LAST_WORDS = [
    "last",
    "last one",
    "last phone",
    "last mobile",
    "final",
    "latest"
];

import { getSelectionContext } from "./01_selectionMemory.mjs";

const PRODUCT_WORDS = [
    "phone",
    "mobile",
    "product",
    "item",
    "watch",
    "gift",
    "laptop",
    "tv",
    "flower",
    "flowers",
    "dress",
    "necklace",
    "cake",
    "cakes",
    "toy",
    "toys",
    "perfume",
    "perfumes",
    "chocolate",
    "chocolates",
    "card",
    "cards",
    "cupcake",
    "cupcakes",
    "gift",
    "gifts",
    "bouquet",
    "bouquets",
    "hamper",
    "hampers",
    "box",
    "boxes",
    "teddy",
    "bear",
    "balloon",
    "balloons",
    "watches",
    "phones",
    "laptops",
    "mobiles"
];

/**
 * Normalize text.
 */
function normalize(text = "") {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Parse ordinal numbers.
 */
function parseOrdinal(text) {

    text = normalize(text);

    // 1st 2nd 3rd 4th...
    const digitMatch = text.match(/(\d+)(st|nd|rd|th)/);

    if (digitMatch) {
        return Number(digitMatch[1]);
    }

    // first second third...
    for (const [word, value] of Object.entries(ORDINAL_WORDS)) {
        const regex = new RegExp(`\\b${word}\\b`);
        if (regex.test(text)) {
            return value;
        }
    }

    // Bare numbers (e.g. "order 3", "number 2")
    // Only capture if it follows words like 'number', 'item', 'product' or is just a single digit after a verb
    const numMatch = text.match(/\b(?:number|item|product)\s*(\d+)\b|\b(?:order|buy|get|select|choose)\s*(\d+)\b/);
    if (numMatch) {
        const num = numMatch[1] || numMatch[2];
        if (num) return Number(num);
    }

    return null;
}

/**
 * Detect comparison.
 */
function parseComparison(text) {

    text = normalize(text);

    if (!text.includes("compare")) {
        return null;
    }

    const matches = [];

    // Numeric ordinals
    const regex = /(\d+)(st|nd|rd|th)/g;

    let match;

    while ((match = regex.exec(text))) {
        matches.push(Number(match[1]));
    }

    // Word ordinals
    for (const [word, value] of Object.entries(ORDINAL_WORDS)) {
        const regex = new RegExp(`\\b${word}\\b`);
        if (regex.test(text)) {
            matches.push(value);
        }
    }

    const unique = [...new Set(matches)];

    if (unique.length >= 2) {
        return unique.slice(0, 2);
    }

    return null;
}

/**
 * Main parser with optional dynamic data-driven Reference Index queries.
 */
export function parseReference(message = "", sessionId = null) {

    const text = normalize(message);

    const result = {

        detected: false,

        type: null,

        index: null,

        indexes: [],

        raw: message,

        matchedTerm: null,

        targetIndexes: []
    };

    // 1. Compare
    const comparison = parseComparison(text);

    if (comparison) {

        result.detected = true;
        result.type = "comparison";
        result.indexes = comparison.map(i => i - 1);

        return result;
    }

    // 2. Ordinals
    const ordinal = parseOrdinal(text);

    if (ordinal !== null) {

        result.detected = true;
        result.type = "index";
        result.index = ordinal - 1;

        return result;
    }

    // 3. Last item
    for (const word of LAST_WORDS) {
        const regex = new RegExp(`\\b${word}\\b`);
        if (regex.test(text)) {
            result.detected = true;
            result.type = "last";
            return result;
        }
    }

    // 4. Check for plural/all requests ("show me those", "can I see the images", "let me see them")
    const lowerText = text.toLowerCase();
    const isAllRequest = [
        "show", "see", "display", "view", "look", "render"
    ].some(phrase => lowerText.includes(phrase)) && [
        "them", "those", "these", "images", "pictures", "cards", "products", "items", "options", "all"
    ].some(word => lowerText.includes(word));

    if (isAllRequest) {
        result.detected = true;
        result.type = "all";
        return result;
    }

    // 5. Query the reference index for category/brand/term matches!
    const selection = sessionId ? getSelectionContext(sessionId) : null;
    const refIndex = selection?.referenceIndex;

    if (refIndex) {
        const words = text.split(/\s+/);
        for (const word of words) {
            const cleanWord = word.trim();
            if (!cleanWord) continue;

            // Check categories
            if (refIndex.categories && refIndex.categories[cleanWord]) {
                result.detected = true;
                result.type = "dynamic_match";
                result.matchedTerm = cleanWord;
                result.targetIndexes = refIndex.categories[cleanWord];
                return result;
            }

            // Check brands
            if (refIndex.brands && refIndex.brands[cleanWord]) {
                result.detected = true;
                result.type = "dynamic_match";
                result.matchedTerm = cleanWord;
                result.targetIndexes = refIndex.brands[cleanWord];
                return result;
            }

            // Check name terms
            if (refIndex.terms && refIndex.terms[cleanWord]) {
                result.detected = true;
                result.type = "dynamic_match";
                result.matchedTerm = cleanWord;
                result.targetIndexes = refIndex.terms[cleanWord];
                return result;
            }
        }
    }

    // 6. Pronouns
    const EXPANED_PRONOUNS = [...PRONOUNS, "those", "them", "these"];
    for (const word of EXPANED_PRONOUNS) {
        const regex = new RegExp(`\\b${word}\\b`);
        if (regex.test(text)) {
            result.detected = true;
            result.type = "current";
            return result;
        }
    }

    // 7. Generic product reference
    for (const word of PRODUCT_WORDS) {
        const regex = new RegExp(`\\b${word}\\b`);
        if (regex.test(text)) {
            result.detected = true;
            result.type = "generic";
            return result;
        }
    }

    return result;
}

/**
 * Helper
 */
export function hasReference(message = "", sessionId = null) {
    return parseReference(message, sessionId).detected;
}

/**
 * Debug helper
 */
export function explainReference(message = "") {

    const parsed = parseReference(message);

    return {
        input: message,
        parsed
    };
}
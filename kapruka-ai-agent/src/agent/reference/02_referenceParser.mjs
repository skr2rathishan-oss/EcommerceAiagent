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

const PRODUCT_WORDS = [
    "phone",
    "mobile",
    "product",
    "item",
    "watch",
    "gift",
    "laptop",
    "tv"
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
 * Main parser.
 */
export function parseReference(message = "") {

    const text = normalize(message);

    const result = {

        detected: false,

        type: null,

        index: null,

        indexes: [],

        raw: message
    };

    // Compare
    const comparison = parseComparison(text);

    if (comparison) {

        result.detected = true;
        result.type = "comparison";
        result.indexes = comparison.map(i => i - 1);

        return result;
    }

    // Last item
    for (const word of LAST_WORDS) {
        const regex = new RegExp(`\\b${word}\\b`);
        if (regex.test(text)) {
            result.detected = true;
            result.type = "last";
            return result;
        }
    }

    // Pronouns
    for (const word of PRONOUNS) {
        const regex = new RegExp(`\\b${word}\\b`);
        if (regex.test(text)) {
            result.detected = true;
            result.type = "current";
            return result;
        }
    }

    // Ordinals
    const ordinal = parseOrdinal(text);

    if (ordinal !== null) {

        result.detected = true;
        result.type = "index";
        result.index = ordinal - 1;

        return result;
    }

    // Generic product reference
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
export function hasReference(message = "") {
    return parseReference(message).detected;
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
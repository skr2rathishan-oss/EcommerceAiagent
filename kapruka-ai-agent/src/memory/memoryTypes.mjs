// src/memory/memoryTypes.mjs

/**
 * Defines the structured memory format used across the agent.
 */

export const OCCASIONS = [
  "birthday", "anniversary", "wedding", "graduation", "valentine",
  "mother's day", "father's day", "new year", "christmas", "funeral",
  "get well", "congratulations", "housewarming"
];

export const RECIPIENTS = [
  "girlfriend", "boyfriend", "wife", "husband", "mother", "father",
  "son", "daughter", "brother", "sister", "friend", "colleague",
  "boss", "kids", "baby", "parents", "fiance"
];

export const EMOTIONS = [
  "happy", "sad", "urgent", "confused", "frustrated", "excited", "romantic"
];

/**
 * @typedef {Object} SessionMemory
 * @property {string} sessionId
 * @property {string[]} recipient - Extracted recipients
 * @property {string[]} occasion - Extracted occasions
 * @property {number|null} maxBudget - Extracted max budget (LKR)
 * @property {string[]} preferredCategories - Extracted categories
 * @property {string[]} deliveryLocations - Extracted delivery cities
 * @property {string} language - User language preference
 */

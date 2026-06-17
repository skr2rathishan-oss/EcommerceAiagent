/**
 * language.utils.mjs — language detection utilities used by the chat controller.
 */

/**
 * Detects language from a single text string using Unicode range checks.
 * @param {string} text
 * @returns {"en"|"si"|"ta"}
 */
export function localDetectLanguage(text) {
  if (!text || typeof text !== "string") return "en";
  if (/[\u0D80-\u0DFF]/.test(text)) return "si";  // Sinhala
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta";  // Tamil
  return "en";
}

/**
 * Scans recent history to detect the most recent user language.
 * @param {Array} history
 * @returns {"en"|"si"|"ta"}
 */
export function detectLanguageFromHistory(history) {
  if (!history || history.length === 0) return "en";
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === "user") {
      return localDetectLanguage(history[i].content);
    }
  }
  return "en";
}

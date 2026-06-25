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
  
  // 1. Unicode range checks
  if (/[\u0D80-\u0DFF]/.test(text)) return "si";  // Sinhala Script
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta";  // Tamil Script
  
  // 2. Romanized Singlish & Tanglish Keyword checks
  const lower = text.toLowerCase();
  
  const singlishWords = [
    "kohomada", "oyata", "apita", "dawasata", "dawasa", "bari", "wenawa", 
    "habai", "awulak", "ne", "mama", "tikak", "hoyala", "thiyenawa", 
    "pennanna", "karanna", "ekak", "danna", "aluthin", "balamu", 
    "mokakda", "hoyanne", "hari", "walu", "kiyanna", "naha", "epaa"
  ];
  
  const tanglishWords = [
    "eppadi", "irukkinga", "vanakkam", "enanga", "unga", "enaku", "mudiyala", 
    "panna", "aana", "pannadhe", "kaaga", "konjam", "pannirukken", 
    "pannalaam", "kaaminga", "pannunga", "sollunga", "naan", "munnadi", 
    "pudusa", "paatha", "sila", "ippo", "theduveenga"
  ];

  if (singlishWords.some(w => new RegExp(`\\b${w}\\b`, "i").test(lower))) {
    return "si";
  }
  if (tanglishWords.some(w => new RegExp(`\\b${w}\\b`, "i").test(lower))) {
    return "ta";
  }
  
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

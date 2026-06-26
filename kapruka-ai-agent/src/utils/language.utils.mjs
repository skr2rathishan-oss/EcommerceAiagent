/**
 * language.utils.mjs — language detection utilities used by the chat controller.
 */

// ── Dictionaries & Weights ───────────────────────────────────────────────────

const SINHALA_KEYWORDS = {
  "machan": 3.0, "puluwanda": 3.0, "mokakda": 3.0, "kohomada": 3.0,
  "karanna": 2.5, "ganna": 2.5, "ekak": 2.0, "one": 2.5, "oni": 2.5,
  "epaa": 2.5, "epa": 2.5, "ne": 1.5, "naha": 2.0, "ow": 2.0,
  "mama": 1.5, "mata": 2.0, "mage": 2.0, "oyata": 2.0, "apita": 2.0,
  "hari": 1.5, "ane": 2.5, "heta": 2.0, "ada": 2.0, "anidda": 2.5,
  "danna": 2.0, "aluthin": 2.0, "balamu": 2.0, "hoyanne": 2.0,
  "kiyanna": 2.0, "bari": 2.0, "wenawa": 2.0, "habai": 2.0,
  "awulak": 2.5, "tikak": 2.0, "hoyala": 2.0, "thiyenawa": 2.0,
  "pennanna": 2.5, "meka": 2.0, "oyage": 2.0, "monawada": 2.5,
  "kiyada": 2.5, "gana": 1.5, "ganan": 2.0, "ehenam": 2.5,
  "kamak": 2.0, "wade": 2.5, "mokada": 2.0, "thamai": 2.0,
  "nemeyi": 2.0, "neda": 2.0, "neada": 2.0, "aththa": 2.0,
  "wede": 2.5
};

const TAMIL_KEYWORDS = {
  "anna": 3.0, "akka": 3.0, "venum": 3.0, "seri": 2.5, "inga": 2.5,
  "unga": 2.5, "enaku": 2.5, "naan": 2.0, "thambi": 3.0, "eppadi": 3.0,
  "irukkinga": 3.0, "vanakkam": 3.0, "enanga": 3.0, "mudiyala": 2.5,
  "panna": 2.0, "aana": 2.0, "pannadhe": 2.5, "kaaga": 2.0,
  "konjam": 2.5, "pannirukken": 3.0, "pannalaam": 2.5, "kaaminga": 3.0,
  "pannunga": 3.0, "sollunga": 3.0, "munnadi": 2.0, "pudusa": 2.5,
  "paatha": 2.0, "sila": 1.5, "ippo": 2.0, "theduveenga": 3.0,
  "idha": 2.0, "intha": 2.0, "anuppunga": 3.0, "naalai": 2.5,
  "indru": 2.5, "nanri": 3.0, "nandri": 3.0, "parava": 2.0,
  "illa": 1.5, "romba": 2.5, "nalla": 2.0, "iruku": 2.0,
  "irukku": 2.0, "vaanga": 3.0, "ponga": 3.0, "yenna": 2.5,
  "enna": 1.5, "theriyum": 2.5, "theriyadhu": 2.5, "seiya": 2.5,
  "seiyunga": 3.0
};

const ENGLISH_KEYWORDS = {
  "show": 1.0, "me": 1.0, "deliver": 1.0, "delivery": 1.0, "order": 1.0,
  "birthday": 1.0, "cake": 1.0, "cakes": 1.0, "laptop": 1.0, "laptops": 1.0,
  "phone": 1.0, "phones": 1.0, "address": 1.0, "contact": 1.0, "name": 1.0,
  "number": 1.0, "track": 1.0, "search": 1.0, "find": 1.0, "get": 1.0,
  "please": 1.0, "want": 1.0, "need": 1.0, "buy": 1.0, "purchase": 1.0,
  "give": 1.0, "to": 0.5, "at": 0.5, "for": 0.5, "the": 0.5, "is": 0.5
};

const SINHALA_PHRASES = [
  { phrase: "cake ekak one", weight: 5.0 },
  { phrase: "cake ekak oni", weight: 5.0 },
  { phrase: "order karanna oni", weight: 5.0 },
  { phrase: "order karanna one", weight: 5.0 },
  { phrase: "delivery karanna puluwanda", weight: 5.0 },
  { phrase: "karanna puluwanda", weight: 4.0 },
  { phrase: "pennanna puluwanda", weight: 4.0 },
  { phrase: "ganna oni", weight: 4.0 },
  { phrase: "ganna one", weight: 4.0 },
  { phrase: "address eka hari", weight: 4.0 },
  { phrase: "kohomada oyata", weight: 4.0 },
  { phrase: "aluthin monawada", weight: 4.0 },
  { phrase: "me address eka", weight: 4.0 },
  { phrase: "deliver karanna", weight: 3.5 },
  { phrase: "mokakda aluthin", weight: 4.0 }
];

const TAMIL_PHRASES = [
  { phrase: "idha order pannunga", weight: 5.0 },
  { phrase: "intha order pannunga", weight: 5.0 },
  { phrase: "order pannunga", weight: 4.5 },
  { phrase: "address ku anuppunga", weight: 5.0 },
  { phrase: "ku anuppunga", weight: 4.0 },
  { phrase: "laptop venum", weight: 4.5 },
  { phrase: "phone venum", weight: 4.5 },
  { phrase: "eppadi irukkinga", weight: 4.5 },
  { phrase: "parava illa", weight: 4.0 },
  { phrase: "nalla iruku", weight: 4.0 },
  { phrase: "nalla irukku", weight: 4.0 },
  { phrase: "enna shopping", weight: 4.0 },
  { phrase: "seri intha", weight: 4.0 },
  { phrase: "seri idha", weight: 4.0 }
];

// ── Text Normalization ────────────────────────────────────────────────────────

/**
 * Normalizes input text for language detection.
 * @param {string} text 
 * @returns {string}
 */
export function normalizeText(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Checks if a message is short or a simple greeting/acknowledgment.
 * @param {string} normalizedText 
 * @returns {boolean}
 */
export function isShortMessage(normalizedText) {
  if (!normalizedText) return true;
  const wordCount = normalizedText.split(" ").length;
  if (wordCount <= 3) return true;

  const shortPhrases = [
    "ok", "okay", "thanks", "thank you", "yes", "no", "hi", "hello", "hey",
    "seri", "hari", "ow", "na", "epa", "epaa", "vanakkam", "nandri", "nanri",
    "machan", "anna", "akka"
  ];
  return shortPhrases.includes(normalizedText);
}

// ── Heuristic Scoring ─────────────────────────────────────────────────────────

/**
 * Runs heuristic detection on normalized text.
 * @param {string} normalizedText 
 * @returns {{language: string, confidence: number, reason: string}}
 */
export function runHeuristicDetection(normalizedText) {
  if (!normalizedText) {
    return { language: "english", confidence: 0.5, reason: "empty_text" };
  }

  // 1. Unicode Range check (Sinhala & Tamil Script)
  if (/[\u0D80-\u0DFF]/.test(normalizedText)) {
    return { language: "sinhala", confidence: 1.0, reason: "sinhala_script" };
  }
  if (/[\u0B80-\u0BFF]/.test(normalizedText)) {
    return { language: "tamil", confidence: 1.0, reason: "tamil_script" };
  }

  let siScore = 0;
  let taScore = 0;
  let enScore = 0;

  // 2. Phrase matching
  for (const { phrase, weight } of SINHALA_PHRASES) {
    if (normalizedText.includes(phrase)) {
      siScore += weight;
    }
  }
  for (const { phrase, weight } of TAMIL_PHRASES) {
    if (normalizedText.includes(phrase)) {
      taScore += weight;
    }
  }

  // 3. Keyword matching
  const words = normalizedText.split(" ");
  for (const word of words) {
    let matched = false;
    if (SINHALA_KEYWORDS[word]) {
      siScore += SINHALA_KEYWORDS[word];
      matched = true;
    }
    if (TAMIL_KEYWORDS[word]) {
      taScore += TAMIL_KEYWORDS[word];
      matched = true;
    }
    if (ENGLISH_KEYWORDS[word]) {
      enScore += ENGLISH_KEYWORDS[word];
      matched = true;
    }
    if (!matched && /^[a-z]+$/.test(word)) {
      enScore += 0.1;
    }
  }

  const totalScore = siScore + taScore + enScore;
  if (totalScore === 0) {
    return { language: "english", confidence: 0.5, reason: "no_keywords_matched" };
  }

  if (siScore > taScore && siScore > enScore) {
    const confidence = parseFloat((siScore / totalScore).toFixed(2));
    return { language: "sinhala_mix", confidence, reason: "romanized_keywords" };
  } else if (taScore > siScore && taScore > enScore) {
    const confidence = parseFloat((taScore / totalScore).toFixed(2));
    return { language: "tamil_mix", confidence, reason: "romanized_keywords" };
  } else {
    const confidence = parseFloat((enScore / totalScore).toFixed(2));
    return { language: "english", confidence, reason: "english_keywords" };
  }
}

// ── Extended Stateful Engine ──────────────────────────────────────────────────

/**
 * Stateful language detection taking into account conversation history,
 * preference learning, short message stickiness, and gradual switches.
 * 
 * @param {string} text - Raw user message
 * @param {Array} history - Message history array
 * @param {object} sessionState - Current VCSM session state object (DB doc)
 * @param {Function} [callLLMFallbackFn] - Async function calling LLM fallback
 * @returns {Promise<{language: string, confidence: number, reason: string}>}
 */
export async function detectLanguageExtended(text, history = [], sessionState = {}, callLLMFallbackFn = null) {
  if (sessionState && sessionState._languageProcessed) {
    return {
      language: sessionState.preferredLanguage || "english",
      confidence: sessionState.languageConfidence || 1.0,
      reason: "already_processed_this_turn"
    };
  }

  const normalized = normalizeText(text);

  // Heuristic detection
  let { language: heuristicLanguage, confidence: heuristicConfidence, reason: heuristicReason } = runHeuristicDetection(normalized);

  let finalLanguage = heuristicLanguage;
  let finalConfidence = heuristicConfidence;
  let finalReason = heuristicReason;

  const isShort = isShortMessage(normalized);

  // LLM fallback trigger
  const threshold = 0.6;
  if (heuristicConfidence < threshold && !isShort && callLLMFallbackFn) {
    try {
      const llmLang = await callLLMFallbackFn(text);
      if (llmLang === "sinhala_mix" || llmLang === "sinhala") {
        finalLanguage = "sinhala_mix";
        finalConfidence = 0.90;
        finalReason = "llm_fallback";
      } else if (llmLang === "tamil_mix" || llmLang === "tamil") {
        finalLanguage = "tamil_mix";
        finalConfidence = 0.90;
        finalReason = "llm_fallback";
      } else {
        finalLanguage = "english";
        finalConfidence = 0.90;
        finalReason = "llm_fallback";
      }
    } catch (err) {
      // Keep heuristic if LLM fails
    }
  }

  // State integration
  let preferredLanguage = sessionState.preferredLanguage;
  let consecutiveCount = sessionState.consecutiveMessagesInSameLanguage || 0;

  // Initialize if not set or if it's the default and consecutiveCount is 0
  if (!preferredLanguage || (preferredLanguage === "english" && consecutiveCount === 0)) {
    preferredLanguage = finalLanguage;
    consecutiveCount = 1;
  }

  if (finalLanguage !== preferredLanguage) {
    if (isShort) {
      // Short messages stick to the preferred language
      finalLanguage = preferredLanguage;
      finalConfidence = 0.95;
      finalReason = "sticky_preferred_language";
    } else {
      // Substantive switch: require 3 consecutive user messages in the same language to shift preferredLanguage
      const userHistory = history.filter(m => m.role === "user");
      const requiredConsecutive = 3;
      let matchesHistory = true;

      // Exclude the current message if it is already present in history
      let previousUserMsgs = userHistory;
      if (userHistory.length > 0 && userHistory[userHistory.length - 1].content === text) {
        previousUserMsgs = userHistory.slice(0, -1);
      }

      const recentUserMsgs = previousUserMsgs.slice(-(requiredConsecutive - 1));

      if (recentUserMsgs.length === requiredConsecutive - 1) {
        for (const msg of recentUserMsgs) {
          const histNorm = normalizeText(msg.content);
          const histHeur = runHeuristicDetection(histNorm);
          
          const histLang = (histHeur.language === "sinhala" || histHeur.language === "sinhala_mix") ? "sinhala_mix" : 
                           (histHeur.language === "tamil" || histHeur.language === "tamil_mix") ? "tamil_mix" : 
                           "english";
          
          const targetLang = (finalLanguage === "sinhala" || finalLanguage === "sinhala_mix") ? "sinhala_mix" :
                             (finalLanguage === "tamil" || finalLanguage === "tamil_mix") ? "tamil_mix" :
                             "english";

          if (histLang !== targetLang) {
            matchesHistory = false;
            break;
          }
        }
      } else {
        matchesHistory = false;
      }

      if (matchesHistory) {
        preferredLanguage = finalLanguage;
        consecutiveCount = 1;
        finalReason = "history_consistent_switch";
      } else {
        // Keep preferred language for this message's target response language
        finalLanguage = preferredLanguage;
      }
    }
  } else {
    consecutiveCount = consecutiveCount + 1;
  }

  // Update session state object
  sessionState.preferredLanguage = preferredLanguage;
  sessionState.consecutiveMessagesInSameLanguage = consecutiveCount;
  sessionState.lastDetectedLanguage = finalLanguage;
  sessionState.languageConfidence = finalConfidence;

  return {
    language: finalLanguage,
    confidence: finalConfidence,
    reason: finalReason
  };
}

// ── Backward-compatible Wrappers ──────────────────────────────────────────────

/**
 * Detects language from a single text string using new weighted heuristics.
 * @param {string} text
 * @returns {"en"|"si"|"ta"}
 */
export function localDetectLanguage(text) {
  const normalized = normalizeText(text);
  const result = runHeuristicDetection(normalized);

  if (result.language === "sinhala" || result.language === "sinhala_mix") {
    return "si";
  }
  if (result.language === "tamil" || result.language === "tamil_mix") {
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

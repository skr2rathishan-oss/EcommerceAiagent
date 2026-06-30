/**
 * 01_5_languageDetection.mjs
 * 
 * Pipeline Stage 1.5: Language Detection Engine
 * 
 * Responsibilities:
 * - Deterministic language detection
 * - Support English, Sinhala Unicode, Tamil Unicode, Singlish, Tanglish
 * - Apply dictionary matching, unicode detection, regex heuristics
 * - Enforce language stickiness (memory) for short replies
 * - Never generate intents, workflows, or responses
 */

import {
    EnglishDictionary,
    SINGlishDictionary,
    TANGlishDictionary,
    LanguagePatterns,
    hasSinhalaScript,
    hasTamilScript,
    isShortConfirmation
} from "../../../resources/language/index.mjs";
import { logStepStart, logStepDone } from "../../../utils/velora.console.mjs";
import { normalizeText } from "../../../utils/language.utils.mjs";

function detectByDictionary(text, dict) {
    let score = 0;
    const words = text.split(/\s+/);
    const allDictWords = [
        ...dict.greetings || [],
        ...dict.confirmations || [],
        ...dict.shopping || [],
        ...dict.relationship || [],
        ...dict.casual || [],
        ...dict.delivery || []
    ];
    
    for (const word of words) {
        if (allDictWords.includes(word)) score += 1;
    }
    return score;
}

export const executeLanguageDetection = (message, conversationState) => {
    logStepStart("Language Detection Engine");
    
    if (!message || message.trim() === "") {
        return {
            language: conversationState?.preferredLanguage || "english",
            confidence: 1.0,
            method: "default"
        };
    }

    const text = normalizeText(message);
    const isShort = isShortConfirmation(text) || text.length <= 4;
    const preferredLanguage = conversationState?.preferredLanguage || "english";

    // 1. Explicit Switch Rules
    if (text.includes("speak tamil") || text.includes("தமிழில் பேசு")) {
        return { language: "tamil", confidence: 1.0, method: "explicit_switch" };
    }
    if (text.includes("speak sinhala") || text.includes("සිංහලෙන් කතා කරන්න")) {
        return { language: "sinhala", confidence: 1.0, method: "explicit_switch" };
    }
    if (text.includes("speak english")) {
        return { language: "english", confidence: 1.0, method: "explicit_switch" };
    }

    // 2. Stickiness for short messages
    if (isShort) {
        logStepDone("Language Detection Engine", `Short reply. Sticky: ${preferredLanguage}`);
        return {
            language: preferredLanguage,
            confidence: 0.95,
            method: "stickiness"
        };
    }

    // 3. Unicode Detection
    if (hasTamilScript(text)) {
        logStepDone("Language Detection Engine", "Tamil Unicode detected");
        return { language: "tamil", confidence: 1.0, method: "unicode" };
    }
    if (hasSinhalaScript(text)) {
        logStepDone("Language Detection Engine", "Sinhala Unicode detected");
        return { language: "sinhala", confidence: 1.0, method: "unicode" };
    }

    // 4. Dictionary Matching (Tanglish, Singlish, English)
    const tanglishScore = detectByDictionary(text, TANGlishDictionary);
    const singlishScore = detectByDictionary(text, SINGlishDictionary);
    const englishScore = detectByDictionary(text, EnglishDictionary);

    let detected = "english";
    let method = "dictionary";
    let confidence = 0.5;

    const maxScore = Math.max(tanglishScore, singlishScore, englishScore);
    
    if (maxScore > 0) {
        if (tanglishScore === maxScore && tanglishScore > singlishScore) {
            detected = "tanglish";
            confidence = Math.min(0.7 + (tanglishScore * 0.1), 0.98);
        } else if (singlishScore === maxScore && singlishScore > tanglishScore) {
            detected = "singlish";
            confidence = Math.min(0.7 + (singlishScore * 0.1), 0.98);
        } else if (englishScore === maxScore) {
            detected = "english";
            confidence = Math.min(0.7 + (englishScore * 0.1), 0.98);
        }
    } else {
        method = "fallback";
        detected = preferredLanguage; // Fallback to current preferred language if nothing matches
    }

    logStepDone("Language Detection Engine", `Detected: ${detected} (${confidence}) via ${method}`);
    return {
        language: detected,
        confidence,
        method
    };
};

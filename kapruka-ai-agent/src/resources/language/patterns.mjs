export const LanguagePatterns = {
    sinhalaUnicode: /[\u0D80-\u0DFF]/,
    tamilUnicode: /[\u0B80-\u0BFF]/,
    shortConfirmations: /^(yes|no|ok|sure|cancel|stop|hari|ow|na|ne|ela|seri|am|aama|illai|illa)$/i
};

export function hasSinhalaScript(text) {
    return LanguagePatterns.sinhalaUnicode.test(text);
}

export function hasTamilScript(text) {
    return LanguagePatterns.tamilUnicode.test(text);
}

export function isShortConfirmation(text) {
    return LanguagePatterns.shortConfirmations.test(text.trim());
}

/**
 * =============================================================================
 * Velora Prompt Operating System
 * =============================================================================
 *
 * File:
 *    promptCache.mjs
 *
 * Purpose:
 *    Caches the static Prompt Operating System to avoid rebuilding it
 *    for every request.
 *
 * Responsibilities
 * ----------------
 * ✓ Cache Prompt OS
 * ✓ Return cached prompt
 * ✓ Refresh cache
 * ✓ Clear cache
 *
 * Never:
 * ✗ Build Runtime Context
 * ✗ Call Gemini
 * ✗ Validate prompts
 * ✗ Compress prompts
 *
 * =============================================================================
 */

import buildPromptOS from "../prompts/builder/promptBuilder.mjs";

/* =============================================================================
 * Private Cache
 * =============================================================================
 */

let promptCache = null;

let cacheCreatedAt = null;

/* =============================================================================
 * Build Cache
 * =============================================================================
 */

export function initializePromptCache() {

    promptCache = buildPromptOS();

    cacheCreatedAt = new Date();

    return promptCache;

}

/* =============================================================================
 * Get Cached Prompt
 * =============================================================================
 */

export function getPromptCache() {

    if (!promptCache) {

        initializePromptCache();

    }

    return promptCache;

}

/* =============================================================================
 * Refresh Cache
 * =============================================================================
 */

export function refreshPromptCache() {

    promptCache = buildPromptOS();

    cacheCreatedAt = new Date();

    return promptCache;

}

/* =============================================================================
 * Clear Cache
 * =============================================================================
 */

export function clearPromptCache() {

    promptCache = null;

    cacheCreatedAt = null;

}

/* =============================================================================
 * Cache Information
 * =============================================================================
 */

export function getPromptCacheInfo() {

    return {

        cached: Boolean(promptCache),

        createdAt: cacheCreatedAt,

        size: promptCache
            ? promptCache.length
            : 0

    };

}

/* =============================================================================
 * Cache Metadata
 * =============================================================================
 */

export const PROMPT_CACHE_INFO = Object.freeze({

    name: "Velora Prompt Cache",

    version: "1.0.0",

    strategy: "Memory Cache"

});

/* =============================================================================
 * Default Export
 * =============================================================================
 */

export default getPromptCache;
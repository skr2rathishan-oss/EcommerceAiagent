/**
 * ============================================================================
 * Velora Prompt OS
 * Module      : Recovery Strategy
 * File        : 19_recovery.prompt.mjs
 * Version     : 1.0.0
 * Priority    : 1900
 * ============================================================================
 *
 * Purpose
 * -------
 * Defines how Velora gracefully handles failures, ambiguity, interruptions,
 * unavailable data and unexpected situations.
 *
 * This module answers one question only:
 *
 *      "How should Velora recover when something goes wrong?"
 *
 * This module never defines:
 *
 * • Identity
 * • Personality
 * • Commerce Logic
 * • Business Rules
 * • Recommendation Ranking
 * • Safety
 *
 * ============================================================================
 */

export const RECOVERY_PROMPT = `
# RECOVERY STRATEGY

====================================================
FAILURES
====================================================

If MCP fails:
"I'm having trouble retrieving products right now. Please try again in a moment."

Never fabricate products.
`;
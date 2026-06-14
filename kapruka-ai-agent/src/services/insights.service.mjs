// src/services/insights.service.mjs
// Phase 5 – User Insights Engine
// Generates and stores compressed shopping intelligence per session using Nemotron.
// All generation is asynchronous and never blocks user requests.

import UserInsights from "../database/UserInsights.mjs";
import UserProfile from "../database/UserProfile.mjs";
import MemorySummary from "../database/MemorySummary.mjs";
import { generateInsightsWithNemotron } from "./llm.service.mjs";

/**
 * Extracts a JSON object from a raw LLM response string.
 * Handles cases where the model wraps output in markdown code fences.
 * @param {string} text
 * @returns {Object}
 */
function extractInsightsJson(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    // Strip markdown fences if present
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error("Could not parse insights JSON from LLM response");
  }
}

/**
 * Generates and persists UserInsights for a given sessionId.
 * Fetches UserProfile + MemorySummary + interactionScores, calls Nemotron,
 * then upserts into the UserInsights collection (latest version only).
 *
 * Must be called with .catch() — never awaited by callers.
 *
 * @param {string} sessionId
 * @returns {Promise<void>}
 */
export async function generateUserInsights(sessionId) {
  try {
    // 1. Read inputs (parallel)
    const [profile, summaryDoc] = await Promise.all([
      UserProfile.findOne({ sessionId }).lean().exec(),
      MemorySummary.findOne({ sessionId }, { currentSummary: 1 }).lean().exec()
    ]);

    const currentSummary   = summaryDoc?.currentSummary || "";
    const interactionScores = profile?.interactionScores || {};

    // 2. Call Nemotron (LIGHT_MODEL)
    const rawContent = await generateInsightsWithNemotron(profile, currentSummary, interactionScores);
    const insights   = extractInsightsJson(rawContent);

    // 3. Determine next version
    const existing = await UserInsights.findOne({ sessionId }, { version: 1 }).lean().exec();
    const nextVersion = existing ? (existing.version || 1) + 1 : 1;

    // 4. Upsert — overwrite previous insights, keep latest version only
    await UserInsights.findOneAndUpdate(
      { sessionId },
      {
        $set: {
          topCategories: Array.isArray(insights.topCategories) ? insights.topCategories : [],
          averageBudget: typeof insights.averageBudget === "number" ? insights.averageBudget : null,
          topRecipient:  insights.topRecipient  ?? null,
          topOccasion:   insights.topOccasion   ?? null,
          shoppingStyle: insights.shoppingStyle  ?? null,
          confidence:    typeof insights.confidence === "number" ? insights.confidence : 0,
          generatedAt:   new Date(),
          version:       nextVersion
        }
      },
      { upsert: true, new: true }
    );

    // 5. Structured log — sessionId, insightsGenerated, version only
    console.log(JSON.stringify({
      sessionId,
      insightsGenerated: new Date().toISOString(),
      version: nextVersion
    }));
  } catch (err) {
    console.error(`[Insights Service Error] generateUserInsights failed for session ${sessionId}:`, err);
  }
}

/**
 * Retrieves the current UserInsights document for a sessionId.
 * Lean read — expected <10ms from indexed collection.
 *
 * @param {string} sessionId
 * @returns {Promise<Object|null>}
 */
export async function getUserInsights(sessionId) {
  try {
    return await UserInsights.findOne({ sessionId }).lean().exec();
  } catch (err) {
    console.error(`[Insights Service Error] getUserInsights failed for session ${sessionId}:`, err);
    return null;
  }
}

/**
 * Directly upserts insight data for a sessionId without calling Nemotron.
 * Used for manual corrections or test overrides.
 *
 * @param {string} sessionId
 * @param {Object} data - Partial or full insight fields to set
 * @returns {Promise<Object|null>}
 */
export async function updateUserInsights(sessionId, data) {
  try {
    const existing    = await UserInsights.findOne({ sessionId }, { version: 1 }).lean().exec();
    const nextVersion = existing ? (existing.version || 1) + 1 : 1;

    return await UserInsights.findOneAndUpdate(
      { sessionId },
      {
        $set: {
          ...data,
          generatedAt: new Date(),
          version: nextVersion
        }
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error(`[Insights Service Error] updateUserInsights failed for session ${sessionId}:`, err);
    return null;
  }
}

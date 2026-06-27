import { buildSystemPrompt } from "../../agent/system/buildSystemPrompt.mjs";
import { validatePrompt } from "../../agent/validators/promptValidator.mjs";
import { compressPrompt } from "../../agent/validators/promptCompressor.mjs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import {
  getGeneralChatModel,
  getSummaryModel,
  callGemini,
  callGeminiSingleTurn,
  withTimeout,
} from "../ai/modelRouter.mjs";
import { getContext } from "../core/logger.service.mjs";
import logger from "../../utils/logger.mjs";

// ── Helpers ───────────────────────────────────────────────────────────────────

export function isSimpleConversation(message) {
  if (!message || typeof message !== "string") return false;
  const cleaned = message
    .trim()
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const simpleGreetings = [
    "hello","hi","hey","thanks","thank you","thank you so much",
    "bye","goodbye","good morning","good evening","good night",
    "who are you","what can you do","how are you","how are you doing",
    "hows it going","how is it going","how are things","how have you been",
    "hi how are you","hello how are you","hey how are you",
    "hi how are you doing","hello how are you doing",
    "what is your name","whats your name","whats up","what up","yo",
  ];
  return simpleGreetings.includes(cleaned);
}

// ── Main chat function ─────────────────────────────────────────────────────────
export const chatWithLLM = async ({
  message,
  history = [],
  memory = {},
  memoryContext = "",
  runtimeContext = null,
}) => {
  const { client: activeClient, model: selectedModel, provider, displayName } =
    getGeneralChatModel();

  let systemContent;
  if (runtimeContext) {
    systemContent = buildSystemPrompt(runtimeContext);
  } else {
    // Fallback/legacy compatibility:
    // Let's create a minimal runtimeContext from legacy arguments
    const fallbackRuntimeContext = {
      decision: memory?.decision || {},
      conversationState: memory?.conversationState || {},
      customer: {
        name: memory?.customerName || memory?.customer?.name || "Unknown",
        preferredLanguage: memory?.language || "en",
        city: memory?.city || null,
        shoppingStyle: memory?.shoppingStyle || "standard"
      },
      memory: memory || {},
      commerce: {
        searchQuery: memory?.searchQuery || null,
        category: memory?.category || null,
        deliveryRequired: false,
        checkoutStarted: false,
        paymentCompleted: false
      },
      products: [],
      cart: {
        items: memory?.cart || [],
        total: memory?.cart?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0,
        deliveryAddress: memory?.deliveryAddress || null
      },
      order: {},
      tracking: {},
      response: {
        type: memory?.response?.type || "conversation",
        mode: memory?.response?.mode || "dynamic",
        searchProducts: false,
        recommendProducts: false,
        askClarification: false,
        useMemory: true
      },
      settings: {
        streaming: true,
        voiceMode: false,
        model: selectedModel,
        environment: process.env.NODE_ENV || "development"
      },
      latestMessage: message
    };
    systemContent = buildSystemPrompt(fallbackRuntimeContext);
  }

  // Validate System Prompt
  const validation = validatePrompt(systemContent);
  if (!validation.valid) {
    logger.error("[Prompt OS] Prompt validation failed:", validation.errors);
    throw new Error(`Prompt OS Validation Failed: ${validation.errors.join("; ")}`);
  }

  // Compress System Prompt
  const compressedSystemPrompt = compressPrompt(systemContent);

  // Build user message (prepend memory context when present)
  let userContent = message;
  if (memoryContext) {
    userContent = `Memory Context:\n${memoryContext}\n\nCurrent User Request:\n${message}`;
  }

  // Populate telemetry
  const context = getContext();
  const t = context?.telemetry;
  if (t) {
    t.router.selectedModel = `${displayName} [${selectedModel}]`;
    t.router.reason = `Environment-routed: generalChat role.`;
    t.router.scores = [
      { name: displayName, score: 100 },
    ];
    t.prompt.version = "2.0.0";
    t.prompt.length = compressedSystemPrompt.length;
    t.prompt.activeSystemPrompt = compressedSystemPrompt;
    t.workflow.modelSelected = true;
  }

  const llmCallStart = Date.now();

  try {
    // We only use Gemini now.
    const responseText = await callGemini(activeClient, selectedModel, compressedSystemPrompt, history, userContent);

    const latencyMs = Date.now() - llmCallStart;

    // Token / cost estimation
    const promptLen = (systemContent + history.map(m => m.content).join(" ") + userContent).length;
    const promptTokens = Math.ceil(promptLen / 4);
    const completionTokens = Math.ceil((responseText || "").length / 4);
    const totalTokens = promptTokens + completionTokens;
    const costPerToken = 0.00015 / 1000;

    if (t) {
      t.llm.provider = "Google Vertex AI";
      t.llm.model = selectedModel;
      t.llm.ttft = Math.round(latencyMs * 0.35);
      t.llm.completionTime = latencyMs;
      t.llm.promptTokens = promptTokens;
      t.llm.completionTokens = completionTokens;
      t.llm.totalTokens = totalTokens;
      t.llm.estimatedCost = totalTokens * costPerToken;
      t.performance.llmTtft = t.llm.ttft;
      t.performance.llmGeneration = latencyMs - t.llm.ttft;
      t.workflow.responseGenerated = true;
    }

    // Router log
    const messageType = isSimpleConversation(message) ? "Greeting" : "Shopping";
    try {
      const logPath = resolve(__dirname, "../../../router.log");
      const logLine = `${new Date().toISOString()} | [Velora Router] | Message Type: ${messageType} | Model: ${selectedModel} | Provider: ${provider} | Latency: ${latencyMs}ms\n`;
      fs.appendFileSync(logPath, logLine);
    } catch { /* non-fatal */ }

    return responseText;

  } catch (error) {
    const ctx = getContext();
    const te = ctx?.telemetry;
    if (te) {
      te.error = {
        serviceName: selectedModel,
        errorType: error.name || "APIError",
        errorMessage: error.message,
        stackTrace: error.stack,
        recoveryAction: "Returned error to controller",
        fallbackModel: "None",
      };
    }
    logger.error("chatWithLLM call failed", { error: error.message, model: selectedModel, provider });
    return { error: true, message: "Failed to process AI request" };
  }
};

// ── Conversation summarisation (background task) ──────────────────────────────
export const generateSummaryWithGemini = async (messages) => {
  const { client: activeClient, model, provider } = getSummaryModel();

  // Limit to the most recent 40 messages to keep the prompt size manageable.
  const recentMessages = messages.slice(-40);
  const formattedConvo = recentMessages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n");

  const systemContent = `You are a helpful AI that analyzes ecommerce chat logs and extracts user profile insights.
Your output must be a single, valid JSON object containing user profile summary and preferences.
Do not include any explanations, markdown code blocks, or conversational filler. Return ONLY the JSON object.

The JSON object must have this exact structure:
{
  "summary": "A concise paragraph summarizing the user's shopping history, interests, and behavior.",
  "favoriteCategories": ["cakes", "flowers"],
  "favoriteRecipients": ["mother", "friend"],
  "favoriteOccasions": ["birthday", "anniversary"],
  "deliveryCities": ["Colombo", "Kandy"],
  "averageBudget": 5000
}

If any preference field cannot be determined, return an empty array or null for averageBudget.
Ensure all JSON is correctly formatted and all strings are properly closed.`;

  const userContent = `Here is the conversation log to analyze:\n\n${formattedConvo}`;

  return await callGeminiSingleTurn(activeClient, model, systemContent, userContent, {
    temperature: 0.1,
    maxOutputTokens: 2000,
  });
};

// ── Shopping intelligence insights (background task) ──────────────────────────
export const generateInsightsWithGemini = async (profile, currentSummary, interactionScores) => {
  const { client: activeClient, model, provider } = getSummaryModel();

  const profileBlock = JSON.stringify({
    favoriteCategories: profile?.favoriteCategories || [],
    favoriteRecipients: profile?.favoriteRecipients || [],
    favoriteOccasions: profile?.favoriteOccasions || [],
    averageBudget: profile?.averageBudget ?? null,
  }, null, 2);

  const scoresBlock = JSON.stringify(interactionScores || {}, null, 2);

  const systemContent = `You are a shopping intelligence engine. Analyze the provided user profile, memory summary, and behavior scores to generate a concise insight object.
Return ONLY a single valid JSON object — no explanations, no markdown, no extra text.

The JSON must have exactly this structure:
{
  "topCategories": ["cakes", "flowers"],
  "averageBudget": 4500,
  "topRecipient": "mother",
  "topOccasion": "birthday",
  "shoppingStyle": "gift_buyer",
  "confidence": 92
}

Rules:
- topCategories: array of 1–3 strings, sorted by relevance. Empty array if unknown.
- averageBudget: integer in LKR, or null if unknown.
- topRecipient: single string (most common recipient), or null if unknown.
- topOccasion: single string (most common occasion), or null if unknown.
- shoppingStyle: one of "gift_buyer", "deal_hunter", "occasion_planner", "frequent_buyer", "explorer", or null.
- confidence: integer 0–100 reflecting how much usable data was available.`;

  const userContent = `User Profile:\n${profileBlock}\n\nMemory Summary:\n${currentSummary || "(none)"}\n\nInteraction Scores (category → score):\n${scoresBlock}`;

  return await callGeminiSingleTurn(activeClient, model, systemContent, userContent, {
    temperature: 0.1,
    maxOutputTokens: 300,
  });
};

// Compatibility stubs
export const generateSummaryWithNemotron = generateSummaryWithGemini;
export const generateInsightsWithNemotron = generateInsightsWithGemini;

// ── Legacy model selection (kept for backward compat) ─────────────────────────
export async function selectModel(message, detectedLang = "en") {
  return getGeneralChatModel().model;
}

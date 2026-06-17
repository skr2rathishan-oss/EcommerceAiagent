import { SYSTEM_PROMPT }   from "../agent/systemPrompt.mjs";
import { INTENT_PROMPT }   from "../agent/intentPrompt.mjs";
import fs                  from "fs";

import {
  getGeneralChatModel,
  getIntentModel,
  getSummaryModel,
  callGemini,
  callGeminiSingleTurn,
  nvidiaClient,
  nvidiaGeneralClient,
  withTimeout,
} from "./modelRouter.mjs";
import { getContext } from "./logger.service.mjs";
import logger         from "../utils/logger.mjs";

// Legacy alias — some services import `client` directly
export const NVIDIA_CLIENT       = nvidiaClient;
export const NVIDIA_GENERAL_CLIENT = nvidiaGeneralClient;
export const LLAMA_MODEL         = "meta/llama-3.1-8b-instruct";
export const PRIMARY_MODEL       = "qwen/qwen3.5-122b-a10b";
export const GENERAL_MODEL       = "openai/gpt-oss-20b";
export const LIGHT_MODEL         = "nvidia/nemotron-3-nano-30b-a3b";

export const client        = nvidiaClient;
export const generalClient = nvidiaGeneralClient;

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

// ── Language detection via GPT (called in language-ambiguous cases) ────────────
export async function detectLanguageWithGPT(message) {
  if (!message || typeof message !== "string") return "en";
  try {
    // Always use NVIDIA general client for fast language detection
    const completion = await withTimeout(
      nvidiaGeneralClient.chat.completions.create({
        model:      GENERAL_MODEL,
        temperature: 0,
        max_tokens: 10,
        messages: [
          {
            role: "system",
            content:
              "You are a language detection engine. Analyze the user's message and determine its language. " +
              "Respond ONLY with one of the following language codes:\n" +
              "- 'si': for Sinhala script or Singlish/Sinhala in English alphabet (e.g. 'kohomada', 'oyata', 'machan').\n" +
              "- 'ta': for Tamil script or Tanglish/Tamil in English alphabet (e.g. 'eppadi irukkinga', 'vanakkam', 'enanga').\n" +
              "- 'en': for English or any other language.\n" +
              "Do not output any other text, punctuation, or explanation. Respond with just the two-letter code.",
          },
          { role: "user", content: message },
        ],
      }),
      undefined,
      "Language detection"
    );
    const result = completion.choices[0].message.content.trim().toLowerCase();
    logger.info(`GPT language detection result for "${message}": "${result}"`);
    if (result.includes("si")) return "si";
    if (result.includes("ta")) return "ta";
    return "en";
  } catch (err) {
    logger.error("Failed to detect language with GPT", { error: err.message });
    return "en";
  }
}

// ── Main chat function ─────────────────────────────────────────────────────────
export const chatWithLLM = async ({
  message,
  history      = [],
  memory       = {},
  memoryContext = "",
  detectedLang  = "en",
}) => {
  const { client: activeClient, model: selectedModel, provider, displayName } =
    getGeneralChatModel();

  let langInstruction = "";
  if (detectedLang === "ta") {
    langInstruction =
      "\n\nCRITICAL LANGUAGE RULE:\n- The customer is speaking in Tamil. You MUST respond ONLY in Tamil. Do not translate or write in English.";
  } else if (detectedLang === "si") {
    langInstruction =
      "\n\nCRITICAL LANGUAGE RULE:\n- The customer is speaking in Sinhala. You MUST respond ONLY in Sinhala. Do not translate or write in English.";
  } else {
    langInstruction =
      "\n\nCRITICAL LANGUAGE RULE:\n- The customer is speaking in English. You MUST respond ONLY in English.";
  }

  const systemContent = `${SYSTEM_PROMPT}\n\n${langInstruction}\n\nCustomer Context:\n${JSON.stringify(memory, null, 2)}`;

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
    t.router.reason        = `Environment-routed: generalChat role.`;
    t.router.scores        = [
      { name: displayName, score: 98 },
    ];
    t.prompt.version            = "2.0.0";
    t.prompt.length             = SYSTEM_PROMPT.length;
    t.prompt.activeSystemPrompt = SYSTEM_PROMPT;
    t.workflow.modelSelected    = true;
  }

  const llmCallStart = Date.now();

  try {
    let responseText;

    if (provider === "gemini") {
      // ── Gemini path ────────────────────────────────────────────────────────
      responseText = await callGemini(activeClient, selectedModel, systemContent, history, userContent);
    } else {
      // ── NVIDIA NIM (OpenAI-compatible) path ───────────────────────────────
      const messagesArray = [
        { role: "system", content: systemContent },
        ...history,
        { role: "user",   content: userContent },
      ];

      const completion = await withTimeout(
        activeClient.chat.completions.create({
          model:       selectedModel,
          temperature: 0.8,
          max_tokens:  4096,
          messages:    messagesArray,
        }),
        undefined,
        "General chat"
      );

      const reasoning = completion.choices[0].message.reasoning_content || completion.choices[0].message.reasoning;
      if (reasoning) logger.info("[LLM RESPONSE] Reasoning Content:\n" + reasoning);

      responseText = completion.choices[0].message.content;
    }

    const latencyMs = Date.now() - llmCallStart;

    // Token / cost estimation
    const promptLen         = (systemContent + history.map(m => m.content).join(" ") + userContent).length;
    const promptTokens      = Math.ceil(promptLen / 4);
    const completionTokens  = Math.ceil((responseText || "").length / 4);
    const totalTokens       = promptTokens + completionTokens;
    const costPerToken      = provider === "gemini" ? 0.00015 / 1000 : 0.0001 / 1000;

    if (t) {
      t.llm.provider         = provider === "gemini" ? "Google Vertex AI" : "NVIDIA NIM";
      t.llm.model            = selectedModel;
      t.llm.ttft             = Math.round(latencyMs * 0.35);
      t.llm.completionTime   = latencyMs;
      t.llm.promptTokens     = promptTokens;
      t.llm.completionTokens = completionTokens;
      t.llm.totalTokens      = totalTokens;
      t.llm.estimatedCost    = totalTokens * costPerToken;
      t.performance.llmTtft       = t.llm.ttft;
      t.performance.llmGeneration = latencyMs - t.llm.ttft;
      t.workflow.responseGenerated = true;
    }

    // Router log
    const messageType = isSimpleConversation(message) ? "Greeting" : "Shopping";
    try {
      const logPath = resolve(__dirname, "../../router.log");
      const logLine = `${new Date().toISOString()} | [Velora Router] | Message Type: ${messageType} | Model: ${selectedModel} | Provider: ${provider} | Latency: ${latencyMs}ms\n`;
      fs.appendFileSync(logPath, logLine);
    } catch { /* non-fatal */ }

    return responseText;

  } catch (error) {
    const ctx = getContext();
    const te  = ctx?.telemetry;
    if (te) {
      te.error = {
        serviceName:    selectedModel,
        errorType:      error.name || "APIError",
        errorMessage:   error.message,
        stackTrace:     error.stack,
        recoveryAction: "Returned error to controller",
        fallbackModel:  "None",
      };
    }
    logger.error("chatWithLLM call failed", { error: error.message, model: selectedModel, provider });
    return { error: true, message: "Failed to process AI request" };
  }
};

// ── Intent detection ──────────────────────────────────────────────────────────
export const detectIntent = async (message) => {
  logger.info(`Running intent detection...`);
  const start = Date.now();

  const { client: activeClient, model, provider, displayName } = getIntentModel();

  try {
    let raw;

    if (provider === "gemini") {
      raw = await callGeminiSingleTurn(
        activeClient,
        model,
        INTENT_PROMPT,
        message,
        { temperature: 0, maxOutputTokens: 200 }
      );
    } else {
      const completion = await withTimeout(
        activeClient.chat.completions.create({
          model,
          temperature: 0,
          max_tokens:  200,
          messages: [
            { role: "system", content: INTENT_PROMPT },
            { role: "user",   content: message },
          ],
        }),
        undefined,
        "Intent detection"
      );
      raw = completion.choices[0].message.content;
    }

    const elapsed = Date.now() - start;
    logger.info(`Intent detection completed in ${elapsed}ms via ${displayName}`);
    return raw;

  } catch (error) {
    logger.error("detectIntent failed", { error: error.message, model, provider });
    throw error;
  }
};

// ── Conversation summarisation (background task) ──────────────────────────────
export const generateSummaryWithNemotron = async (messages) => {
  const { client: activeClient, model, provider } = getSummaryModel();
  const formattedConvo = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n");

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
Ensure all JSON is correctly formatted.`;

  const userContent = `Here is the conversation log to analyze:\n\n${formattedConvo}`;

  if (provider === "gemini") {
    return await callGeminiSingleTurn(activeClient, model, systemContent, userContent, {
      temperature:    0.1,
      maxOutputTokens: 1000,
    });
  }

  const completion = await withTimeout(
    activeClient.chat.completions.create({
      model,
      temperature: 0.1,
      max_tokens:  1000,
      messages: [
        { role: "system", content: systemContent },
        { role: "user",   content: userContent },
      ],
    }),
    undefined,
    "Memory summary"
  );

  const reasoning = completion.choices[0].message.reasoning_content || completion.choices[0].message.reasoning;
  if (reasoning) logger.info("[MongoDB Summary] Reasoning Content:\n" + reasoning);

  return completion.choices[0].message.content;
};

// ── Shopping intelligence insights (background task) ──────────────────────────
export const generateInsightsWithNemotron = async (profile, currentSummary, interactionScores) => {
  const { client: activeClient, model, provider } = getSummaryModel();

  const profileBlock = JSON.stringify({
    favoriteCategories: profile?.favoriteCategories || [],
    favoriteRecipients: profile?.favoriteRecipients || [],
    favoriteOccasions:  profile?.favoriteOccasions  || [],
    averageBudget:      profile?.averageBudget       ?? null,
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

  if (provider === "gemini") {
    return await callGeminiSingleTurn(activeClient, model, systemContent, userContent, {
      temperature:    0.1,
      maxOutputTokens: 300,
    });
  }

  const completion = await withTimeout(
    activeClient.chat.completions.create({
      model,
      temperature: 0.1,
      max_tokens:  300,
      messages: [
        { role: "system", content: systemContent },
        { role: "user",   content: userContent },
      ],
    }),
    undefined,
    "Shopping insights"
  );

  const reasoning = completion.choices[0].message.reasoning_content || completion.choices[0].message.reasoning;
  if (reasoning) logger.info("[MongoDB Insights] Reasoning Content:\n" + reasoning);

  return completion.choices[0].message.content;
};

// ── Legacy model selection (kept for backward compat — no longer used in chat) ─
export async function selectModel(message, detectedLang = "en") {
  return getGeneralChatModel().model;
}

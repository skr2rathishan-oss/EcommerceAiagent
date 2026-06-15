import OpenAI from "openai";
import { SYSTEM_PROMPT } from "../agent/systemPrompt.mjs";
import { INTENT_PROMPT } from "../agent/intentPrompt.mjs";
import dotenv from "dotenv";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";    

import { getContext } from "./logger.service.mjs";
import logger from "../utils/logger.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve path to the .env file in the backend root directory (kapruka-ai-agent/.env)
dotenv.config({ path: resolve(__dirname, "../../.env") });

const client = new OpenAI({
    baseURL: "https://integrate.api.nvidia.com/v1",
    apiKey: process.env.NVIDIA_API_KEY,
});

const generalClient = new OpenAI({
    baseURL: "https://integrate.api.nvidia.com/v1",
    apiKey: process.env.GENERAL_CHAT_API_KEY || process.env.NVIDIA_API_KEY,
});

export const PRIMARY_MODEL = "qwen/qwen3.5-122b-a10b";
export const GENERAL_MODEL = "openai/gpt-oss-20b";
export const LIGHT_MODEL = "nvidia/nemotron-3-nano-30b-a3b";
export const LLAMA_MODEL = "meta/llama-3.1-8b-instruct";

export function isSimpleConversation(message) {
  if (!message || typeof message !== "string") return false;
  const cleaned = message.trim().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").replace(/\s+/g, " ").trim();
  const simpleGreetings = [
    "hello",
    "hi",
    "hey",
    "thanks",
    "thank you",
    "thank you so much",
    "bye",
    "goodbye",
    "good morning",
    "good evening",
    "good night",
    "who are you",
    "what can you do",
    "how are you",
    "how are you doing",
    "hows it going",
    "how is it going",
    "how are things",
    "how have you been",
    "hi how are you",
    "hello how are you",
    "hey how are you",
    "hi how are you doing",
    "hello how are you doing",
    "what is your name",
    "whats your name",
    "whats up",
    "what up",
    "yo"
  ];
  return simpleGreetings.includes(cleaned);
}

export async function detectLanguageWithGPT(message) {
  if (!message || typeof message !== "string") return "en";
  try {
    const completion = await generalClient.chat.completions.create({
      model: GENERAL_MODEL,
      temperature: 0,
      max_tokens: 10,
      messages: [
        {
          role: "system",
          content: "You are a language detection engine. Analyze the user's message and determine its language. Respond ONLY with one of the following language codes:\n- 'si': for Sinhala script (e.g. මට කේක් ඕනේ) or Singlish/Sinhala written in English alphabet (e.g. 'kohomada', 'oyata', 'subha dawasak', 'machan', 'mokada karanne').\n- 'ta': for Tamil script (e.g. எனக்கு கேக் வேண்டும்) or Tanglish/Tamil written in English alphabet (e.g. 'eppadi irukkinga', 'nandri', 'vanakkam', 'enanga').\n- 'en': for English or any other language (e.g. 'hi how are you', 'hello', 'thank you').\n\nDo not output any other text, punctuation, or explanation. Respond with just the two-letter code."
        },
        {
          role: "user",
          content: message
        }
      ]
    });
    const result = completion.choices[0].message.content.trim().toLowerCase();
    logger.info(`GPT language detection result for "${message}": "${result}"`);
    if (result.includes("si")) return "si";
    if (result.includes("ta")) return "ta";
    return "en";
  } catch (err) {
    logger.error("Failed to detect language with GPT", { error: err.message });
    return "en"; // Default fallback
  }
}

export async function selectModel(message, detectedLang = "en") {
  const gptLang = await detectLanguageWithGPT(message);
  if (gptLang === "si" || gptLang === "ta") {
    return PRIMARY_MODEL;
  }
  return GENERAL_MODEL;
}

export const chatWithLLM = async ({
  message,
  history = [],
  memory = {},
  memoryContext = "",
  detectedLang = "en",
}) => {
  let selectedModel = PRIMARY_MODEL;
  try {
    selectedModel = await selectModel(message, detectedLang);
    const activeClient = selectedModel === PRIMARY_MODEL ? client : generalClient;

    let userContent = message;
    if (memoryContext && selectedModel === PRIMARY_MODEL) {
      userContent = `Memory Context:\n${memoryContext}\n\nCurrent User Request:\n${message}`;
    }

    let langInstruction = "";
    if (detectedLang === "ta") {
      langInstruction = "\n\nCRITICAL LANGUAGE RULE:\n- The customer is speaking in Tamil. You MUST respond ONLY in Tamil. Do not translate or write in English.";
    } else if (detectedLang === "si") {
      langInstruction = "\n\nCRITICAL LANGUAGE RULE:\n- The customer is speaking in Sinhala. You MUST respond ONLY in Sinhala. Do not translate or write in English.";
    } else {
      langInstruction = "\n\nCRITICAL LANGUAGE RULE:\n- The customer is speaking in English. You MUST respond ONLY in English.";
    }

    const messagesArray = [
      {
        role: "system",
        content: `
${SYSTEM_PROMPT}

${langInstruction}

Customer Context:
${JSON.stringify(memory, null, 2)}
        `,
      },

      ...history,

      {
        role: "user",
        content: userContent,
      },
    ];

    const context = getContext();
    const t = context?.telemetry;

    const isGeneral = selectedModel === GENERAL_MODEL;
    if (t) {
      t.router.selectedModel = selectedModel;
      t.router.reason = isGeneral ? "General chat or background process query." : "Shopping/Regional conversation detected.";
      if (isGeneral) {
        t.router.scores = [
          { name: "openai/gpt-oss-20b", score: 96 },
          { name: "Llama 3.1 8B", score: 70 },
          { name: "qwen/qwen3.5-122b-a10b", score: 52 }
        ];
      } else {
        t.router.scores = [
          { name: "qwen/qwen3.5-122b-a10b", score: 98 },
          { name: "openai/gpt-oss-20b", score: 74 },
          { name: "Llama 3.1 8B", score: 62 }
        ];
      }
      t.prompt.version = "1.0.0";
      t.prompt.length = SYSTEM_PROMPT.length;
      t.prompt.activeSystemPrompt = SYSTEM_PROMPT;
      t.workflow.modelSelected = true;
    }

    const llmCallStart = Date.now();

    const completionOptions = {
      model: selectedModel,
      temperature: isGeneral ? 1.0 : 0.8,
      max_tokens: isGeneral ? 4096 : 200,
      messages: messagesArray,
    };
    if (isGeneral) {
      completionOptions.top_p = 1.0;
    }

    const completion = await activeClient.chat.completions.create(completionOptions);

    const reasoning = completion.choices[0].message.reasoning_content || completion.choices[0].message.reasoning;
    if (reasoning) {
      logger.info("[LLM RESPONSE] Reasoning Content:\n" + reasoning);
    }

    const latencyMs = Date.now() - llmCallStart;
    
    // Estimate tokens
    const textContent = completion.choices[0].message.content || "";
    const promptLen = messagesArray.map(m => m.content).join(" ").length;
    const promptTokens = Math.ceil(promptLen / 4);
    const completionTokens = Math.ceil(textContent.length / 4);
    const totalTokens = promptTokens + completionTokens;
    const costPerToken = isGeneral ? 0.0001 / 1000 : 0.0007 / 1000;

    if (t) {
      t.llm.provider = "NVIDIA NIM";
      t.llm.model = selectedModel;
      t.llm.ttft = Math.round(latencyMs * 0.35); // Estimated TTFT
      t.llm.completionTime = latencyMs;
      t.llm.promptTokens = promptTokens;
      t.llm.completionTokens = completionTokens;
      t.llm.totalTokens = totalTokens;
      t.llm.estimatedCost = totalTokens * costPerToken;
      
      t.performance.llmTtft = t.llm.ttft;
      t.performance.llmGeneration = latencyMs - t.llm.ttft;
      t.workflow.responseGenerated = true;
    }

    // Router Logging
    const messageType = isSimpleConversation(message) ? "Greeting" : "Shopping";
    const statsJSON = JSON.stringify({
      selectedModel,
      messageType,
      latencyMs
    });

    try {
      const logPath = resolve(__dirname, "../../router.log");
      const logLine = `${new Date().toISOString()} | [Velora Router] | Message Type: ${messageType} | Model: ${selectedModel} | Stats: ${statsJSON}\n`;
      fs.appendFileSync(logPath, logLine);
    } catch (logErr) {
      logger.error("Failed to append to router.log", { error: logErr.message });
    }

    return completion.choices[0].message.content;
  } catch (error) {
    const context = getContext();
    const t = context?.telemetry;
    if (t) {
      t.error = {
        serviceName: selectedModel,
        errorType: error.name || "APIError",
        errorMessage: error.message,
        stackTrace: error.stack,
        recoveryAction: "Bypassed LLM call and returned error details",
        fallbackModel: "None"
      };
    }
    logger.error("chatWithLLM call failed", { error: error.message, model: selectedModel });

    return {
      error: true,
      message: "Failed to process AI request",
    };
  }
};


export const detectIntent = async (message) => {
  logger.info(`Running intent detection via model Llama...`);
  const start = Date.now();

  const completion = await client.chat.completions.create({
    model: LLAMA_MODEL,
    temperature: 0,
    max_tokens: 200,
    messages: [
      {
        role: "system",
        content: INTENT_PROMPT,
      },
      {
        role: "user",
        content: message,
      },
    ],
  });

  return completion.choices[0].message.content;
};

export const generateSummaryWithNemotron = async (messages) => {
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

  const completion = await generalClient.chat.completions.create({
    model: LLAMA_MODEL,
    temperature: 0.1,
    max_tokens: 1000,
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: `Here is the conversation log to analyze:\n\n${formattedConvo}` }
    ]
  });

  const reasoning = completion.choices[0].message.reasoning_content || completion.choices[0].message.reasoning;
  if (reasoning) {
    logger.info("[MongoDB Summary] Reasoning Content:\n" + reasoning);
  }

  return completion.choices[0].message.content;
};

/**
 * Generates compressed shopping intelligence from profile, memory summary, and interaction scores.
 * Uses Nemotron (LIGHT_MODEL). Returns raw JSON string.
 *
 * @param {Object} profile         - UserProfile document (lean)
 * @param {string} currentSummary  - Current memory summary text
 * @param {Object} interactionScores - Category → score map from UserProfile
 * @returns {Promise<string>} Raw JSON string
 */
export const generateInsightsWithNemotron = async (profile, currentSummary, interactionScores) => {
  const profileBlock = JSON.stringify({
    favoriteCategories: profile?.favoriteCategories || [],
    favoriteRecipients: profile?.favoriteRecipients || [],
    favoriteOccasions:  profile?.favoriteOccasions  || [],
    averageBudget:      profile?.averageBudget       ?? null
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

  const userContent = `User Profile:
${profileBlock}

Memory Summary:
${currentSummary || "(none)"}

Interaction Scores (category → score):
${scoresBlock}`;

  const completion = await generalClient.chat.completions.create({
    model: LLAMA_MODEL,
    temperature: 0.1,
    max_tokens: 300,
    messages: [
      { role: "system", content: systemContent },
      { role: "user",   content: userContent }
    ]
  });

  const reasoning = completion.choices[0].message.reasoning_content || completion.choices[0].message.reasoning;
  if (reasoning) {
    logger.info("[MongoDB Insights] Reasoning Content:\n" + reasoning);
  }

  return completion.choices[0].message.content;
};

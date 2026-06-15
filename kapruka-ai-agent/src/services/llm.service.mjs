import OpenAI from "openai";
import { SYSTEM_PROMPT } from "../agent/systemPrompt.mjs";
import { INTENT_PROMPT } from "../agent/intentPrompt.mjs";
import dotenv from "dotenv";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";    

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

export function isSimpleConversation(message) {
  if (!message || typeof message !== "string") return false;
  const cleaned = message.trim().toLowerCase().replace(/[.,!?]+$/, "").trim();
  const simpleGreetings = [
    "hello",
    "hi",
    "hey",
    "thanks",
    "thank you",
    "bye",
    "good morning",
    "good evening",
    "good night",
    "who are you",
    "what can you do"
  ];
  return simpleGreetings.includes(cleaned);
}

export function selectModel(message, detectedLang = "en") {
  const isQwenLang = ["en", "si", "ta", "mixed-si", "mixed-ta"].includes(detectedLang);
  if (isQwenLang) {
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
  try {
    const selectedModel = selectModel(message, detectedLang);
    const activeClient = selectedModel === PRIMARY_MODEL ? client : generalClient;

    let userContent = message;
    if (memoryContext && selectedModel === PRIMARY_MODEL) {
      userContent = `Memory Context:\n${memoryContext}\n\nCurrent User Request:\n${message}`;
    }

    const messagesArray = [
      {
        role: "system",
        content: `
${SYSTEM_PROMPT}

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

    // TEMP DEBUG LOG - SAFE TO REMOVE LATER
    console.log("[LLM REQUEST] Model:", selectedModel);
    console.log("[LLM REQUEST] Total messages in context:", messagesArray.length);
    console.log("[LLM REQUEST] Full messages array:", JSON.stringify(messagesArray, null, 2));
    const llmCallStart = Date.now();

    const isGeneral = selectedModel === GENERAL_MODEL;
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
      console.log("[LLM RESPONSE] Reasoning Content:\n", reasoning);
    }

    const latencyMs = Date.now() - llmCallStart;
    // TEMP DEBUG LOG - SAFE TO REMOVE LATER
    console.log("[LLM RESPONSE] API call duration:", latencyMs, "ms");
    console.log("[LLM RESPONSE] Raw completion:", JSON.stringify(completion.choices[0], null, 2));

    // Router Logging
    const messageType = isSimpleConversation(message) ? "Greeting" : "Shopping";
    console.log("[Velora Router]");
    console.log(`Message Type: ${messageType}`);
    console.log(`Model: ${selectedModel}`);
    const statsJSON = JSON.stringify({
      selectedModel,
      messageType,
      latencyMs
    });
    console.log("Router Stats:", statsJSON);

    try {
      const logPath = resolve(__dirname, "../../router.log");
      const logLine = `${new Date().toISOString()} | [Velora Router] | Message Type: ${messageType} | Model: ${selectedModel} | Stats: ${statsJSON}\n`;
      fs.appendFileSync(logPath, logLine);
    } catch (logErr) {
      console.error("Failed to append to router.log:", logErr);
    }

    return completion.choices[0].message.content;
  } catch (error) {
    console.error("LLM Error:", error);
    // TEMP DEBUG LOG - SAFE TO REMOVE LATER
    console.error("[ERROR] chatWithLLM failed:", error.message);

    return {
      error: true,
      message: "Failed to process AI request",
    };
  }
};


export const detectIntent = async (message) => {
  // TEMP DEBUG LOG - SAFE TO REMOVE LATER
  console.log("[INTENT] detectIntent called with:", message);
  const start = Date.now();

  const completion = await client.chat.completions.create({
    model: PRIMARY_MODEL,
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

  // TEMP DEBUG LOG - SAFE TO REMOVE LATER
  console.log("[INTENT] detectIntent response time:", Date.now() - start, "ms");
  console.log("[INTENT] Raw LLM intent response:", completion.choices[0].message.content);

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
    model: GENERAL_MODEL,
    temperature: 0.1,
    max_tokens: 1000,
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: `Here is the conversation log to analyze:\n\n${formattedConvo}` }
    ]
  });

  const reasoning = completion.choices[0].message.reasoning_content || completion.choices[0].message.reasoning;
  if (reasoning) {
    console.log("[MongoDB Summary] Reasoning Content:\n", reasoning);
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
    model: GENERAL_MODEL,
    temperature: 0.1,
    max_tokens: 300,
    messages: [
      { role: "system", content: systemContent },
      { role: "user",   content: userContent }
    ]
  });

  const reasoning = completion.choices[0].message.reasoning_content || completion.choices[0].message.reasoning;
  if (reasoning) {
    console.log("[MongoDB Insights] Reasoning Content:\n", reasoning);
  }

  return completion.choices[0].message.content;
};

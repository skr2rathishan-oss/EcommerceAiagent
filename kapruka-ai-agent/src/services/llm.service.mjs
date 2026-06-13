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

export const PRIMARY_MODEL = "qwen/qwen3-next-80b-a3b-instruct";
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

export function selectModel(message) {
  const enableRouting = process.env.ENABLE_MODEL_ROUTING === "true";
  if (!enableRouting) {
    return PRIMARY_MODEL;
  }
  if (isSimpleConversation(message)) {
    return LIGHT_MODEL;
  }
  return PRIMARY_MODEL;
}

export const chatWithLLM = async ({
  message,
  history = [],
  memory = {},
}) => {
  try {
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
        content: message,
      },
    ];

    const selectedModel = selectModel(message);

    // TEMP DEBUG LOG - SAFE TO REMOVE LATER
    console.log("[LLM REQUEST] Model:", selectedModel);
    console.log("[LLM REQUEST] Total messages in context:", messagesArray.length);
    console.log("[LLM REQUEST] Full messages array:", JSON.stringify(messagesArray, null, 2));
    const llmCallStart = Date.now();

    const completion = await client.chat.completions.create({
      model: selectedModel,
      temperature: 0.8,
      max_tokens: 200,
      messages: messagesArray,
    });

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

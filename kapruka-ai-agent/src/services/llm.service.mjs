import OpenAI from "openai";
import { SYSTEM_PROMPT } from "../agent/systemPrompt.mjs";
import { INTENT_PROMPT } from "../agent/intentPrompt.mjs";
import dotenv from "dotenv";
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

    // TEMP DEBUG LOG - SAFE TO REMOVE LATER
    console.log("[LLM REQUEST] Model:", process.env.NVIDIA_MODEL);
    console.log("[LLM REQUEST] Total messages in context:", messagesArray.length);
    console.log("[LLM REQUEST] Full messages array:", JSON.stringify(messagesArray, null, 2));
    const llmCallStart = Date.now();

    const completion = await client.chat.completions.create({
      model: process.env.NVIDIA_MODEL,
      temperature: 0.8,
      max_tokens:200,
      messages: messagesArray,
    });

    // TEMP DEBUG LOG - SAFE TO REMOVE LATER
    console.log("[LLM RESPONSE] API call duration:", Date.now() - llmCallStart, "ms");
    console.log("[LLM RESPONSE] Raw completion:", JSON.stringify(completion.choices[0], null, 2));

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
    model: process.env.NVIDIA_MODEL,
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

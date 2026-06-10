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

export const chatWithLLM = async (message) => {
    try {
        const completion = await client.chat.completions.create({
            model: process.env.NVIDIA_MODEL,
            temperature: 0.2,
            max_tokens: 300,
            messages: [
                {
                    role: "system",
                    content: SYSTEM_PROMPT,
                },
                {
                    role: "user",
                    content: message,
                },
            ],
        });

        return completion.choices[0].message.content;

    } catch (error) {
        console.error("LLM Error:", error);

        return {
            error: true,
            message: "Failed to process AI request",
        };

    }
};


export const detectIntent = async (message) => {
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

  return completion.choices[0].message.content;
};

// llm_speed_test.mjs
// Benchmark script to test response speed and latency of various NVIDIA NIM LLMs.
import OpenAI from "openai";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from backend root directory
dotenv.config({ path: resolve(__dirname, "../../.env") });

const apiKey = process.env.NVIDIA_API_KEY;
if (!apiKey) {
  console.error("❌ Error: NVIDIA_API_KEY is not defined in the environment or .env file.");
  process.exit(1);
}

const client = new OpenAI({
  baseURL: "https://integrate.api.nvidia.com/v1",
  apiKey: apiKey,
});

// A list of popular open models on NVIDIA NIM to test (excluding Gemini)
const MODELS_TO_TEST = [
  "meta/llama-3.1-8b-instruct",
  "meta/llama-3.1-70b-instruct",
  "nvidia/llama-3.1-nemotron-70b-instruct",
  "qwen/qwen3.5-122b-a10b",
  "mistralai/mixtral-8x7b-instruct-v0.1"
];

const PROMPT = "Write a 3-sentence summary of the benefits of online grocery shopping.";

async function benchmarkModel(modelName) {
  console.log(`\n🚀 Benchmarking: ${modelName}...`);
  try {
    const start = Date.now();
    let ttft = null;
    let text = "";
    
    // Call using streaming to measure Time-to-First-Token (TTFT)
    const stream = await client.chat.completions.create({
      model: modelName,
      messages: [{ role: "user", content: PROMPT }],
      max_tokens: 150,
      temperature: 0.5,
      stream: true,
    });

    for await (const chunk of stream) {
      if (ttft === null) {
        ttft = Date.now() - start;
      }
      const content = chunk.choices[0]?.delta?.content || "";
      text += content;
      process.stdout.write(content.replace(/\n/g, " ↩ "));
    }
    process.stdout.write("\n");

    const totalDuration = Date.now() - start;
    
    // Estimate token count (standard heuristic: ~4 characters per token)
    const tokenCount = Math.ceil(text.length / 4); 
    const generationTimeMs = totalDuration - (ttft || 0);
    const tokensPerSecond = generationTimeMs > 0 
      ? ((tokenCount / generationTimeMs) * 1000).toFixed(2) 
      : "0";

    return {
      model: modelName,
      status: "Success",
      ttftMs: ttft || totalDuration,
      totalMs: totalDuration,
      tokens: tokenCount,
      tokensPerSec: tokensPerSecond,
      snippet: text.trim().substring(0, 50) + "..."
    };
  } catch (err) {
    console.error(`❌ Error benchmark for ${modelName}:`, err.message);
    return {
      model: modelName,
      status: `Failed (${err.message.substring(0, 30)})`,
      ttftMs: "-",
      totalMs: "-",
      tokens: "-",
      tokensPerSec: "-",
      snippet: "-"
    };
  }
}

(async () => {
  console.log("=================================================");
  console.log("       LLM RESPONSE SPEED BENCHMARK SCRIPT       ");
  console.log("=================================================");
  console.log(`Prompt: "${PROMPT}"\n`);

  const results = [];
  for (const model of MODELS_TO_TEST) {
    const result = await benchmarkModel(model);
    results.push(result);
    // Short sleep to avoid hitting Nvidia API rate limits in rapid succession
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  console.log("\n=============================================================================================");
  console.log("                                       BENCHMARK RESULTS                                     ");
  console.log("=============================================================================================");
  console.table(results.map(r => ({
    "Model Name": r.model,
    "Status": r.status,
    "TTFT (ms)": r.ttftMs,
    "Total Time (ms)": r.totalMs,
    "Est. Tokens": r.tokens,
    "Tokens/sec": r.tokensPerSec,
  })));
  console.log("=============================================================================================");
  console.log("TTFT = Time to First Token (measures latency of initial generation start)");
  console.log("Tokens/sec is calculated over generation time (total duration - TTFT).");
})();

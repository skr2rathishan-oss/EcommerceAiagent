import { asyncLocalStorage } from "../services/logger.service.mjs";

export const requestIdMiddleware = (req, res, next) => {
  // Generate a structured transaction / correlation ID
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const sessionId = req.headers["x-session-id"] || req.body?.sessionId || "default";
  
  // Resolve user identification from request or default to guest
  const userId = req.user?.userId || req.user?.id || "guest";

  const context = {
    requestId,
    sessionId,
    userId,
    telemetry: {
      startTime: Date.now(),
      userInput: {
        requestId,
        sessionId,
        userId,
        timestamp: new Date().toISOString(),
        message: ""
      },
      language: {
        detected: "English",
        confidence: 1.0,
        translationUsed: "No"
      },
      intent: {
        type: "general_chat",
        confidence: 1.0,
        routeDecision: "LLM Handler"
      },
      router: {
        scores: [
          { name: "Llama 3.1 8B", score: 62 },
          { name: "openai/gpt-oss-20b", score: 74 },
          { name: "qwen/qwen3.5-122b-a10b", score: 98 }
        ],
        selectedModel: "qwen/qwen3.5-122b-a10b",
        reason: "Shopping/Regional conversation detected."
      },
      prompt: {
        version: "1.0.0",
        length: 0,
        activeSystemPrompt: "",
        memoryContextLength: 0,
        retrievedSummaryLength: 0
      },
      llm: {
        provider: "NVIDIA NIM",
        model: "",
        ttft: 0,
        completionTime: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCost: 0
      },
      cache: {
        redisStatus: "Offline",
        hitMiss: "Miss",
        key: "N/A",
        savedLatency: 0
      },
      memory: {
        loaded: "No",
        summaryLoaded: "No",
        updated: "No",
        summaryRegenerated: "No",
        mongoWriteTime: 0
      },
      search: {
        query: "N/A",
        filters: "N/A",
        category: "N/A",
        budget: "N/A",
        retrieved: 0,
        ranked: 0,
        returned: 0
      },
      workflow: {
        requestReceived: true,
        languageDetected: false,
        intentClassified: false,
        memoryLoaded: false,
        cacheChecked: false,
        modelSelected: false,
        productSearchCompleted: false,
        responseGenerated: false,
        analyticsSaved: false,
        responseSent: false
      },
      performance: {
        langDetection: 0,
        intentClassification: 0,
        memoryRetrieval: 0,
        redisAccess: 0,
        productSearch: 0,
        llmTtft: 0,
        llmGeneration: 0,
        totalTime: 0
      },
      error: null
    }
  };

  // Run the Express request chain inside the asyncLocalStorage store
  asyncLocalStorage.run(context, () => {
    next();
  });
};

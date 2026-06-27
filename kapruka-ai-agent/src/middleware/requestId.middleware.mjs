import { asyncLocalStorage } from "../services/core/logger.service.mjs";

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
          { name: "Gemini 2.5 Flash", score: 100 }
        ],
        selectedModel: "gemini-2.5-flash",
        reason: "Environment-routed: generalChat role."
      },
      prompt: {
        version: "2.0.0",
        length: 0,
        activeSystemPrompt: "",
        memoryContextLength: 0,
        retrievedSummaryLength: 0
      },
      llm: {
        provider: "Google Vertex AI",
        model: "gemini-2.5-flash",
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

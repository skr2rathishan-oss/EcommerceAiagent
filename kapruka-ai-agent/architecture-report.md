# Velora Architecture Discovery Report

## 1. Controllers Map
- **admin.controller.mjs**
  - Endpoints/Handlers: getAIMode, setAIMode, resetAIMode
  - Services Called: modelRouter.mjs
- **chat.controller.mjs**
  - Endpoints/Handlers: chat, saveLocalMessage
  - Services Called: llm.service.mjs, responseService.mjs, chatMemory.service.mjs, conversation.service.mjs, memory.service.mjs, logger.service.mjs, cacheService.mjs
- **chatStream.controller.mjs**
  - Endpoints/Handlers: chatStream
  - Services Called: responseService.mjs, chatMemory.service.mjs, conversation.service.mjs, memory.service.mjs, logger.service.mjs, cacheService.mjs
- **delivery.controller.mjs**
  - Endpoints/Handlers: checkDeliveryAvailability, getAddressesHandler, saveAddressHandler, checkDeliveryHandler, nearestAreaHandler
  - Services Called: delivery.service.mjs, mcp.service.mjs, concierge.service.mjs
- **order.controller.mjs**
  - Endpoints/Handlers: handleCreateOrder
  - Services Called: order.service.mjs
- **orderTracking.controller.mjs**
  - Endpoints/Handlers: getOrderTracking
  - Services Called: orderTracking.service.mjs
- **products.controller.mjs**
  - Endpoints/Handlers: getProduct, trackInteractionController, getRecommendationsController, getSearchStrategyController, getSearchProductsController, rankProductsController, generateRecommendationsController
  - Services Called: mcp.service.mjs, productInteraction.service.mjs, cacheService.mjs, modelRouter.mjs, mcp.client.mjs

## 2. Services Dependency Graph
- **services\ai\contextBuilder.service.mjs**
  - Dependencies: ../../database/UserProfile.mjs, ../../database/MemorySummary.mjs
- **services\ai\conversationUnderstanding.service.mjs**
  - Dependencies: ../../agent/conversationUnderstandingPrompt.mjs, ./modelRouter.mjs, ../../utils/language.utils.mjs, ../../ai/context/emotionDetector.mjs, ../../ai/context/situationDetector.mjs, ../commerce/conversationStateService.mjs, ../../utils/logger.mjs
- **services\ai\decisionBuilder.mjs**
  - Dependencies: ../../utils/logger.mjs, ../../utils/language.utils.mjs
- **services\ai\llm.service.mjs**
  - Dependencies: ../../agent/system/buildSystemPrompt.mjs, ../../agent/validators/promptValidator.mjs, ../../agent/validators/promptCompressor.mjs, ../core/logger.service.mjs, ../../utils/logger.mjs
- **services\ai\llmStream.service.mjs**
  - Dependencies: ../../agent/system/buildSystemPrompt.mjs, ../../agent/validators/promptValidator.mjs, ../../agent/validators/promptCompressor.mjs, ../../utils/logger.mjs
- **services\ai\modelRouter.mjs**
  - Dependencies: ../ai/modelRouter.mjs, ../../config/aiEnvironment.mjs, ../../utils/logger.mjs
- **services\analytics\analytics.service.mjs**
  - Dependencies: ../../database/DailyAnalytics.mjs, ../../database/ProductInteraction.mjs, ../../database/UserProfile.mjs, ../../database/MemorySummary.mjs
- **services\analytics\insights.service.mjs**
  - Dependencies: ../../database/UserInsights.mjs, ../../database/UserProfile.mjs, ../../database/MemorySummary.mjs, ../ai/llm.service.mjs, ../commerce/recommendationCache.service.mjs, ../../utils/logger.mjs
- **services\commerce\addressService.mjs**
  - Dependencies: None
- **services\commerce\concierge.service.mjs**
  - Dependencies: ../../database/UserProfile.mjs, ../integration/googleMapsService.mjs, ./delivery.service.mjs, ../../utils/logger.mjs
- **services\commerce\conversationStateService.mjs**
  - Dependencies: ../../database/ConversationState.mjs, ../../database/ShoppingContext.mjs, ../../database/DeliverySession.mjs, ../../utils/logger.mjs
- **services\commerce\delivery.service.mjs**
  - Dependencies: ../integration/mcp.client.mjs
- **services\commerce\deliveryFlowService.mjs**
  - Dependencies: ../../memory/memoryStore.mjs, ./conversationStateService.mjs, ./shoppingContextService.mjs, ./addressService.mjs, ./delivery.service.mjs, ./order.service.mjs, ../../utils/date.utils.mjs, ../../utils/logger.mjs
- **services\commerce\deliveryRecoveryService.mjs**
  - Dependencies: ./delivery.service.mjs
- **services\commerce\order.service.mjs**
  - Dependencies: ../integration/mcp.client.mjs, ../../database/Order.mjs, ../../utils/logger.mjs
- **services\commerce\orderTracking.service.mjs**
  - Dependencies: ../integration/mcp.client.mjs, ../../utils/logger.mjs
- **services\commerce\productInteraction.service.mjs**
  - Dependencies: ../../database/ProductInteraction.mjs, ../../database/UserProfile.mjs, ../analytics/insights.service.mjs, ../commerce/recommendationCache.service.mjs, ../../utils/logger.mjs
- **services\commerce\recommendation.service.mjs**
  - Dependencies: ../../database/UserProfile.mjs, ../../database/MemorySummary.mjs, ../commerce/recommendationCache.service.mjs, ../commerce/recommendationExplanation.service.mjs, ../../utils/logger.mjs
- **services\commerce\recommendationCache.service.mjs**
  - Dependencies: ../../cache/cacheService.mjs, ../../database/UserProfile.mjs, ../../database/UserInsights.mjs, ../../database/ProductInteraction.mjs, ../../database/RecommendationCache.mjs, ../../utils/logger.mjs
- **services\commerce\recommendationExplanation.service.mjs**
  - Dependencies: ../commerce/recommendationCache.service.mjs, ../../utils/logger.mjs
- **services\commerce\shoppingContextService.mjs**
  - Dependencies: ../../database/ShoppingContext.mjs, ../../utils/logger.mjs
- **services\core\cache.service.mjs**
  - Dependencies: None
- **services\core\logger.service.mjs**
  - Dependencies: None
- **services\core\performance.service.mjs**
  - Dependencies: None
- **services\core\redis.service.mjs**
  - Dependencies: None
- **services\core\startupHealthService.mjs**
  - Dependencies: ../../cache/cacheService.mjs, ../integration/mcp.client.mjs, ../integration/mcp.service.mjs, ../commerce/delivery.service.mjs, ../integration/googleMapsService.mjs, ../../config/aiEnvironment.mjs, ../../utils/logger.mjs, ../ai/conversationUnderstanding.service.mjs, ../ai/decisionBuilder.mjs, ../responseEngine.service.mjs, ../commerce/conversationStateService.mjs, ../memory/memoryManager.service.mjs, ../ai/llmStream.service.mjs, ../media/voiceService.js, ../commerce/deliveryFlowService.mjs, ../commerce/addressService.mjs, ../commerce/order.service.mjs, ../commerce/deliveryRecoveryService.mjs
- **services\integration\googleMapsHealthService.mjs**
  - Dependencies: ../integration/googleMapsService.mjs, ../../utils/logger.mjs
- **services\integration\googleMapsService.mjs**
  - Dependencies: ../../utils/logger.mjs, ../commerce/delivery.service.mjs
- **services\integration\mcp.client.mjs**
  - Dependencies: None
- **services\integration\mcp.client.mock.mjs**
  - Dependencies: None
- **services\integration\mcp.service.mjs**
  - Dependencies: ../integration/mcp.client.mjs, ../commerce/orderTracking.service.mjs, ../../utils/logger.mjs
- **services\media\languageDetector.js**
  - Dependencies: None
- **services\media\translationService.js**
  - Dependencies: None
- **services\media\voiceService.js**
  - Dependencies: None
- **services\memory\chatMemory.service.mjs**
  - Dependencies: ../../cache/cacheService.mjs, ../../database/Conversation.mjs, ../memory/memoryManager.service.mjs, ./conversation.service.mjs, ../../utils/logger.mjs
- **services\memory\conversation.service.mjs**
  - Dependencies: ../../database/Conversation.mjs
- **services\memory\memory.service.mjs**
  - Dependencies: ../../database/MemorySummary.mjs, ../../database/UserProfile.mjs, ../memory/conversation.service.mjs, ../ai/llm.service.mjs, ../analytics/insights.service.mjs, ../../utils/logger.mjs
- **services\memory\memoryManager.service.mjs**
  - Dependencies: ../../utils/logger.mjs
- **services\responseEngine.service.mjs**
  - Dependencies: ../responseEngine.service.mjs
- **services\responseService.mjs**
  - Dependencies: ../services/responseService.mjs

## 3. Conversation Pipeline
User -> Controller (`chat.controller.mjs`) -> CUL (`understandConversation`) -> Decision Builder (`buildDecision`) -> State Management (`updateMemory`, `saveMessage`) -> Response Engine (`routeIntent` / LLM) -> Gemini -> Streaming Response.

## 4. Gemini Pipeline
Files integrating with Gemini:
- config\aiEnvironment.mjs
- controllers\chat.controller.mjs
- controllers\chatStream.controller.mjs
- controllers\products.controller.mjs
- middleware\requestId.middleware.mjs
- scripts\architecture-discovery.mjs
- server.mjs
- services\ai\conversationUnderstanding.service.mjs
- services\ai\llm.service.mjs
- services\ai\llmStream.service.mjs
- services\ai\modelRouter.mjs
- services\core\startupHealthService.mjs
- test\console.test.mjs
- test\test-gemini.js
- test\test-llm-stream.mjs
- utils\velora.console.mjs

## 5. MCP Pipeline
Files integrating with MCP:
- controllers\products.controller.mjs
- list-tools.mjs
- refactor-services.js
- scripts\architecture-discovery.mjs
- server.mjs
- services\commerce\delivery.service.mjs
- services\commerce\order.service.mjs
- services\commerce\orderTracking.service.mjs
- services\core\startupHealthService.mjs
- services\integration\mcp.client.mjs
- services\integration\mcp.service.mjs
- test-mcp.mjs

## 6. Conversation State
- Handled largely in `services/commerce/conversationStateService.mjs` (loadConversationState, saveConversationState)
- Shopping Context in `services/commerce/shoppingContextService.mjs`
- Memory in `agent/memoryManager.mjs` & `services/memory/chatMemory.service.mjs`

## 7. Prompt Pipeline
- `agent/core/promptCache.mjs` - Initializes and manages prompt cache.
- `agent/core/promptLoader.mjs` - Loads system prompts and modules.
- `agent/builders/runtimeBuilder.mjs` - Constructs runtime variables.

## 8. Frontend Request Pipeline
Frontend repository found. Assumed standard React/Vite interaction with `/api/chat` endpoints via SSE.

## 9. Duplicate Implementation Report
- Found multiple memory managers (`agent/memoryManager.mjs`, `services/memory/memory.service.mjs`, `services/memory/chatMemory.service.mjs`). This indicates some duplication in state handling.
- Duplicate logic seen between `analyze-services.js` and `refactor-services.js` in root `src`.

## 10. Legacy Code Report
- `test_intent.js`, `test-details.mjs`, `test-mcp.mjs` in root.

## 11. Workflow Engine Integration Points
To properly connect `05_workflowManager.mjs`:
- **`chat.controller.mjs`**: Inject `manageWorkflow` immediately after `buildDecision` and CUL extraction.
- Use the returned `workflow` state to dynamically route to Shopping Context, Delivery Flow, or General Chat.
- Replace hardcoded interceptions (e.g. `if (isResumeRequest && userState?.pausedFlows...`) with proper Workflow Manager transitions.
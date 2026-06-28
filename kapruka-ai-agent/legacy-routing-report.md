# New Pipeline Stages Audit

## Stage 1: Context Loader (01_contextLoader.mjs)
- **Responsibility:** Load session state (cart updates, conversation history, delivery session, memory) for the request.
- **Services Called:** `chatMemory.service` (getRecentHistory), `memoryManager` (getMemory, updateMemory), `memoryStore` (getDeliverySession), `conversationStateService` (loadConversationState, saveConversationState).
- **Duplication/Transport Check:** It extracts state loading. No HTTP/SSE. Returns structured data: `userState`, `history`, `deliverySession`, `deliveryState`, `pendingOrder`, `memory`.

## Stage 2: Conversation Understanding (02_conversationUnderstanding.mjs)
- **Responsibility:** Predict intent (using CUL) and enforce delivery flow overrides.
- **Services Called:** `responseService` (understandConversation, buildDecision).
- **Duplication/Transport Check:** It generates `decision` and `culOutput`. No HTTP/SSE. Returns structured data: `decision`, `currentLang`, `culOutput`.

## Stage 3: Workflow Manager (03_workflowManager.mjs)
- **Responsibility:** Validate intent transitions against conversational state.
- **Services Called:** `workflowManager`, `conversationStateService` (clearConversationState, pauseCurrentFlow, saveConversationState), `memoryManager` (updateMemory).
- **Duplication/Transport Check:** No HTTP/SSE. Does not overlap with CUL. Returns structured data: `workflowDecision`, `userState`.

## Stage 4: Reference Engine (04_referenceEngine.mjs)
- **Responsibility:** Resolve conversational reference (e.g., "add this to cart" -> resolves to product ID) before execution.
- **Services Called:** `referenceManager` (handleReference).
- **Duplication/Transport Check:** No HTTP/SSE (controller handles the early exit `responsePayload` it returns). Returns structured data: `resolvedReference`, `decision`, `earlyReturn`.

## Stage 5: Pre-Workflow Interceptions (05_preWorkflowInterceptions.mjs)
- **Responsibility:** Legacy bypass block where specific conditions (Order Cancellation, Checkout Block, Pending Order Confirmation) stop the request early and return predefined responses.
- **Services Called:** `responseService` (selectResponse), `conversationStateService` (saveConversationState), `deliveryFlowService` (handleFinalOrderConfirmation).
- **Duplication/Transport Check:** Separated out to highlight legacy routing! No HTTP/SSE (it returns `earlyReturn`, `providerUsed`, `serviceResult`, `responsePayload` to the orchestrator). 

## Stage 6: Commerce Services (06_commerceServices.mjs)
- **Responsibility:** Handles legacy active delivery session routing, shopping context resume flows, and adds order reminders.
- **Services Called:** `conversationStateService` (resumeFlow), `deliveryFlowService` (handleAddressInput, etc.), `responseService` (selectResponse).
- **Duplication/Transport Check:** Like Stage 5, it isolates legacy mid-pipeline execution. Returns structured data indicating if early return is needed or if reminders should be appended.

## Stage 7: Response Engine (07_responseEngine.mjs)
- **Responsibility:** Actually execute the intent (Call Gemini or MCP API) and format the results.
- **Services Called:** `llm.service` (chatWithLLM), `llmStream.service` (chatWithLLMStream), `intentRouter` (routeIntent).
- **Duplication/Transport Check:** It receives an `onChunk` callback but does not directly interact with `res` HTTP headers or lifecycle. Returns structured data: `finalPayload`, `providerUsed`.

# Legacy Routing Report

## 1. Resume Chat History Detection
- **File:** `01_contextLoader.mjs`
- **Function:** `executeContextLoader`
- **Purpose:** Hardcoded string matching for "resume my previous chat".
- **Type:** Business Logic (Intent Detection)
- **Still Required:** Yes
- **Canonical Stage Replacement:** Should be moved to CUL/Intent Router.
- **Safe to Remove:** No (needs CUL retraining first).

## 2. Delivery Flow Intent Override
- **File:** `02_conversationUnderstanding.mjs`
- **Function:** `executeConversationUnderstanding`
- **Purpose:** Hardcoded regex and word counts to override CUL's intent to "delivery_flow_input" during active delivery states.
- **Type:** Business Logic (Intent Detection Override)
- **Still Required:** Yes
- **Canonical Stage Replacement:** Should be handled inside CUL.
- **Safe to Remove:** No (VCSM relies on this heavily).

## 3. Early Cancellation Check
- **File:** `05_preWorkflowInterceptions.mjs`
- **Function:** `executePreWorkflowInterceptions`
- **Purpose:** String matching for "cancel order" that bypasses the Workflow Manager entirely.
- **Type:** Business Logic Bypass
- **Still Required:** Yes (functionally)
- **Canonical Stage Replacement:** Should be routed to `routeIntent` -> Commerce Engine.
- **Safe to Remove:** No (currently bypasses workflow manager, needs to be refactored into an intent).

## 4. Payment Pending Block
- **File:** `05_preWorkflowInterceptions.mjs`
- **Function:** `executePreWorkflowInterceptions`
- **Purpose:** Blocks input if `PAYMENT_PENDING`.
- **Type:** Business Logic Bypass
- **Still Required:** Yes
- **Canonical Stage Replacement:** Workflow Manager should reject the transition natively.
- **Safe to Remove:** No (needs Workflow rule update first).

## 5. Early Pending Order Confirmation
- **File:** `05_preWorkflowInterceptions.mjs`
- **Function:** `executePreWorkflowInterceptions`
- **Purpose:** Bypasses workflow and handles "yes" to confirm a pending order.
- **Type:** Business Logic Bypass
- **Still Required:** Yes
- **Canonical Stage Replacement:** Commerce Engine (`handleFinalOrderConfirmation` inside Intent Router).
- **Safe to Remove:** No.

## 6. CSM Resume Flow 
- **File:** `06_commerceServices.mjs`
- **Function:** `executeCommerceServices`
- **Purpose:** Intercepts if a flow was paused to resume it.
- **Type:** Business Logic Bypass
- **Still Required:** Yes
- **Canonical Stage Replacement:** Commerce Engine.
- **Safe to Remove:** No.

## 7. Delivery State Machine Routing
- **File:** `06_commerceServices.mjs`
- **Function:** `executeCommerceServices`
- **Purpose:** Bypasses `routeIntent` and directly calls `handleAddressInput`, `handleDateInput`, etc.
- **Type:** Legacy Routing
- **Still Required:** Yes
- **Canonical Stage Replacement:** Commerce Engine (`routeIntent` -> `INTENTS.DELIVERY_FLOW_INPUT`).
- **Safe to Remove:** Yes, if `routeIntent` is updated to handle `delivery_flow_input`.

## 8. Shopping Context Resume Choice
- **File:** `06_commerceServices.mjs`
- **Function:** `executeCommerceServices`
- **Purpose:** Intercepts a, b, 1, 2 choices to resume or start a new product search.
- **Type:** Legacy Routing Bypass
- **Still Required:** Yes
- **Canonical Stage Replacement:** Should be an intent routed inside `routeIntent`.
- **Safe to Remove:** No.
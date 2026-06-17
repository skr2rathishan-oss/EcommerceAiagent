Audit validation & fixes applied
I verified your audit against the codebase. Most findings are accurate. Below is what was confirmed, what I fixed, and what still needs manual action.

Critical bugs — status
#	Issue	Verdict	Action
1
.env secrets in git
Confirmed
Updated root .gitignore, expanded .env.example, ran git rm --cached kapruka-ai-agent/.env
2
setShoppingContext missing in App.tsx
Confirmed — would throw ReferenceError on popup close
Added to useApp() destructuring
3
isTyping / setIsTyping conflict
Partially accurate — real bug was setIsTyping used but not destructured (same as Bug 2)
Added setIsTyping to destructuring; shared context state is intentional
4
justifycontent typo
Confirmed in 4 places
Fixed in App.tsx, TopNavbar.tsx, SuggestedPrompts.tsx
5
checkDelivery missing x-session-id
Confirmed
Added session header in productServices.ts
6
Express error handler
Confirmed
Added res.headersSent guard + uses err.status when present
Security — status
Issue	Verdict	Action
Weak JWT + unused auth middleware
Confirmed
Not changed (needs product decision on auth strategy)
MongoDB/API keys in .env
Confirmed
Untracked from git; you must rotate all exposed credentials
Permissive dev CORS
Confirmed
Left as-is for local dev; ensure NODE_ENV=production in deploy
No chat payload validation
Confirmed
Recommend Zod — not implemented (larger change)
Missing rate limits on admin/orders
Confirmed
Added orderLimiter + adminLimiter
Urgent manual step: Because secrets were in git history, rotate NVIDIA, MongoDB, Google Maps, ElevenLabs, and JWT keys even after untracking .env.

Performance & optimizations — status
Issue	Verdict	Action
Scroll resize listener re-registration
Overstated — cleanup is correct ([] deps)
No change needed
8 parallel category searches on recommendations
Confirmed
Not changed (needs caching/strategy decision)
Duplicate product detail fetch paths
Confirmed (useChat vs /api/products/:id)
Not consolidated (architectural)
localStorage in render
Confirmed
Moved to savedDelivery state initialized once
Debug console.log in delivery service
Confirmed
Removed
LLM calls without timeout
Confirmed
Added withTimeout() (default 60s via LLM_TIMEOUT_MS)
Missing error boundaries
Confirmed
Added ErrorBoundary wrapping the app
Radix bloat / split AppContext / client order numbers
Confirmed
Deferred — larger refactors
Files changed
Frontend

frontend/src/app/App.tsx — setShoppingContext, setIsTyping, CSS fixes, delivery display state
frontend/src/app/services/productServices.ts — session header on delivery check
frontend/src/app/components/TopNavbar.tsx, SuggestedPrompts.tsx — CSS fixes
frontend/src/app/components/ErrorBoundary.tsx — new
frontend/src/main.tsx — wraps app in error boundary
Backend

kapruka-ai-agent/src/server.mjs — safer error handler
kapruka-ai-agent/src/services/delivery.service.mjs — removed debug logs
kapruka-ai-agent/src/services/modelRouter.mjs — withTimeout + Gemini timeouts
kapruka-ai-agent/src/services/llm.service.mjs — NVIDIA call timeouts
kapruka-ai-agent/src/middleware/rateLimiter.mjs — adminLimiter
kapruka-ai-agent/src/routes/order.routes.mjs, admin.routes.mjs — rate limiting
.gitignore, kapruka-ai-agent/.env.example
Recommended next steps (not done yet)
Rotate all leaked credentials and scrub git history if the repo was ever public (git filter-repo or BFG).
Split AppContext into Chat / Checkout / UI contexts to reduce re-renders.
Consolidate product detail fetching — pick either chat SSE or REST, not both.
Cache recommendations — avoid 8 parallel Kapruka searches on every load.
Move order number generation to the backend — replace client-side Math.random().
Add Zod validation on /api/chat and order endpoints.
Audit frontend dependencies — remove unused Radix/shadcn packages (~40% bundle savings possible).
Wire JWT auth middleware on protected routes when you’re ready for auth.
Architecture snapshot
Frontend - React/Vite
Backend - Express
NVIDIA NIM / Gemini
Kapruka MCP
App
AppContext
useChat
useCheckout
/api/chat SSE
productServices
/api/products
/api/delivery
server
chatRoutes
productsRoutes
deliveryRoutes
orderRoutes
llmService
intentRouter
mcpClient
I can tackle the next batch (context split, recommendation caching, or dependency cleanup) if you want to prioritize one of those.

.env untracking succeeded. git rm --cached kapruka-ai-agent/.env completed cleanly — the file stays on your machine but is no longer tracked by git, and the updated .gitignore will keep it out of future commits.

When you’re ready to commit, stage the audit fixes plus the .env removal together. Rotate all API keys and MongoDB credentials that were ever in that file; removing it from the index doesn’t erase git history.
































The crash had two causes:

ESM import order — In server.mjs, dotenv.config() ran after other modules loaded. modelRouter.mjs created the OpenAI client before .env was read, so NVIDIA_API_KEY was undefined.

Gemini client eager init — GoogleGenAI was created at startup even in development (NVIDIA-only) mode, which failed when GOOGLE_CLOUD_PROJECT wasn’t set.

Fixes applied:

Added src/config/loadEnv.mjs and import it before any client setup
Lazy-load Gemini via getGeminiClient() (only when staging/production needs it)
Clear error message if NVIDIA_API_KEY is missing
Restart the server:

cd .\kapruka-ai-agent\
npm run dev
If you still see a key error, confirm kapruka-ai-agent/.env has a real value for NVIDIA_API_KEY (not the placeholder from .env.example). Gemini/GCP vars are only needed when AI_MODE=staging or production.



















Code Modularization Audit
Architecture-only refactor plan — no code changes in this pass. Goal: split oversized modules without changing behavior.

Files over 300 lines
Lines	File	Domain
1,777
frontend/src/app/components/SmartInputPanel.tsx
UI — smart panels
1,198
frontend/src/app/App.tsx
UI — main shell
780
frontend/src/app/components/PanelPopup.tsx
UI — settings panels
618
frontend/src/app/components/TopNavbar.tsx
UI — navigation
524
kapruka-ai-agent/src/controllers/products.controller.mjs
API — products
513
kapruka-ai-agent/src/controllers/chat.controller.mjs
API — chat SSE
500
frontend/src/app/hooks/useChat.ts
Hook — chat logic
397
kapruka-ai-agent/src/agent/intentRouter.mjs
Agent — intent routing
383
kapruka-ai-agent/src/services/llm.service.mjs
Service — LLM
360
kapruka-ai-agent/src/agent/systemPrompt.mjs
Config — prompt text
330
frontend/src/app/components/CheckoutPanel.tsx
UI — checkout
309
frontend/src/app/contexts/AppContext.tsx
State — global context
215
kapruka-ai-agent/src/services/modelRouter.mjs
Service — model routing
Priority file analysis
1. chat.controller.mjs (~513 lines)
Current responsibility: HTTP entry for POST /api/chat — request validation, commerce state sync, language detection, SSE streaming, intent classification, memory loading, routing (general_chat vs MCP), response formatting, persistence, telemetry.

SRP violations:

Concern	Lines (approx.)	Should live in
Language detection
15–30
utils/language.utils.mjs
SSE progress orchestration
171–201, 303–327
services/chat/sseProgress.service.mjs
Direct-intent fast path
112–164
services/chat/directIntent.handler.mjs
Intent detail extraction
278–301
services/chat/intentDetails.builder.mjs
Log step templates
303–317
services/chat/progressSteps.config.mjs
Result → payload mapping
419–454
services/chat/responsePayload.builder.mjs
Persistence side-effects
108–110, 142–156, 459–473
services/chat/chatPersistence.service.mjs
Telemetry wiring
scattered
services/chat/chatTelemetry.service.mjs
Suggested folder structure:

kapruka-ai-agent/src/
├── controllers/
│   └── chat.controller.mjs          # ~80 lines — HTTP only
└── services/chat/
    ├── chatOrchestrator.service.mjs # main pipeline
    ├── directIntent.handler.mjs
    ├── sseProgress.service.mjs
    ├── responsePayload.builder.mjs
    ├── intentDetails.builder.mjs
    ├── chatPersistence.service.mjs
    ├── chatTelemetry.service.mjs
    └── progressSteps.config.mjs
Suggested splits:


chat.controller.mjs (513)
  → chat.controller.mjs (~60)     export chat(); delegate to orchestrator
  → chatOrchestrator.service.mjs (~200)  pipeline: validate → detect → route → respond
  → directIntent.handler.mjs (~70)
  → sseProgress.service.mjs (~80)  createProgressWriter(res), buildLogSteps(intent)
  → responsePayload.builder.mjs (~60)  buildFinalPayload(result, session, lang)
  → chatPersistence.service.mjs (~40)  saveUserMessage, saveAssistantMessage
Import changes:

// chat.controller.mjs (after)
import { handleChatRequest } from "../services/chat/chatOrchestrator.service.mjs";
export const chat = (req, res) => handleChatRequest(req, res);
// chat.routes.mjs — unchanged
Refactor plan: Extract pure functions first (language, payload, intent details), then SSE writer, then orchestrator. Controller becomes a one-liner delegate.

2. llm.service.mjs (~383 lines)
Current responsibility: LLM gateway — legacy exports, greeting heuristics, GPT language detection, general chat, intent detection, conversation summarization, shopping insights, telemetry, router logging.

SRP violations:

Concern	Lines (approx.)	Issue
Legacy re-exports
18–27
Compatibility shim mixed with logic
isSimpleConversation
31–50
Heuristic utility
detectLanguageWithGPT
53–88
Separate language service
chatWithLLM
91–218
Chat + telemetry + file logging
detectIntent
221–263
Separate role
generateSummaryWithNemotron
266–314
Background analytics
generateInsightsWithNemotron
317–377
Background analytics
Inline prompts
270–285, 329–348
Should be in agent/prompts/
Suggested folder structure:

kapruka-ai-agent/src/
├── services/llm/
│   ├── index.mjs                    # barrel re-exports (backward compat)
│   ├── constants.mjs                # NVIDIA_CLIENT, LLAMA_MODEL, etc.
│   ├── conversation.service.mjs     # chatWithLLM
│   ├── intent.service.mjs           # detectIntent
│   ├── language.service.mjs         # detectLanguageWithGPT, isSimpleConversation
│   ├── summary.service.mjs          # generateSummaryWithNemotron
│   ├── insights.service.mjs         # generateInsightsWithNemotron
│   ├── telemetry.helper.mjs         # shared telemetry population
│   └── completion.helper.mjs        # shared NVIDIA/Gemini call wrapper
├── agent/prompts/
│   ├── summary.prompt.mjs
│   └── insights.prompt.mjs
└── services/llm.service.mjs           # thin re-export shim (deprecated)
Suggested splits:

llm.service.mjs (383)
  → conversation.service.mjs (~130)  chatWithLLM
  → intent.service.mjs (~45)
  → language.service.mjs (~60)
  → summary.service.mjs (~55)
  → insights.service.mjs (~65)
  → completion.helper.mjs (~40)  withTimeout + provider branch
  → constants.mjs (~15)
  → llm.service.mjs (~20)  re-exports only
Import changes (transitional):

// Keep working during migration:
// llm.service.mjs
export { chatWithLLM } from "./llm/conversation.service.mjs";
export { detectIntent } from "./llm/intent.service.mjs";
// ... all existing exports
// Consumers unchanged until Phase 4 cleanup
Refactor plan: Extract completion.helper.mjs first (deduplicates 4 NVIDIA call blocks). Move prompts to agent/prompts/. Keep llm.service.mjs as barrel until all imports updated.

3. AppContext.tsx (~309 lines)
Current responsibility: Type definitions, god-context with 50+ state fields spanning UI layout, chat, checkout, delivery, smart panels, and bridged cart/wishlist operations.

SRP violations:

Domain	State count	Problem
UI chrome
~12
phase, sidebarOpen, activePanel, anchorPos, activeScreen
Chat
~8
messages, value, isTyping, activity, shoppingContext
Checkout / purchase
~14
pendingConfirm*, address fields, checkingAddress
Smart panels / delivery recovery
~4
activeSmartPanel, nearbyCitiesSuggested, lastCheckedDelivery
Commerce bridge
~6
cart/wishlist bridging + handlers
Suggested folder structure:

frontend/src/app/
├── types/
│   ├── chat.types.ts
│   ├── ui.types.ts
│   ├── checkout.types.ts
│   └── smartPanel.types.ts
├── contexts/
│   ├── UIContext.tsx
│   ├── ChatContext.tsx
│   ├── CheckoutContext.tsx
│   ├── SmartPanelContext.tsx
│   ├── OrderHistoryContext.tsx
│   ├── AppProvider.tsx          # composes providers
│   ├── useApp.ts                # composite hook (backward compat)
│   └── AppContext.tsx           # deprecated barrel
Suggested splits:

AppContext.tsx (309)
  → types/*.ts (~80)           all interfaces
  → UIContext.tsx (~50)        phase, panels, screens, sidebar
  → ChatContext.tsx (~60)      messages, typing, activity, shoppingContext
  → CheckoutContext.tsx (~70)  address fields, pending purchase, handlers
  → SmartPanelContext.tsx (~40) activeSmartPanel, delivery recovery state
  → OrderHistoryContext.tsx (~30) orderedItems, saveOrderToHistory
  → AppProvider.tsx (~40)      nesting order
  → useApp.ts (~30)            merges all contexts for legacy consumers
Import changes:

// Phase 1 — no consumer changes:
import { useApp } from "../contexts/AppContext";  // still works
// Phase 4 — targeted imports:
import { useChatContext } from "../contexts/ChatContext";
import { useCheckoutContext } from "../contexts/CheckoutContext";
Refactor plan: Extract types first. Split contexts one domain at a time. useApp() remains a facade composing all sub-hooks — zero consumer breakage during migration.

4. useChat.ts (~500 lines)
Current responsibility: All chat interaction logic — product selection/actions, SSE search, response type dispatch (12+ types), keyword routing to smart panels, inline delivery address parsing, product details fetch, activity/typing state.

SRP violations:

Concern	Lines (approx.)	Issue
Product actions popup
47–101
Product UX
performSearch + SSE dispatch
104–282
Search + 10 response handlers
Address-in-chat delivery flow
303–406
Delivery domain
Keyword → panel routing
408–428
Input routing
Product details fetch
446–486
Product domain
CITIES_LIST constant
314–317
Should be shared config
Suggested folder structure:

frontend/src/app/
├── hooks/chat/
│   ├── useChat.ts                 # composer (~40 lines)
│   ├── useProductActions.ts
│   ├── useChatSearch.ts
│   ├── useChatSend.ts
│   ├── useProductDetails.ts
│   └── chatResponseHandlers.ts
├── config/
│   └── sriLankaCities.ts
└── utils/
    └── detectCityFromText.ts
Suggested splits:

useChat.ts (500)
  → useProductActions.ts (~75)     handleProductSelect, handleProductAction
  → useChatSearch.ts (~180)        performSearch, handleRetry + response dispatch
  → chatResponseHandlers.ts (~120) map each data.type → setMessages/setPanel
  → useChatSend.ts (~130)          handleSend, keywords, address flow
  → useProductDetails.ts (~50)     handleRequestProductDetails
  → useChat.ts (~40)               composes and returns public API
Import changes:

// App.tsx — unchanged
const { handleSend, handleStop, ... } = useChat();
// Internal only:
import { dispatchChatResponse } from "./chat/chatResponseHandlers";
Refactor plan: Extract chatResponseHandlers.ts first (biggest complexity reduction). Then useChatSearch, then useChatSend. Public useChat() API surface stays identical.

5. SmartInputPanel.tsx (~1,777 lines)
Current responsibility: Container for 7 smart panels + 4 full sub-forms + 3 recovery panels, each with own state, API calls, activity logs, and order generation.

SRP violations:

Component	Lines (approx.)	Responsibility
logPanelEvent
13–38
Analytics utility
SmartInputPanel shell
40–125
Router — OK alone
RecommendationForm
127–650
524 lines — multi-step wizard + AI pipeline
DeliveryForm
651–807
Delivery check form
TrackOrderForm
808–918
Order tracking
CheckoutForm
920–1140
Order creation + persistence
DeliveryRecoveryPanel
1141–1259
Recovery UX
NearbyAddressPanel
1260–1565
305 lines
AlternativeDatePanel
1566–1777
Date recovery
Suggested folder structure:

frontend/src/app/components/smart-panels/
├── SmartInputPanel.tsx            # shell + router (~90 lines)
├── PanelHeader.tsx                # shared title/close
├── RecommendationForm/
│   ├── RecommendationForm.tsx
│   ├── RecommendationSteps.tsx    # step UI components
│   └── useRecommendationSubmit.ts
├── DeliveryForm.tsx
├── TrackOrderForm.tsx
├── CheckoutForm.tsx
├── DeliveryRecoveryPanel.tsx
├── NearbyAddressPanel.tsx
├── AlternativeDatePanel.tsx
└── shared/
    ├── panelStyles.ts
    └── PanelChipSelect.tsx        # reused chip button pattern
Suggested splits:

SmartInputPanel.tsx (1777)
  → SmartInputPanel.tsx (~90)
  → RecommendationForm/ (~550 total, split UI vs submit hook)
  → DeliveryForm.tsx (~155)
  → TrackOrderForm.tsx (~110)
  → CheckoutForm.tsx (~220)
  → DeliveryRecoveryPanel.tsx (~120)
  → NearbyAddressPanel.tsx (~305)
  → AlternativeDatePanel.tsx (~210)
  → utils/panelAnalytics.ts (~30)
  → shared/PanelChipSelect.tsx (~50)
Import changes:

// App.tsx
import { SmartInputPanel } from "./components/smart-panels/SmartInputPanel";
// SmartInputPanel.tsx
import { RecommendationForm } from "./RecommendationForm/RecommendationForm";
import { DeliveryForm } from "./DeliveryForm";
// ...
Refactor plan: Move each const XxxForm to its own file verbatim first (mechanical cut-paste). Extract panelAnalytics.ts and shared chip UI second. Extract useRecommendationSubmit.ts last (highest logic density).

Cross-cutting patterns
Current - God Modules
Target - Layered
chat.controller 513L
llm.service 383L
AppContext 309L
useChat 500L
SmartInputPanel 1777L
Thin Controller
Orchestrator Services
Domain Contexts
Composed Hooks
Panel Components
Shared extraction opportunities:

CITIES_LIST duplicated in useChat.ts and likely delivery forms → config/sriLankaCities.ts
Order number generation in CheckoutForm + useCheckout.ts → utils/orderNumber.ts
Activity log step templates duplicated in useChat, SmartInputPanel, chat.controller → domain-specific configs
Chip-button UI pattern in RecommendationForm → PanelChipSelect.tsx
Migration plan (before any code changes)
Phase 0 — Preparation (1 day)

 Add REFACTOR.md with file map and import conventions

 Add barrel re-export files (llm/index.mjs, contexts/index.ts)

 Run full manual smoke test checklist (chat, search, delivery, checkout, panels)

 Ensure TypeScript strict checks pass
Phase 1 — Pure utilities, zero risk (2 days)
Extract	From	To
Language utils
chat.controller.mjs
utils/language.utils.mjs
extractText, payload builder
chat.controller.mjs
services/chat/responsePayload.builder.mjs
isSimpleConversation
llm.service.mjs
services/llm/language.service.mjs
Summary/insights prompts
llm.service.mjs
agent/prompts/*.mjs
logPanelEvent
SmartInputPanel.tsx
utils/panelAnalytics.ts
Shared types
AppContext.tsx
types/*.ts
Validation: All existing imports still work via re-exports. No behavior change.

Phase 2 — Service decomposition, backend (3 days)
completion.helper.mjs from llm.service.mjs
Split llm.service.mjs into role-specific services; keep barrel
sseProgress.service.mjs + progressSteps.config.mjs from chat.controller.mjs
chatOrchestrator.service.mjs — move pipeline body out of controller
Thin chat.controller.mjs to HTTP delegate
Validation: POST /api/chat SSE events byte-identical for test messages.

Phase 3 — Hook decomposition, frontend (3 days)
chatResponseHandlers.ts from useChat.ts
useChatSearch.ts, useProductActions.ts, useChatSend.ts
useChat.ts becomes composer only
Split SmartInputPanel.tsx into 7 panel files (mechanical moves)
Validation: Chat flow, product actions, smart panels behave identically.

Phase 4 — Context split (4 days)
UIContext → extract UI state from AppContext
ChatContext → messages, typing, activity
CheckoutContext → address + pending purchase
SmartPanelContext → panel + delivery recovery
useApp() facade merges all — deprecate direct god-context
Validation: React DevTools shows smaller re-render scopes; no UI regressions.

Phase 5 — Cleanup (2 days)

 Update imports to use domain-specific hooks where beneficial

 Remove deprecated barrels

 Split App.tsx (1,198 lines) using same panel extraction patterns

 Document final architecture in ARCHITECTURE.md
Recommended execution order
Priority	File	Impact	Risk	Order
1
SmartInputPanel.tsx
Highest LOC reduction
Low (mechanical)
Phase 3
2
useChat.ts
Reduces hook complexity
Medium
Phase 3
3
chat.controller.mjs
Backend maintainability
Medium
Phase 2
4
llm.service.mjs
LLM extensibility
Low
Phase 2
5
AppContext.tsx
Re-render performance
High (many consumers)
Phase 4 last
Risk controls
Barrel re-exports — keep llm.service.mjs, AppContext.tsx, useChat.ts as facades until Phase 5
One file per PR — mechanical extractions only; no logic edits
Smoke test matrix per phase:
Test	Covers
General chat message
chat.controller, llm, useChat
Product search SSE
chat.controller, useChat
Product action popup
useChat, AppContext
Recommendation panel
SmartInputPanel
Delivery recovery flow
SmartInputPanel, useChat, AppContext
Checkout panel
SmartInputPanel, CheckoutContext
Do not refactor App.tsx until panel/context splits are stable — it depends on all five priority modules
Summary
The five priority files total ~3,482 lines with clear domain boundaries already implicit in the code — they are organized by feature, not by layer. The migration is mechanical extraction + facade preservation, not a rewrite.

Highest ROI first: split SmartInputPanel.tsx (7 self-contained components already defined inline), then useChat.ts response dispatch, then backend chat.controller / llm.service orchestration layers.

Say which phase you want implemented first and I can execute it file-by-file with zero functionality changes.



Composer 2.5 Fast
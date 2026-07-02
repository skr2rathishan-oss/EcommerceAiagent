Objective

Investigate and fix the issue where the Gift Planner correctly ignores category extraction while collecting mandatory information (occasion, recipient, budget), but the LLM still generates product recommendation responses as if the category had already been accepted.

This is not an extraction bug. The extraction layer is already behaving correctly. The bug exists in the conversation orchestration between the Shopping Mission state and the Response Engine.

Root Cause

Current flow:

User
 ↓
Conversation Understanding
 ↓
Gift Planner Extractor
 ↓
Mission State
 ↓
Response Engine
 ↓
Gemini

The extractor correctly rejects category extraction when the mission is still collecting required information.

Example:

Mission Status:
COLLECTING_INFORMATION

Current Step:
Collecting Budget

User:
dress

Extractor:
Ignored

Mission:
No category added

However, the Response Engine still tells Gemini to talk about dresses, causing responses such as:

"I'll show you some dresses..."

instead of asking for the missing budget.

The Response Engine is therefore not respecting the current Shopping Mission state.

Implementation Requirements
1. Investigate the Response Pipeline

Trace the complete execution path after extractGiftPlannerData() returns.

Review:

06_commerceServices.mjs
07_responseEngine.mjs
runtimeBuilder.mjs
recommendation prompts
response strategy prompts

Identify where the current mission state is lost or ignored.

2. Make the Response Engine State-Aware

Before Gemini is invoked, inspect:

shoppingMission.status
shoppingMission.currentStep
shoppingMission.presentation
validation.nextStep
validation.missingFields

The Response Engine must use these values as the single source of truth.

Never infer the next conversational step from the user's latest message.

3. Introduce Blocking Reasons

Instead of simply ignoring category extraction, return a structured response from the commerce layer.

Example:

{
    blocked: true,
    blockedReason: "WAITING_FOR_BUDGET",
    nextStep: "Collecting Budget"
}

Supported blocking reasons:

WAITING_FOR_OCCASION
WAITING_FOR_RECIPIENT
WAITING_FOR_BUDGET
WAITING_FOR_CATEGORIES

The Response Engine must consume this metadata before calling Gemini.

4. Enforce Strict Conversation State Rules

Gemini must never advance the workflow ahead of the Shopping Mission.

Required behavior:

Collecting Occasion

Only ask for the occasion.

Never discuss:

products
categories
recommendations
budget allocation
Collecting Recipient

Only ask who the gift is for.

Do not recommend products.

Collecting Budget

Only ask for the budget.

If the user says:

dress
iphone
flowers
earbuds
watch

Gemini must respond naturally:

"Great choice! Before I start searching, could you tell me your budget?"

Never mention searching.

Never mention products found.

Never say "I'll show you..."

Collecting Categories

Accept categories.

Only after at least one valid category exists may the planner transition to READY_FOR_SEARCH.

5. Prevent Premature Product Search

The following actions must never occur while the mission is in COLLECTING_INFORMATION:

searchProducts()
orchestrateSequentialSearch()
recommendation generation
comparison generation
product card rendering
search payload generation
"Search Products" UI payload

All search logic must remain blocked until:

validation.ready == true
6. Runtime Prompt Improvements

Update the runtime prompt with strict workflow instructions.

Example:

Shopping Mission is authoritative.

Follow shoppingMission.currentStep exactly.

Never skip steps.

Never assume missing information.

Never recommend products until the mission reaches READY_FOR_SEARCH.

If categories are mentioned before budget, acknowledge them politely but continue collecting the missing budget.

Do not fabricate searches.

Do not say you are searching when no search has been executed.

Never generate Search Products payloads unless grounded MCP results exist.
7. Response Engine Safety Check

Before generating the final response, verify:

Mission Status
↓

COLLECTING_INFORMATION ?

↓

Yes

↓

Missing Fields?

↓

Occasion
Recipient
Budget
Mission Items

↓

Generate ONLY the question for the next missing field.

No product conversation should occur until the mission is validated.

8. Verification Scenarios

All of these flows must pass:

Scenario 1
birthday
girlfriend
dress

Expected:

Ask for budget.

No search.

Scenario 2
birthday
girlfriend
50000
dress

Expected:

Accept category
↓

READY_FOR_SEARCH
↓

MCP search
↓

Product cards
Scenario 3
birthday
girlfriend
dress
50000

Expected:

Remember dress.

Ask for budget.

After budget is received:

Automatically continue with dress search.

Do not ask the user to repeat "dress".
Scenario 4
birthday
girlfriend
50000

Expected:

Ask which gift categories they would like to include.
Scenario 5
birthday
girlfriend
50000
dress
earbuds
flowers

Expected:

Mission becomes READY_FOR_SEARCH.

Sequential searches begin.

Product cards are rendered.

No premature recommendations.
Success Criteria
The Shopping Mission state is the single source of truth.
The Response Engine strictly follows shoppingMission.currentStep.
No product recommendations or searches occur before the mission is ready.
Blocked states return natural conversational prompts instead of search responses.
Existing workflows (Product Search, Checkout, Delivery, Tracking) remain unaffected.
No regressions to the Gift Planner sequential workflow or Phase 3 functionality.
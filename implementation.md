# Velora AI Agent – AI-Driven Conversation Understanding Pipeline Refactor

You are a Senior AI Architect, Senior Node.js Engineer, NLP Specialist, and Software Refactoring Engineer.

Your task is to refactor the existing Conversation Understanding pipeline of the Velora AI Shopping Assistant.

This is NOT a new feature.

This is an architectural upgrade that replaces fragmented local language detection with a centralized AI-driven Conversation Understanding pipeline.

The objective is to simplify the architecture, eliminate duplicate analysis logic, and make the LLM the primary source of conversational understanding.

---

# PRIMARY GOAL

Refactor the Conversation Understanding pipeline so that a single AI request determines:

* Language
* Intent
* Emotion
* Variables
* Conversation Stage
* Confidence

The Conversation Understanding Layer becomes the single intelligence layer of Velora.

All downstream components must consume its structured output.

---

# CURRENT PROBLEM

The current architecture performs language detection separately using keyword matching.

This causes:

• incorrect language detection

• duplicated logic

• inconsistent Decision Objects

• mixed responsibilities

• poor handling of Sri Lankan mixed-language conversations

Examples

"Machan show me laptops"

"Anna compare this phone"

"Mama meka order karanna oni"

"Super, idha deliver pannunga"

Keyword detection cannot reliably classify these conversations.

---

# TARGET ARCHITECTURE

User Message

↓

Conversation State Manager

↓

Conversation Understanding (LLM)

↓

Structured Conversation Object

↓

Decision Builder

↓

Response Engine

↓

Response Library

↓

Streaming Controller

↓

Frontend

There should be only one conversational analysis pipeline.

---

# RULE 1 — ANALYZE THE EXISTING PROJECT FIRST

Before writing any code:

Analyze the entire backend.

Locate:

Conversation Understanding

Language Detection

Intent Detection

Emotion Detection

Decision Builder

Conversation State Manager

Response Engine

Response Library

Streaming Controllers

Chat Controllers

Determine how conversational analysis currently flows through the project.

Reuse existing implementations whenever possible.

---

# RULE 2 — REMOVE DUPLICATE ANALYSIS

Do NOT create another language detector.

Do NOT create another intent detector.

Do NOT create another emotion detector.

Instead,

merge the responsibilities into the existing Conversation Understanding Layer.

Conversation Understanding becomes the only AI analysis component.

---

# RULE 3 — PRESERVE BACKWARD COMPATIBILITY

Do NOT break:

Shopping

Delivery

Orders

Voice Mode

Streaming

Response Library

Controllers

MCP Tools

Existing APIs

All existing functionality must continue working.

---

# NEW RESPONSIBILITIES OF THE CONVERSATION UNDERSTANDING LAYER

For every user message,

the Conversation Understanding Layer must determine:

Language

Intent

Emotion

Variables

Conversation Stage

Confidence

using one AI request.

---

# STRUCTURED OUTPUT

The Conversation Understanding Layer should return a standardized object.

Example

{
"language": {
"detected": "tamil_mix",
"confidence": 0.98
},

"intent": {
"value": "search_product",
"confidence": 0.97
},

"emotion": "friendly",

"conversationStage": "shopping",

"variables": {
"product": "Laptop"
},

"analysisConfidence": 0.96
}

Every downstream service should consume this object.

---

# LANGUAGE DETECTION

Language must no longer rely primarily on keyword matching.

The AI should determine:

english

sinhala_mix

tamil_mix

based on the complete conversational context.

It must correctly understand:

Romanized Sinhala

Romanized Tamil

Mixed English + Sinhala

Mixed English + Tamil

Natural Sri Lankan conversation styles.

---

# CONVERSATION STATE INTEGRATION

The Conversation State Manager should provide context to the AI.

Examples

Current Flow

Current Step

Previous Language

Paused Flows

Recent Conversation History

This allows the AI to make better language and intent decisions.

---

# LANGUAGE PREFERENCE

Persist the detected language inside the Conversation State Manager.

Example

preferences:

preferredLanguage

languageConfidence

lastDetectedLanguage

Future responses should reuse this information.

Do not unnecessarily switch languages during a conversation.

---

# LLM FALLBACK STRATEGY

The AI becomes the primary language detector.

However,

if the AI request fails:

network error

timeout

quota exceeded

invalid JSON

fallback to the existing lightweight keyword detector.

Do NOT remove the existing detector immediately.

Downgrade it into a fallback mechanism.

---

# DECISION BUILDER

The Decision Builder must consume:

language

intent

emotion

variables

conversationStage

directly from the Conversation Understanding Layer.

It should never perform additional conversational analysis.

---

# RESPONSE ENGINE

The Response Engine should consume only:

decision.language.detected

No language detection logic should exist inside the Response Engine.

---

# RESPONSE LIBRARY

The Response Library continues working exactly as before.

Only the language source changes.

The Response Engine should automatically load:

english

sinhala_mix

tamil_mix

based on the AI result.

---

# STREAMING COMPATIBILITY

Streaming should remain unchanged.

Conversation Understanding completes first.

Streaming begins only after the structured analysis has been produced.

---

# FILE CREATION POLICY

Before creating any new files:

Search the project.

Reuse:

Conversation Understanding

Language Utilities

Decision Builder

Response Engine

Conversation State Manager

If obsolete language utilities become unnecessary,

remove them safely.

Never leave duplicate conversational analysis logic inside the project.

---

# CODE QUALITY

Reuse:

Existing logging

Existing error handling

Existing folder structure

Existing naming conventions

Existing helper utilities

Follow the project's architecture.

Maintain single responsibility for every service.

---

# VALIDATION PLAN

Verify:

✓ English conversations detect correctly

✓ Sinhala Mixed conversations detect correctly

✓ Tamil Mixed conversations detect correctly

✓ Romanized Sinhala works

✓ Romanized Tamil works

✓ Mixed-language conversations work

✓ Preferred language persists

✓ Response Library loads correct language

✓ Streaming still works

✓ Delivery flow still works

✓ Shopping flow still works

✓ Order flow still works

✓ No duplicate language detection remains

✓ Existing APIs remain unchanged

---

# TEST SCENARIOS

Test using realistic Sri Lankan conversations.

Examples

"Machan show me birthday cakes."

"Anna compare this laptop."

"Mama meka order karanna oni."

"Seri, intha address ku anuppunga."

"Hari, tomorrow deliver karanna."

"Super, thanks machan."

Ensure the AI consistently returns the correct language and the Response Engine loads the appropriate localized response.

---

# FINAL OUTPUT

Before implementing any changes provide:

1. Current architecture analysis

2. Existing conversational analysis pipeline

3. Existing files reused

4. Files modified

5. New files created (only if absolutely necessary)

6. Obsolete files safely removed

7. Updated architecture diagram

8. Migration plan

9. Validation strategy

10. Rollback strategy

Only after completing the analysis should implementation begin.

The final architecture must make the Conversation Understanding Layer the single source of truth for conversational analysis while preserving backward compatibility and minimizing duplicate logic.

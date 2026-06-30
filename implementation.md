Refactor the prompt architecture into a modular Prompt Registry and integrate it cleanly into the existing AI request pipeline.

Goal

The project now contains many prompt files across different categories (commerce, communication, intelligence, etc.). Prompt loading is becoming difficult to maintain.

Create a centralized Prompt Registry that manages all prompts and assembles the final system prompt for the Response Engine.

Do not change the existing business logic or workflow behavior.

------------------------------------------------------------

1. Create Prompt Registry

Create:

src/agent/prompts/index.mjs

This file should become the single entry point for every prompt used by the AI.

It should export all prompt modules in a structured way.

Example structure:

Commerce
- shopping
- delivery
- checkout
- orders
- tracking

Communication
- writingStyle
- voice
- clarification
- recovery

Intelligence
- commerce
- customerPsychology
- conversationStrategy
- recommendationStrategy
- responseLibrary
- reference

The registry should not contain prompt text.
It should only organize and expose prompt modules.

------------------------------------------------------------

2. Update Prompt Builder

Refactor promptBuilder.mjs.

Instead of importing individual prompt files, import them only from:

src/agent/prompts/index.mjs

The Prompt Builder should assemble prompts dynamically depending on:

- workflow
- runtime context
- language
- available MCP data
- response library context

This should become the only place responsible for constructing the final system prompt.

------------------------------------------------------------

3. Response Library Integration

Refactor the Response Engine so that it always performs a Response Library lookup before generating the final response.

When a matching response category exists:

Retrieve:
- module
- category
- language
- candidate responses

Do NOT directly return one of the responses.

Instead include them inside the Response Engine prompt as context.

Example runtime:

Response Library

Module:
delivery

Category:
ask_city

Language:
english

Candidate Responses:

1...
2...
3...

The LLM should receive these templates.

------------------------------------------------------------

4. Rewrite Strategy

Update the Response Library prompt.

The LLM must understand:

The Response Library represents Velora's official communication style.

The templates are NOT final responses.

Instead:

- understand the templates
- preserve their intent
- preserve their personality
- preserve their meaning
- rewrite naturally
- combine multiple templates if useful
- never invent different business logic

If no templates exist:

Generate a completely new response that matches Velora's communication style.

------------------------------------------------------------

5. Writing Style Prompt

Enhance writingStyle.prompt.mjs.

Describe HOW responses should be written.

Requirements:

- conversational
- natural
- human
- friendly
- premium shopping assistant
- concise
- not repetitive
- context-aware
- smooth transitions
- avoid robotic wording

This prompt should only describe writing style.

------------------------------------------------------------

6. Voice Prompt

Enhance voice.prompt.mjs.

Define Velora's personality.

Examples:

- warm
- confident
- trustworthy
- proactive
- shopping expert
- polite
- empathetic
- premium brand voice

This prompt should never contain workflow logic.

------------------------------------------------------------

7. Response Library Prompt

Rewrite responseLibrary.prompt.mjs.

Explain:

The Response Library is Velora's source of truth.

When templates are provided:

- analyze them
- identify the best candidate
- combine if appropriate
- improve fluency
- preserve meaning
- preserve personality
- respond naturally

Never simply copy a template unless it already perfectly matches the conversation.

------------------------------------------------------------

8. Multilingual Behaviour

The rewriting process must support every language currently supported.

Examples:

- English
- Sinhala
- Tamil
- Tanglish

The LLM must preserve the user's detected language.

Never translate unless the user changes language.

------------------------------------------------------------

9. Runtime Context

Extend the runtime builder so the Response Engine receives:

responseLibrary

{
    module,
    category,
    language,
    templates
}

This should become part of the runtime context.

------------------------------------------------------------

10. Logging

Add prompt debugging.

Example:

[PROMPT]

Workflow:
delivery

Language:
english

Prompt Modules:

✓ Commerce
✓ Voice
✓ Writing Style
✓ Response Library
✓ Recommendation Strategy

Response Library:

delivery.ask_city

Templates:
3

This should help debug prompt construction.

------------------------------------------------------------

11. No Breaking Changes

Do NOT change:

- Conversation Understanding
- Decision Builder
- Workflow Manager
- MCP integrations
- Business logic
- UI rendering

Only improve prompt organization and Response Engine prompt construction.

------------------------------------------------------------

12. Expected Architecture

User
      ↓
Conversation Understanding
      ↓
Decision Builder
      ↓
Workflow
      ↓
Business Logic / MCP
      ↓
Runtime Builder
      ↓
Prompt Builder
      ↓
Prompt Registry (index.mjs)
      ↓
Response Library Lookup
      ↓
Response Engine Prompt
      ↓
Gemini
      ↓
UI Renderer

------------------------------------------------------------

Expected Result

The Prompt Registry becomes the single source for prompt management.

The Prompt Builder dynamically assembles prompts.

The Response Library guides the LLM instead of bypassing it.

Every response becomes more natural while preserving Velora's multilingual personality.

The architecture remains modular, scalable, and easy to extend as new prompt modules and workflows are added.
# Velora AI Application Pipeline Architecture

This document describes the request pipeline architecture of the Velora AI Shopping Assistant.

## Overview

The core application pipeline is designed sequentially as a series of middleware-like steps that execute in `requestPipeline.service.mjs`.

## Request Pipeline Stages

### 01 Context Loader (\`01_contextLoader.mjs\`)
**Purpose**: Loads all necessary session state and memory before processing the request.
- Retrieves `sessionId`, `userState`, `deliverySession`, `pendingOrder`, and shopping contexts.
- Initializes context objects that will be passed through the entire pipeline.

### 02 Conversation Understanding (CUL) (\`02_conversationUnderstanding.mjs\`)
**Purpose**: Acts as the brain to understand user intent, emotion, language, and context from the raw message.
- Uses `conversationUnderstandingPrompt.mjs` with an LLM call.
- Extracts standard entities (city, date, occasion, recipient) and categorizes intents (`search_products`, `general_chat`, etc.).
- Normalizes language detection (e.g., Sinhala mix, Tamil mix, English).

### 03 Workflow Manager (\`03_workflowManager.mjs\`)
**Purpose**: Manages multi-turn conversation states and flow transitions.
- Transitions between different logical flows (e.g., from `general_chat` to `product_search` or `checkout`).
- Handles pausing and resuming contexts.
- Resolves conflicts when users interrupt a flow.

### 04 Reference Engine (\`04_referenceEngine.mjs\`)
**Purpose**: Resolves context based on frontend interactions.
- Validates user input against the currently visible product references or UI states.
- Maps relative queries like "buy this one" to actual product IDs stored in session.

### 05 Pre-Workflow Interceptions (\`05_preWorkflowInterceptions.mjs\`)
**Purpose**: Immediate logic handling before deeper commerce integrations.
- Handles quick fallbacks and checks.
- Normalizes inputs before they hit heavy commerce services.

### 06 Commerce Services (\`06_commerceServices.mjs\`)
**Purpose**: Executes core e-commerce tasks based on the CUL intent.
- Interfaces with catalog searching, product details fetching, delivery checking, and order creation.
- Processes context changes related to shopping decisions (updating active delivery dates, carts, etc.).

### 07 Response Engine (\`07_responseEngine.mjs\`)
**Purpose**: Generates the final output sent to the user.
- For `general_chat`, relies purely on a generated LLM response (guided by `systemPrompt.mjs`).
- For product intents, formats e-commerce data (product grids, tracking cards) and adds conversational text using the LLM.
- Generates fallback messages in case of errors.

## Execution Flow

1. User sends a message via `chat.controller.mjs`.
2. Controller invokes `executePipeline` in `requestPipeline.service.mjs`.
3. The pipeline runs sequentially from step 1 to 7.
4. Response is structured and returned to the client/frontend.

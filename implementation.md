# Velora AI – Frontend to Response Engine Integration Verification

## Objective

The Response Engine has been verified to work correctly during backend testing.

The purpose of this phase is **not** to modify or rewrite the Response Engine.

The objective is to verify that every request coming from the frontend reaches and uses the Response Engine correctly.

This is an integration verification phase only.

Do not change business logic unless a broken integration is confirmed.

---

# Scope

Verify only:

Frontend → API Endpoint → Controller → Workflow Manager → Reference Manager → Response Engine → Runtime Builder → Prompt Builder → Gemini → Frontend

Do not redesign the architecture.

Do not modify prompts.

Do not modify workflow logic.

---

# Phase 1 – Frontend Endpoint Audit

Identify every frontend API endpoint related to chat.

Examples:

* Chat
* Streaming Chat
* Voice Chat
* Product Search
* Product Details
* Delivery
* Checkout

For each endpoint document:

* Frontend file
* Function
* API URL
* HTTP method
* Payload
* Response type (JSON / SSE)

---

# Phase 2 – Backend Route Verification

For every frontend endpoint verify:

Frontend Request

↓

Express Route

↓

Controller

↓

Controller Function

Produce a mapping table.

Example:

Frontend
↓

POST /api/chat

↓

chat.controller.mjs

↓

handleChat()

Repeat for all conversation endpoints.

---

# Phase 3 – Response Engine Usage Verification

For every conversation request verify:

Controller

↓

Workflow Manager

↓

Reference Manager

↓

Response Engine

↓

Runtime Builder

↓

Prompt Builder

↓

Gemini

Determine whether the Response Engine is actually executed.

If it is bypassed:

Report:

* File
* Function
* Reason
* Alternate execution path

---

# Phase 4 – Runtime Logging

Temporarily add structured logs.

Immediately before entering the Response Engine:

```text
=========================
RESPONSE ENGINE ENTRY
=========================

Endpoint:
/api/chat

Controller:
chat.controller

Intent:

Workflow:

Reference:

Calling Response Engine...

=========================
```

Immediately after:

```text
=========================
RESPONSE ENGINE EXIT
=========================

Response Category

Template

Fallback Used

LLM Used

Streaming

Duration

=========================
```

---

# Phase 5 – Frontend Response Verification

Verify the frontend receives the response produced by the Response Engine.

Check:

* Response status
* Streaming events
* Final message
* Rendering

Ensure the frontend is not replacing or reformatting the Response Engine output.

---

# Phase 6 – Streaming Verification

For streaming requests verify:

Frontend

↓

SSE Connection

↓

Response Engine

↓

Gemini Stream

↓

Frontend

Ensure every streamed response originates from the Response Engine.

---

# Phase 7 – Legacy Path Detection

Search the controllers for any direct paths such as:

* Direct Gemini calls
* Direct MCP calls
* Hardcoded responses
* Legacy response builders

Determine whether they bypass the Response Engine.

Produce a report listing:

* File
* Function
* Current execution path
* Recommended integration point

Do not remove legacy code during this phase.

---

# Phase 8 – End-to-End Trace

Trace a single request from the frontend.

Example:

User:

"Show me Samsung smartphones"

Expected execution:

Frontend

↓

POST /api/chat

↓

chat.controller

↓

Conversation Understanding Layer

↓

Decision Builder

↓

Workflow Manager

↓

Reference Manager

↓

Response Engine

↓

Runtime Builder

↓

Prompt Builder

↓

Gemini

↓

Streaming

↓

Frontend

Mark each stage:

✓ Executed

✗ Skipped

⚠ Bypassed

---

# Deliverables

Produce:

1. Frontend endpoint map.
2. Backend route map.
3. Controller execution map.
4. Response Engine usage report.
5. Response Engine bypass report (if any).
6. Streaming execution report.
7. End-to-end request trace.
8. Integration gaps (if found).
9. Required fixes (if any).

---

# Success Criteria

The integration is considered correct only if:

✓ Every frontend chat request reaches the correct backend endpoint.

✓ Every backend controller executes the Response Engine.

✓ No direct response path bypasses the Response Engine.

✓ Streaming responses originate from the Response Engine.

✓ The frontend renders the Response Engine output without modification.

✓ No legacy response generation path overrides the Response Engine.

Do not implement fixes until the complete verification report is finished with runtime evidence.

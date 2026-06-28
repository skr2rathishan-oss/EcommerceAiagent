# Objective

Refactor Velora so there is **one canonical request pipeline**. Remove legacy routing paths and response bypasses while preserving the existing architecture and functionality.

## Target Pipeline

Every user message must follow exactly this execution flow:

User
→ Conversation Understanding Layer (CUL)
→ Workflow Manager
→ Response Engine
→ Reference Engine
→ Commerce Engine / MCP (when required)
→ Controller
→ Frontend

No request should bypass any of these stages unless it is a deliberate infrastructure concern (health checks, diagnostics, etc.).

## Tasks

1. Audit the entire backend for duplicate request pipelines, legacy routing paths, early returns, and bypass logic.
2. Identify every place where a request can skip the canonical pipeline.
3. Remove obsolete routing paths that are no longer part of the current architecture.
4. Remove legacy response generation that bypasses the Response Engine.
5. Ensure both `chat.controller.mjs` and `chatStream.controller.mjs` use the same orchestration logic instead of maintaining separate execution paths.
6. Preserve all current business logic, workflows, MCP integrations, shopping, delivery, ordering, tracking, and conversation memory.
7. Do not rewrite working components. Only eliminate redundant or legacy routing.

## Constraints

* Do not modify API contracts.
* Do not change database schemas.
* Do not rewrite the Workflow Manager.
* Do not rewrite the Response Engine.
* Do not change the Commerce Engine logic.
* Do not introduce new architectures.

## Before Removing Anything

For every pipeline or routing path you believe is obsolete:

* Explain why it is obsolete.
* Show where it is currently used.
* Show what will replace it.
* Confirm that removing it will not break existing workflows.

Do not delete code unless you can prove another active path fully replaces it.

## Deliverables

Produce:

1. A list of all request entry points.
2. A diagram of the final canonical pipeline.
3. A list of removed legacy routing paths.
4. A list of remaining bypasses (if any).
5. Confirmation that every user message now follows the same canonical execution pipeline.

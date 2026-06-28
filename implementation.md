# Phase 1.1 — Complete Response Engine Migration

## Objective

Finish migrating all remaining hardcoded user-facing responses to the existing Response Engine without changing the architecture.

The request pipeline must remain:

User
→ Conversation Understanding Layer
→ Workflow Manager
→ Response Engine
→ Reference Engine
→ Commerce Engine
→ Controller
→ Frontend

Controllers and workflow services must no longer own response wording.

---

## Scope

Only modify the following files:

* chat.controller.mjs
* chatStream.controller.mjs
* deliveryFlowService.mjs
* deliveryRecoveryService.mjs

Do not modify any other modules.

---

## Migration Rules

### Controllers

Controllers must never contain:

* hardcoded response text
* multilingual strings
* greeting text
* delivery prompts
* resume prompts
* cancellation prompts
* payment prompts

Controllers should only:

* collect workflow result
* call Response Engine
* return response

---

### Workflow Services

Workflow services must never return:

```js
{
    message: "...",
    response: "...",
    text: "..."
}
```

Instead they should return semantic results.

Example:

```js
{
    status: "ASK_PHONE_NUMBER",
    workflow: "delivery",
    context: {...}
}
```

The Response Engine converts that status into the final message.

---

### Delivery Recovery

Recovery services should return only recovery states.

Example:

```js
{
    recoveryState: "RESUME_DELIVERY"
}
```

Never generate user-facing sentences.

---

## Response Engine

All wording must be generated through:

* selectResponse(...)
* selectResponseWithFallback(...)

Every migrated response must use an existing response category.

Do not create duplicate templates.

---

## Logging

Temporarily log:

Workflow

↓

Status

↓

Response Category

↓

Template Selected

↓

Fallback Used

↓

Final Response

This is for verification only.

---

## Validation

Search the four files for:

* "message:"
* "response:"
* "Please"
* "Sorry"
* "Could you"
* "Enter"
* "Order"
* "Delivery"
* "return ""

No user-facing strings should remain.

---

## Acceptance Criteria

Complete only when:

✓ chat.controller contains no user-facing text.

✓ chatStream.controller contains no user-facing text.

✓ deliveryFlowService contains no user-facing text.

✓ deliveryRecoveryService contains no user-facing text.

✓ Response Engine is responsible for all delivery/resume/cancel messaging.

✓ Existing workflows remain unchanged.

Do not continue to Shopping Context improvements until this migration is complete.

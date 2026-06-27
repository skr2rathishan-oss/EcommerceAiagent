# Fix Greeting Reset – Previous Shopping Context Still Appears

## Issue

The Workflow Manager correctly transitions to:

```
Greeting
```

However, after saying:

```
Hi
```

the assistant still references the previous shopping conversation.

Example:

```
You mentioned you're looking for a surprise for your mother's birthday...
```

This indicates that workflow reset is incomplete.

---

## Investigation

Trace the complete runtime after:

```
workflowDecision.action = "reset"
```

Determine which component reintroduces the previous shopping context.

Inspect:

* ConversationStateService
* ShoppingContextService
* agent/memoryManager.mjs
* memory.service.mjs
* Runtime Builder
* Prompt Builder

---

## Verify Reset

When workflow action is:

```
reset
```

ensure the following are cleared:

* active shopping context
* resume search context
* pending checkout
* delivery session
* pending confirmation
* workflow context
* temporary conversation context

Do NOT clear:

* user profile
* language preference
* personalization
* long-term memory
* order history

---

## Runtime Builder Audit

Verify Runtime Builder does not inject:

* previous shopping context
* previous search query
* resume state

after a workflow reset.

---

## Prompt Builder Audit

Verify Prompt Builder does not include stale shopping information after a reset.

---

## Logging

After every reset log:

Conversation State

Shopping Context

Workflow Context

Memory Manager

Runtime Context

Prompt Context

Identify exactly which component still contains:

```
mother birthday
```

Report the first component that reintroduces stale context.

Do not modify unrelated logic until the source is identified.

# Implementation Plan – Fix Conversation State & Resume Flow

## Objective

Investigate and resolve incorrect conversation state restoration and shopping session continuation.

The goal is to make Velora behave like a premium shopping concierge by restoring previous shopping sessions **only when the user intends to continue them**.

Current behavior incorrectly resumes previous shopping sessions for unrelated greetings and loses previous search context during continuation.

This is a Conversation State Manager and Response Engine improvement, **not a Prompt OS change**.

---

# Critical Requirements

## Preserve Existing Features

Do NOT remove or rewrite:

* Conversation Understanding Layer
* Decision Builder
* Conversation State Manager
* Response Engine
* Response Library
* Memory System
* MCP Product Search
* Shopping Flow
* Delivery Flow
* Checkout Flow
* Orders
* Tracking
* Voice Mode
* Streaming
* Prompt Operating System

Maintain full backward compatibility.

---

# Current Problems

## Issue 1 — Greeting incorrectly restores shopping context

Example:

User:

```
Vanakkam
```

Current Response:

```
Vanakkam!

We were just looking at chocolates...
```

Expected:

```
Vanakkam!

Welcome to Kapruka.

How can I help you today?
```

Greeting alone should **never** automatically resume an old shopping session.

---

## Issue 2 — Previous search context is lost

Current:

```
We were already looking at earlier.
```

Expected:

```
We were already looking at smartwatches.

Would you like to continue?
```

The Response Engine is attempting to use previous shopping context, but the required variable is empty or missing.

Investigate why the previous search query is not being stored or restored correctly.

---

## Issue 3 — Continue Search uses an empty query

Conversation:

```
User:
Show me smartwatches

↓

AI:
Continue previous search?

↓

User:
A

↓

AI:
No products found.
```

Expected:

```
Continue Previous Search

↓

Retrieve previous query

↓

Search MCP

↓

Return products
```

Current implementation appears to call MCP using an empty or invalid query.

---

# Investigation Phase

## Step 1 — Analyze Conversation State Manager

Inspect:

* Active Shopping Session
* Previous Search Query
* Shopping Context
* Session Memory
* Current Stage

Determine:

* When sessions are created
* When sessions expire
* When sessions are resumed

---

## Step 2 — Analyze Resume Logic

Identify the current resume decision.

Determine why:

```
Greeting

↓

Resume Shopping
```

is occurring.

Resume should only happen when the user explicitly intends to continue.

---

## Step 3 — Add Resume Intent Detection

Introduce a dedicated decision before restoring shopping state.

Expected logic:

```
Incoming Message

↓

Greeting?

↓

YES

↓

Does user explicitly reference previous shopping?

Examples:

continue

same

previous

those

again

last one

resume

↓

YES

Resume Session

↓

NO

Fresh Greeting
```

This decision should occur before the Conversation State Manager restores shopping context.

---

## Step 4 — Analyze Shopping Session Storage

Verify that the following values are correctly stored:

* Previous Search Query
* Product Category
* Filters
* Recipient
* Budget
* Occasion
* Last MCP Query
* Search Timestamp

Ensure they remain available for continuation.

---

## Step 5 — Analyze Continue Search Flow

Current:

```
Continue Search

↓

Empty Query

↓

MCP

↓

0 Products
```

Expected:

```
Continue Search

↓

Restore Previous Query

↓

Validate Query

↓

Search MCP

↓

Products
```

---

## Step 6 — Validate Shopping Context

Before calling MCP verify:

* Previous Search exists
* Query is not empty
* Query is valid
* Shopping session is active

If validation fails:

Do not call MCP.

Instead gracefully ask the customer what they would like to search for.

---

## Step 7 — Session Expiration

Introduce session rules.

Example:

Resume only if:

* Active session exists
* Session not expired
* User intends to continue

Otherwise:

Create a fresh shopping flow.

---

## Step 8 — Greeting Rules

Greeting messages should never automatically restore shopping.

Greeting should:

* Welcome customer
* Introduce Velora
* Offer shopping assistance

Only restore shopping if Resume Intent Detection returns TRUE.

---

## Step 9 — Logging

Temporarily log:

```
Incoming Message

↓

Intent

↓

Resume Intent

↓

Conversation State

↓

Previous Search

↓

Shopping Context

↓

Decision

↓

MCP Query

↓

Gemini Response
```

This should clearly show where incorrect state restoration occurs.

---

# Expected Conversation

Example 1

```
User:
Vanakkam

↓

Greeting

↓

Fresh Greeting

↓

Welcome Message
```

---

Example 2

```
User:
Show me smartwatches

↓

Shopping Search

↓

MCP

↓

Products
```

---

Example 3

```
User:
Continue

↓

Resume Intent

↓

Restore Previous Search

↓

Search MCP

↓

Products
```

---

Example 4

```
User:
Show me flowers

↓

New Search

↓

Replace Previous Search

↓

MCP

↓

Products
```

The new search should replace the previous shopping context instead of continuing an unrelated one.

---

# Validation

Verify:

✓ Greeting

✓ Small Talk

✓ New Shopping Search

✓ Continue Shopping

✓ Previous Search

✓ Session Expiration

✓ Resume Intent

✓ MCP Search

✓ Response Engine

✓ Conversation State

✓ Memory

✓ Streaming

✓ Voice Mode

---

# Completion Criteria

The task is complete only if:

* Greetings no longer resume old shopping sessions.
* Resume occurs only when the user explicitly intends it.
* Previous shopping query is correctly stored and restored.
* Continue Search always uses the correct previous query.
* MCP never receives an empty search query.
* New shopping requests replace previous shopping context appropriately.
* No existing shopping, delivery, checkout, tracking, or voice functionality is broken.

---

# Deliverables

Produce a final report containing:

* Root cause
* Conversation state changes
* Resume logic improvements
* Files modified
* Validation results
* Regression test results
* Confirmation that all existing features remain functional

# Velora Conversation State Manager (VCSM)

# Phase 5 – Intelligent Shopping Context Memory & Conversation Resume

## Implementation Plan

---

# Objective

Implement a **Conversation State Manager** that allows Velora to intelligently manage multiple shopping conversations while preserving an active delivery process.

Instead of treating every user message independently, Velora should understand the user's current activity, previous shopping sessions, and pending orders.

This feature transforms Velora from a chatbot into a true conversational shopping assistant.

---

# Primary Goals

The Conversation State Manager should enable Velora to:

* Remember unfinished shopping searches
* Remember pending orders waiting for confirmation
* Resume previous shopping sessions
* Prevent users from accidentally abandoning an active delivery process
* Allow browsing after an order reaches the confirmation stage
* Restore unfinished conversations after page refresh or login
* Persist conversation state in MongoDB

---

# Overall Architecture

```
User Message
      │
      ▼
Conversation State Manager
      │
      ├── Delivery Session Manager
      ├── Shopping Context Manager
      ├── Pending Order Manager
      ├── Conversation Memory
      └── Intent Router
```

Every incoming message must first pass through the **Conversation State Manager** before reaching the normal intent router.

---

# Phase 1 – MongoDB Conversation Storage

## Objective

Create persistent storage for delivery sessions and shopping contexts.

---

## Collections

### 1. delivery_sessions

Stores delivery-related information.

Example fields:

* session_id
* user_id
* product
* delivery address
* delivery date
* contact details
* delivery fee
* order status
* payment link
* created_at
* updated_at

Status values:

* COLLECTING_ADDRESS
* WAITING_FOR_ADDRESS_CONFIRMATION
* WAITING_FOR_DATE
* CHECKING_DELIVERY
* WAITING_FOR_CONTACT_NAME
* WAITING_FOR_CONTACT_PHONE
* PENDING_CONFIRMATION
* ORDER_CREATED
* PAYMENT_PENDING
* COMPLETED
* CANCELLED

---

### 2. shopping_contexts

Stores unfinished shopping sessions.

Each shopping search becomes one document.

Example:

```
Gaming Laptop Search

Status:
PAUSED
```

Fields:

* context_id
* user_id
* search_query
* category
* filters
* viewed_products
* selected_product
* status
* created_at
* updated_at
* expires_at

Status values:

* ACTIVE
* PAUSED
* RESUMABLE
* COMPLETED
* CANCELLED
* EXPIRED

---

### 3. conversation_state

One document per user.

Purpose:

Store only references to currently active conversations.

Example:

```
{
    active_delivery_session,
    pending_order,
    active_shopping_context,
    paused_contexts:[]
}
```

This becomes the first document loaded whenever the user sends a message.

---

# Phase 2 – Conversation State Manager

Create:

```
conversationStateService.mjs
```

Responsibilities:

* Load user conversation state
* Save state
* Determine active session
* Determine conversation priority
* Route incoming messages

Functions:

```
loadConversationState()

saveConversationState()

getActiveDelivery()

getPendingOrder()

getShoppingContexts()

setActiveShoppingContext()

setPendingOrder()

clearPendingOrder()

clearConversationState()
```

---

# Phase 3 – Shopping Context Manager

Create:

```
shoppingContextService.mjs
```

Responsibilities

* Create shopping contexts
* Pause contexts
* Resume contexts
* Complete contexts
* Remove expired contexts
* Detect duplicate searches

Functions

```
createShoppingContext()

pauseShoppingContext()

resumeShoppingContext()

completeShoppingContext()

expireShoppingContext()

findMatchingContext()

restoreShoppingContext()
```

---

# Phase 4 – Conversation Priority Engine

Every incoming message follows this priority order.

Priority 1

Pending Order Confirmation

↓

Priority 2

Active Delivery Session

↓

Priority 3

Active Shopping Context

↓

Priority 4

Paused Shopping Context

↓

Priority 5

Small Talk / General Questions

Only one priority handles the message.

---

# Phase 5 – Delivery Protection

If delivery is collecting:

* address
* delivery date
* contact name
* phone number

Velora should not allow new shopping.

Example

User:

"Show me laptops."

Velora:

😊 We're almost done with your current order.

Let's finish this first.

If you'd like to cancel it, just let me know and I'll help you search for something else.

---

# Phase 6 – Pending Order Mode

Once the Order Summary has been shown,

Delivery Status becomes:

```
PENDING_CONFIRMATION
```

Conversation lock is removed.

The user can now:

* browse products
* compare products
* ask questions
* continue previous searches
* have normal conversations

The pending order remains safely stored.

---

# Phase 7 – Pending Order Reminder

If the user starts browsing while a pending order exists,

Velora should only remind them once.

Example

😊 By the way, your Chocolate Cake order is still waiting for confirmation.

Whenever you're ready, simply type **Yes** and I'll place the order.

After this reminder,

continue browsing normally.

Do not repeatedly interrupt the user.

---

# Phase 8 – Shopping Context Resume

Whenever a new search arrives,

check MongoDB for matching shopping contexts.

Example

Existing Context

Gaming Laptop

User later types

"Laptop"

Instead of creating another search,

Velora should respond

😊 Welcome back!

We were already looking at Gaming Laptops earlier.

Would you like to:

A. Continue the previous search

B. Start a new search

---

# Phase 9 – Resume Previous Search

If user selects

A

Restore:

* search query
* filters
* viewed products
* selected products

Continue browsing naturally.

---

# Phase 10 – Start New Search

If user selects

B

Close previous shopping context.

Create a brand-new context.

Continue product search.

---

# Phase 11 – Small Talk Handling

Small talk should never destroy shopping contexts.

Examples

* Hi
* Thank you
* Tell me a joke
* What's the weather?
* How are you?

Answer normally.

After answering,

continue the active shopping or delivery session.

---

# Phase 12 – Pending Order Confirmation

If the user types

```
Yes
```

or

```
Y
```

Conversation State Manager checks:

```
Pending Order Exists?
```

YES

↓

Call

```
kapruka_create_order()
```

NO

↓

Treat "Yes" as a normal conversation reply.

---

# Phase 13 – Order Cancellation

If user says

* Cancel order
* Don't place it
* Never mind

Clear:

* pending order
* delivery session

Keep:

* shopping contexts

Example

😊 No worries.

I've cancelled your pending order.

What would you like to do next?

---

# Phase 14 – Context Similarity Detection

Before creating a new shopping context,

compare:

* category
* keywords
* search intent

Examples

Existing

Gaming Laptop

Incoming

Laptop

Gaming ASUS Laptop

Best Laptop for Gaming

These should all match the existing shopping context.

---

# Phase 15 – Context Expiration

Automatically clean old contexts.

Shopping Context

Paused

↓

Expire after

2 Hours

Completed

↓

Delete after

24 Hours

Pending Orders

↓

Keep until

* Order placed
* Cancelled
* Timeout reached

---

# Phase 16 – Browser Refresh Recovery

If user refreshes the application,

load

conversation_state

↓

restore

* pending delivery
* pending order
* paused shopping contexts

Velora should continue naturally without asking the user to start over.

---

# Phase 17 – Cross Device Support

If the same user logs in from another device,

load conversation_state

↓

restore

active delivery

shopping contexts

pending orders

Conversation continues seamlessly.

---

# Backend Components

Create

```
conversationStateService.mjs
```

Create

```
shoppingContextService.mjs
```

Update

```
contextEngine.mjs
```

Update

```
intentRouter.mjs
```

Update

```
chat.controller.mjs
```

---

# Suggested Backend Functions

Conversation State

```
loadConversationState()

saveConversationState()

getHighestPriorityContext()

getPendingOrder()

setPendingOrder()

clearPendingOrder()
```

Shopping Context

```
createContext()

pauseContext()

resumeContext()

completeContext()

expireContext()

findMatchingContext()

restoreContext()
```

---

# Testing Scenarios

Scenario 1

Gaming Laptop Search

↓

Cake Delivery

↓

Pending Order

↓

Browse Watches

↓

Return to Laptop

↓

Resume Prompt Appears

---

Scenario 2

Pending Cake Order

↓

Browse Laptops

↓

Type

Yes

↓

Cake Order Placed

---

Scenario 3

Browser Refresh

↓

Conversation Restored

---

Scenario 4

Login From Another Device

↓

Conversation Restored

---

Scenario 5

Search Same Category Again

↓

Resume Prompt Appears

---

Scenario 6

Small Talk During Shopping

↓

Conversation Continues Normally

↓

Shopping Context Preserved

---

# Definition of Done

✓ Delivery sessions persist in MongoDB.

✓ Shopping contexts persist in MongoDB.

✓ Pending orders survive browser refresh.

✓ Users can browse while an order is waiting for confirmation.

✓ Previous shopping searches can be resumed.

✓ Duplicate shopping contexts are detected.

✓ Resume prompts work correctly.

✓ Conversation state restores after reconnect.

✓ Expired contexts are cleaned automatically.

✓ Conversation State Manager becomes the single source of truth for every incoming user message.

---

# Final Goal

Velora should behave like a real human shopping assistant.

It should remember what the customer was shopping for, safely pause and resume conversations, preserve pending orders, and allow users to move naturally between shopping and checkout without losing progress.

The result is a premium conversational commerce experience that feels intelligent, organized, and personalized while remaining technically scalable and easy to extend.

# Velora Delivery System — Phase 2 Implementation Plan

## Agent Integration + Order Confirmation Flow

## Objective

Integrate the completed **Address Intelligence V1** into Velora’s live delivery agent flow so that:

1. the agent asks for a delivery address
2. the address is cleaned and validated using `addressService.mjs`
3. the user confirms the corrected address
4. the agent collects the delivery date
5. the agent runs `kapruka_check_delivery`
6. if delivery is available, the agent shows a checkout confirmation summary
7. after the user confirms, the agent calls `kapruka_create_order`
8. the user receives the order ID + payment link

This phase connects the address module to the real conversational delivery journey.

---

# Phase 2 Scope

## In Scope

* connect `addressService.mjs` to delivery chat flow
* store confirmed address inside delivery session
* collect delivery date after address confirmation
* run `kapruka_check_delivery(city, delivery_date, product_id)`
* handle delivery available / unavailable branches
* show checkout confirmation message/card
* handle final order confirmation from user
* call `kapruka_create_order`
* show order success + payment link
* preserve delivery session state throughout the flow

## Out of Scope for this phase

Do not add these yet unless already partially built:

* Google address verification improvements
* advanced nearest-city ranking improvements
* gift messages
* occasion intelligence
* recipient intelligence
* bundle builder
* full voice-only checkout confirmation

---

# 1. Delivery Flow We Are Connecting Now

## Target conversational flow

User:
“I want this cake”

Velora:
“Super 😊 Please send me the full delivery address for this order.”

User sends address

↓
Address Intelligence cleans + parses it
↓
Velora shows corrected address
↓
User confirms
↓
Velora asks for delivery date
↓
User gives date
↓
Velora runs delivery check
↓

## If delivery is available:

* show fee
* show perishable warning if needed
* show checkout confirmation
* ask user to place the order
* call `kapruka_create_order`
* show payment link

## If delivery is unavailable:

* go into recovery flow
* alternative dates / nearby cities / alternative products / cancel flow

---

# 2. Delivery Session Schema Update

The delivery session must now store **address-specific fields** in addition to delivery fields.

## Required DeliverySession fields

```ts
type DeliverySession = {
  session_id: string;
  session_version: number;

  state:
    | "IDLE"
    | "WAITING_FOR_ADDRESS"
    | "WAITING_FOR_ADDRESS_CONFIRMATION"
    | "WAITING_FOR_DATE"
    | "CHECKING_DELIVERY"
    | "WAITING_FOR_RECOVERY_CHOICE"
    | "WAITING_FOR_ALTERNATIVE_PRODUCT_SELECTION"
    | "WAITING_FOR_CONFIRMATION"
    | "CREATING_ORDER"
    | "PAYMENT_PENDING"
    | "COMPLETED"
    | "CANCELLED";

  selected_product: {
    product_id: string;
    product_name: string;
    price?: number;
    category?: string;
  } | null;

  raw_address: string | null;
  cleaned_address: string | null;
  normalized_address: string | null;
  address_confidence: number | null;

  house_number: string | null;
  street: string | null;
  area: string | null;
  city: string | null;
  postal_code: string | null;

  delivery_date: string | null;
  delivery_available: boolean | null;
  delivery_fee: number | null;

  alternative_dates: string[];
  nearest_cities: string[];
  alternative_products: Array<any>;

  order_id: string | null;
  payment_link: string | null;

  created_at: string;
  updated_at: string;
};
```

---

# 3. Backend Files to Update

## A) `backend/services/addressService.mjs`

Already completed in Phase 1.

Use it as the address parser/cleaner.

### Function to call

```js
parseAddress(rawAddress)
```

This becomes the main entry point from the delivery agent.

---

## B) `contextEngine.mjs`

Update the delivery session state schema to store:

* raw address
* cleaned address
* normalized address
* confidence
* extracted city
* delivery date
* delivery fee
* order status

Also ensure:

* `session_version` increments on every delivery mutation
* stale async responses are ignored

---

## C) `chat.controller.mjs`

This becomes the main place that routes the conversational delivery flow state by state.

It should now handle:

* `WAITING_FOR_ADDRESS`
* `WAITING_FOR_ADDRESS_CONFIRMATION`
* `WAITING_FOR_DATE`
* `CHECKING_DELIVERY`
* `WAITING_FOR_CONFIRMATION`
* recovery states

---

## D) `deliveryFlowService.mjs` (recommended if not already created)

Create or expand a dedicated service to keep the delivery orchestration logic out of the controller.

Suggested responsibilities:

* start delivery flow
* save parsed address into session
* move between delivery states
* call delivery check
* build checkout summary
* call order creation

---

## E) `order.service.mjs`

Connect final delivery-confirmed session data to `kapruka_create_order`.

This file should:

* build the create order payload
* validate required fields
* call Kapruka create order
* return order ID + payment link

---

# 4. State-by-State Integration Plan

# State 1 — Start Delivery Flow

## Trigger

User selects a product or says:

* “I want this cake”
* “Buy this”
* “Order this”

## Action

Create or update a delivery session.

Set:

```js
state = "WAITING_FOR_ADDRESS"
selected_product = { product_id, product_name, ... }
```

## Agent message

“Super 😊 Please send me the **full delivery address** for this order.

Example: **No 25, Temple Road, Wellawatte, Colombo 06**”

---

# State 2 — Address Input Handling

## When user sends an address

Call:

```js
const parsed = parseAddress(userMessage);
```

## If parsed address is sufficient

Save all parsed fields into session:

* raw_address
* cleaned_address
* normalized_address
* city
* postal_code
* confidence
* house_number
* street
* area

Move to:

```js
state = "WAITING_FOR_ADDRESS_CONFIRMATION"
```

## Agent message

“I found this delivery address 😊

**{normalized_address}**

Is this correct?

**A.** Yes, use this address
**B.** Edit address”

---

## If parsed address is insufficient

Stay in:

```js
state = "WAITING_FOR_ADDRESS"
```

## Agent message

“Aiyoo 😅 I need a little more detail for the delivery address.

Please send:

* house/building number
* road / street
* area
* city

Example: **No 14, Hospital Road, Jaffna**”

---

# State 3 — Address Confirmation

## If user selects A / confirms

Move to:

```js
state = "WAITING_FOR_DATE"
```

## Agent message

“Perfect 😊 When would you like it delivered?”

---

## If user selects B / wants to edit

Clear address-related fields if needed and move back to:

```js
state = "WAITING_FOR_ADDRESS"
```

## Agent message

“No problem 👍 Please send the correct delivery address.”

---

# State 4 — Delivery Date Collection

## Accept user date input

Examples:

* today
* tomorrow
* Friday
* June 30
* next Sunday

Normalize it into ISO date format.

Save:

```js
delivery_date = normalizedDate
state = "CHECKING_DELIVERY"
```

---

# State 5 — Run Delivery Check

Use the **confirmed city** from the parsed address.

Call:

```js
kapruka_check_delivery({
  city: session.city,
  delivery_date: session.delivery_date,
  product_id: session.selected_product.product_id
})
```

---

# State 6 — Delivery Available Flow

If delivery is available:

Save:

* `delivery_available = true`
* `delivery_fee = returned fee`

## Agent message

“✅ Good news! This item can be delivered.

📍 **{city}**
📅 **{delivery_date_human}**
🚚 **Delivery Fee: LKR {fee}**”

---

## Perishable product rule

If selected product category is:

* cake
* flowers
* combo

Show:

“⚠️ This is a perishable item. Please make sure someone is available to receive it on the delivery date.”

---

## Next action

Move to:

```js
state = "WAITING_FOR_CONFIRMATION"
```

Then show the checkout confirmation summary.

---

# State 7 — Checkout Confirmation

## Build checkout summary using confirmed delivery data

### Required fields to show

* product name
* full confirmed address
* city
* delivery date
* delivery fee
* perishable warning if applicable

## Agent message example

“🎉 Everything is ready!

**Product:** Chocolate Cake
**Deliver To:** No 25, Temple Road, Wellawatte, Colombo 06
**Delivery Date:** June 30
**Delivery Fee:** LKR 350

Would you like me to place the order?

**A.** Yes, place order
**B.** Cancel”

---

# State 8 — Final User Confirmation

## If user selects A

Move to:

```js
state = "CREATING_ORDER"
```

Call `kapruka_create_order`.

## If user selects B

Move to:

```js
state = "CANCELLED"
```

Send cancel flow message.

---

# State 9 — Create Order

Build the order payload from the **confirmed delivery session**.

## Required payload structure

```json
{
  "items": [
    {
      "product_id": "CAKE123",
      "quantity": 1
    }
  ],
  "recipient_name": "Customer Name",
  "delivery_address": "No 25, Temple Road, Wellawatte, Colombo 06",
  "delivery_city": "Colombo",
  "delivery_date": "2026-06-30",
  "contact_phone": "07XXXXXXXX"
}
```

### Important mapping rule

Use:

* `normalized_address` → `delivery_address`
* `city` → `delivery_city`
* `delivery_date` → `delivery_date`

Do **not** rebuild the address from scratch during order creation. Use the already confirmed normalized address.

---

# State 10 — Order Success Response

If `kapruka_create_order` succeeds:

Save:

* `order_id`
* `payment_link`
* `state = "PAYMENT_PENDING"`

## Agent message

“🎉 Your order is ready!

**Order ID:** {order_id}
**Delivery To:** {normalized_address}
**Delivery Date:** {delivery_date_human}

Here’s your payment link:
{payment_link}”

---

# State 11 — Order Error Handling

If create order fails:

Do not lose the delivery session.

Keep:

* confirmed address
* city
* date
* selected product

## Agent message

“Sorry 😔 I couldn’t create the order right now.

Your delivery details are still saved.

Would you like me to try again?”

Possible options:

* retry order creation
* cancel
* go back to delivery flow

---

# 5. Frontend Work for This Phase

## A) `ChatInterface.tsx`

Render:

* address confirmation messages
* delivery success messages
* checkout confirmation messages
* order success messages

---

## B) `DeliveryActionButtons.tsx`

Use this component for:

### Address confirmation

* A = Yes, use this address
* B = Edit address

### Checkout confirmation

* A = Yes, place order
* B = Cancel

---

## C) `AppContext.tsx`

Store the latest delivery session snapshot from backend for UI rendering convenience only.

Backend remains the source of truth.

---

# 6. Message Types to Return from Backend

To keep frontend rendering clean, backend should return structured message types.

Recommended message types for this phase:

* `delivery_address_request`
* `delivery_address_confirmation`
* `delivery_date_request`
* `delivery_success`
* `checkout_confirmation`
* `order_success`
* `delivery_error`

---

# 7. Suggested Integration Functions

## In `deliveryFlowService.mjs`

```js
startDeliveryFlow(product, userContext)
handleAddressInput(session, rawAddress)
handleAddressConfirmation(session, userChoice)
handleDateInput(session, rawDate)
runDeliveryCheck(session)
buildCheckoutConfirmation(session)
confirmAndCreateOrder(session)
```

---

# 8. Test Plan for Phase 2

## Test 1 — Happy path

1. select product
2. enter messy address
3. system normalizes it
4. confirm address
5. enter delivery date
6. delivery available
7. confirm order
8. create order success
9. payment link shown

---

## Test 2 — Bad address then corrected address

1. select product
2. enter vague address
3. system asks for more detail
4. enter proper address
5. continue normally

---

## Test 3 — Address confirmation edit loop

1. enter address
2. system normalizes it
3. user selects “Edit address”
4. re-enter correct address
5. continue flow

---

## Test 4 — Order creation failure

1. complete full delivery flow
2. simulate `kapruka_create_order` failure
3. ensure session is preserved
4. retry works

---

# 9. Implementation Order

## Milestone 1

Connect `addressService.parseAddress()` into the delivery chat flow.

## Milestone 2

Implement:

* `WAITING_FOR_ADDRESS`
* `WAITING_FOR_ADDRESS_CONFIRMATION`
* `WAITING_FOR_DATE`

## Milestone 3

Run `kapruka_check_delivery` using parsed city + delivery date.

## Milestone 4

Implement delivery success response + perishable warning.

## Milestone 5

Implement checkout confirmation summary.

## Milestone 6

Connect `kapruka_create_order`.

## Milestone 7

Implement order success / order failure handling.

---

# 10. Definition of Done

Phase 2 is complete only if:

* the agent asks for the full delivery address
* `addressService` cleans and parses the address
* the agent shows the corrected address for confirmation
* the user can confirm or edit the address
* the agent collects delivery date after address confirmation
* `kapruka_check_delivery` runs using the extracted city
* delivery fee is shown if available
* perishable warning appears when needed
* checkout confirmation is shown using the confirmed address
* final order confirmation triggers `kapruka_create_order`
* order ID + payment link are shown on success
* order creation failure does not destroy the delivery session

---

# Final Goal of Phase 2

By the end of this phase, Velora should support a full conversational delivery flow like this:

**User:** I want this cake
**Velora:** Please send the delivery address
**User:** no25 temple rd wellawatte col 6
**Velora:** I found this address — No 25, Temple Road, Wellawatte, Colombo 06. Is this correct?
**User:** Yes
**Velora:** When would you like it delivered?
**User:** Tomorrow
**Velora:** Good news! This can be delivered. Delivery fee is LKR 350. Would you like me to place the order?
**User:** Yes
**Velora:** Your order is ready. Here’s your payment link.

That will be the first complete **address-to-order conversational delivery experience** for Velora.

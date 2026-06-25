# Velora Delivery System — Phase 3 Implementation Plan

## Contact Details Collection + Final Order Summary + Manual Order Confirmation

## Objective

Extend the current delivery flow so that **after address and delivery date are confirmed and delivery availability is successful**, Velora will:

1. collect the **contact name**
2. collect the **phone number**
3. validate both fields
4. generate a **full order summary**
5. ask the user to manually confirm the order by replying **Yes / Y**
6. place the order only after explicit confirmation
7. handle **No / Cancel** gracefully in Sri Lankan conversational style

This phase turns the delivery flow into a complete **address → date → delivery check → customer details → order summary → confirmation → order creation** journey.

---

# 1. Final Flow for This Phase

## Target happy path

User selects a product
↓
Velora asks for delivery address
↓
Address Intelligence cleans + confirms address
↓
Velora asks for delivery date
↓
Velora runs `kapruka_check_delivery`
↓
Delivery available
↓
Velora asks for **contact name**
↓
Velora asks for **phone number**
↓
Velora shows **full order summary**
↓
Velora asks user to reply **Yes / Y** to confirm
↓
User sends **Yes**
↓
Velora calls `kapruka_create_order`
↓
Velora shows order success + payment link

---

# 2. Scope of Phase 3

## In Scope

* collect contact name after successful delivery check
* collect contact phone number after contact name
* validate Sri Lankan mobile numbers
* store customer details in delivery session
* build a final order summary using:

  * product
  * confirmed address
  * delivery date
  * delivery fee
  * contact name
  * phone number
* ask for explicit confirmation via text reply:

  * Yes / Y
* create order only after confirmation
* handle “No” / cancel gracefully

## Out of Scope

Do not add these in this phase:

* gift messages
* recipient intelligence
* occasion flow
* multiple quantities / cart logic
* payment status polling
* edit specific order fields from summary screen
* advanced OTP / phone verification

---

# 3. Updated Delivery Session Schema

Add customer details + final confirmation state to the delivery session.

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
    | "WAITING_FOR_CONTACT_NAME"
    | "WAITING_FOR_CONTACT_PHONE"
    | "WAITING_FOR_FINAL_ORDER_CONFIRMATION"
    | "CREATING_ORDER"
    | "PAYMENT_PENDING"
    | "COMPLETED"
    | "CANCELLED"
    | "WAITING_FOR_RECOVERY_CHOICE";

  selected_product: {
    product_id: string;
    product_name: string;
    price?: number;
    category?: string;
    quantity?: number;
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

  contact_name: string | null;
  contact_phone: string | null;

  order_summary_text: string | null;

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

# 4. New Delivery States for This Phase

Add these new states:

## `WAITING_FOR_CONTACT_NAME`

Used after successful delivery validation.

## `WAITING_FOR_CONTACT_PHONE`

Used after valid contact name is collected.

## `WAITING_FOR_FINAL_ORDER_CONFIRMATION`

Used after order summary is shown and Velora is waiting for:

* Yes
* Y
* No
* Cancel

---

# 5. Backend Files to Update

## A) `chat.controller.mjs`

Add new state handling for:

* `WAITING_FOR_CONTACT_NAME`
* `WAITING_FOR_CONTACT_PHONE`
* `WAITING_FOR_FINAL_ORDER_CONFIRMATION`

This file will intercept the user’s reply at each stage and route it correctly.

---

## B) `deliveryFlowService.mjs`

Add new functions for contact collection and final confirmation flow.

Suggested functions:

```js
handleContactNameInput(session, rawName)
handleContactPhoneInput(session, rawPhone)
buildOrderSummary(session)
handleFinalOrderConfirmation(session, userReply)
confirmAndCreateOrder(session)
```

---

## C) `order.service.mjs`

Update the create-order payload mapping so it uses:

* confirmed normalized delivery address
* confirmed city
* confirmed delivery date
* contact name
* contact phone

This service should remain the only place that maps Velora session data into Kapruka’s order payload format.

---

# 6. Phase 3 State-by-State Flow

# State 1 — Delivery Success → Ask Contact Name

## Trigger

Delivery address is confirmed
AND delivery date is confirmed
AND `kapruka_check_delivery` returned success

## Action

Move session to:

```js
state = "WAITING_FOR_CONTACT_NAME"
```

## Agent message

Use Sri Lankan-style friendly tone:

### English Sri Lankan style

“Good news 🎉 Delivery is available for this item.

Now I just need the **contact name** for the order 😊
Please send the name of the person we should contact for delivery.”

### Sinhala mixed

“Hari hari 🎉 me item eka deliver karanna puluwan.

Dan mata **contact name eka** one order eka complete karanna 😊
Delivery ekata contact karanna ona nama danna please.”

### Tamil mixed

“Super 🎉 indha item-ku delivery panna mudiyum.

Ippo order complete panna **contact name** venum 😊
Delivery-ku contact panna vendiya name anuppunga.”

---

# State 2 — Contact Name Input

## Input expected

A normal human name.

Examples:

* Nimal Perera
* A. Yogathas
* Kiruthika
* M. Sivanesan

## Validation rules

For V1 keep it simple:

### Accept if:

* trimmed length >= 2
* not purely numeric
* not obviously invalid like:

  * `12345`
  * `----`
  * empty string

### If valid

Save:

```js
contact_name = cleanedName
state = "WAITING_FOR_CONTACT_PHONE"
```

Then ask for phone number.

---

## If invalid

Stay in:

```js
state = "WAITING_FOR_CONTACT_NAME"
```

## Agent message

“Aiyoo 😅 that doesn’t look like a valid contact name.

Please send the **name of the person receiving the delivery**.
Example: **Nimal Perera**”

---

# State 3 — Ask Contact Phone Number

## Agent message

### English Sri Lankan style

“Perfect 😊 Now send me the **contact phone number** for the delivery.

Example: **0771234567**”

### Sinhala mixed

“Perfect 😊 dan **contact phone number eka** danna.

Example: **0771234567**”

### Tamil mixed

“Seri 😊 ippo **contact phone number** anuppunga.

Example: **0771234567**”

---

# State 4 — Contact Phone Input

## Validation goal

Accept valid Sri Lankan mobile numbers.

### Accept these formats in V1

* `0771234567`
* `0712345678`
* `+94771234567`
* `94771234567`

### Normalize into one internal format

Recommended normalized format:

```text
0771234567
```

---

# 7. Phone Validation Rules

Create a helper:

```js
normalizeSriLankanPhoneNumber(rawPhone)
```

## Rules

1. Remove spaces, hyphens, parentheses
2. Convert:

   * `+94771234567` → `0771234567`
   * `94771234567` → `0771234567`
3. Accept only Sri Lankan mobile patterns such as:

```regex
^0(70|71|72|74|75|76|77|78)\d{7}$
```

You can extend later if needed.

---

## If phone is valid

Save:

```js
contact_phone = normalizedPhone
state = "WAITING_FOR_FINAL_ORDER_CONFIRMATION"
```

Then build and send the order summary.

---

## If phone is invalid

Stay in:

```js
state = "WAITING_FOR_CONTACT_PHONE"
```

## Agent message

“Aiyoo 😅 that phone number doesn’t look right.

Please send a valid Sri Lankan mobile number like:
**0771234567**”

---

# 8. Build Final Order Summary

After contact name + phone are valid, generate the final order summary.

## Summary must include

### Product details

* product name
* quantity (default 1 if single-item flow)

### Delivery details

* full confirmed normalized address
* delivery city
* delivery date
* delivery fee

### Customer contact details

* contact name
* phone number

---

# 9. Final Order Summary Message Format

## English Sri Lankan style

“🎉 Everything is ready machan / 😊

Here’s your order summary — please check it once before I place the order 👇

**Product:** {product_name}
**Delivery Address:** {normalized_address}
**Delivery City:** {city}
**Delivery Date:** {delivery_date_human}
**Delivery Fee:** LKR {delivery_fee}
**Contact Name:** {contact_name}
**Phone Number:** {contact_phone}

If everything looks good, just reply with **Yes** or **Y** and I’ll place the order for you.

If you don’t want to continue, reply **No**.”

---

## Sinhala mixed style

“🎉 Hari hari, okkoma ready 😊

Me order summary eka poddak check karala balanna 👇

**Product:** {product_name}
**Delivery Address:** {normalized_address}
**Delivery City:** {city}
**Delivery Date:** {delivery_date_human}
**Delivery Fee:** LKR {delivery_fee}
**Contact Name:** {contact_name}
**Phone Number:** {contact_phone}

Okkoma hari nam **Yes** hari **Y** hari reply karanna — mama order eka place karannam.

Continue karanna epa nam **No** kiyanna.”

---

## Tamil mixed style

“🎉 Super, ellam ready 😊

Order summary oru thadava check pannunga 👇

**Product:** {product_name}
**Delivery Address:** {normalized_address}
**Delivery City:** {city}
**Delivery Date:** {delivery_date_human}
**Delivery Fee:** LKR {delivery_fee}
**Contact Name:** {contact_name}
**Phone Number:** {contact_phone}

Ellam correct-na **Yes** illa **Y** nu reply pannunga — naan order place pannuren.

Continue panna vendaam-na **No** nu sollunga.”

---

# 10. Final Confirmation Input Rules

When state = `WAITING_FOR_FINAL_ORDER_CONFIRMATION`

## Accept as confirmation

* `yes`
* `y`
* `Yes`
* `Y`
* `yes machan`
* `hari`
* `ow`

For V1, I recommend handling at least:

* yes
* y
* no

You can add Sinhala/Tamil local confirmations later.

---

## If user confirms with Yes / Y

Move to:

```js
state = "CREATING_ORDER"
```

Then call `kapruka_create_order`.

---

## If user says No

Do **not** place the order.

Move to a cancel / correction response.

---

# 11. “No” / Cancel Response Behavior

If user replies **No**, Velora should respond politely and keep the conversation alive.

## Suggested behavior

For Phase 3, keep it simple:

### Agent message — English Sri Lankan style

“No worries 😊 I haven’t placed the order yet.

If you want, I can help you with one of these:

**A.** Change the delivery details
**B.** Start over with another product”

---

### Sinhala mixed

“Awulak ne 😊 mama thama order eka place kale ne.

Oyata ona nam me deken ekak karamu:

**A.** Delivery details wenas karamu
**B.** Aluthin wena product ekak balamu”

---

### Tamil mixed

“Parava illa 😊 naan innum order place pannala.

Neenga venumna idhula onnu pannalaam:

**A.** Delivery details maathalaam
**B.** Pudusa vera product paakalaam”

---

# 12. Recommended No/Cancel Routing

## If user chooses A after No

Go back to the delivery flow at the appropriate point.

### Minimum recommended behavior

Restart from:

```js
state = "WAITING_FOR_ADDRESS"
```

if you want the simplest implementation.

### Better behavior

Ask what they want to change:

* address
* date
* phone number

That can be a later improvement.

---

## If user chooses B after No

Clear the delivery session and return to product search / browsing flow.

---

# 13. Create Order Payload for This Phase

When user confirms Yes / Y, build the order payload using the already confirmed session data.

## Required payload structure

```json
{
  "items": [
    {
      "product_id": "CAKE123",
      "quantity": 1
    }
  ],
  "recipient_name": "Nimal Perera",
  "delivery_address": "No 25, Temple Road, Wellawatte, Colombo 06",
  "delivery_city": "Colombo",
  "delivery_date": "2026-06-30",
  "contact_phone": "0771234567"
}
```

### Mapping rules

* `recipient_name` ← `contact_name`
* `delivery_address` ← `normalized_address`
* `delivery_city` ← `city`
* `delivery_date` ← `delivery_date`
* `contact_phone` ← `contact_phone`

---

# 14. Order Success Message

If `kapruka_create_order` succeeds:

Save:

* `order_id`
* `payment_link`
* `state = "PAYMENT_PENDING"`

## Agent message — English Sri Lankan style

“🎉 Order eka ready!

**Order ID:** {order_id}
**Product:** {product_name}
**Delivery To:** {normalized_address}
**Delivery Date:** {delivery_date_human}

Here’s your payment link 👇
{payment_link}”

---

# 15. Order Error Handling

If order creation fails:

Do not destroy the delivery session.

Keep:

* address
* date
* contact name
* contact phone
* selected product

## Agent message

“Sorry 😔 I couldn’t place the order right now.

But don’t worry — your details are still saved.
If you want, send **Yes** again and I’ll retry the order.”

---

# 16. Backend Functions to Add

## In `deliveryFlowService.mjs`

```js
handleContactNameInput(session, rawName)
handleContactPhoneInput(session, rawPhone)
normalizeSriLankanPhoneNumber(rawPhone)
buildOrderSummary(session)
handleFinalOrderConfirmation(session, userReply)
confirmAndCreateOrder(session)
```

---

# 17. `chat.controller.mjs` Updates

Add state handlers for:

* `WAITING_FOR_CONTACT_NAME`
* `WAITING_FOR_CONTACT_PHONE`
* `WAITING_FOR_FINAL_ORDER_CONFIRMATION`

Flow logic:

## After successful delivery check

→ ask contact name

## After valid name

→ ask phone

## After valid phone

→ send order summary + ask for Yes/Y

## If Yes

→ create order

## If No

→ send change/restart options

---

# 18. Frontend Work for This Phase

## `ChatInterface.tsx`

Render:

* contact name request message
* phone request message
* final order summary card/message
* final confirmation prompt
* order success message

## Optional improvement

Create an `OrderSummaryCard.tsx` component to render the final summary cleanly inside chat.

---

# 19. Test Plan for Phase 3

## Test 1 — Happy path

1. product selected
2. address confirmed
3. date confirmed
4. delivery available
5. enter valid contact name
6. enter valid phone number
7. summary shown
8. user sends Yes
9. order created successfully

---

## Test 2 — Invalid contact name

1. delivery success
2. user sends invalid name like `1234`
3. system rejects and asks again
4. user sends valid name
5. flow continues

---

## Test 3 — Invalid phone number

1. valid name entered
2. user sends invalid phone
3. system rejects and asks again
4. user sends valid Sri Lankan mobile
5. summary shown

---

## Test 4 — User says No at summary stage

1. summary shown
2. user replies No
3. order is not created
4. change/restart options shown

---

## Test 5 — Order creation failure

1. full summary confirmed with Yes
2. create order fails
3. session remains intact
4. retry is possible

---

# 20. Implementation Order

## Milestone 1

Add new session fields:

* `contact_name`
* `contact_phone`
* `order_summary_text`

Add new states:

* `WAITING_FOR_CONTACT_NAME`
* `WAITING_FOR_CONTACT_PHONE`
* `WAITING_FOR_FINAL_ORDER_CONFIRMATION`

---

## Milestone 2

Implement contact name collection + validation.

---

## Milestone 3

Implement phone number normalization + validation.

---

## Milestone 4

Build final order summary generator.

---

## Milestone 5

Implement Yes / Y / No final confirmation logic.

---

## Milestone 6

Connect `kapruka_create_order` using the confirmed session data.

---

## Milestone 7

Implement order success / failure responses.

---

# 21. Definition of Done

Phase 3 is complete only if:

* after delivery availability success, Velora asks for contact name
* valid contact name is stored in session
* Velora asks for contact phone number
* Sri Lankan mobile number validation works
* Velora shows a full order summary with all client details
* Velora explicitly asks the user to reply **Yes / Y** to confirm
* order is created only after Yes / Y
* if user says No, order is not created and Velora offers next actions
* order success returns order ID + payment link
* order creation failure does not destroy the session

---

# Final Goal of Phase 3

By the end of this phase, Velora should support this complete conversational order flow:

**User:** I want this cake
**Velora:** Please send the delivery address
**User:** no25 temple rd wellawatte col 6
**Velora:** I found this address — No 25, Temple Road, Wellawatte, Colombo 06. Is this correct?
**User:** Yes
**Velora:** When would you like it delivered?
**User:** Tomorrow
**Velora:** Good news! Delivery is available. What’s the contact name for this order?
**User:** Nimal Perera
**Velora:** Great 😊 Now send the contact phone number.
**User:** 0771234567
**Velora:** Here’s your order summary. If everything looks good, reply Yes or Y to place the order.
**User:** Yes
**Velora:** Your order is ready. Here’s your payment link.

That will complete the first full **address → delivery check → customer details → manual order confirmation → order creation** journey for Velora.

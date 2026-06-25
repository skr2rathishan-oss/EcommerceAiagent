# Velora Delivery Intelligence System (Finalized Implementation Plan)

## Objective

Replace the traditional delivery form with a fully conversational delivery experience.

Velora should:

* Collect delivery details naturally through chat
* Validate delivery availability using Kapruka MCP
* Recover intelligently when delivery is unavailable
* Guide users to checkout
* Maintain session state reliably
* Never leave users at a dead end

---

# Phase 1 - Delivery Session Management

## Session Schema

Single source of truth for all delivery operations.

{
session_id,

selected_products: [],

city,

delivery_date,

delivery_available,

delivery_fee,

alternative_dates: [],

nearest_cities: [],

alternative_products: [],

order_status,

payment_link,

session_version,

created_at,

updated_at
}

No feature may maintain separate state.

---

## Session States

ACTIVE

WAITING_FOR_CITY

WAITING_FOR_DATE

WAITING_FOR_DELIVERY_CHECK

WAITING_FOR_CONFIRMATION

PAYMENT_PENDING

COMPLETED

EXPIRED

---

## Session Expiration

Soft TTL:
24 Hours

Hard TTL:
7 Days

---

## Resume Session Flow

If user returns:

"👋 Welcome back.

I found an unfinished order.

🎂 Chocolate Cake
📍 Colombo
📅 June 30

Would you like to continue?"

---

# Phase 2 - Default Address Detection

When user selects a product:

Example:

"🎂 Great choice!

Should I deliver this to your default address in Colombo?

✅ Use my address
📍 Deliver somewhere else"

If user confirms:

Use default city.

If user chooses another location:

Ask:

"Which city would you like it delivered to?"

Store city in session.

---

# Phase 3 - Delivery Date Collection

After city confirmation:

Ask:

"When would you like it delivered?"

Support:

* Today
* Tomorrow
* June 30
* Friday
* Next Sunday

Convert all dates into ISO format.

Store delivery_date in session.

---

# Phase 4 - Concurrency Protection

Problem:

User may send multiple messages before MCP responds.

Example:

"Deliver to Jaffna"

Then:

"Actually Kilinochchi"

---

Solution

Use:

session_version

Every session update:

session_version += 1

Rule:

Only latest version can modify session.

Discard stale MCP responses automatically.

---

# Phase 5 - MCP Delivery Validation

Call:

kapruka_check_delivery

Parameters:

{
city,
delivery_date,
product_id
}

Store response in session.

---

# Phase 6 - Successful Delivery Flow

If available:

Show:

"✅ Good news!

This item can be delivered.

📍 Colombo
📅 June 30
🚚 Delivery Fee: LKR 350"

Update:

delivery_available = true

delivery_fee = returned_fee

---

# Phase 7 - Perishable Product Handling

Applicable:

* Cakes
* Flowers
* Gift Combos

Display:

"⚠️ This is a perishable item.

Please ensure someone is available to receive it on the selected delivery date."

---

# Phase 8 - Alternative Date Recovery

If delivery is unavailable:

Never stop immediately.

Check:

* Previous day
* Next day
* Additional nearby dates

Return maximum 3 alternatives.

Example:

"😔 Sorry, this item isn't available on June 30.

However, I found nearby available delivery dates:

📅 June 29
📅 July 1

Would either of these work?"

Store results in:

alternative_dates

---

# Phase 9 - Nearest City Recovery

If delivery still unavailable:

Use:

Google Geocoding API

Google Distance Matrix API

Process:

1. Convert user city to coordinates
2. Get supported delivery cities
3. Calculate distances
4. Sort ascending
5. Return top 3 nearest cities

Store in:

nearest_cities

---

## Response Example

"😔 Sorry, this item cannot be delivered to Pallai.

However, I found nearby delivery locations:

📍 Jaffna
📍 Kilinochchi
📍 Vavuniya

Would you like me to check one of these instead?"

---

# Phase 10 - Google Maps Fallback

If Google API fails:

Use local supported city list.

Example:

[
Colombo,
Jaffna,
Kandy,
Galle,
Kurunegala
]

Show:

"😔 I couldn't calculate nearby locations right now.

Here are some commonly supported delivery cities:

📍 Colombo
📍 Jaffna
📍 Kandy"

Never block the conversation.

---

# Phase 11 - Alternative Product Recovery

If both city and date fail:

Search for alternative products.

Similarity Rules:

Priority 1:
Same Category

Cake → Cake

Flowers → Flowers

Chocolate → Chocolate

Priority 2:
Price Range ±20%

Priority 3:
Popularity / Best Sellers

Return:

Maximum 3 products.

Example:

"😔 This cake isn't available for delivery.

But don't worry 😊

I found similar cakes that can be delivered:

🎂 Chocolate Celebration Cake
🎂 Black Forest Cake
🎂 Red Velvet Cake"

Store results in:

alternative_products

---

# Phase 12 - Checkout Confirmation

Only after successful delivery validation.

Display:

"🎉 Everything is ready!

🎂 Chocolate Cake

📍 Colombo

📅 June 30

🚚 Delivery Fee: LKR 350

Would you like me to place the order?"

Explicit user confirmation required.

Never auto-create orders.

---

# Phase 13 - Order Creation Contract

Call:

create_order

Required Payload:

{
items: [
{
product_id,
quantity
}
],

recipient_name,

delivery_address,

delivery_city,

delivery_date,

contact_phone
}

---

# Phase 14 - Order Creation Error Handling

Handle:

1. Missing Delivery City
2. Missing Delivery Date
3. Product Out Of Stock
4. Payment Link Generation Failure
5. Order Creation Failure

Recovery Example:

"😔 I couldn't create the order right now.

Your delivery details have been saved.

Would you like me to try again?"

Never lose session state.

---

# Phase 15 - Conversational Personality

Delivery interactions must feel human.

Examples:

"Aiyoo 😔 looks like this item isn't available for that city."

"No worries 😊 let me find another option for you."

"Good news 🎉 I found a nearby delivery location."

Rules:

* Avoid robotic responses
* Avoid technical error messages
* Always provide a next step
* Always offer a solution

---

# Final Delivery Flow

Product Selected
↓
Default Address Detection
↓
Collect City
↓
Collect Delivery Date
↓
MCP Delivery Check
↓
Delivery Available?

YES
↓
Show Delivery Fee
↓
Perishable Warning
↓
Checkout Confirmation
↓
Create Order
↓
Payment Link

NO
↓
Alternative Dates
↓
Nearest Cities
↓
Alternative Products
↓
Continue Shopping

Success Condition:

The user can complete the entire delivery journey through conversation without ever interacting with a traditional delivery form.

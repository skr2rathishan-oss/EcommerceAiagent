# Velora Voice Assistant Mode — Complete UI/UX Prompt

Design a premium AI Voice Assistant experience for Velora, an AI-powered shopping assistant. The voice experience should feel similar to ChatGPT Voice Mode, Apple Siri, and Perplexity Voice, but optimized for e-commerce shopping conversations.

---

## Main Goal

When the user clicks the Voice Chat button from the main chat interface, open a dedicated Voice Assistant Dashboard.

This is NOT a speech-to-text input box.

This is a real conversational voice experience.

The user should never type messages while in Voice Mode.

Speech should automatically become messages and appear in the conversation history.

---

# Dashboard Layout

Use a clean full-screen overlay.

Background:

* Dark premium gradient
* Glassmorphism panels
* Soft blur effects
* Modern AI aesthetic

Color Palette:

* Primary: #6D4AFF
* Secondary: #8A63FF
* Accent: #B39DFF
* Background: #0B0F19
* Surface: rgba(255,255,255,0.08)

---

# Top Section

Height: 10%

Centered horizontally.

Display:

Velora Avatar

Status Text:

Possible states:

* Ready to help
* Listening...
* Processing...
* Speaking...
* Searching products...
* Finding the perfect gift...

Typography:

* Modern
* Semi-bold
* White text
* Clean spacing

---

# Middle Section

Height: 70%

This is the conversation area.

Display recent conversation history.

Show only latest 4–5 exchanges.

Example:

User:
"Find flowers for my girlfriend"

Velora:
"What is your budget?"

User:
"Under Rs. 5000"

Velora:
"I found several beautiful romantic flower arrangements."

Messages should appear as floating glass cards.

User messages:

* Right aligned
* Purple accent

Assistant messages:

* Left aligned
* Glass card style

Animations:

* Smooth fade-in
* Slide-up appearance
* Auto-scroll to newest message

The conversation history should remain visible throughout the entire voice session.

---

# Bottom Voice Dock

Height: 20%

Fixed bottom center.

The microphone must stay anchored at the bottom center of the screen.

Never place a giant microphone in the center.

---

## Voice Waveform

Position:
Above microphone.

Width:
120px–180px

Behavior:

Idle:

* Gentle movement

Listening:

* Audio reactive
* Real-time waveform animation

Processing:

* Slow pulse animation

Speaking:

* Dynamic AI speech animation

---

## Status Indicator

Position:
Above waveform

Examples:

"Tap to speak"

"Listening..."

"Processing your request..."

"Velora is speaking..."

Small subtle text.

---

# Main Microphone Button

Position:
Bottom center

Desktop Size:
44px × 44px

Mobile Size:
48px × 48px

Style:

* Circular
* Glassmorphism
* Soft shadow
* Minimal design
* Floating appearance

Do NOT make it oversized.

The mic should be elegant and subtle.

---

# Microphone States

## Idle

Display:
Small microphone icon

Animation:

* Soft breathing effect

Status:
"Tap to speak"

---

## Listening

When user taps microphone:

Status:
"Listening..."

Effects:

* Thin animated ring
* Waveform reacts to speech

Microphone size remains unchanged.

Do NOT enlarge the button.

---

## Processing

When speech ends:

Actions:

1. Stop listening
2. Convert speech to text
3. Automatically send message to backend

Status:
"Processing..."

Mic:

* Small spinner animation

No manual send button.

---

## Speaking

When AI response arrives:

Status:
"Velora is speaking..."

Actions:

1. Display AI response
2. Read response aloud automatically

Waveform:

* Reacts to AI speech

User can interrupt at any time.

---

# Voice Conversation Flow

Step 1:
User clicks Voice Chat.

Step 2:
Voice Dashboard opens with animation.

Step 3:
User taps microphone.

Step 4:
Speech recognition starts.

Step 5:
User speaks naturally.

Example:

"I need a birthday gift for my girlfriend under five thousand rupees."

Step 6:
Speech recognition ends.

Step 7:
Transcript is automatically converted into a User Message.

IMPORTANT:
Do NOT insert transcript into chat input.

Create a real chat message directly.

Step 8:
Send message to backend.

Step 9:
Display loading state.

Step 10:
Receive AI response.

Step 11:
Display AI response card.

Step 12:
Read response aloud.

Step 13:
Continue conversation naturally.

---

# Shopping Experience

Voice Mode must support:

* Product Search
* Gift Recommendations
* Product Details
* Cart Management
* Delivery Questions
* Order Tracking

Examples:

User:
"Find birthday gifts for my girlfriend."

User:
"Show flowers under Rs. 5000."

User:
"Add the first one to my cart."

User:
"When can this be delivered?"

All interactions should work using voice only.

---

# Product Display

When products are returned:

Show horizontal product cards inside conversation area.

Each card includes:

* Product Image
* Product Name
* Price
* Rating
* Quick Add Button

Cards should animate into view.

---

# Bottom Controls

Below microphone:

Small icon buttons only.

[ Mute ]

[ Speaker ]

[ End Voice Session ]

Keep controls minimal.

---

# Exit Voice Mode

When user clicks End Voice Session:

Actions:

* Stop speech recognition
* Stop AI speech
* Close dashboard
* Return to main chat

Conversation history remains saved.

---

# UX Rules

✅ Microphone always stays at bottom center

✅ Mic size remains small

✅ Conversation remains visible

✅ Waveform provides feedback

✅ User speech automatically becomes a message

✅ AI responses automatically appear

✅ AI automatically speaks responses

✅ User can interrupt AI at any time

✅ Premium, modern, polished experience

❌ No typing required

❌ No transcript inserted into input box

❌ No giant microphone

❌ No old-style assistant UI

❌ No clutter

Goal:
Create a world-class AI shopping voice assistant that feels premium, conversational, modern, and worthy of winning the Kapruka Agent Challenge.

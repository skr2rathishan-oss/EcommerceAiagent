The Google Speech-to-Text integration is already working.

Current status:

✅ Voice Dashboard UI completed
✅ Audio recording using MediaRecorder
✅ Audio upload to backend working
✅ Google Cloud Speech-to-Text working
✅ Transcript successfully generated
✅ Transcript visible in backend logs

Now implement the next stage of the voice pipeline.

GOAL:

When Speech-to-Text returns a transcript, the transcript must automatically behave exactly like a normal text message typed by the user.

Requirements:

1. Find the existing text chat message flow.
   Examples:

   * handleSendMessage()
   * sendMessage()
   * onSendMessage()
   * chatService.send()
   * whichever function is currently used when the user presses the normal Send button.

2. DO NOT create a separate AI flow for voice.

3. After transcription completes:

```javascript
const transcript = result.text;
```

Immediately pass the transcript into the existing chat flow.

Example:

```javascript
await handleSendMessage(transcript);
```

or the equivalent existing function.

4. Voice messages and typed messages must share the exact same pipeline:

Voice
→ Speech To Text
→ Existing Chat Flow
→ Intent Detection
→ Context Extraction
→ Product Search / MCP Tools
→ AI Response

Typed Message
→ Existing Chat Flow
→ Intent Detection
→ Context Extraction
→ Product Search / MCP Tools
→ AI Response

5. Automatically create and display the user message in the conversation history.

Example:

User speaks:
"Show flowers under 5000"

Conversation should immediately show:

👤 Show flowers under 5000

before waiting for the AI response.

6. The Voice Dashboard conversation area must display the same messages as the main chat screen.

Use the existing message state/store/context instead of creating a second conversation state.

7. When the AI response arrives:

Display it inside the Voice Dashboard conversation.

Example:

🤖 Here are some beautiful flower arrangements under Rs. 5000.

8. Add detailed console logs:

[VOICE] Transcript received
[VOICE] Creating user message
[VOICE] Sending transcript to chat pipeline
[VOICE] Waiting for AI response
[VOICE] AI response received

9. Do not modify existing intent detection, context extraction, MCP integration, or chat logic.

Only connect the voice transcript to the existing message flow.

10. After implementation verify this complete flow:

User speaks
→ Audio recorded
→ STT transcript generated
→ User message created
→ Existing chat function called
→ AI response generated
→ AI response displayed in Voice Dashboard

Provide all modified files and explain every change made.

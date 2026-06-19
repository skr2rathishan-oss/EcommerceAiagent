Implement Continuous Voice Conversation Mode for Velora.

Current state:

✅ User speaks
✅ Speech-to-Text works
✅ Transcript sent to AI
✅ AI responds
✅ Text-to-Speech works

New requirement:

After Velora finishes speaking, automatically start listening again.

The user should not need to press the microphone button every turn.

Desired conversation flow:

1. User opens Voice Mode

2. Voice Mode automatically starts listening

State:
Listening

3. User speaks

4. Detect silence/end of speech

5. Stop recording

6. Send audio to Speech-to-Text

7. Generate transcript

8. Send transcript to existing chat pipeline

9. Receive AI response

10. Display AI response

11. Velora speaks response using Text-to-Speech

12. When speech finishes:

Automatically restart listening

13. Repeat forever until user exits Voice Mode.

---

State Machine:

IDLE
↓
LISTENING
↓
PROCESSING
↓
SPEAKING
↓
LISTENING
↓
PROCESSING
↓
SPEAKING
↓
LISTENING

Loop continuously.

---

Implementation Requirements

Create:

```javascript
startListening()
stopListening()
processVoiceMessage()
speakResponse()
```

---

When TTS starts:

```javascript
setVoiceState("speaking");
```

---

When TTS ends:

```javascript
setVoiceState("listening");
startListening();
```

Example:

```javascript
utterance.onend = () => {
  console.log("[VOICE] AI finished speaking");

  setVoiceState("listening");

  startListening();
};
```

---

When user manually exits Voice Mode:

```javascript
voiceSessionActive = false;
```

Prevent automatic restart.

Example:

```javascript
if (!voiceSessionActive) {
  return;
}

startListening();
```

---

Interrupt Handling

If user taps microphone while Velora is speaking:

```javascript
speechSynthesis.cancel();
```

Immediately:

```javascript
setVoiceState("listening");
startListening();
```

---

Voice Status Labels

Listening...
Processing...
Speaking...
Ready

---

Waveform Behavior

Listening:
Audio-reactive waveform

Processing:
Loading animation

Speaking:
Speech waveform animation

---

Logs

[VOICE] Listening started
[VOICE] Speech detected
[VOICE] Processing transcript
[VOICE] AI response received
[VOICE] Speaking response
[VOICE] Speech finished
[VOICE] Restarting listening

---

Goal:

The user should be able to have a natural continuous conversation with Velora without pressing the microphone after every message.

Voice Mode should behave similarly to ChatGPT Voice Mode and modern AI voice assistants.
add an delay before restart
import mongoose from "mongoose";

const conversationStateSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  active_delivery_session: {
    type: String,
    default: null
  },
  pending_order: {
    type: String,
    default: null
  },
  active_shopping_context: {
    type: String,
    default: null
  },
  paused_contexts: {
    type: [String],
    default: []
  },
  activeFlow: {
    type: { type: String, default: "general_chat" },
    status: { type: String, default: "active" },
    currentStep: { type: String, default: "browsing" }
  },
  pausedFlows: {
    type: [mongoose.Schema.Types.Mixed],
    default: []
  },
  shopping: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  delivery: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  order: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  preferences: {
    language: { type: String, default: "english" }
  },
  preferredLanguage: {
    type: String,
    default: "english"
  },
  lastDetectedLanguage: {
    type: String,
    default: "english"
  },
  languageConfidence: {
    type: Number,
    default: 1.0
  },
  consecutiveMessagesInSameLanguage: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

const ConversationState = mongoose.models.ConversationState || mongoose.model("ConversationState", conversationStateSchema);
export default ConversationState;

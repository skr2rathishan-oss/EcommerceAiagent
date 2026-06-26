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
  }
}, {
  timestamps: true
});

const ConversationState = mongoose.models.ConversationState || mongoose.model("ConversationState", conversationStateSchema);
export default ConversationState;

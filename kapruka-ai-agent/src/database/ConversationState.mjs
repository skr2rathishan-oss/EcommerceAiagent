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
  personalityState: {
    type: String,
    default: "standard"
  },
  shoppingMission: {
    id: { type: String, default: null },
    status: { type: String, default: null },
    occasion: { type: String, default: null },
    recipient: { type: String, default: null },
    budget: { type: Number, default: null },
    remainingBudget: { type: Number, default: null },
    currency: { type: String, default: "LKR" },
    categories: { type: [String], default: [] },
    missionItems: { type: [mongoose.Schema.Types.Mixed], default: [] },
    selectedProducts: { type: [mongoose.Schema.Types.Mixed], default: [] },
    productGroups: { type: mongoose.Schema.Types.Mixed, default: {} },
    currentStep: { type: String, default: null },
    createdAt: { type: Date, default: null }
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
  },
  workflowContext: {
    currentWorkflow: { type: String, default: "idle" },
    previousWorkflow: { type: String, default: "idle" },
    lastTransition: { type: String, default: null },
    workflowStartedAt: { type: Date, default: null },
    awaitingConfirmation: { type: Boolean, default: false },
    waitingForPhoneNumber: { type: Boolean, default: false },
    waitingForDelivery: { type: Boolean, default: false },
    waitingForPayment: { type: Boolean, default: false },
    resumeSearch: { type: Boolean, default: false },
    previousSearchQuery: { type: String, default: null },
    canInterrupt: { type: Boolean, default: true },
    canResume: { type: Boolean, default: false },
    lastResetAt: { type: Date, default: null }
  },
  currentWorkflow: { type: String, default: "idle" },
  previousWorkflow: { type: String, default: "idle" },
  lastTransition: { type: String, default: null },
  workflowStartedAt: { type: Date, default: null },
  awaitingConfirmation: { type: Boolean, default: false },
  waitingForPhoneNumber: { type: Boolean, default: false },
  waitingForDelivery: { type: Boolean, default: false },
  waitingForPayment: { type: Boolean, default: false },
  resumeSearch: { type: Boolean, default: false },
  previousSearchQuery: { type: String, default: null },
  canInterrupt: { type: Boolean, default: true },
  canResume: { type: Boolean, default: false }
}, {
  timestamps: true
});

const ConversationState = mongoose.models.ConversationState || mongoose.model("ConversationState", conversationStateSchema);
export default ConversationState;

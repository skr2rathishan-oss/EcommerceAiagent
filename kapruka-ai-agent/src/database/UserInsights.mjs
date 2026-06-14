import mongoose from "mongoose";

const userInsightsSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  topCategories: {
    type: [String],
    default: []
  },
  averageBudget: {
    type: Number,
    default: null
  },
  topRecipient: {
    type: String,
    default: null
  },
  topOccasion: {
    type: String,
    default: null
  },
  shoppingStyle: {
    type: String,
    default: null
  },
  confidence: {
    type: Number,
    default: 0
  },
  generatedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  version: {
    type: Number,
    default: 1
  }
}, {
  timestamps: { createdAt: false, updatedAt: false }
});

const UserInsights = mongoose.models.UserInsights || mongoose.model("UserInsights", userInsightsSchema);

export default UserInsights;

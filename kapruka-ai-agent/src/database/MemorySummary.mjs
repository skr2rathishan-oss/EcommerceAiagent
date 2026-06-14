import mongoose from "mongoose";

const memorySummarySchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  currentSummary: {
    type: String,
    default: ""
  },
  previousSummary: {
    type: String,
    default: ""
  },
  olderSummary: {
    type: String,
    default: ""
  },
  version: {
    type: Number,
    default: 0
  },
  lastSummarizedMessageCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: { createdAt: false, updatedAt: true }
});

const MemorySummary = mongoose.models.MemorySummary || mongoose.model("MemorySummary", memorySummarySchema);

export default MemorySummary;

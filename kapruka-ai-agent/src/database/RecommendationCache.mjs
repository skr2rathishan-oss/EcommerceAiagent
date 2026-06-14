import mongoose from "mongoose";

const recommendationCacheSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  recommendationProfile: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  generatedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 } // Automatic expiration at the exact Date value specified
  }
}, {
  timestamps: false
});

const RecommendationCache = mongoose.models.RecommendationCache || mongoose.model("RecommendationCache", recommendationCacheSchema);

export default RecommendationCache;

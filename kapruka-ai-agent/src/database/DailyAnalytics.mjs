import mongoose from "mongoose";

const topItemSchema = new mongoose.Schema({
  name:  { type: String, required: true },
  count: { type: Number, required: true }
}, { _id: false });

const topProductSchema = new mongoose.Schema({
  productId:   { type: String, required: true },
  productName: { type: String, required: true },
  count:       { type: Number, required: true }
}, { _id: false });

const dailyAnalyticsSchema = new mongoose.Schema({
  // UTC calendar date — business key, one doc per day
  date: {
    type: String,   // "YYYY-MM-DD"
    required: true,
    unique: true,
    index: true
  },
  totalUsers: {
    type: Number,
    default: 0
  },
  totalSessions: {
    type: Number,
    default: 0
  },
  totalSearches: {
    type: Number,
    default: 0
  },
  totalPurchases: {
    type: Number,
    default: 0
  },
  topCategories: {
    type: [topItemSchema],
    default: []
  },
  topProducts: {
    type: [topProductSchema],
    default: []
  },
  averageOrderValue: {
    type: Number,
    default: null
  },
  generatedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: { createdAt: false, updatedAt: false }
});

const DailyAnalytics = mongoose.models.DailyAnalytics || mongoose.model("DailyAnalytics", dailyAnalyticsSchema);

export default DailyAnalytics;

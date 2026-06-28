import mongoose from "mongoose";

const shoppingContextSchema = new mongoose.Schema({
  contextId: {
    type: String,
    required: true,
    unique: true
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  searchQuery: {
    type: String,
    default: ""
  },
  category: {
    type: String,
    default: ""
  },
  filters: {
    type: Object,
    default: {}
  },
  viewedProducts: {
    type: [Object],
    default: []
  },
  lastSearchResults: {
    type: [Object],
    default: []
  },
  selectedProduct: {
    type: Object,
    default: null
  },
  status: {
    type: String,
    enum: ["ACTIVE", "PAUSED", "RESUMABLE", "COMPLETED", "CANCELLED", "EXPIRED"],
    default: "ACTIVE"
  },
  expiresAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

const ShoppingContext = mongoose.models.ShoppingContext || mongoose.model("ShoppingContext", shoppingContextSchema);
export default ShoppingContext;

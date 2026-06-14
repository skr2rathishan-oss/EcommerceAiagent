import mongoose from "mongoose";

const productInteractionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  productId: {
    type: String,
    required: true,
    index: true
  },
  productName: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: ["view", "details", "add_to_cart", "purchase"],
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Compound indexes for optimization
productInteractionSchema.index({ sessionId: 1, action: 1 });
productInteractionSchema.index({ sessionId: 1, productId: 1 });

const ProductInteraction = mongoose.models.ProductInteraction || mongoose.model("ProductInteraction", productInteractionSchema);

export default ProductInteraction;

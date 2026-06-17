import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  orderRef: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  orderNumber: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  status: {
    type: String,
    default: "pending"
  },
  recipient: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true }
  },
  items: [{
    productId: { type: String, required: true },
    name: { type: String, required: true },
    image: { type: String },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    currency: { type: String, default: "LKR" }
  }],
  summary: {
    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    currency: { type: String, default: "LKR" }
  },
  checkoutUrl: {
    type: String
  },
  paymentStatus: {
    type: String,
    default: "unpaid" // unpaid, paid, failed
  },
  giftMessage: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: { createdAt: false, updatedAt: true }
});

const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);

export default Order;

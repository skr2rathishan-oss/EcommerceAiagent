import mongoose from "mongoose";

const deliverySessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  selected_products: {
    type: [Object],
    default: []
  },
  city: {
    type: String,
    default: null
  },
  delivery_date: {
    type: String,
    default: null
  },
  delivery_available: {
    type: Boolean,
    default: null
  },
  delivery_fee: {
    type: Number,
    default: null
  },
  alternative_dates: {
    type: [String],
    default: []
  },
  nearest_cities: {
    type: [String],
    default: []
  },
  alternative_products: {
    type: [Object],
    default: []
  },
  order_status: {
    type: String,
    enum: ["ACTIVE", "WAITING_FOR_CITY", "WAITING_FOR_DATE", "WAITING_FOR_DELIVERY_CHECK", "WAITING_FOR_CONFIRMATION", "PAYMENT_PENDING", "COMPLETED", "EXPIRED"],
    default: "ACTIVE"
  },
  payment_link: {
    type: String,
    default: null
  },
  session_version: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true // Adds created_at and updated_at
});

// Soft TTL: 24 Hours. Using index on updatedAt
deliverySessionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 86400 });

const DeliverySession = mongoose.models.DeliverySession || mongoose.model("DeliverySession", deliverySessionSchema);

export default DeliverySession;

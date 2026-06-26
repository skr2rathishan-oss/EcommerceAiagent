import mongoose from "mongoose";

const deliverySessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  state: {
    type: String,
    enum: [
      "IDLE",
      "WAITING_FOR_ADDRESS",
      "WAITING_FOR_ADDRESS_CONFIRMATION",
      "WAITING_FOR_DATE",
      "CHECKING_DELIVERY",
      "WAITING_FOR_RECOVERY_CHOICE",
      "WAITING_FOR_ALTERNATIVE_PRODUCT_SELECTION",
      "WAITING_FOR_CONFIRMATION",
      "CREATING_ORDER",
      "PAYMENT_PENDING",
      "COMPLETED",
      "CANCELLED",
      "WAITING_FOR_CONTACT_NAME",
      "WAITING_FOR_CONTACT_PHONE",
      "WAITING_FOR_FINAL_ORDER_CONFIRMATION",
      "WAITING_FOR_CANCEL_CHOICE",
      "COLLECTING_ADDRESS",
      "PENDING_CONFIRMATION",
      "ORDER_CREATED"
    ],
    default: "IDLE"
  },
  selected_product: {
    type: Object,
    default: null
  },
  raw_address: {
    type: String,
    default: null
  },
  cleaned_address: {
    type: String,
    default: null
  },
  normalized_address: {
    type: String,
    default: null
  },
  address_confidence: {
    type: Number,
    default: null
  },
  house_number: {
    type: String,
    default: null
  },
  street: {
    type: String,
    default: null
  },
  area: {
    type: String,
    default: null
  },
  city: {
    type: String,
    default: null
  },
  postal_code: {
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
  order_id: {
    type: String,
    default: null
  },
  payment_link: {
    type: String,
    default: null
  },
  contact_name: {
    type: String,
    default: null
  },
  contact_phone: {
    type: String,
    default: null
  },
  order_summary_text: {
    type: String,
    default: null
  },
  session_version: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Soft TTL: 24 Hours. Using index on updatedAt
deliverySessionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 86400 });

const DeliverySession = mongoose.models.DeliverySession || mongoose.model("DeliverySession", deliverySessionSchema);

export default DeliverySession;

import mongoose from "mongoose";

const userProfileSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  favoriteCategories: {
    type: [String],
    default: []
  },
  favoriteRecipients: {
    type: [String],
    default: []
  },
  favoriteOccasions: {
    type: [String],
    default: []
  },
  deliveryCities: {
    type: [String],
    default: []
  },
  averageBudget: {
    type: Number,
    default: null
  },
  interactionScores: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  addresses: [{
    label: { type: String, default: "Home" }, // Home, Office, Other
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    province: { type: String, default: "" },
    postalCode: { type: String, default: "" },
    isDefault: { type: Boolean, default: false }
  }]
}, {
  timestamps: { createdAt: false, updatedAt: true }
});

const UserProfile = mongoose.models.UserProfile || mongoose.model("UserProfile", userProfileSchema);

export default UserProfile;

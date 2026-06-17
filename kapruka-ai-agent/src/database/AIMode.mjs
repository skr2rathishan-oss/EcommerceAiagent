import mongoose from "mongoose";

// ─────────────────────────────────────────────────────────────────────────────
// AIMode — persists the admin-selected AI environment mode in MongoDB.
//
// A single document (keyed by settingKey: "global") stores the active mode.
// The admin API reads/writes this document to survive server restarts.
// ─────────────────────────────────────────────────────────────────────────────

const AIModeSchema = new mongoose.Schema(
  {
    settingKey: {
      type:    String,
      default: "global",
      unique:  true,
      index:   true,
    },
    mode: {
      type:    String,
      enum:    ["development", "staging", "production"],
      default: "development",
    },
    updatedBy: {
      type:    String,
      default: "system",
    },
  },
  { timestamps: true }
);

const AIMode = mongoose.model("AIMode", AIModeSchema);

export default AIMode;

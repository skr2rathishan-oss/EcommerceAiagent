import mongoose from "mongoose";
import "../config/loadEnv.mjs";

async function queryMongo() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  const Conversation = mongoose.model("Conversation", new mongoose.Schema({}, { strict: false }), "conversations");
  const allConvs = await Conversation.find({}).sort({ updatedAt: -1 }).limit(5).lean();
  console.log("=== LATEST 5 CONVERSATIONS ===");
  allConvs.forEach(c => {
    console.log(`SessionId: ${c.sessionId} | UpdatedAt: ${c.updatedAt}`);
    c.messages.forEach((msg, idx) => {
      console.log(`  [${idx}] ${msg.role}: "${msg.content ? msg.content.substring(0, 150) : ""}"`);
    });
  });

  await mongoose.disconnect();
}

queryMongo().catch(console.error);

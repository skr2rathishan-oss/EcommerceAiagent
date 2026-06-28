import { processRequest } from "../services/core/requestPipeline.service.mjs";
import { saveMessage } from "../services/memory/conversation.service.mjs";
import { addMessage } from "../services/memory/chatMemory.service.mjs";
export const chat = async (req, res) => {
  return processRequest(req, res, false);
};

export const saveLocalMessage = async (req, res) => {
  try {
    const { role, content } = req.body;
    const sessionId = req.headers["x-session-id"] || req.body.sessionId || "default";

    if (!role || !content) {
      return res.status(400).json({ success: false, message: "Role and content are required." });
    }

    // 1. Save to MongoDB
    await saveMessage(sessionId, role, content);

    // 2. Save to cache
    await addMessage(sessionId, role, content);

    return res.json({ success: true });
  } catch (error) {
    console.error("Failed to save local message:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
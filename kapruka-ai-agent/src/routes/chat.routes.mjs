import express from "express";
import { chat, saveLocalMessage } from "../controllers/chat.controller.mjs";
import { chatStream } from "../controllers/chatStream.controller.mjs";
import { chatLimiter } from "../middleware/rateLimiter.mjs";
import { validate, chatSchema } from "../middleware/validation.mjs";
import { optionalAuth } from "../middleware/auth.mjs";

const router = express.Router();

const handleChatRequest = (req, res, next) => {
  if (process.env.ENABLE_STREAMING === "true") {
    return chatStream(req, res, next);
  } else {
    return chat(req, res, next);
  }
};

router.post("/", chatLimiter, validate(chatSchema), optionalAuth, handleChatRequest);
router.post("/message", optionalAuth, saveLocalMessage);

export default router;
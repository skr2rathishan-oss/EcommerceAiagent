import express from "express";
import { chat, saveLocalMessage } from "../controllers/chat.controller.mjs";
import { chatLimiter } from "../middleware/rateLimiter.mjs";
import { validate, chatSchema } from "../middleware/validation.mjs";
import { optionalAuth } from "../middleware/auth.mjs";

const router = express.Router();

router.post("/", chatLimiter, validate(chatSchema), optionalAuth, chat);
router.post("/message", optionalAuth, saveLocalMessage);

export default router;
import express from "express";
import { getAIMode, setAIMode, resetAIMode } from "../controllers/admin.controller.mjs";
import { adminLimiter } from "../middleware/rateLimiter.mjs";

const router = express.Router();

router.use(adminLimiter);

// GET  /api/admin/ai-mode       → current mode & model summary
router.get("/ai-mode", getAIMode);

// POST /api/admin/ai-mode       → switch mode  { mode: "development"|"staging"|"production" }
router.post("/ai-mode", setAIMode);

// POST /api/admin/ai-mode/reset → revert to .env AI_MODE
router.post("/ai-mode/reset", resetAIMode);

export default router;

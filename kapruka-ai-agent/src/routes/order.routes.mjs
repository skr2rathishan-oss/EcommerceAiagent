import express from "express";
import { handleCreateOrder } from "../controllers/order.controller.mjs";
import { optionalAuth } from "../middleware/auth.mjs";
import { orderLimiter } from "../middleware/rateLimiter.mjs";

const router = express.Router();

router.post("/create", orderLimiter, optionalAuth, handleCreateOrder);

export default router;

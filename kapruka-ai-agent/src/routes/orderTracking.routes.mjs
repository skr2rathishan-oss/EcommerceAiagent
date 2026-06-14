import { Router } from "express";
import { getOrderTracking } from "../controllers/orderTracking.controller.mjs";
import { trackingLimiter } from "../middleware/rateLimiter.mjs";
import { validate, orderTrackingSchema } from "../middleware/validation.mjs";
import { optionalAuth } from "../middleware/auth.mjs";

const router = Router();

router.post("/track", trackingLimiter, validate(orderTrackingSchema), optionalAuth, getOrderTracking);

export default router;

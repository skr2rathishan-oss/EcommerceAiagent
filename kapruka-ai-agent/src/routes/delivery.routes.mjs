import express from "express";
import { checkDeliveryAvailability } from "../controllers/delivery.controller.mjs";
import { deliveryLimiter } from "../middleware/rateLimiter.mjs";
import { validate, deliveryCheckSchema } from "../middleware/validation.mjs";
import { optionalAuth } from "../middleware/auth.mjs";

const router = express.Router();

router.post("/check", deliveryLimiter, validate(deliveryCheckSchema), optionalAuth, checkDeliveryAvailability);

export default router;

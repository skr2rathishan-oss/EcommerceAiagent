import express from "express";
import { checkDeliveryAvailability, getAddressesHandler, saveAddressHandler, checkDeliveryHandler, nearestAreaHandler } from "../controllers/delivery.controller.mjs";
import { deliveryLimiter } from "../middleware/rateLimiter.mjs";
import { validate, deliveryCheckSchema } from "../middleware/validation.mjs";
import { optionalAuth } from "../middleware/auth.mjs";

const router = express.Router();

router.post("/check", deliveryLimiter, validate(deliveryCheckSchema), optionalAuth, checkDeliveryAvailability);

// Concierge Endpoints
router.get("/concierge/addresses/:sessionId", optionalAuth, getAddressesHandler);
router.post("/concierge/addresses/:sessionId", optionalAuth, saveAddressHandler);
router.post("/concierge/check", optionalAuth, checkDeliveryHandler);
router.post("/concierge/nearest", optionalAuth, nearestAreaHandler);

export default router;

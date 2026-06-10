import express from "express";
import { checkDeliveryAvailability } from "../controllers/delivery.controller.mjs";

const router = express.Router();

router.post("/check", checkDeliveryAvailability);

export default router;

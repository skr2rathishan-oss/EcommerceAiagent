import { Router } from "express";
import { getOrderTracking } from "../controllers/orderTracking.controller.mjs";

const router = Router();

router.post("/track", getOrderTracking);

export default router;

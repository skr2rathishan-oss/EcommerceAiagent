import express from "express";
import { getProduct, trackInteractionController } from "../controllers/products.controller.mjs";

const router = express.Router();

router.get("/:id", getProduct);
router.post("/interaction", trackInteractionController);

export default router;

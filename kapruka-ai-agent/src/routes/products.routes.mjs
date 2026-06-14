import express from "express";
import { getProduct, trackInteractionController } from "../controllers/products.controller.mjs";
import { validate, productDetailsSchema, productInteractionSchema } from "../middleware/validation.mjs";
import { optionalAuth } from "../middleware/auth.mjs";

const router = express.Router();

router.get("/:id", validate(productDetailsSchema), optionalAuth, getProduct);
router.post("/interaction", validate(productInteractionSchema), optionalAuth, trackInteractionController);

export default router;

import express from "express";
import { 
  getProduct, 
  getRecommendationsController, 
  trackInteractionController,
  getSearchStrategyController,
  getSearchProductsController,
  rankProductsController,
  generateRecommendationsController
} from "../controllers/products.controller.mjs";
import { validate, productDetailsSchema, productInteractionSchema } from "../middleware/validation.mjs";
import { optionalAuth } from "../middleware/auth.mjs";

const router = express.Router();

router.get("/recommendations", optionalAuth, getRecommendationsController);
router.post("/recommendations/strategy", optionalAuth, getSearchStrategyController);
router.post("/recommendations/search", optionalAuth, getSearchProductsController);
router.post("/recommendations/rank", optionalAuth, rankProductsController);
router.post("/recommendations/generate", optionalAuth, generateRecommendationsController);
router.get("/:id", validate(productDetailsSchema), optionalAuth, getProduct);
router.post("/interaction", validate(productInteractionSchema), optionalAuth, trackInteractionController);

export default router;

import express from "express";
import { getProduct } from "../controllers/products.controller.mjs";

const router = express.Router();

router.get("/:id", getProduct);

export default router;

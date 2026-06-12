import dotenv from "dotenv";
import { detectIntent } from "../services/llm.service.mjs";

dotenv.config();

const result = await detectIntent(
  "Show me birthday cakes under 5000 rupees"
);

console.log(result);
import { detectIntent } from "./src/services/ai/llm.service.mjs";

const test = async () => {
  try {
    const raw = await detectIntent("My mother is sick in the hospital, need something to show support");
    console.log("Raw Intent Detection Response:");
    console.log(raw);
  } catch (err) {
    console.error("Failed:", err);
  }
};

test();

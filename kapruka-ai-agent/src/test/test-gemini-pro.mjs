import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION || "us-central1",
});

async function main() {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-pro",
    contents: `
You are Velora, an AI shopping assistant for Kapruka.

User: Vanakkam.
User: I'm looking for a laptop around Rs.100000.
User: Compare HP and ASUS.
User: Recommend the best one.
`,
  });

  console.log("==================================");
  console.log("Gemini 2.5 Pro");
  console.log("==================================");
  console.log(response.text);
}

main().catch(console.error);
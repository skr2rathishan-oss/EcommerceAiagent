import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  vertexai: true,
  project: "project-2896d4c4-62e9-4e3f-bac",
  location: "global",
});

async function main() {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: "Recommend a birthday gift for my mother under Rs.5000."
    });

    console.log(response.text);
  } catch (error) {
    console.error(error);
  }
}

main();
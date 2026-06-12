import { detectIntent, chatWithLLM } from "../services/llm.service.mjs";
import { routeIntent } from "../agent/intentRouter.mjs";

export const chat = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== "string" || message.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Message is required and must be a non-empty string."
      });
    }

    let intentResult;
    let parsedIntent = { intent: "general_chat", parameters: {} };

    try {
      intentResult = await detectIntent(message);
      console.log("Intent Result:", intentResult);
      parsedIntent = JSON.parse(intentResult);
    } catch (parseErr) {
      console.warn("Failed to parse intent JSON, falling back to general chat:", parseErr);
      parsedIntent = { intent: "general_chat", parameters: {} };
    }

    let result;
    if (parsedIntent.intent === "general_chat") {
      result = await chatWithLLM(message);
    } else {
      result = await routeIntent(
        parsedIntent.intent,
        parsedIntent.parameters
      );
    }
    console.log("Final Result:", result);

    if (result && typeof result === "object" && result.error) {
      return res.status(500).json({
        success: false,
        message: result.message
      });
    }

    // Format the response correctly for the frontend:
    // 1. If result is an array (e.g. products list from search_products), return it directly
    if (Array.isArray(result)) {
      return res.json(result);
    }

    // 2. If result is a structured object with a type (e.g. order_tracking), return it directly
    if (result && typeof result === "object" && result.type) {
      return res.json(result);
    }

    // 3. If result is a string, wrap it in a text response structure for the frontend
    if (typeof result === "string") {
      return res.json({
        type: "text",
        text: result
      });
    }

    return res.json(result);

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
};
import { suggestAlternativeLocations } from "../integration/googleMapsService.mjs";
import { getDeliveryModel, callGeminiSingleTurn, withTimeout } from "../ai/modelRouter.mjs";
import { getProductDetails, searchProducts } from "../integration/mcp.service.mjs";
import logger from "../../utils/logger.mjs";

export const findAlternativeLocations = async (city) => {
  return await suggestAlternativeLocations(city);
};

export const findAlternativeDates = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextDay = new Date();
  nextDay.setDate(nextDay.getDate() + 2);
  
  return [
    { label: "Tomorrow", date: tomorrow.toISOString().split("T")[0] },
    { label: "Next Day", date: nextDay.toISOString().split("T")[0] }
  ];
};

export const findAlternativeProducts = async (productId) => {
  let query = "gift";
  if (productId) {
    try {
      const details = await getProductDetails(productId);
      if (details) {
        query = details.category || details.name.split(" ")[0] || "gift";
      }
    } catch (err) {
      logger.error(`[DELIVERY RECOVERY] Failed to load product details: ${err.message}`);
    }
  }

  try {
    const products = await searchProducts(query);
    return products.filter(p => p.id !== productId).slice(0, 4);
  } catch (err) {
    logger.error(`[DELIVERY RECOVERY] Search failed: ${err.message}`);
    return [];
  }
};

export const handleDeliveryFailure = async (city, date, productId) => {
  logger.info("[DELIVERY] Recovery Flow Started");
  console.log("[DELIVERY] Recovery Flow Started");

  // Step 1: Find alternative geolocated cities supported by Kapruka
  const altCities = await findAlternativeLocations(city);
  logger.info("[DELIVERY] Alternative Locations Suggested", { altCities });
  console.log("[DELIVERY] Alternative Locations Suggested");

  // Get product name if possible
  let productName = "this item";
  if (productId) {
    try {
      const details = await getProductDetails(productId);
      if (details) productName = details.name;
    } catch {}
  }

  // Step 2: Use Llama model to draft a solution-oriented natural message
  let textResponse = "";
  try {
    const { client: activeClient, model, provider } = getDeliveryModel();
    const systemPrompt = "You are Velora's premium AI shopping concierge.";
    const userPrompt = `You are Velora's premium AI shopping concierge.
We failed to deliver "${productName}" to "${city}" on ${date}.
We found these nearby deliverable cities supported by Kapruka:
${altCities.map(c => `- ${c}`).join("\n")}

Write a friendly, conversational, and solution-oriented recovery message.
Rules:
- Never say "Delivery unavailable" or sound dry.
- State clearly that we couldn't deliver it on that date to that specific city.
- Suggest checking the nearby deliverable cities.
- Remind the user that they can try nearby location, choose another date, or find similar products.
- Keep the tone warm, welcoming, and helpful.
- Keep the message under 3 sentences. Do not write a long paragraph.

Your response MUST be the text message only.`;

    if (provider === "gemini") {
      textResponse = await callGeminiSingleTurn(activeClient, model, systemPrompt, userPrompt, {
        temperature: 0.7,
        maxOutputTokens: 150
      });
    } else {
      const completion = await withTimeout(
        activeClient.chat.completions.create({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 150
        }),
        undefined,
        "Delivery recovery"
      );
      textResponse = completion.choices[0].message.content.trim();
    }
  } catch (err) {
    logger.error(`[DELIVERY RECOVERY] Generation failed: ${err.message}`);
    // Fallback friendly message
    textResponse = `Unfortunately, this item can't be delivered to ${city} on your selected date. I can help find another delivery location, another date, or a similar product that can be delivered. Which option would you like to try?`;
  }

  return {
    available: false,
    city,
    deliveryDate: date,
    productId,
    alternativeCities: altCities,
    text: textResponse
  };
};

import { checkDelivery } from "../services/delivery.service.mjs";

export const checkDeliveryAvailability = async (req, res) => {
  // TEMP DEBUG LOG - SAFE TO REMOVE LATER
  console.log("\n==================================================");
  console.log("[CONTROLLER] Entry: checkDeliveryAvailability");
  console.log("[REQUEST] Payload:", JSON.stringify(req.body, null, 2));
  console.log("==================================================");

  try {
    const { city, deliveryDate, productId } = req.body;

    if (!city || typeof city !== "string" || city.trim() === "") {
      // TEMP DEBUG LOG - SAFE TO REMOVE LATER
      console.log("[ERROR] Missing city in checkDeliveryAvailability");
      return res.status(400).json({
        success: false,
        message: "City is required and must be a valid string."
      });
    }

    if (!deliveryDate || typeof deliveryDate !== "string" || deliveryDate.trim() === "") {
      // TEMP DEBUG LOG - SAFE TO REMOVE LATER
      console.log("[ERROR] Missing deliveryDate in checkDeliveryAvailability");
      return res.status(400).json({
        success: false,
        message: "Delivery date is required and must be a valid string (YYYY-MM-DD)."
      });
    }

    const result = await checkDelivery(
      city.trim(),
      deliveryDate.trim(),
      productId && typeof productId === "string" ? productId.trim() : null
    );

    // TEMP DEBUG LOG - SAFE TO REMOVE LATER
    console.log("[FINAL RESPONSE] Payload:", JSON.stringify(result, null, 2));
    return res.json(result);
  } catch (error) {
    // TEMP DEBUG LOG - SAFE TO REMOVE LATER
    console.error("[ERROR] Failed in checkDeliveryAvailability:", error.message);
    console.error("Error checking delivery availability:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error"
    });
  }
};

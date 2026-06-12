import { trackOrder } from "../services/orderTracking.service.mjs";

export const getOrderTracking = async (req, res) => {
  // TEMP DEBUG LOG - SAFE TO REMOVE LATER
  console.log("\n==================================================");
  console.log("[CONTROLLER] Entry: getOrderTracking");
  console.log("[REQUEST] Payload:", JSON.stringify(req.body, null, 2));
  console.log("==================================================");

  try {
    const { orderNumber } = req.body;

    if (!orderNumber || typeof orderNumber !== "string" || orderNumber.trim() === "") {
      // TEMP DEBUG LOG - SAFE TO REMOVE LATER
      console.log("[ERROR] Missing orderNumber in getOrderTracking");
      return res.status(400).json({
        success: false,
        message: "Order number is required and must be a string."
      });
    }

    const result = await trackOrder(orderNumber.trim());

    // TEMP DEBUG LOG - SAFE TO REMOVE LATER
    console.log("[FINAL RESPONSE] Payload:", JSON.stringify(result, null, 2));
    return res.json(result);
  } catch (error) {
    // TEMP DEBUG LOG - SAFE TO REMOVE LATER
    console.error("[ERROR] Failed in getOrderTracking:", error.message);
    console.error("Error retrieving order tracking:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve order tracking information."
    });
  }
};

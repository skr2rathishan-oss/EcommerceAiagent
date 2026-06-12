import { trackOrder } from "../services/orderTracking.service.mjs";

export const getOrderTracking = async (req, res) => {
  try {
    const { orderNumber } = req.body;

    if (!orderNumber || typeof orderNumber !== "string" || orderNumber.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Order number is required and must be a string."
      });
    }

    const result = await trackOrder(orderNumber.trim());
    return res.json(result);
  } catch (error) {
    console.error("Error retrieving order tracking:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve order tracking information."
    });
  }
};

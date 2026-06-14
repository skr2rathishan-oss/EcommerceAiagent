import { checkDelivery } from "../services/delivery.service.mjs";
import logger from "../utils/logger.mjs";

export const checkDeliveryAvailability = async (req, res) => {
  logger.info("[CONTROLLER] Entry: checkDeliveryAvailability", { body: req.body });

  try {
    const { city, deliveryDate, productId } = req.body;

    if (!city || typeof city !== "string" || city.trim() === "") {
      logger.warn("[ERROR] Missing city in checkDeliveryAvailability");
      return res.status(400).json({
        success: false,
        message: "City is required and must be a valid string."
      });
    }

    if (!deliveryDate || typeof deliveryDate !== "string" || deliveryDate.trim() === "") {
      logger.warn("[ERROR] Missing deliveryDate in checkDeliveryAvailability");
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

    logger.info("[FINAL RESPONSE] checkDeliveryAvailability Success", { success: result.success });
    return res.json(result);
  } catch (error) {
    logger.error("[ERROR] Failed in checkDeliveryAvailability", { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error"
    });
  }
};

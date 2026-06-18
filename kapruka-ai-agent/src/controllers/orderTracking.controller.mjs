import { trackOrder } from "../services/commerce/orderTracking.service.mjs";
import logger from "../utils/logger.mjs";

export const getOrderTracking = async (req, res) => {
  logger.info("[CONTROLLER] Entry: getOrderTracking", { body: req.body });

  try {
    const { orderNumber } = req.body;

    if (!orderNumber || typeof orderNumber !== "string" || orderNumber.trim() === "") {
      logger.warn("[ERROR] Missing orderNumber in getOrderTracking");
      return res.status(400).json({
        success: false,
        message: "Order number is required and must be a string."
      });
    }

    const result = await trackOrder(orderNumber.trim());

    logger.info("[FINAL RESPONSE] getOrderTracking Success", { orderNumber, success: result.success });
    return res.json(result);
  } catch (error) {
    logger.error("[ERROR] Failed in getOrderTracking", { error: error.message, stack: error.stack });
    
    const isNotFound = error.code === "ORDER_NOT_FOUND" || error.message?.toLowerCase().includes("not found");
    const statusCode = isNotFound ? 404 : 500;
    
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to retrieve order tracking information."
    });
  }
};

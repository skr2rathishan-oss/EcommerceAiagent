import { checkDelivery } from "../services/commerce/delivery.service.mjs";
import { updateMemory } from "../agent/memoryManager.mjs";
import { getProductDetails } from "../services/integration/mcp.service.mjs";
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

    if (result.available) {
      const sessionId = req.headers["x-session-id"] || "default";
      if (productId) {
        const productDetails = await getProductDetails(productId).catch(() => null);
        if (productDetails) {
          updateMemory(sessionId, {
            waitingFor: "order_confirmation",
            buyNowProduct: productDetails,
            deliveryInfo: {
              fullName: "Guest User",
              phone: "0771234567",
              email: "guest@example.com",
              address: result.city || city.trim()
            }
          });
        } else {
          updateMemory(sessionId, { waitingFor: "order_confirmation" });
        }
      } else {
        updateMemory(sessionId, { waitingFor: "order_confirmation" });
      }
    }

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

import { getAddresses, getDefaultAddress, saveAddress, validateDeliveryForAddress, findNearestDeliverableArea } from "../services/commerce/concierge.service.mjs";

export const getAddressesHandler = async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) return res.status(400).json({ error: "Missing sessionId" });

    const addresses = await getAddresses(sessionId);
    res.json({ success: true, addresses });
  } catch (error) {
    logger.error(`[CONCIERGE API] getAddressesHandler error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};

export const saveAddressHandler = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { addressData } = req.body;
    if (!sessionId || !addressData) return res.status(400).json({ error: "Missing parameters" });

    const updatedAddresses = await saveAddress(sessionId, addressData);
    res.json({ success: true, addresses: updatedAddresses });
  } catch (error) {
    logger.error(`[CONCIERGE API] saveAddressHandler error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};

export const checkDeliveryHandler = async (req, res) => {
  try {
    const { city, deliveryDate, productId } = req.body;
    if (!city || !deliveryDate || !productId) return res.status(400).json({ error: "Missing parameters" });

    const result = await validateDeliveryForAddress(city, deliveryDate, productId);
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error(`[CONCIERGE API] checkDeliveryHandler error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};

export const nearestAreaHandler = async (req, res) => {
  try {
    const { city } = req.body;
    if (!city) return res.status(400).json({ error: "Missing city parameter" });

    const result = await findNearestDeliverableArea(city);
    res.json({ success: true, nearest: result });
  } catch (error) {
    logger.error(`[CONCIERGE API] nearestAreaHandler error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};

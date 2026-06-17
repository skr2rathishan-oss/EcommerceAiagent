import { createOrder } from "../services/commerce/order.service.mjs";
import logger from "../utils/logger.mjs";

export const handleCreateOrder = async (req, res) => {
  const sessionId = req.headers["x-session-id"] || req.body.sessionId || "default";
  
  logger.checkout(`Entry handleCreateOrder for session: ${sessionId}`);

  try {
    const { cart, recipient, delivery, sender, giftMessage, currency } = req.body;

    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ success: false, message: "Cart items are required." });
    }
    if (!recipient || !recipient.name || !recipient.phone || !recipient.email) {
      return res.status(400).json({ success: false, message: "Recipient name, phone, and email are required." });
    }
    if (!delivery || !delivery.address || !delivery.city || !delivery.date) {
      return res.status(400).json({ success: false, message: "Delivery address, city, and date are required." });
    }

    const orderDoc = await createOrder(sessionId, {
      cart,
      recipient,
      delivery,
      sender: sender || { name: recipient.name, anonymous: false },
      giftMessage,
      currency
    });

    return res.status(201).json({
      success: true,
      order: orderDoc
    });
  } catch (error) {
    logger.error("Failed to create order", { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create order on Kapruka."
    });
  }
};

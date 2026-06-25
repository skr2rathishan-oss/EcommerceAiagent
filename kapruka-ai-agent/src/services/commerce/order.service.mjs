import { getMcpClient } from "../integration/mcp.client.mjs";
import Order from "../../database/Order.mjs";
import logger from "../../utils/logger.mjs";

export const createOrder = async (sessionId, { cart, recipient, delivery, sender, giftMessage, currency }) => {
  const client = await getMcpClient();

  logger.checkout(`Creating order for session: ${sessionId}`, {
    cart,
    recipient,
    delivery,
    sender,
    giftMessage
  });

  if (!delivery?.city) {
    throw new Error("Missing Delivery City");
  }
  if (!delivery?.date) {
    throw new Error("Missing Delivery Date");
  }
  if (!cart || cart.length === 0) {
    throw new Error("Cart is empty");
  }

  const mcpStart = Date.now();

  const result = await client.callTool({
    name: "kapruka_create_order",
    arguments: {
      params: {
        cart: cart.map(item => ({
          product_id: item.productId,
          quantity: item.quantity,
          icing_text: item.icingText || null
        })),
        recipient: {
          name: recipient.name,
          phone: recipient.phone
        },
        delivery: {
          address: delivery.address,
          city: delivery.city,
          location_type: delivery.locationType || "house",
          date: delivery.date,
          instructions: delivery.instructions || null
        },
        sender: {
          name: sender.name,
          anonymous: sender.anonymous || false
        },
        gift_message: giftMessage || null,
        currency: currency || "LKR",
        response_format: "json"
      }
    }
  });

  const durationMs = Date.now() - mcpStart;

  const raw =
    result?.structuredContent?.result ??
    result?.content?.[0]?.text ??
    "";

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    logger.error(`[MCP] createOrder: non-JSON response: ${raw.substring(0, 100)}...`);
    throw new Error("Order creation failed, Kapruka returned non-JSON response.");
  }

  logger.order(`Order created on Kapruka in ${durationMs}ms | Ref: ${data.order_ref}`);

  // Save order to MongoDB
  const orderDoc = new Order({
    sessionId,
    orderRef: data.order_ref,
    status: "pending",
    recipient: {
      name: recipient.name,
      phone: recipient.phone,
      email: recipient.email,
      address: delivery.address,
      city: delivery.city
    },
    items: cart.map(item => ({
      productId: item.productId,
      name: item.name,
      image: item.image || "",
      price: item.price,
      quantity: item.quantity,
      currency: currency || "LKR"
    })),
    summary: {
      subtotal: data.summary.items_total,
      deliveryFee: data.summary.delivery_fee,
      discount: 0, 
      total: data.summary.grand_total,
      currency: data.summary.currency
    },
    checkoutUrl: data.checkout_url,
    paymentStatus: "unpaid",
    giftMessage: giftMessage || null
  });

  await orderDoc.save();

  logger.order(`Order saved to MongoDB | Ref: ${orderDoc.orderRef}`);

  return orderDoc;
};

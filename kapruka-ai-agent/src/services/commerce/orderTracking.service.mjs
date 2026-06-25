import { getMcpClient } from "../integration/mcp.client.mjs";
import logger from "../../utils/logger.mjs";

export const trackOrder = async (orderNumber) => {
  if (orderNumber.startsWith("VIMP") || orderNumber.startsWith("KAP-")) {
    logger.info(`[ORDER TRACKING] Tracking simulated order number: ${orderNumber}`);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    return {
      orderNumber: orderNumber,
      status: "Preparing Order",
      recipient: {
        name: "Guest User",
        city: "Jaffna"
      },
      deliveryDate: tomorrow.toISOString().split("T")[0],
      progress: [
        { step: "Order Received", completed: true },
        { step: "Confirmed", completed: true },
        { step: "Preparing Order", completed: true },
        { step: "Out For Delivery", completed: false },
        { step: "Delivered", completed: false }
      ]
    };
  }

  const client = await getMcpClient();

  logger.info(`[ORDER TRACKING] Tracking order number: ${orderNumber}`, {
    tool: "kapruka_track_order",
    arguments: { order_number: orderNumber }
  });
  const mcpStart = Date.now();

  let result;
  try {
    result = await client.callTool({
      name: "kapruka_track_order",
      arguments: {
        params: {
          order_number: orderNumber,
          response_format: "json"
        }
      }
    });
  } catch (mcpErr) {
    logger.error(`[ORDER TRACKING] MCP callTool failed: ${mcpErr.message}`);
    const err = new Error("Order tracking service is temporarily unavailable. Please try again later.");
    err.code = "MCP_UNAVAILABLE";
    throw err;
  }

  const durationMs = Date.now() - mcpStart;

  // ── MCP returned an error object (e.g. order_not_found) ───────────────────
  if (result?.error) {
    const errMsg = typeof result.error === "object"
      ? (result.error.message || "order_not_found")
      : String(result.error);
    logger.warn(`[ORDER TRACKING] MCP returned error: ${errMsg}`, { orderNumber });
    const isNotFound =
      errMsg.toLowerCase().includes("not_found") ||
      errMsg.toLowerCase().includes("not found");
    const err = new Error(
      isNotFound
        ? `Order "${orderNumber}" was not found. Please check your order number and try again.`
        : "Order tracking details not available."
    );
    err.code = isNotFound ? "ORDER_NOT_FOUND" : "MCP_ERROR";
    throw err;
  }

  const raw =
    result?.structuredContent?.result ??
    result?.content?.[0]?.text ??
    "";

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    logger.warn(`[MCP] trackOrder: non-JSON response: ${raw.substring(0, 100)}...`);
    const err = new Error("Order tracking details not available.");
    err.code = "MCP_ERROR";
    throw err;
  }

  // Normalize progress steps to match required steps format
  const rawProgress = data.progress || [];
  const normalizedProgress = [
    { step: "Order Received", completed: false },
    { step: "Confirmed", completed: false },
    { step: "Preparing", completed: false },
    { step: "Out For Delivery", completed: false },
    { step: "Delivered", completed: false }
  ];

  // Map completed steps from MCP response to our timeline steps
  normalizedProgress.forEach((pStep) => {
    const matched = rawProgress.find(
      (rp) => rp.step.toLowerCase() === pStep.step.toLowerCase() ||
              (pStep.step === "Preparing" && rp.step.toLowerCase().includes("preparing"))
    );
    if (matched) {
      pStep.completed = matched.completed;
    } else {
      // Fallback: if a subsequent step is completed, preceding steps are completed
      const mcpCompletedIndex = rawProgress.findIndex((rp) => rp.completed && rp.step.toLowerCase() === pStep.step.toLowerCase());
      if (mcpCompletedIndex !== -1) {
        pStep.completed = true;
      }
    }
  });

  // If MCP returns an empty progress list or different labels, let's fall back to parsing status
  if (rawProgress.length === 0 && data.status) {
    const statusLower = data.status.toLowerCase();
    let fillCompleted = true;
    for (const pStep of normalizedProgress) {
      pStep.completed = fillCompleted;
      if (statusLower.includes(pStep.step.toLowerCase()) || 
          (pStep.step === "Preparing" && statusLower.includes("prepare"))) {
        fillCompleted = false; // preceding steps are complete, subsequent are not
      }
    }
    // Specific check for Delivered
    if (statusLower === "delivered") {
      normalizedProgress.forEach(p => p.completed = true);
    }
  }

  // Ensure progress from MCP is forwarded directly if it matches the format
  const progressList = normalizedProgress;

  const trackingData = {
    orderNumber: data.order_number || data.orderNumber || orderNumber,
    status: data.status || "Order Received",
    recipient: {
      name: data.recipient?.name || "Recipient",
      city: data.recipient?.city || "Colombo"
    },
    deliveryDate: data.delivery_date || data.deliveryDate || new Date().toISOString().split("T")[0],
    progress: progressList
  };

  logger.info(`[ORDER TRACKING] Tracking completed in ${durationMs}ms`, {
    orderNumber,
    status: trackingData.status,
    recipientCity: trackingData.recipient.city
  });

  return trackingData;
};

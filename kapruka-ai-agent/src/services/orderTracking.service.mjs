import { getMcpClient } from "./mcp.client.mjs";
import logger from "../utils/logger.mjs";

export const trackOrder = async (orderNumber) => {
  const client = await getMcpClient();

  logger.info(`[ORDER TRACKING] Tracking order number: ${orderNumber}`, {
    tool: "kapruka_track_order",
    arguments: { order_number: orderNumber }
  });
  const mcpStart = Date.now();

  const result = await client.callTool({
    name: "kapruka_track_order",
    arguments: {
      params: {
        order_number: orderNumber,
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
    logger.warn(`[MCP] trackOrder: non-JSON response: ${raw.substring(0, 100)}...`);
    throw new Error("Order tracking details not available");
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

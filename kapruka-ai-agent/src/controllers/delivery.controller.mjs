import { checkDelivery } from "../services/delivery.service.mjs";

export const checkDeliveryAvailability = async (req, res) => {
  try {
    const { city, deliveryDate, productId } = req.body;

    if (!city || typeof city !== "string" || city.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "City is required and must be a valid string."
      });
    }

    if (!deliveryDate || typeof deliveryDate !== "string" || deliveryDate.trim() === "") {
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

    return res.json(result);
  } catch (error) {
    console.error("Error checking delivery availability:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error"
    });
  }
};

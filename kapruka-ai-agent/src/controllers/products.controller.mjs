import { getProductDetails } from "../services/mcp.service.mjs";

export const getProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== "string" || id.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Valid product ID is required"
      });
    }

    const details = await getProductDetails(id.trim());

    if (!details || !details.id) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    return res.json(details);

  } catch (error) {
    console.error(`Error retrieving product details:`, error);
    
    // Check if error is due to product not found from MCP
    const errMsg = error.message || "";
    if (errMsg.includes("product_not_found") || errMsg.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: "Product not found on Kapruka"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
};

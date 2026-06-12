import { getProductDetails } from "../services/mcp.service.mjs";

export const getProduct = async (req, res) => {
  // TEMP DEBUG LOG - SAFE TO REMOVE LATER
  console.log("\n==================================================");
  console.log("[CONTROLLER] Entry: getProduct");
  console.log("[REQUEST] Params:", JSON.stringify(req.params, null, 2));
  console.log("==================================================");

  try {
    const { id } = req.params;

    if (!id || typeof id !== "string" || id.trim() === "") {
      // TEMP DEBUG LOG - SAFE TO REMOVE LATER
      console.log("[ERROR] Missing or invalid ID in getProduct");
      return res.status(400).json({
        success: false,
        message: "Valid product ID is required"
      });
    }

    const details = await getProductDetails(id.trim());

    if (!details || !details.id) {
      // TEMP DEBUG LOG - SAFE TO REMOVE LATER
      console.log("[ERROR] Product details not found or invalid response for ID:", id);
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // TEMP DEBUG LOG - SAFE TO REMOVE LATER
    console.log("[FINAL RESPONSE] Payload:", JSON.stringify(details, null, 2));
    return res.json(details);

  } catch (error) {
    // TEMP DEBUG LOG - SAFE TO REMOVE LATER
    console.error("[ERROR] Failed in getProduct:", error.message);
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

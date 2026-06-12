import { INTENTS } from "../config/intents.mjs";
import { searchProducts, getProductDetails } from "../services/mcp.service.mjs";
import { getShoppingContext, updateShoppingContext } from "./memoryManager.mjs";
import { formatProductDetails } from "../utils/productDetailsFormatter.mjs";

// ── Intent Router ────────────────────────────────────────────────────────────
// Routes a detected intent to the appropriate service.
//
// @param {string} intent      - intent key from INTENTS
// @param {Object} parameters  - extracted intent parameters
// @param {string} sessionId   - session identifier for per-user memory
//
// SAFE TO EXTEND: Add new case blocks below for new intents.

export const routeIntent = async (intent, parameters = {}, sessionId = "default") => {
    switch (intent) {

        // ── Product Search ────────────────────────────────────────────────────
        case INTENTS.SEARCH_PRODUCTS: {
            const results = await searchProducts(
                parameters.query || parameters.q
            );

            // Store results in shopping context for future filtering
            // without needing a new MCP request
            updateShoppingContext(sessionId, { lastSearchResults: results });

            console.log("[SHOPPING CONTEXT] Stored", results.length, "products for session:", sessionId);
            return results;
        }

        // ── Product Selection ─────────────────────────────────────────────────
        // Triggered when the user clicks on a product card in the chat.
        // Saves the selected product to session memory and returns a
        // conversational follow-up response — does NOT show raw product data.
        case INTENTS.SELECT_PRODUCT: {
            const product = parameters.product;
            if (!product) {
                return {
                    type: "text",
                    text: "I couldn't find that product. Please try selecting it again."
                };
            }

            // Save selected product to session shopping context
            updateShoppingContext(sessionId, { selectedProduct: product });
            console.log("[SHOPPING CONTEXT] Selected product:", product.name, "for session:", sessionId);

            return {
                type: "product_selected",
                productId: product.id,
                product: product,
                message: `Great choice! 😊\n\nYou've selected **${product.name}**.`,
                actions: [
                    { id: "view_details",     label: "View Full Details",          emoji: "👀" },
                    { id: "check_delivery",   label: "Check Delivery",             emoji: "🚚" },
                    { id: "add_to_cart",      label: "Add To Cart",                emoji: "🛒" },
                    { id: "save_for_later",   label: "Save For Later",             emoji: "❤️" },
                    { id: "compare",          label: "Compare With Similar",       emoji: "⚖️" },
                ]
            };
        }

        // ── Get Product Details ───────────────────────────────────────────────
        // Fetches full product details from MCP and formats them for display.
        case INTENTS.GET_PRODUCT_DETAILS: {
            const productId = parameters.productId || parameters.product_id;
            if (!productId) {
                return {
                    type: "text",
                    text: "I need a product ID to fetch details. Please select a product first."
                };
            }

            try {
                const rawProduct = await getProductDetails(productId);
                const formatted = formatProductDetails(rawProduct);
                console.log("[PRODUCT DETAILS] Formatted details for product:", productId);
                return formatted;
            } catch (err) {
                console.error("[PRODUCT DETAILS] Failed to fetch details:", err.message);

                // Fallback: use product from shopping context if MCP call fails
                const context = getShoppingContext(sessionId);
                if (context.selectedProduct && context.selectedProduct.id === productId) {
                    console.log("[PRODUCT DETAILS] Falling back to session context product");
                    return formatProductDetails(context.selectedProduct);
                }

                return {
                    type: "text",
                    text: "⚠️ Sorry, I couldn't load the full product details right now. Please try again shortly."
                };
            }
        }

        case INTENTS.CHECK_DELIVERY:
            return {
                success: true,
                action: "check_delivery",
                parameters,
            };

        case INTENTS.CREATE_ORDER:
            return {
                success: true,
                action: "create_order",
                parameters,
            };

        case INTENTS.TRACK_ORDER:
            return {
                success: true,
                action: "track_order",
                parameters,
            };

        default:
            return {
                success: false,
                message: "Unknown intent",
            };
    }
};
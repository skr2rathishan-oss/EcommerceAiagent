import { INTENTS } from "../config/intents.mjs";
import { searchProducts, getProductDetails } from "../services/mcp.service.mjs";
import { getShoppingContext, updateShoppingContext } from "./memoryManager.mjs";
import { formatProductDetails } from "../utils/productDetailsFormatter.mjs";
import { applyFilters, getSuggestions } from "../utils/filterEngine.mjs";
import { trackInteraction } from "../services/productInteraction.service.mjs";

// ── Intent Router ────────────────────────────────────────────────────────────
// Routes a detected intent to the appropriate service.
//
// @param {string} intent      - intent key from INTENTS
// @param {Object} parameters  - extracted intent parameters
// @param {string} sessionId   - session identifier for per-user memory
//
// SAFE TO EXTEND: Add new case blocks below for new intents.

export const routeIntent = async (intent, parameters = {}, sessionId = "default", onProgress) => {
    switch (intent) {

        // ── Product Search ────────────────────────────────────────────────────
        case INTENTS.SEARCH_PRODUCTS: {
            onProgress?.("SEARCHING", "active");

            let results;
            try {
                results = await searchProducts(
                    parameters.query || parameters.q
                );
            } catch (err) {
                onProgress?.("SEARCHING", "error", ["Catalog service unavailable"]);
                throw err;
            }

            onProgress?.("SEARCHING", "completed", [`Retrieved ${results.length} products`]);
            onProgress?.("FILTERING", "active");

            // Store results in shopping context for future filtering
            // without needing a new MCP request
            updateShoppingContext(sessionId, { lastSearchResults: results });

            console.log("[SHOPPING CONTEXT] Stored", results.length, "products for session:", sessionId);

            // Apply universal filtering
            const filters = parameters.filters || {};
            const filteredResults = applyFilters(results, filters);
            console.log("[FILTERING] Applied filters:", JSON.stringify(filters), "Filtered count:", filteredResults.length);

            const filterDetails = [];
            if (filters.brand) filterDetails.push(`${filters.brand} filter applied`);
            if (filters.category) filterDetails.push(`${filters.category} filter applied`);
            if (filters.color) filterDetails.push(`${filters.color} filter applied`);
            if (filters.gender) filterDetails.push(`${filters.gender} filter applied`);
            if (filters.priceMin || filters.priceMax) filterDetails.push("Price filter applied");
            if (filterDetails.length === 0 && Object.keys(filters).length > 0) {
                filterDetails.push("Filters applied");
            }

            onProgress?.("FILTERING", "completed", filterDetails);
            onProgress?.("RANKING", "active");

            let finalProducts;
            let introText = "";

            if (filteredResults.length > 0) {
                finalProducts = filteredResults;
            } else {
                // No results matching filters: return suggestions
                const suggestions = getSuggestions(results, filters);
                console.log("[FILTERING] No matches. Suggestions count:", suggestions.length);
                finalProducts = suggestions;
                introText = "No products matched your filters. However, you might like these similar options:";
            }

            onProgress?.("RANKING", "completed", ["Ranked by relevance"]);
            onProgress?.("READY", "active");

            if (introText) {
                return {
                    type: "product_grid",
                    text: introText,
                    products: finalProducts
                };
            }
            return finalProducts;
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

            // Track "view" interaction in the background asynchronously
            trackInteraction(sessionId, product.id, product.name, product.category, "view").catch(err => {
                console.error("[Background Tracking Error] Failed to track select_product:", err);
            });

            return {
                type: "product_selected",
                productId: product.id,
                product: product,
                message: `Great choice! 😊\n\nThat looks like a promising option.\n\nWhat would you like to do next?`,
                actions: [
                    { id: "view_details", label: "View Full Details", emoji: "👀" },
                    { id: "check_delivery", label: "Check Delivery", emoji: "🚚" },
                    { id: "add_to_cart", label: "Add To Cart", emoji: "🛒" },
                    { id: "save_for_later", label: "Save For Later", emoji: "❤️" },
                    { id: "compare", label: "Compare With Similar", emoji: "⚖️" },
                ]
            };
        }

        // ── Get Product Details ───────────────────────────────────────────────
        // Fetches full product details from MCP and formats them for display.
        case INTENTS.GET_PRODUCT_DETAILS: {
            let productId = parameters.productId || parameters.product_id;

            // Check context fallback if productId is not explicitly passed
            const context = getShoppingContext(sessionId);
            if (!productId && context.selectedProduct) {
                productId = context.selectedProduct.id;
            }

            if (!productId) {
                return {
                    type: "text",
                    text: "I need a product ID to fetch details. Please select a product first."
                };
            }

            try {
                const rawProduct = await getProductDetails(productId);
                // Track "details" interaction in the background asynchronously
                trackInteraction(sessionId, rawProduct.id, rawProduct.name, rawProduct.category, "details").catch(err => {
                    console.error("[Background Tracking Error] Failed to track get_product_details:", err);
                });

                const formatted = formatProductDetails(rawProduct);
                console.log("[PRODUCT DETAILS] Formatted details for product:", productId);
                return formatted;
            } catch (err) {
                console.error("[PRODUCT DETAILS] Failed to fetch details:", err.message);

                // Fallback: use product from shopping context if MCP call fails
                if (context.selectedProduct && context.selectedProduct.id === productId) {
                    console.log("[PRODUCT DETAILS] Falling back to session context product");
                    // Track "details" interaction for context product in the background
                    trackInteraction(sessionId, context.selectedProduct.id, context.selectedProduct.name, context.selectedProduct.category, "details").catch(err => {
                        console.error("[Background Tracking Error] Failed to track get_product_details fallback:", err);
                    });
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
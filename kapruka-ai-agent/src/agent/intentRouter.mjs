import { INTENTS } from "../config/intents.mjs";
import { searchProducts, getProductDetails } from "../services/mcp.service.mjs";
import { getShoppingContext, updateShoppingContext } from "./memoryManager.mjs";
import { formatProductDetails } from "../utils/productDetailsFormatter.mjs";
import { applyFilters, getSuggestions } from "../utils/filterEngine.mjs";
import { trackInteraction } from "../services/productInteraction.service.mjs";
import { MOCK_PRODUCTS } from "../controllers/products.controller.mjs";
import logger from "../utils/logger.mjs";

// ── Intent Router ────────────────────────────────────────────────────────────
// Routes a detected intent to the appropriate service.
//
// @param {string} intent      - intent key from INTENTS
// @param {Object} parameters  - extracted intent parameters
// @param {string} sessionId   - session identifier for per-user memory
//
// SAFE TO EXTEND: Add new case blocks below for new intents.

export const routeIntent = async (intent, parameters = {}, sessionId = "default", onProgress, lang = "en") => {
    switch (intent) {

        // ── Product Search ────────────────────────────────────────────────────
        case INTENTS.SEARCH_PRODUCTS: {
            onProgress?.("SEARCHING", "active");

            let results;
            let usingFallback = false;
            try {
                results = await searchProducts(
                    parameters.query || parameters.q
                );
            } catch (err) {
                logger.error("[SEARCH PRODUCTS] MCP Search failed, falling back to mock catalog:", err.message);
                usingFallback = true;
                const queryStr = (parameters.query || parameters.q || "").toLowerCase().trim();
                const allMockProducts = Object.values(MOCK_PRODUCTS).map(p => ({
                    ...p,
                    inStock: p.stock === true
                }));
                results = allMockProducts.filter(p => {
                    if (!queryStr) return true;
                    return (
                        p.name.toLowerCase().includes(queryStr) ||
                        p.description.toLowerCase().includes(queryStr) ||
                        p.brand.toLowerCase().includes(queryStr) ||
                        p.category.toLowerCase().includes(queryStr)
                    );
                });
            }

            if (usingFallback) {
                onProgress?.("SEARCHING", "completed", [`Retrieved ${results.length} products from offline catalog`]);
            } else {
                onProgress?.("SEARCHING", "completed", [`Retrieved ${results.length} products`]);
            }
            onProgress?.("FILTERING", "active");

            // Store results in shopping context for future filtering
            // without needing a new MCP request
            updateShoppingContext(sessionId, { lastSearchResults: results });

            logger.info(`[SHOPPING CONTEXT] Stored ${results.length} products for session: ${sessionId}`);

            // Apply universal filtering
            const filters = parameters.filters || {};
            const filteredResults = applyFilters(results, filters);
            logger.info(`[FILTERING] Applied filters: ${JSON.stringify(filters)} | Filtered count: ${filteredResults.length}`);

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
                logger.info(`[FILTERING] No matches. Suggestions count: ${suggestions.length}`);
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
                let failText = "I couldn't find that product. Please try selecting it again.";
                if (lang === "ta") {
                    failText = "அந்தத் தயாரிப்பை என்னால் கண்டுபிடிக்க முடியவில்லை. மீண்டும் தேர்ந்தெடுக்க முயற்சிக்கவும்.";
                } else if (lang === "si") {
                    failText = "මට එම නිෂ්පාදනය සොයාගත නොහැකි විය. කරුණාකර එය නැවත තේරීමට උත්සාහ කරන්න.";
                }
                return {
                    type: "text",
                    text: failText
                };
            }

            // Save selected product to session shopping context
            updateShoppingContext(sessionId, { selectedProduct: product });
            logger.info(`[SHOPPING CONTEXT] Selected product: ${product.name} for session: ${sessionId}`);

            // Track "view" interaction in the background asynchronously
            trackInteraction(sessionId, product.id, product.name, product.category, "view").catch(err => {
                logger.error("[Background Tracking Error] Failed to track select_product:", err);
            });

            let selectMessage = `Great choice! 😊\n\nThat looks like a promising option.\n\nWhat would you like to do next?`;
            let actions = [
                { id: "view_details", label: "View Full Details", emoji: "👀" },
                { id: "check_delivery", label: "Check Delivery", emoji: "🚚" },
                { id: "add_to_cart", label: "Add To Cart", emoji: "🛒" },
                { id: "save_for_later", label: "Save For Later", emoji: "❤️" },
                { id: "compare", label: "Compare With Similar", emoji: "⚖️" },
            ];

            if (lang === "ta") {
                selectMessage = `அருமையான தேர்வு! 😊\n\nஅது ஒரு சிறந்த தயாரிப்பாகத் தெரிகிறது.\n\nஅடுத்து நீங்கள் என்ன செய்ய விரும்புகிறீர்கள்?`;
                actions = [
                    { id: "view_details", label: "முழு விபரங்களையும் காண்க", emoji: "👀" },
                    { id: "check_delivery", label: "டெலிவரியைச் சரிபார்", emoji: "🚚" },
                    { id: "add_to_cart", label: "கார்ட்டில் சேர்", emoji: "🛒" },
                    { id: "save_for_later", label: "பின்னர் சேமிக்கவும்", emoji: "❤️" },
                    { id: "compare", label: "ஒத்தவற்றுடன் ஒப்பிடுக", emoji: "⚖️" },
                ];
            } else if (lang === "si") {
                selectMessage = `නියම තේරීමක්! 😊\n\nඑය හොඳ නිෂ්පාදනයක් බව පෙනේ.\n\nඊළඟට ඔබ කුමක් කිරීමට කැමතිද?`;
                actions = [
                    { id: "view_details", label: "සම්පූර්ණ විස්තර බලන්න", emoji: "👀" },
                    { id: "check_delivery", label: "බෙදා හැරීම පරීක්ෂා කරන්න", emoji: "🚚" },
                    { id: "add_to_cart", label: "කරත්තයට එක් කරන්න", emoji: "🛒" },
                    { id: "save_for_later", label: "පසුවට සුරකින්න", emoji: "❤️" },
                    { id: "compare", label: "සමාන ඒවා සමඟ සසඳන්න", emoji: "⚖️" },
                ];
            }

            return {
                type: "product_selected",
                productId: product.id,
                product: product,
                message: selectMessage,
                actions: actions
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
                let failText = "I need a product ID to fetch details. Please select a product first.";
                if (lang === "ta") {
                    failText = "விவரங்களைப் பெற எனக்கு தயாரிப்பு ஐடி தேவை. முதலில் ஒரு தயாரிப்பைத் தேர்ந்தெடுக்கவும்.";
                } else if (lang === "si") {
                    failText = "විස්තර ලබා ගැනීමට මට නිෂ්පාදන හැඳුනුම්පතක් (ID) අවශ්‍ය වේ. කරුණාකර පළමුව නිෂ්පාදනයක් තෝරන්න.";
                }
                return {
                    type: "text",
                    text: failText
                };
            }

            try {
                const rawProduct = await getProductDetails(productId);
                // Track "details" interaction in the background asynchronously
                trackInteraction(sessionId, rawProduct.id, rawProduct.name, rawProduct.category, "details").catch(err => {
                    logger.error("[Background Tracking Error] Failed to track get_product_details:", err);
                });

                const formatted = formatProductDetails(rawProduct);
                logger.info(`[PRODUCT DETAILS] Formatted details for product: ${productId}`);
                return formatted;
            } catch (err) {
                logger.error(`[PRODUCT DETAILS] Failed to fetch details: ${err.message}`);

                // Fallback 1: check if it's in MOCK_PRODUCTS
                if (MOCK_PRODUCTS[productId]) {
                    logger.info(`[PRODUCT DETAILS] Falling back to offline MOCK_PRODUCTS database for ID: ${productId}`);
                    const mockProd = MOCK_PRODUCTS[productId];
                    trackInteraction(sessionId, mockProd.id, mockProd.name, mockProd.category, "details").catch(err => {
                        logger.error("[Background Tracking Error] Failed to track fallback mock product details:", err);
                    });
                    return formatProductDetails(mockProd);
                }

                // Fallback 2: use product from shopping context if MCP call fails
                if (context.selectedProduct && context.selectedProduct.id === productId) {
                    logger.info("[PRODUCT DETAILS] Falling back to session context product");
                    // Track "details" interaction for context product in the background
                    trackInteraction(sessionId, context.selectedProduct.id, context.selectedProduct.name, context.selectedProduct.category, "details").catch(err => {
                        logger.error("[Background Tracking Error] Failed to track get_product_details fallback:", err);
                    });
                    return formatProductDetails(context.selectedProduct);
                }

                let errorText = "⚠️ Sorry, I couldn't load the full product details right now. Please try again shortly.";
                if (lang === "ta") {
                    errorText = "⚠️ மன்னிக்கவும், இப்போது தயாரிப்பு விவரங்களை ஏற்ற முடியவில்லை. சிறிது நேரத்தில் மீண்டும் முயற்சிக்கவும்.";
                } else if (lang === "si") {
                    errorText = "⚠️ කණගාටුයි, මේ මොහොතේ නිෂ්පාදන විස්තර ලබා ගැනීමට නොහැකි විය. කරුණාකර සුළු මොහොතකින් නැවත උත්සාහ කරන්න.";
                }

                return {
                    type: "text",
                    text: errorText
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
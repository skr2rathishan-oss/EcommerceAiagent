import { INTENTS } from "../config/intents.mjs";
import { searchProducts, getProductDetails } from "../services/integration/mcp.service.mjs";
import { getShoppingContext, updateShoppingContext, getMemory, updateMemory } from "./memoryManager.mjs";
import { formatProductDetails } from "../utils/productDetailsFormatter.mjs";
import { applyFilters, getSuggestions } from "../utils/filterEngine.mjs";
import { trackInteraction } from "../services/commerce/productInteraction.service.mjs";
import { trackOrder } from "../services/commerce/orderTracking.service.mjs";
import { checkDelivery } from "../services/commerce/delivery.service.mjs";
import { parseAddress } from "../services/commerce/addressService.mjs";
import { handleDeliveryFailure } from "../services/commerce/deliveryRecoveryService.mjs";
import { startDeliveryFlow, handleAddressInput } from "../services/commerce/deliveryFlowService.mjs";
import { getDeliverySession } from "../memory/memoryStore.mjs";
import logger from "../utils/logger.mjs";

// ── Fallback Query Mapping ───────────────────────────────────────────────────
// Maps vague, emotional, or situational search terms to standard product terms.
export function getFallbackQuery(query, context = {}) {
    const lowerQuery = query ? query.toLowerCase() : "";
    const situation = context.situation ? context.situation.toLowerCase() : "";

    // Sinhala/Tamil/English multilingual checks
    const isHospitalSick =
        situation === "hospital" ||
        situation === "sick" ||
        lowerQuery.includes("hospital") ||
        lowerQuery.includes("sick") ||
        lowerQuery.includes("unwell") ||
        lowerQuery.includes("get well") ||
        lowerQuery.includes("comfort") ||
        lowerQuery.includes("හොස්පිට්ල්") ||
        lowerQuery.includes("රෝහල") ||
        lowerQuery.includes("සනීප නැතුව") ||
        lowerQuery.includes("සනීප නැති") ||
        lowerQuery.includes("අසනීප") ||
        lowerQuery.includes("සුවවෙන්න") ||
        lowerQuery.includes("සුවය") ||
        lowerQuery.includes("අමාරු") ||
        lowerQuery.includes("ஹோஸ்பிட்டல்") ||
        lowerQuery.includes("ஆஸ்பத்திரி") ||
        lowerQuery.includes("உடம்பு சரியில்லை") ||
        lowerQuery.includes("உடல்நிலை") ||
        lowerQuery.includes("சுகம்") ||
        lowerQuery.includes("குணமாக") ||
        lowerQuery.includes("நோயாளி");

    const isApologySupport =
        situation === "apology" ||
        situation === "apologetic" ||
        lowerQuery.includes("apology") ||
        lowerQuery.includes("sorry") ||
        (lowerQuery.includes("support") && !lowerQuery.includes("supporter")) ||
        lowerQuery.includes("සොරි") ||
        lowerQuery.includes("සමාවෙන්න") ||
        lowerQuery.includes("කණගාටුයි") ||
        lowerQuery.includes("සහාය") ||
        lowerQuery.includes("ஸாரி") ||
        lowerQuery.includes("மன்னிக்கவும்") ||
        lowerQuery.includes("வருந்துகிறேன்") ||
        lowerQuery.includes("ஆதரவு");

    const isForgotBirthday =
        situation === "forgot_birthday" ||
        lowerQuery.includes("forgot") ||
        lowerQuery.includes("birthday") ||
        lowerQuery.includes("cake") ||
        lowerQuery.includes("උපන් දින") ||
        lowerQuery.includes("උපන්දින") ||
        lowerQuery.includes("බර්ත්ඩේ") ||
        lowerQuery.includes("අමතක") ||
        lowerQuery.includes("කේක්") ||
        lowerQuery.includes("பிறந்தநாள்") ||
        lowerQuery.includes("பிறந்த நாள்") ||
        lowerQuery.includes("மறந்து") ||
        lowerQuery.includes("கேக்");

    if (isHospitalSick) return "fruits";
    if (isApologySupport) return "flowers";
    if (isForgotBirthday) return "cakes";

    const isGift =
        lowerQuery === "gifts" ||
        lowerQuery === "gift" ||
        lowerQuery === "තෑග්ග" ||
        lowerQuery === "තෑගි" ||
        lowerQuery === "තෑග්ගක්" ||
        lowerQuery === "பரிசு" ||
        lowerQuery === "அன்பளிப்பு";

    if (isGift) {
        if (context.recipient === "mother" || context.recipient === "mom") {
            return "gift hampers";
        }
    }

    return null;
}

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

            let searchQuery = parameters.query || parameters.q;
            const context = parameters.context || {};

            const proactiveFallback = getFallbackQuery(searchQuery, context);
            if (proactiveFallback) {
                logger.info(`[SEARCH PRODUCTS] Proactively mapping "${searchQuery}" to fallback: "${proactiveFallback}"`);
                searchQuery = proactiveFallback;
            }

            let results;
            try {
                results = await searchProducts(searchQuery);

                if ((!results || results.length === 0) && searchQuery) {
                    const fallback = getFallbackQuery(searchQuery, context);
                    if (fallback && fallback !== searchQuery) {
                        logger.info(`[SEARCH PRODUCTS] 0 results for "${searchQuery}". Retrying with fallback: "${fallback}"`);
                        searchQuery = fallback;
                        results = await searchProducts(searchQuery);
                    }
                }
            } catch (err) {
                logger.error("[SEARCH PRODUCTS] MCP Search failed:", err.message);
                results = [];
            }

            onProgress?.("SEARCHING", "completed", [`Retrieved ${results.length} products`]);
            onProgress?.("FILTERING", "active");

            updateShoppingContext(sessionId, { lastSearchResults: results });
            logger.info(`[SHOPPING CONTEXT] Stored ${results.length} products for session: ${sessionId}`);

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
        case INTENTS.SELECT_PRODUCT: {
            const product = parameters.product;
            if (!product) {
                let failText = "I couldn't find that product. Please try selecting it again.";
                if (lang === "ta") {
                    failText = "அந்தத் தயாரிப்பை என்னால் கண்டுபிடிக்க முடியவில்லை. மீண்டும் தேர்ந்தெடுக்க முயற்சிக்கவும்.";
                } else if (lang === "si") {
                    failText = "මට එම නිෂ්පාදනය සොයාගත නොහැකි විය. කරුණාකර එය නැවත තේරීමට උත්සාහ කරන්න.";
                }
                return { type: "text", text: failText };
            }

            updateShoppingContext(sessionId, { selectedProduct: product });
            logger.info(`[SHOPPING CONTEXT] Selected product: ${product.name} for session: ${sessionId}`);

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
        case INTENTS.GET_PRODUCT_DETAILS: {
            let productId = parameters.productId || parameters.product_id;

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
                return { type: "text", text: failText };
            }

            try {
                const rawProduct = await getProductDetails(productId);
                trackInteraction(sessionId, rawProduct.id, rawProduct.name, rawProduct.category, "details").catch(err => {
                    logger.error("[Background Tracking Error] Failed to track get_product_details:", err);
                });
                const formatted = formatProductDetails(rawProduct);
                logger.info(`[PRODUCT DETAILS] Formatted details for product: ${productId}`);
                return formatted;
            } catch (err) {
                logger.error(`[PRODUCT DETAILS] Failed to fetch details: ${err.message}`);

                if (context.selectedProduct && context.selectedProduct.id === productId) {
                    logger.info("[PRODUCT DETAILS] Falling back to session context product");
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
                return { type: "text", text: errorText };
            }
        }

        // ── Track Order ───────────────────────────────────────────────────────
        case INTENTS.TRACK_ORDER: {
            const orderNumber = parameters.orderNumber || parameters.order_number;
            logger.tracking(`Tracking order number: ${orderNumber}`);

            if (!orderNumber) {
                return {
                    type: "text",
                    text: "Please provide a valid Order ID to track."
                };
            }
            try {
                const trackingData = await trackOrder(orderNumber);
                return {
                    type: "order_tracking",
                    tracking: trackingData
                };
            } catch (error) {
                return {
                    type: "order_tracking_error",
                    message: error.message || "Unable to retrieve order status",
                    orderNumber
                };
            }
        }
        case INTENTS.CHECK_DELIVERY: {
            const context = getShoppingContext(sessionId);
            const productId = parameters.productId || parameters.product_id || (context.selectedProduct ? context.selectedProduct.id : null);
            
            let product = null;
            if (productId) {
                try {
                    product = await getProductDetails(productId);
                } catch (e) {
                    if (context.selectedProduct && context.selectedProduct.id === productId) {
                        product = context.selectedProduct;
                    }
                }
            } else if (context.selectedProduct) {
                product = context.selectedProduct;
            }

            const address = parameters.address || parameters.city;
            if (address) {
                await startDeliveryFlow(sessionId, product, lang);
                const session = await getDeliverySession(sessionId);
                return await handleAddressInput(session, address, lang);
            } else {
                return await startDeliveryFlow(sessionId, product, lang);
            }
            }

        default:
            return {
                success: false,
                message: "Unknown intent",
            };
    }
};
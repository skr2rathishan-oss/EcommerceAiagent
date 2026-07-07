import { INTENTS } from "../config/intents.mjs";
import { searchProducts, getProductDetails } from "../services/integration/mcp.service.mjs";
import { getShoppingContext, updateShoppingContext, getMemory, updateMemory } from "./memoryManager.mjs";
import { rememberSearchResults } from "./reference/05_referenceManager.mjs";
import { formatProductDetails } from "../utils/productDetailsFormatter.mjs";
import { applyFilters, getSuggestions } from "../utils/filterEngine.mjs";
import { trackInteraction } from "../services/commerce/productInteraction.service.mjs";
import { trackOrder } from "../services/commerce/orderTracking.service.mjs";
import { checkDelivery } from "../services/commerce/delivery.service.mjs";
import { parseAddress } from "../services/commerce/addressService.mjs";
import { handleDeliveryFailure } from "../services/commerce/deliveryRecoveryService.mjs";
import { startDeliveryFlow, handleAddressInput } from "../services/commerce/deliveryFlowService.mjs";
import { getDeliverySession } from "../memory/memoryStore.mjs";
import { createShoppingContext, updateShoppingContextInDB } from "../services/commerce/shoppingContextService.mjs";
import { setActiveShoppingContext, loadConversationState } from "../services/commerce/conversationStateService.mjs";
import logger from "../utils/logger.mjs";

// ── Fallback Query Mapping ───────────────────────────────────────────────────
// Trigger restart.
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

            if (!searchQuery || searchQuery.trim().length < 3) {
                logger.info(`[SEARCH PRODUCTS] Query is empty or too short: "${searchQuery}". Requesting clarification.`);
                return {
                    error: true,
                    code: "MISSING_QUERY"
                };
            }

            let results;
            try {
                const isVagueAccessory = ["accessory", "accessories", "components", "parts", "items", "extras"].some(word => searchQuery.toLowerCase().includes(word));
                const shoppingCtx = getShoppingContext(sessionId) || {};
                const prevQuery = shoppingCtx.searchQuery || "";

                if (isVagueAccessory && prevQuery) {
                    logger.info(`[SEARCH RECOVERY] Detected accessory search mismatch with previous query: "${prevQuery}". Refining search...`);
                    let refinedQuery = `${prevQuery} accessories`;
                    results = await searchProducts(refinedQuery);
                    if (results && results.length > 0) {
                        searchQuery = refinedQuery;
                    } else {
                        logger.info(`[SEARCH RECOVERY] No refined accessory results. Falling back to previous query: "${prevQuery}" to return laptops`);
                        searchQuery = prevQuery;
                        results = await searchProducts(prevQuery);
                    }
                } else {
                    results = await searchProducts(searchQuery);
                }

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

            // Apply Accessory Filter from implementation.md
            if (Array.isArray(results) && searchQuery) {
                const lowerQ = searchQuery.toLowerCase();
                if (["phone", "smartphone", "mobile", "phn"].some(word => lowerQ.includes(word))) {
                    const ignoredKeywords = [
                        "case", "cover", "tripod", "holder", "gimbal", "selfie stick", 
                        "charger", "cable", "screen protector", "tempered glass", "battery", 
                        "earbuds", "headphones"
                    ];
                    results = results.filter(p => {
                        const name = p.name ? p.name.toLowerCase() : "";
                        return !ignoredKeywords.some(keyword => name.includes(keyword));
                    });
                }
                if (lowerQ.includes("laptop") || lowerQ.includes("notebook")) {
                    const ignoredKeywords = ["bag", "mouse", "keyboard", "adapter"];
                    results = results.filter(p => {
                        const name = p.name ? p.name.toLowerCase() : "";
                        return !ignoredKeywords.some(keyword => name.includes(keyword));
                    });
                }
                if (["tv", "television", "led tv", "smart tv"].some(word => lowerQ.includes(word))) {
                    const ignoredKeywords = ["wall mount", "remote", "hdmi cable", "hdmi"];
                    results = results.filter(p => {
                        const name = p.name ? p.name.toLowerCase() : "";
                        return !ignoredKeywords.some(keyword => name.includes(keyword));
                    });
                }
            }

            onProgress?.("SEARCHING", "completed", [`Retrieved ${results.length} products`]);
            onProgress?.("FILTERING", "active");

            const filters = parameters.filters || {};
            const category = filters.category || "";
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

            const activeCtx = await createShoppingContext(sessionId, searchQuery, category, filters);
            if (activeCtx) {
                await setActiveShoppingContext(sessionId, activeCtx.contextId);
                await updateShoppingContextInDB(activeCtx.contextId, { viewedProducts: finalProducts, lastSearchResults: finalProducts });
            }

            updateShoppingContext(sessionId, { lastSearchResults: finalProducts });
            rememberSearchResults(sessionId, finalProducts);
            logger.info(`[SHOPPING CONTEXT] Stored ${finalProducts.length} filtered/suggested products for session: ${sessionId}`);

            onProgress?.("RANKING", "completed", ["Ranked by relevance"]);
            onProgress?.("READY", "active");

            return {
                type: "product_grid",
                products: finalProducts,
                isSuggestion: !!introText
            };
        }

        // ── Product Selection ─────────────────────────────────────────────────
        case INTENTS.SELECT_PRODUCT: {
            const product = parameters.product;
            if (!product) {
                return { error: true, code: "PRODUCT_NOT_FOUND" };
            }

            updateShoppingContext(sessionId, { selectedProduct: product });
            logger.info(`[SHOPPING CONTEXT] Selected product: ${product.name} for session: ${sessionId}`);

            // VCSM Integration: Update active context in MongoDB
            const state = await loadConversationState(sessionId);
            if (state && state.active_shopping_context) {
                await updateShoppingContextInDB(state.active_shopping_context, { selectedProduct: product });
            }

            trackInteraction(sessionId, product.id, product.name, product.category, "view").catch(err => {
                logger.error("[Background Tracking Error] Failed to track select_product:", err);
            });

            return {
                type: "product_selected",
                productId: product.id,
                product: product
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
                return { error: true, code: "MISSING_PRODUCT_ID" };
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

                return { error: true, code: "PRODUCT_DETAILS_FAILED" };
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
            const memory = getMemory(sessionId);
            const productId = parameters.productId || parameters.product_id || (context.selectedProduct ? context.selectedProduct.id : (memory.buyNowProduct ? (memory.buyNowProduct.id || memory.buyNowProduct.productId) : null));
            
            let product = null;
            if (productId) {
                try {
                    product = await getProductDetails(productId);
                } catch (e) {
                    if (context.selectedProduct && context.selectedProduct.id === productId) {
                        product = context.selectedProduct;
                    } else if (memory.buyNowProduct && (memory.buyNowProduct.id === productId || memory.buyNowProduct.productId === productId)) {
                        product = memory.buyNowProduct;
                    }
                }
            } else if (context.selectedProduct) {
                product = context.selectedProduct;
            } else if (memory.buyNowProduct) {
                product = memory.buyNowProduct;
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

        case INTENTS.DELIVERY_FLOW_INPUT: {
            const {
                handleAddressConfirmation,
                handleDateInput,
                handleRecoveryChoice,
                handleCancelOptions,
                handleCheckoutConfirmation,
                handleContactNameInput,
                handleContactPhoneInput,
                handleCancelChoice
            } = await import("../services/commerce/deliveryFlowService.mjs");
            
            const message = parameters.message || parameters.query || "";
            const session = await getDeliverySession(sessionId);
            if (!session) {
                return { status: "temporary_error" };
            }

            const deliveryState = session.state;
            logger.info(`[INTENT ROUTER] Processing DELIVERY_FLOW_INPUT. State: ${deliveryState}, Message: "${message}"`);
            if (deliveryState === "WAITING_FOR_ADDRESS") {
                return await handleAddressInput(session, message, lang);
            } else if (deliveryState === "WAITING_FOR_ADDRESS_CONFIRMATION") {
                return await handleAddressConfirmation(session, message, lang);
            } else if (deliveryState === "WAITING_FOR_DATE") {
                return await handleDateInput(session, message, lang);
            } else if (deliveryState === "WAITING_FOR_RECOVERY_CHOICE") {
                return await handleRecoveryChoice(session, message, lang);
            } else if (deliveryState === "WAITING_FOR_ALTERNATIVE_PRODUCT_SELECTION") {
                return await handleCancelOptions(session, message, lang);
            } else if (deliveryState === "WAITING_FOR_CONFIRMATION" || deliveryState === "WAITING_FOR_FINAL_ORDER_CONFIRMATION") {
                return await handleCheckoutConfirmation(session, message, lang);
            } else if (deliveryState === "WAITING_FOR_CONTACT_NAME") {
                return await handleContactNameInput(session, message, lang);
            } else if (deliveryState === "WAITING_FOR_CONTACT_PHONE") {
                return await handleContactPhoneInput(session, message, lang);
            } else if (deliveryState === "WAITING_FOR_CANCEL_CHOICE") {
                return await handleCancelChoice(session, message, lang);
            }

            return { status: "temporary_error" };
        }

        default:
            return {
                success: false,
                message: "Unknown intent",
            };
    }
};

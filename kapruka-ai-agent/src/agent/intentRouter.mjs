import { INTENTS } from "../config/intents.mjs";
import { searchProducts, getProductDetails } from "../services/mcp.service.mjs";
import { getShoppingContext, updateShoppingContext, getMemory, updateMemory } from "./memoryManager.mjs";
import { formatProductDetails } from "../utils/productDetailsFormatter.mjs";
import { applyFilters, getSuggestions } from "../utils/filterEngine.mjs";
import { trackInteraction } from "../services/productInteraction.service.mjs";
import { checkDelivery, listDeliveryCities, findNearbyCities } from "../services/delivery.service.mjs";
import { handleDeliveryFailure, findAlternativeLocations, findAlternativeDates, findAlternativeProducts } from "../services/deliveryRecoveryService.mjs";
import { trackOrder } from "../services/orderTracking.service.mjs";
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
            try {
                results = await searchProducts(
                    parameters.query || parameters.q
                );
            } catch (err) {
                logger.error("[SEARCH PRODUCTS] MCP Search failed:", err.message);
                results = [];
            }

            onProgress?.("SEARCHING", "completed", [`Retrieved ${results.length} products`]);
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

                // Fallback: use product from shopping context if MCP call fails
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

        case INTENTS.CHECK_DELIVERY: {
            onProgress?.("UNDERSTANDING", "active");

            const context = getShoppingContext(sessionId);
            const productId = parameters.productId || parameters.product_id || context.selectedProduct?.id;
            const city = parameters.city;

            let date = parameters.deliveryDate || parameters.delivery_date;
            if (date === "tomorrow") {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              date = tomorrow.toISOString().split("T")[0];
            } else if (date === "next day" || date === "next_day") {
              const nextDay = new Date();
              nextDay.setDate(nextDay.getDate() + 2);
              date = nextDay.toISOString().split("T")[0];
            } else if (!date) {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              date = tomorrow.toISOString().split("T")[0];
            }

            if (!city) {
              return {
                type: "text",
                text: "Which city would you like to deliver to?"
              };
            }

            try {
              const res = await checkDelivery(city, date, productId);

              if (res.available) {
                logger.delivery(`Delivery Available to ${city} on ${date}`);
                return {
                  type: "delivery_result",
                  available: true,
                  city: res.city || city,
                  deliveryDate: res.deliveryDate || date,
                  deliveryCharge: res.deliveryCharge || 0,
                  text: `✅ Delivery is available for **${res.city || city}** on **${res.deliveryDate || date}**.\n\n- **Delivery Charge**: Rs. ${res.deliveryCharge || 0}\n- **Service Carrier**: Next-day dispatch qualified.`
                };
              } else {
                logger.delivery(`Delivery Check Failed for ${city} on ${date} (Unavailable)`);

                const recovery = await handleDeliveryFailure(city, date, productId);

                updateMemory(sessionId, {
                  lastCheckedDelivery: {
                    city: city,
                    deliveryDate: date,
                    productId: productId || ""
                  }
                });

                return {
                  type: "delivery_result",
                  ...recovery
                };
              }
            } catch (err) {
              logger.delivery(`Delivery Check Error for ${city} on ${date}: ${err.message}`);

              const recovery = await handleDeliveryFailure(city, date, productId);

              updateMemory(sessionId, {
                lastCheckedDelivery: {
                  city: city,
                  deliveryDate: date,
                  productId: productId || ""
                }
              });

              return {
                type: "delivery_result",
                ...recovery
              };
            }
        }

        case INTENTS.RECOVERY_NEARBY_LOCATION: {
            logger.delivery(`Recovery Flow Started: Nearby Location check`);

            const memory = getMemory(sessionId);
            const lastChecked = memory.lastCheckedDelivery || {};
            const city = lastChecked.city || "Mullaitivu";

            const nearby = await findAlternativeLocations(city);
            logger.delivery(`Alternative Locations Suggested: ${nearby.join(", ")}`);

            return {
              type: "nearby_cities",
              city: city,
              cities: nearby,
              text: `I couldn't deliver this item to **${city}** on your selected date.\n\nNearby delivery locations:\n${nearby.map(c => `📍 ${c}`).join("\n")}\n\nYou can select one from the panel below or choose another date or similar product.`
            };
        }

        case INTENTS.RECOVERY_ALTERNATIVE_DATE: {
            logger.delivery(`Recovery Flow Started: Alternative Date check`);

            const dates = findAlternativeDates();

            return {
              type: "alternative_date",
              dates: dates,
              text: "📅 Choose Another Delivery Date\n\nPlease choose Tomorrow, Next Day, or a custom date from the panel below to check delivery again."
            };
        }

        case INTENTS.RECOVERY_SIMILAR_PRODUCTS: {
            logger.recommendation(`Recovery Flow Started: Suggesting similar deliverable products`);

            const memory = getMemory(sessionId);
            const lastChecked = memory.lastCheckedDelivery || {};
            const productId = lastChecked.productId || (memory.shoppingContext?.selectedProduct?.id);

            const products = await findAlternativeProducts(productId);
            logger.recommendation(`Similar Products Found: ${products.length} alternatives`);

            return {
              type: "similar_products",
              products: products,
              text: `🎁 Find Similar Deliverable Products\n\nHere are some similar products that might be deliverable to your location:`
            };
        }

        case INTENTS.CREATE_ORDER: {
            logger.checkout(`CREATE_ORDER intent detected for session: ${sessionId}`);
            const memory = getMemory(sessionId);
            const cart = memory.cart || [];
            
            if (cart.length === 0) {
                logger.checkout(`Cart is empty for session: ${sessionId}. Aborting checkout.`);
                return {
                    type: "text",
                    text: "Your cart is empty. Please add some products to your cart before checking out!"
                };
            }
            
            logger.checkout(`Cart has ${cart.length} items. Initializing checkout panel trigger.`);
            return {
                type: "checkout_init",
                text: "I have opened the checkout panel for you. Please confirm your delivery details in the checkout panel.",
                cart: cart
            };
        }

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

        default:
            return {
                success: false,
                message: "Unknown intent",
            };
    }
};
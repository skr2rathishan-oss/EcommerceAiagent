import { INTENTS } from "../config/intents.mjs";
import { searchProducts } from "../services/mcp.service.mjs";

export const routeIntent = async (intent, parameters = {}) => {
    switch (intent) {
        case INTENTS.SEARCH_PRODUCTS:
            return await searchProducts(
                parameters.query || parameters.q
            );
            
        case INTENTS.GET_PRODUCT_DETAILS:
            return {
                success: true,
                action: "get_product_details",
                parameters,
            };

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
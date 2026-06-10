export const AI_RESPONSE_EXAMPLES = {
    SEARCH_PRODUCTS: {
        intent: "search_products",
        parameters: {
            query: "chocolate cake"
        }
    },

    GET_PRODUCT_DETAILS: {
        intent: "get_product_details",
        parameters: {
            productId: "CAKE123"
        }
    },

    CHECK_DELIVERY: {
        intent: "check_delivery",
        parameters: {
            productId: "CAKE123",
            city: "Jaffna",
            date: "2026-06-20"
        }
    },

    CREATE_ORDER: {
        intent: "create_order",
        parameters: {}
    },

    TRACK_ORDER: {
        intent: "track_order",
        parameters: {
            orderNumber: "VIMP34456CB2"
        }
    },

    GENERAL_CHAT: {
        intent: "general_chat",
        parameters: {}
    }
};
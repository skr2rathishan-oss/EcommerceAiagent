// ------------------------------------------------------------
// Minimal mock for Kapruka MCP client – used only in test runs
// ------------------------------------------------------------
export const getMcpClient = async () => {
  // The mock client mimics the real Client API used in the tests.
  return {
    // `callTool` receives an object { name, arguments } and must
    // return a structure that the test code can read:
    //   result?.structuredContent?.result  OR
    //   result?.content?.[0]?.text
    async callTool({ name, arguments: args }) {
      // Very simple deterministic responses per tool name.
      // In a real suite you could load JSON fixtures, but this keeps it light.
      const dummyResponses = {
        kapruka_search_products: {
          structuredContent: { result: JSON.stringify({ items: [], total: 0 }) },
        },
        kapruka_get_product: {
          // Return error when product_id starts with "invalid"
          ...(args.params?.product_id?.startsWith("invalid")
            ? { error: { message: "product_not_found" } }
            : {
                structuredContent: {
                  result: JSON.stringify({
                    product_id: args.params?.product_id ?? "unknown",
                    name: "Mock Product",
                  }),
                },
              }),
        },
        kapruka_list_categories: {
          structuredContent: { result: JSON.stringify({ categories: [] }) },
        },
        kapruka_list_delivery_cities: {
          structuredContent: { result: JSON.stringify({ cities: [] }) },
        },
        kapruka_check_delivery: {
          // Return error for invalid city (contains "Invalid")
          ...(args.params?.city?.includes("Invalid")
            ? { error: { message: "city_not_supported" } }
            : {
                structuredContent: {
                  result: JSON.stringify({
                    can_deliver: true,
                    rate: 0,
                    warning: null,
                  }),
                },
              }),
        },
        kapruka_create_order: (() => {
          const missingField = !args.params?.recipient || !args.params?.delivery;
          const hasInvalidProduct = (args.params?.cart ?? []).some(
            item => item.product_id?.startsWith("invalid")
          );

          if (missingField) {
            // Missing required field → validation error
            return { error: { message: "validation_error", details: "Missing required fields" } };
          }
          if (hasInvalidProduct) {
            // Invalid product in cart → product_not_found error
            return { error: { message: "product_not_found" } };
          }
          // All fields valid → return success
          return {
            structuredContent: {
              result: JSON.stringify({
                checkout_url: "https://kapruka.com/checkout/MOCK12345",
                order_ref:    "MOCK12345",
                summary: {
                  items_total:  2500,
                  delivery_fee: 350,
                  addons_total: 0,
                  grand_total:  2850,
                  currency:     "LKR",
                },
                expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
              }),
            },
          };
        })(),
        kapruka_track_order: {
          error: { message: "order_not_found", order_number: args.params?.order_number },
        },
      };

      // Return the matching dummy, falling back to a generic empty result.
      return dummyResponses[name] ?? { structuredContent: { result: "{}" } };
    },
  };
};

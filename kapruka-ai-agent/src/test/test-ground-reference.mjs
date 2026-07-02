import { rememberSearchResults, handleReference } from "../agent/reference/05_referenceManager.mjs";
import { getSelection } from "../agent/reference/01_selectionMemory.mjs";

async function runGroundReferenceTests() {
    console.log("=================================================");
    console.log("VELORA GROUND & DYNAMIC REFERENCE UNIT TESTS");
    console.log("=================================================");

    const sessionId = "sess_ground_test_" + Date.now();
    const mockProducts = [
        { id: "prod_cake_1", name: "Chocolate Fudge Celebration Cake", price: 4500, currency: "LKR", category: "Cakes", brand: "Kapruka" },
        { id: "prod_flower_2", name: "Red Rose Blossom Flower Bouquet", price: 3200, currency: "LKR", category: "Flowers", brand: "Kapruka" },
        { id: "prod_dress_3", name: "Evening Silk Dress", price: 12500, currency: "LKR", category: "Fashion", brand: "GFLOCK" }
    ];

    let passed = 0;
    let failed = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`[PASS] ${message}`);
            passed++;
        } else {
            console.error(`[FAIL] ${message}`);
            failed++;
        }
    }

    try {
        // 1. Save products and generate index
        rememberSearchResults(sessionId, mockProducts);
        const selection = getSelection(sessionId);
        assert(selection !== null, "Selection memory exists");
        assert(selection.products.length === 3, "Contains 3 products");

        // 2. Test "SHOW_ALL_PRODUCTS" / Plural reference
        const refResultAll1 = handleReference(sessionId, "show me those");
        assert(refResultAll1.success === true, "Should resolve 'show me those'");
        assert(refResultAll1.action === "SHOW_ALL_PRODUCTS", "Action is SHOW_ALL_PRODUCTS");
        assert(refResultAll1.products.length === 3, "Contains all 3 products");

        const refResultAll2 = handleReference(sessionId, "can I see the images");
        assert(refResultAll2.success === true, "Should resolve 'can I see the images'");
        assert(refResultAll2.action === "SHOW_ALL_PRODUCTS", "Action is SHOW_ALL_PRODUCTS");

        const refResultAll3 = handleReference(sessionId, "let me see them");
        assert(refResultAll3.success === true, "Should resolve 'let me see them'");
        assert(refResultAll3.action === "SHOW_ALL_PRODUCTS", "Action is SHOW_ALL_PRODUCTS");

        // 3. Test dynamic keyword matches - Category ("flowers")
        const refResultFlower = handleReference(sessionId, "show me the flowers");
        assert(refResultFlower.success === true, "Should resolve 'flowers' dynamically");
        assert(refResultFlower.action === "PRODUCT_SELECTED", "Action is PRODUCT_SELECTED (since only one matches)");
        assert(refResultFlower.product.name.includes("Flower Bouquet"), "Resolved flower matches bouquet");

        // 4. Test dynamic keyword matches - Category ("dress")
        const refResultDress = handleReference(sessionId, "Show me the dress");
        assert(refResultDress.success === true, "Should resolve 'dress' dynamically");
        assert(refResultDress.action === "PRODUCT_SELECTED", "Action is PRODUCT_SELECTED");
        assert(refResultDress.product.name === "Evening Silk Dress", "Resolved dress is Evening Silk Dress");

        // 5. Test dynamic keyword matches - Name word ("cake")
        const refResultCake = handleReference(sessionId, "Show me the cake");
        assert(refResultCake.success === true, "Should resolve 'cake' dynamically");
        assert(refResultCake.action === "PRODUCT_SELECTED", "Action is PRODUCT_SELECTED");
        assert(refResultCake.product.name.includes("Celebration Cake"), "Resolved cake is Chocolate Fudge Celebration Cake");

        // 6. Test dynamic comparison under match
        // Let's add another cake and test
        const mockProductsWithTwoCakes = [
            ...mockProducts,
            { id: "prod_cake_2", name: "Red Velvet Ribbon Cake", price: 4800, currency: "LKR", category: "Cakes", brand: "Kapruka" }
        ];
        rememberSearchResults(sessionId, mockProductsWithTwoCakes);

        const refResultCakes = handleReference(sessionId, "show me the cakes");
        assert(refResultCakes.success === true, "Should resolve plural 'cakes' dynamically");
        assert(refResultCakes.action === "COMPARE_PRODUCTS", "Action should resolve to COMPARE_PRODUCTS since multiple match");
        assert(refResultCakes.products.length === 2, "Should resolve exactly 2 matching cake products");
        assert(refResultCakes.products[0].name.includes("Celebration Cake"), "First cake is Fudge");
        assert(refResultCakes.products[1].name.includes("Ribbon Cake"), "Second cake is Ribbon");

        console.log("=================================================");
        console.log(`DYNAMIC REFERENCE UNIT TESTS COMPLETED. Passed: ${passed}, Failed: ${failed}`);
        console.log("=================================================");
        process.exit(failed > 0 ? 1 : 0);
    } catch (e) {
        console.error("Unit test suite failed with unhandled exception:", e);
        process.exit(1);
    }
}

runGroundReferenceTests();

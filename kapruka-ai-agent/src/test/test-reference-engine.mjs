import { rememberSearchResults, handleReference } from "../agent/reference/05_referenceManager.mjs";
import { getSelection, getSelectionSummary } from "../agent/reference/01_selectionMemory.mjs";
import { buildRuntimeContext } from "../agent/builders/runtimeBuilder.mjs";
import { buildPromptOS } from "../agent/prompts/builder/promptBuilder.mjs";

async function runReferenceTests() {
    console.log("=================================================");
    console.log("VELORA REFERENCE ENGINE INTEGRATION TEST SUITE");
    console.log("=================================================");

    const sessionId = "test_session_" + Date.now();
    const mockProducts = [
        { id: "prod_iphone_15", name: "Apple iPhone 15", price: 299000, currency: "Rs.", brand: "Apple", description: "Standard iPhone 15", sku: "SKU-IP15", mongoId: "507f1f77bcf86cd799439011" },
        { id: "prod_samsung_s24", name: "Samsung Galaxy S24", price: 259000, currency: "Rs.", brand: "Samsung", description: "AI flagship phone", sku: "SKU-S24", mongoId: "507f1f77bcf86cd799439012" },
        { id: "prod_google_pixel", name: "Google Pixel 8", price: 219000, currency: "Rs.", brand: "Google", description: "Pure Android experience", sku: "SKU-P8", mongoId: "507f1f77bcf86cd799439013" }
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
        // --- Test 1: Save Search Results ---
        rememberSearchResults(sessionId, mockProducts);
        const selection = getSelection(sessionId);
        assert(selection !== null, "Selection memory should exist for session");
        assert(selection.products.length === 3, "Selection memory should contain exactly 3 products");
        assert(selection.products[1].id === "prod_samsung_s24", "Second product should be Samsung S24");

        // --- Test 2: Resolve Conversational Reference (Single) ---
        const refResult1 = handleReference(sessionId, "show details of the second phone");
        assert(refResult1.success === true, "Should resolve 'second phone' successfully");
        assert(refResult1.action === "PRODUCT_SELECTED", "Action should be PRODUCT_SELECTED");
        assert(refResult1.product.name === "Samsung Galaxy S24", "Resolved product should be Samsung Galaxy S24");
        assert(refResult1.product.id === undefined, "Sanitized product should NOT contain 'id'");
        assert(refResult1.product.mongoId === undefined, "Sanitized product should NOT contain 'mongoId'");
        assert(refResult1.product.sku === undefined, "Sanitized product should NOT contain 'sku'");
        assert(refResult1.internalProduct.id === "prod_samsung_s24", "Internal product should preserve original ID");

        // --- Test 3: Resolve Conversational Reference (Comparison) ---
        const refResult2 = handleReference(sessionId, "compare the first and third ones");
        assert(refResult2.success === true, "Should resolve 'compare first and third' successfully");
        assert(refResult2.action === "COMPARE_PRODUCTS", "Action should be COMPARE_PRODUCTS");
        assert(refResult2.products.length === 2, "Should return 2 products for comparison");
        assert(refResult2.products[0].name === "Apple iPhone 15", "First compared product should be iPhone 15");
        assert(refResult2.products[1].name === "Google Pixel 8", "Second compared product should be Pixel 8");
        assert(refResult2.products[0].id === undefined, "Sanitized compared product should NOT contain 'id'");

        // --- Test 4: Handle Invalid Reference Range ---
        const refResult3 = handleReference(sessionId, "show details of the fifth one");
        assert(refResult3.success === false, "Should return failure for out-of-bounds index (5th)");
        assert(refResult3.reason === "PRODUCT_NOT_FOUND", "Reason should be PRODUCT_NOT_FOUND");
        assert(refResult3.response.includes("between 1 and 3"), "Response should guide user to valid range 1-3");

        // --- Test 5: Handle Reference with No Memory ---
        const fakeSessionId = "fake_session_" + Date.now();
        const refResult4 = handleReference(fakeSessionId, "tell me about the first one");
        assert(refResult4.success === false, "Should return failure when session selection memory is missing");
        assert(refResult4.reason === "NO_SELECTION_MEMORY", "Reason should be NO_SELECTION_MEMORY");

        // --- Test 6: Prompt OS updates ---
        const promptOS = buildPromptOS();
        assert(promptOS.includes("PRODUCT REFERENCE INSTRUCTIONS"), "Prompt OS should contain Reference section");
        assert(promptOS.includes("NEVER EXPOSE INTERNAL PRODUCT IDS"), "Prompt OS should warn against exposing internal IDs");

        // --- Test 7: Runtime Context formatting (Single Resolved) ---
        const runtime1 = buildRuntimeContext({
            resolvedReference: refResult1
        });
        assert(runtime1.prompt.includes("REFERENCE RUNTIME (RESOLVED PRODUCT)"), "Runtime prompt should render resolved single product header");
        assert(runtime1.prompt.includes("Name: Samsung Galaxy S24"), "Runtime prompt should contain resolved product name");
        assert(!runtime1.prompt.includes("prod_samsung_s24"), "Runtime prompt should NEVER contain internal product IDs");

        // --- Test 8: Runtime Context formatting (Comparison Resolved) ---
        const runtime2 = buildRuntimeContext({
            resolvedReference: refResult2
        });
        assert(runtime2.prompt.includes("REFERENCE RUNTIME (COMPARE PRODUCTS)"), "Runtime prompt should render compare products header");
        assert(runtime2.prompt.includes("Product 1:\nName: Apple iPhone 15"), "Runtime prompt should list compared product 1");
        assert(runtime2.prompt.includes("Product 2:\nName: Google Pixel 8"), "Runtime prompt should list compared product 2");
        assert(!runtime2.prompt.includes("prod_iphone_15"), "Runtime prompt should NEVER contain internal product IDs");

        console.log("=================================================");
        console.log(`TEST RUN COMPLETED. Passed: ${passed}, Failed: ${failed}`);
        console.log("=================================================");
        process.exit(failed > 0 ? 1 : 0);
    } catch (e) {
        console.error("Test execution threw unhandled exception:", e);
        process.exit(1);
    }
}

runReferenceTests();

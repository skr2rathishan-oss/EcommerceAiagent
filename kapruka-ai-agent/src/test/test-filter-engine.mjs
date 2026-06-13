import { matchProduct, applyFilters, getSuggestions } from "../utils/filterEngine.mjs";

const sampleProducts = [
  {
    id: "p1",
    name: "Samsung Galaxy M04 Mobile Phone",
    price: 35000,
    currency: "LKR",
    category: "mobile",
    brand: "Samsung",
    inStock: true
  },
  {
    id: "p2",
    name: "Apple iPhone 13 Pro Max",
    price: 180000,
    currency: "LKR",
    category: "mobile",
    brand: "Apple",
    inStock: true
  },
  {
    id: "p3",
    name: "Nike Men's Black Polo Shirt",
    price: 38000,
    currency: "LKR",
    category: "shirt",
    brand: "Nike",
    color: "black",
    type: "polo",
    gender: "men",
    size: "M",
    inStock: true
  },
  {
    id: "p4",
    name: "Chocolate Gateau Cake",
    price: 2500,
    currency: "LKR",
    category: "cake",
    brand: "Kapruka",
    flavor: "chocolate",
    inStock: true
  },
  {
    id: "p5",
    name: "Red Rose Bouquet",
    price: 1500,
    currency: "LKR",
    category: "flower",
    brand: "Kapruka",
    color: "red",
    inStock: true
  }
];

function runTests() {
  console.log("=== RUNNING FILTER ENGINE TESTS ===");

  // Test 1: Category filter "mobile"
  {
    const filters = { category: "mobile" };
    const results = applyFilters(sampleProducts, filters);
    console.log("Test 1 (category=mobile): Expected 2, got:", results.length);
    if (results.length !== 2) throw new Error("Test 1 failed");
  }

  // Test 2: Category and Brand "Samsung mobile"
  {
    const filters = { category: "mobile", brand: "Samsung" };
    const results = applyFilters(sampleProducts, filters);
    console.log("Test 2 (category=mobile, brand=Samsung): Expected 1 (p1), got:", results[0]?.id);
    if (results.length !== 1 || results[0].id !== "p1") throw new Error("Test 2 failed");
  }

  // Test 3: PriceMax constraint "Samsung under 50000"
  {
    const filters = { category: "mobile", brand: "Samsung", priceMax: 50000 };
    const results = applyFilters(sampleProducts, filters);
    console.log("Test 3 (Samsung mobile priceMax=50000): Expected 1, got:", results.length);
    if (results.length !== 1 || results[0].id !== "p1") throw new Error("Test 3 failed");
  }

  // Test 4: PriceMax constraint "Samsung under 30000" (no matches)
  {
    const filters = { category: "mobile", brand: "Samsung", priceMax: 30000 };
    const results = applyFilters(sampleProducts, filters);
    console.log("Test 4 (Samsung mobile priceMax=30000): Expected 0, got:", results.length);
    if (results.length !== 0) throw new Error("Test 4 failed");

    // Test suggestions for no matches
    const suggestions = getSuggestions(sampleProducts, filters);
    console.log("Test 4 suggestions: Expected 1 (p1), got:", suggestions.map(p => p.id));
    if (suggestions.length !== 1 || suggestions[0].id !== "p1") throw new Error("Test 4 suggestions failed");
  }

  // Test 5: Detailed shirt attributes "black polo shirts for men under 40000"
  {
    const filters = { category: "shirt", color: "black", type: "polo", gender: "men", priceMax: 40000 };
    const results = applyFilters(sampleProducts, filters);
    console.log("Test 5 (detailed shirt filters): Expected 1 (p3), got:", results[0]?.id);
    if (results.length !== 1 || results[0].id !== "p3") throw new Error("Test 5 failed");
  }

  // Test 6: Detailed cake attributes "chocolate cakes under 3000"
  {
    const filters = { category: "cake", flavor: "chocolate", priceMax: 3000 };
    const results = applyFilters(sampleProducts, filters);
    console.log("Test 6 (chocolate cake priceMax=3000): Expected 1 (p4), got:", results[0]?.id);
    if (results.length !== 1 || results[0].id !== "p4") throw new Error("Test 6 failed");
  }

  // Test 7: Size matching whole-word vs substring
  {
    // Test size "S" (should NOT match "Samsung" or "Rose Bouquet" but if product has size "S" or "S" as whole word, etc.)
    const filters = { size: "S" };
    const results = applyFilters(sampleProducts, filters);
    console.log("Test 7 (size=S): Expected 0 (should not match 'S' in 'Samsung'), got:", results.length);
    if (results.length !== 0) throw new Error("Test 7 failed");
  }

  console.log("=== ALL TESTS PASSED SUCCESSFULLY ===");
}

try {
  runTests();
} catch (err) {
  console.error("Test execution failed:", err.message);
  process.exit(1);
}

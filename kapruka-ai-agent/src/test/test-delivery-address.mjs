/**
 * test-delivery-address.mjs
 * ═══════════════════════════════════════════════════════════════════════════
 * Integration tests for the Delivery Address creation/retrieval endpoints.
 *
 * Tests the full lifecycle:
 *   1. Save a new address for a session
 *   2. Retrieve all saved addresses for that session
 *   3. Save a second address (confirm ordering)
 *   4. Save an address marked as default (verify previous default is unset)
 *   5. Missing params → 400 validation error
 *   6. Missing sessionId → 400 error
 *
 * The backend must be running on http://127.0.0.1:5000 before running this.
 */

const BASE_URL = "http://127.0.0.1:5000/api/delivery";

// ─── Helper ────────────────────────────────────────────────────────────────────

async function post(path, body, sessionId = null) {
  const headers = { "Content-Type": "application/json" };
  if (sessionId) headers["x-session-id"] = sessionId;
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function get(path, sessionId = null) {
  const headers = {};
  if (sessionId) headers["x-session-id"] = sessionId;
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

// ─── Test Runner ───────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(label, condition, details = "") {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}${details ? " — " + details : ""}`);
    failed++;
  }
}

// ─── Test Definitions ──────────────────────────────────────────────────────────

// Unique session per test run to avoid MongoDB collisions
const SESSION_ID = `test-addr-${Date.now()}`;

const ADDRESS_1 = {
  label: "Home",
  fullName: "Tharaka Perera",
  phone: "0771234567",
  address: "No 45, Galle Road",
  city: "Colombo",
  province: "Western",
  postalCode: "00300",
  isDefault: false
};

const ADDRESS_2 = {
  label: "Office",
  fullName: "Tharaka Perera",
  phone: "0779876543",
  address: "No 15, Hospital Road",
  city: "Kandy",
  province: "Central",
  postalCode: "20000",
  isDefault: false
};

const ADDRESS_DEFAULT = {
  label: "Parent Home",
  fullName: "Saman Perera",
  phone: "0761112233",
  address: "No 7, Temple Lane",
  city: "Jaffna",
  province: "Northern",
  postalCode: "40000",
  isDefault: true
};

// ─── Scenario 1: Save first address ────────────────────────────────────────────

async function scenario1_saveFirstAddress() {
  console.log("\n─── Scenario 1: Save first address ───");

  const { status, data } = await post(
    `/concierge/addresses/${SESSION_ID}`,
    { addressData: ADDRESS_1 }
  );

  assert("Status 200", status === 200, `got ${status}`);
  assert("success flag true", data.success === true, JSON.stringify(data));
  assert("Addresses array returned", Array.isArray(data.addresses), JSON.stringify(data));
  assert("Address count is 1", data.addresses.length === 1, `count=${data.addresses.length}`);

  const saved = data.addresses[0];
  assert("Saved label matches", saved.label === ADDRESS_1.label, `got "${saved.label}"`);
  assert("Saved fullName matches", saved.fullName === ADDRESS_1.fullName);
  assert("Saved city matches", saved.city === ADDRESS_1.city);
  assert("First address auto-set as default", saved.isDefault === true,
    "First address should always be marked default");
}

// ─── Scenario 2: GET addresses for session ─────────────────────────────────────

async function scenario2_getAddresses() {
  console.log("\n─── Scenario 2: GET addresses for session ───");

  const { status, data } = await get(`/concierge/addresses/${SESSION_ID}`);

  assert("Status 200", status === 200, `got ${status}`);
  assert("success flag true", data.success === true, JSON.stringify(data));
  assert("Addresses array returned", Array.isArray(data.addresses), JSON.stringify(data));
  assert("1 address in list", data.addresses.length === 1, `count=${data.addresses.length}`);
  assert("City is Colombo", data.addresses[0].city === "Colombo");
}

// ─── Scenario 3: Save second address ───────────────────────────────────────────

async function scenario3_saveSecondAddress() {
  console.log("\n─── Scenario 3: Save second address ───");

  const { status, data } = await post(
    `/concierge/addresses/${SESSION_ID}`,
    { addressData: ADDRESS_2 }
  );

  assert("Status 200", status === 200, `got ${status}`);
  assert("success flag true", data.success === true, JSON.stringify(data));
  assert("Addresses count is now 2", data.addresses.length === 2, `count=${data.addresses.length}`);

  const second = data.addresses[1];
  assert("Second label is Office", second.label === "Office", `got "${second.label}"`);
  assert("Second city is Kandy", second.city === "Kandy", `got "${second.city}"`);
  assert("Second isDefault is false", second.isDefault === false,
    "Non-first address should not auto-default");
}

// ─── Scenario 4: Save address marked as default ────────────────────────────────

async function scenario4_saveDefaultAddress() {
  console.log("\n─── Scenario 4: Save address marked as default ───");

  const { status, data } = await post(
    `/concierge/addresses/${SESSION_ID}`,
    { addressData: ADDRESS_DEFAULT }
  );

  assert("Status 200", status === 200, `got ${status}`);
  assert("success flag true", data.success === true, JSON.stringify(data));
  assert("3 addresses total", data.addresses.length === 3, `count=${data.addresses.length}`);

  // The new address should be default
  const defaultAddr = data.addresses.find(a => a.isDefault === true);
  assert("Exactly one default address", data.addresses.filter(a => a.isDefault).length === 1,
    `${data.addresses.filter(a => a.isDefault).length} defaults found`);
  assert("Default city is Jaffna", defaultAddr?.city === "Jaffna",
    `got "${defaultAddr?.city}"`);
  
  // Previous default (Colombo) should be unset
  const colombo = data.addresses.find(a => a.city === "Colombo");
  assert("Previous default (Colombo) is now non-default", colombo?.isDefault === false,
    `isDefault=${colombo?.isDefault}`);
}

// ─── Scenario 5: Missing addressData body → 400 ────────────────────────────────

async function scenario5_missingAddressData() {
  console.log("\n─── Scenario 5: Missing addressData → 400 ───");

  const { status, data } = await post(
    `/concierge/addresses/${SESSION_ID}`,
    {} // no addressData
  );

  assert("Status 400", status === 400, `got ${status}`);
  assert("Error returned", !!data.error || data.success === false, JSON.stringify(data));
}

// ─── Scenario 6: Bad sessionId (empty string in URL) → route not found ─────────

async function scenario6_emptySessionId() {
  console.log("\n─── Scenario 6: GET with non-existent session ───");

  const unknownSession = `no-such-session-${Date.now()}`;
  const { status, data } = await get(`/concierge/addresses/${unknownSession}`);

  // Should return 200 with empty addresses array (no profile found)
  assert("Status 200", status === 200, `got ${status}`);
  assert("Addresses is empty array", Array.isArray(data.addresses) && data.addresses.length === 0,
    JSON.stringify(data.addresses));
}

// ─── Scenario 7: Verify address field validation ───────────────────────────────

async function scenario7_incompleteAddress() {
  console.log("\n─── Scenario 7: Incomplete address (missing required fields) ───");

  const incompleteAddress = {
    label: "Broken",
    // missing fullName, phone, address, city → Mongoose validation should fail
  };

  const { status, data } = await post(
    `/concierge/addresses/${SESSION_ID}`,
    { addressData: incompleteAddress }
  );

  assert("Status 500 (Mongoose validation error)", status === 500, `got ${status}`);
  assert("Error message returned", !!data.error, JSON.stringify(data));
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function runAll() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  DELIVERY ADDRESS CREATION TESTS");
  console.log(`  Session: ${SESSION_ID}`);
  console.log("═══════════════════════════════════════════════════");

  try {
    await scenario1_saveFirstAddress();
    await scenario2_getAddresses();
    await scenario3_saveSecondAddress();
    await scenario4_saveDefaultAddress();
    await scenario5_missingAddressData();
    await scenario6_emptySessionId();
    await scenario7_incompleteAddress();
  } catch (err) {
    console.error("\n💥 Unexpected error during test run:", err.message);
    process.exit(1);
  }

  console.log("\n═══════════════════════════════════════════════════");
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  console.log("═══════════════════════════════════════════════════\n");

  if (failed > 0) process.exit(1);
}

runAll();

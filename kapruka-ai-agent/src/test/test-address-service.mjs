import { parseAddress } from "../services/commerce/addressService.mjs";

const testCases = [
  // Group A: Good structured addresses
  {
    input: "No25 temple rd wellawatte col 6",
    expected: {
      city: "Colombo",
      area: "Wellawatte",
      normalizedAddress: "No 25, Temple Road, Wellawatte, Colombo 06",
      isSufficient: true,
      error: null
    }
  },
  {
    input: "15 hospital road kandy",
    expected: {
      city: "Kandy",
      normalizedAddress: "No 15, Hospital Road, Kandy",
      isSufficient: true,
      error: null
    }
  },
  {
    input: "Apartment 4B, Marine Drive, Bambalapitiya, Colombo 04",
    expected: {
      city: "Colombo",
      area: "Bambalapitiya",
      normalizedAddress: "No 4B, Marine Drive, Bambalapitiya, Colombo 04",
      isSufficient: true,
      error: null
    }
  },
  {
    input: "No. 45/2 Galle Road, Colombo 03",
    expected: {
      city: "Colombo",
      normalizedAddress: "No 45/2, Galle Road, Colombo 03",
      isSufficient: true,
      error: null
    }
  },
  {
    input: "Flat 3, Peradeniya Road, Kandy",
    expected: {
      city: "Kandy",
      normalizedAddress: "No 3, Peradeniya Road, Kandy",
      isSufficient: true,
      error: null
    }
  },
  {
    input: "102 Main Street, Negombo",
    expected: {
      city: "Negombo",
      normalizedAddress: "No 102, Main Street, Negombo",
      isSufficient: true,
      error: null
    }
  },
  {
    input: "No 18, Temple Lane, Jaffna",
    expected: {
      city: "Jaffna",
      normalizedAddress: "No 18, Temple Lane, Jaffna",
      isSufficient: true,
      error: null
    }
  },
  {
    input: "Building 12, Kandy Road, Gampaha",
    expected: {
      city: "Gampaha",
      normalizedAddress: "No 12, Kandy Road, Gampaha",
      isSufficient: true,
      error: null
    }
  },
  // Group B: Messy but recoverable
  {
    input: "25 temple rd colombo 6",
    expected: {
      city: "Colombo",
      normalizedAddress: "No 25, Temple Road, Colombo 06",
      isSufficient: true,
      error: null
    }
  },
  {
    input: "no 7 marine dr bambalapitiya col 4",
    expected: {
      city: "Colombo",
      area: "Bambalapitiya",
      normalizedAddress: "No 7, Marine Drive, Bambalapitiya, Colombo 04",
      isSufficient: true,
      error: null
    }
  },
  {
    input: "no 45, galle rd cmb 3",
    expected: {
      city: "Colombo",
      normalizedAddress: "No 45, Galle Road, Colombo 03",
      isSufficient: true,
      error: null
    }
  },
  {
    input: "apt 5b, marine dr, colombo6",
    expected: {
      city: "Colombo",
      normalizedAddress: "No 5b, Marine Drive, Colombo 06",
      isSufficient: true,
      error: null
    }
  },
  {
    input: "no.25, temple road, wellawatte, col 6",
    expected: {
      city: "Colombo",
      area: "Wellawatte",
      normalizedAddress: "No 25, Temple Road, Wellawatte, Colombo 06",
      isSufficient: true,
      error: null
    }
  },
  // Group C: Too vague
  {
    input: "jaffna bus stand",
    expected: {
      city: "Jaffna",
      isSufficient: false,
      error: "ADDRESS_TOO_VAGUE"
    }
  },
  {
    input: "colombo",
    expected: {
      city: "Colombo",
      isSufficient: false,
      error: "ADDRESS_TOO_VAGUE"
    }
  },
  {
    input: "near bus stand jaffna",
    expected: {
      city: "Jaffna",
      isSufficient: false,
      error: "ADDRESS_TOO_VAGUE"
    }
  },
  {
    input: "my home in kandy",
    expected: {
      city: "Kandy",
      isSufficient: false,
      error: "ADDRESS_TOO_VAGUE"
    }
  },
  {
    input: "opposite school negombo",
    expected: {
      city: "Negombo",
      isSufficient: false,
      error: "ADDRESS_TOO_VAGUE"
    }
  },
  // Group D: Missing city
  {
    input: "No 10 Temple Road",
    expected: {
      city: null,
      isSufficient: false,
      error: "CITY_NOT_FOUND"
    }
  },
  // Group E: Empty
  {
    input: "   ",
    expected: {
      city: null,
      isSufficient: false,
      error: "ADDRESS_EMPTY"
    }
  }
];

console.log("=== RUNNING ADDRESS INTELLIGENCE TESTS ===");
let passed = 0;
let failed = 0;

for (const [idx, tc] of testCases.entries()) {
  const result = parseAddress(tc.input);
  const assertions = [];

  if (tc.expected.city !== undefined && result.city !== tc.expected.city) {
    assertions.push(`City expected: "${tc.expected.city}", got: "${result.city}"`);
  }
  if (tc.expected.isSufficient !== undefined && result.isSufficient !== tc.expected.isSufficient) {
    assertions.push(`isSufficient expected: ${tc.expected.isSufficient}, got: ${result.isSufficient}`);
  }
  if (tc.expected.error !== undefined && result.error !== tc.expected.error) {
    assertions.push(`Error expected: "${tc.expected.error}", got: "${result.error}"`);
  }
  if (tc.expected.normalizedAddress !== undefined && result.normalizedAddress !== tc.expected.normalizedAddress) {
    assertions.push(`NormalizedAddress expected: "${tc.expected.normalizedAddress}", got: "${result.normalizedAddress}"`);
  }

  if (assertions.length === 0) {
    console.log(`[PASS] Case #${idx + 1}: "${tc.input}"`);
    passed++;
  } else {
    console.error(`[FAIL] Case #${idx + 1}: "${tc.input}"`);
    assertions.forEach(err => console.error(`       - ${err}`));
    failed++;
  }
}

console.log(`\n=== RESULTS ===\nPassed: ${passed}\nFailed: ${failed}`);
if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

import { localDetectLanguage } from "../utils/language.utils.mjs";

const testCases = [
  { text: "Hello, how are you?", expected: "en" },
  { text: "කොහොමද ඔයාට?", expected: "si" },
  { text: "வணக்கம், எப்படி இருக்கிறீர்கள்?", expected: "ta" },
  { text: "Kohomada machan, oyata kohomada?", expected: "si" },
  { text: "Vanakkam unga name enna?", expected: "ta" },
  { text: "Can you deliver this item?", expected: "en" },
  { text: "meka deliver karන්න puluwanda?", expected: "si" } // mixed script
];

console.log("=== RUNNING LANGUAGE DETECTION TESTS ===");
let passed = 0;
let failed = 0;

for (const [idx, tc] of testCases.entries()) {
  const result = localDetectLanguage(tc.text);
  if (result === tc.expected) {
    console.log(`[PASS] Case #${idx + 1}: "${tc.text}" -> "${result}"`);
    passed++;
  } else {
    console.error(`[FAIL] Case #${idx + 1}: "${tc.text}" -> Expected: "${tc.expected}", Got: "${result}"`);
    failed++;
  }
}

console.log(`\n=== RESULTS ===\nPassed: ${passed}\nFailed: ${failed}`);
if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

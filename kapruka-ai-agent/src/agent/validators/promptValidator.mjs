/**
 * =============================================================================
 * Velora AI Prompt Validator
 * =============================================================================
 *
 * Purpose:
 * Validates the final system prompt before sending it to Gemini.
 *
 * Responsibilities
 * ----------------
 * ✓ Validate Prompt OS
 * ✓ Validate Runtime Context
 * ✓ Validate Latest User Message
 * ✓ Detect undefined values
 * ✓ Detect empty prompts
 * ✓ Generate validation report
 *
 * Never:
 * ✗ Modify prompts
 * ✗ Call Gemini
 * ✗ Compress prompts
 * =============================================================================
 */

const REQUIRED_SECTIONS = [
    "VELORA PROMPT OPERATING SYSTEM",
    "VELORA RUNTIME CONTEXT",
    "LATEST CUSTOMER MESSAGE"
];

export function validatePrompt(systemPrompt = "") {

    const report = {

        valid: true,

        errors: [],

        warnings: [],

        stats: {

            characters: systemPrompt.length,

            lines: systemPrompt.split("\n").length,

            requiredSections: REQUIRED_SECTIONS.length

        }

    };

    if (!systemPrompt.trim()) {

        report.valid = false;

        report.errors.push("System prompt is empty.");

    }

    if (systemPrompt.includes("undefined")) {

        report.valid = false;

        report.errors.push("Prompt contains undefined values.");

    }

    if (systemPrompt.includes("null")) {

        report.warnings.push("Prompt contains null values.");

    }

    REQUIRED_SECTIONS.forEach(section => {

        if (!systemPrompt.includes(section)) {

            report.valid = false;

            report.errors.push(`Missing required section: ${section}`);

        }

    });

    return report;

}

export default validatePrompt;
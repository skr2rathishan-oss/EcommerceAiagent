/**
 * =============================================================================
 * Velora AI Prompt Compressor
 * =============================================================================
 *
 * Purpose:
 * Optimizes the final system prompt before it is sent to Gemini.
 *
 * Responsibilities
 * ----------------
 * ✓ Remove duplicate blank lines
 * ✓ Trim whitespace
 * ✓ Remove unnecessary spacing
 * ✓ Reduce prompt size
 *
 * Never:
 * ✗ Remove prompt content
 * ✗ Modify instructions
 * ✗ Change prompt meaning
 * =============================================================================
 */

export function compressPrompt(systemPrompt = "") {

    return systemPrompt

        // Remove trailing spaces
        .replace(/[ \t]+$/gm, "")

        // Collapse 3+ blank lines into 2
        .replace(/\n{3,}/g, "\n\n")

        // Trim beginning/end
        .trim();

}

export default compressPrompt;
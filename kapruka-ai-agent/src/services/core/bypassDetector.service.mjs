/**
 * # Phase 1 — Eliminate Legacy Response Paths
 * ... (Markdown instructions commented out) ...
 */

import logger from "../../utils/logger.mjs";

export function logBypass(context) {
    logger.warn(`RESPONSE_BYPASS_DETECTED:
    File: ${context.file || "Unknown"}
    Function: ${context.function || "Unknown"}
    Workflow: ${context.workflow || "Unknown"}
    Response Text: ${context.response || "Unknown"}`);
}

export function detectBypass(responseObj, context) {
    if (responseObj && responseObj.bypassed) {
        logBypass({
            ...context,
            response: responseObj.text || "Unknown"
        });
    }
}

/**
 * =============================================================================
 * Velora Prompt Operating System
 * =============================================================================
 *
 * File:
 *    promptLoader.mjs
 *
 * Purpose:
 *    Loads the static Prompt Operating System.
 *
 * Responsibilities:
 *    ✓ Load Prompt OS
 *    ✓ Load Prompt Version
 *    ✓ Provide Prompt Metadata
 *    ✓ Provide Prompt Summary
 *
 * Never:
 *    ✗ Build Runtime Context
 *    ✗ Call Gemini
 *    ✗ Validate Prompts
 *    ✗ Compress Prompts
 *
 * =============================================================================
 */

import buildPromptOS, {
    getPromptOSInfo
} from "../prompts/builder/promptBuilder.mjs";

import PROMPT_VERSION from "./promptVersion.mjs";

/* =============================================================================
 * Load Prompt Operating System
 * =============================================================================
 */

export function loadPromptOS() {

    return buildPromptOS();

}

/* =============================================================================
 * Load Prompt Package
 * =============================================================================
 */

export function loadPromptPackage() {

    return {

        prompt: buildPromptOS(),

        metadata: getPromptOSInfo(),

        version: PROMPT_VERSION

    };

}

/* =============================================================================
 * Prompt Information
 * =============================================================================
 */

export function getPromptInformation() {

    return {

        name: PROMPT_VERSION.name,

        version: PROMPT_VERSION.version,

        architecture: PROMPT_VERSION.architecture,

        provider: PROMPT_VERSION.provider,

        model: PROMPT_VERSION.model,

        promptModules: PROMPT_VERSION.promptModules.total,

        runtimeModules: PROMPT_VERSION.runtimeModules.total

    };

}

/* =============================================================================
 * Loader Metadata
 * =============================================================================
 */

export const PROMPT_LOADER_INFO = Object.freeze({

    name: "Velora Prompt Loader",

    version: "1.0.0",

    status: "Ready"

});

/* =============================================================================
 * Default Export
 * =============================================================================
 */

export default loadPromptOS;
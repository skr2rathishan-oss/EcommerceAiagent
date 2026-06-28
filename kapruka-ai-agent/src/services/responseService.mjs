/**
 * responseService.mjs — Public façade for the Conversation Understanding Layer.
 *
 * Re-exports:
 *   understandConversation()       from conversationUnderstanding.service.mjs
 *   selectResponse()               from responseEngine.service.mjs
 *   selectResponseWithFallback()   from responseEngine.service.mjs
 *
 * Usage in controllers:
 *   import { understandConversation, selectResponse } from "../services/responseService.mjs";
 */

export { understandConversation } from "./ai/conversationUnderstanding.service.mjs";
export { selectResponse, selectResponseWithFallback, clearResponseCache, validateResponseTemplates } from "./responseEngine.service.mjs";
export { buildDecision, validateDecision } from "./ai/decisionBuilder.mjs";

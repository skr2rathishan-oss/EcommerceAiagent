import { getContext } from "./logger.service.mjs";
import { saveMessage } from "../memory/conversation.service.mjs";
import { addMessage } from "../memory/chatMemory.service.mjs";
import {
  sendErrorAndEnd,
  sendCompleteAndEnd as originalSendCompleteAndEnd,
  setSSEHeaders
} from "../../utils/sse.utils.mjs";
import {
  logIncomingMessage,
  logBackground,
  logError,
  logWorkflowTrace,
  logRequestFooter
} from "../../utils/velora.console.mjs";
import fs from "fs";
import { extractText } from "../../utils/sse.utils.mjs";

import { executeContextLoader } from "./requestPipeline/01_contextLoader.mjs";
import { executeLanguageDetection } from "./requestPipeline/01_5_languageDetection.mjs";
import { executeConversationUnderstanding } from "./requestPipeline/02_conversationUnderstanding.mjs";
import { executeWorkflowManager } from "./requestPipeline/03_workflowManager.mjs";
import { executeReferenceEngine } from "./requestPipeline/04_referenceEngine.mjs";
import { executePreWorkflowInterceptions } from "./requestPipeline/05_preWorkflowInterceptions.mjs";
import { executeCommerceServices } from "./requestPipeline/06_commerceServices.mjs";
import { executeResponseEngine } from "./requestPipeline/07_responseEngine.mjs";
import { selectResponseWithFallback, selectResponse } from "../responseService.mjs";
import { checkAndTriggerSummarization } from "../memory/memory.service.mjs";

const sendCompleteAndEnd = (res, data) => {
  try {
    const req = res.req;
    const sessionId = req?.headers?.["x-session-id"] || req?.body?.sessionId || "default";
    const endpoint = req?.originalUrl || req?.path || "/api/chat";
    const controller = "requestPipeline.service.mjs";

    const userState = req?.debugUserState;
    const decision = req?.debugDecision;
    const workflowDecision = req?.debugWorkflowDecision;
    const providerUsed = req?.debugProviderUsed;
    const memory = req?.debugMemory;
    const serviceResult = req?.debugServiceResult;
    const pipelineStages = req?.pipelineStages || [];

    const conversationId = userState ? String(userState._id) : "N/A";
    const currentWorkflow = userState?.workflowContext?.currentWorkflow || "N/A";
    const currentWorkflowStep = userState?.activeFlow?.currentStep || "N/A";
    const loadedState = userState ? JSON.stringify(userState) : "N/A";
    
    const shoppingContext = memory?.shoppingContext || {};
    const lastSearchResultsCount = shoppingContext.lastSearchResults?.length || 0;
    const selectedProduct = shoppingContext.selectedProduct ? JSON.stringify(shoppingContext.selectedProduct) : "None";
    const selectedIndex = shoppingContext.selectedIndex !== undefined ? shoppingContext.selectedIndex : "None";

    const workflowDecisionStr = workflowDecision ? JSON.stringify(workflowDecision) : "N/A";
    const responseCategory = decision?.response?.category || decision?.category || "N/A";
    
    let finalService = "Unknown";
    if (providerUsed === "response_library") {
      finalService = "Response Engine";
    } else if (providerUsed === "gemini") {
      finalService = "LLM (Gemini)";
    } else if (providerUsed === "reference_engine") {
      finalService = "Reference Engine";
    } else if (providerUsed === "delivery_state_machine") {
      finalService = "Commerce Engine / Delivery Flow State Machine";
    }
    if (serviceResult) {
      finalService = `Commerce Engine / Delivery Flow State Machine: ${serviceResult.status || "processed"}`;
    }

    const pipelineTrace = [...pipelineStages, "Controller", "Frontend"].join(" → ");

    // Priority 10: Expanded Telemetry Log
    const detectedLanguageObj = req?.debugDetectedLanguage || {};
    const logEntry = `\n========================================\n[CONVERSATION TURN LOG]
Controller: ${controller}
Endpoint: ${endpoint}
Session ID: ${sessionId}
Conversation ID: ${conversationId}
Loaded State: ${loadedState}

[Language Detection]
Detected: ${detectedLanguageObj.language || "Unknown"}
Preferred: ${userState?.preferredLanguage || "Unknown"}
Confidence: ${detectedLanguageObj.confidence || "Unknown"}
Method: ${detectedLanguageObj.method || "Unknown"}
Response Language: ${userState?.preferredLanguage || "Unknown"}

Workflow Decision: ${workflowDecisionStr}
* Pipeline Stage Trace: ${pipelineTrace}
* Final Response Source: ${finalService}
* Response Category: ${responseCategory}
* Shopping Context: Search Count=${lastSearchResultsCount}, Selected Product=${selectedProduct}, Selected Index=${selectedIndex}
* Workflow State: ${currentWorkflow}
* Workflow Step: ${currentWorkflowStep}
========================================\n`;
    fs.appendFileSync("src/logs/debug-requests.log", logEntry);
  } catch (err) {
    console.error("Error writing debug log:", err);
  }
  return originalSendCompleteAndEnd(res, data);
};

export const processRequest = async (req, res, isStream = false) => {
  req.pipelineStages = [];
  const requestStart = Date.now();
  const context = getContext();

  let logs = [];
  let intentLabel = "—";
  let providerUsed = "";

  try {
    const { message, commerceState, voiceMode, intent: bodyIntent, parameters: bodyParams } = req.body;
    const sessionId = req.headers["x-session-id"] || req.body.sessionId || "default";

    if (!message || typeof message !== "string" || message.trim() === "") {
      return res.status(400).json({ success: false, message: "Message is required." });
    }

    // Stage 1: Context Loader
    const contextData = await executeContextLoader(req.body, req.headers, sessionId);
    req.debugUserState = contextData.userState;
    req.debugMemory = contextData.memory;

    console.log(`\n\n--- PIPELINE TRACE FOR MESSAGE: "${message}" ---`);
    console.log(`[STATE] Delivery State BEFORE: ${contextData.deliveryState}`);
    console.log(`[STATE] Current Workflow BEFORE: ${contextData.userState?.workflowContext?.currentWorkflow}`);

    // Stage 1.5: Language Detection Engine
    req.pipelineStages.push("Language Detection Engine");
    const languageData = executeLanguageDetection(message, contextData.userState);
    contextData.detectedLanguage = languageData;
    req.debugDetectedLanguage = languageData;
    console.log(`[LANGUAGE] Detected: ${languageData.language} (Confidence: ${languageData.confidence}, Method: ${languageData.method})`);

    // Stage 2: Conversation Understanding
    req.pipelineStages.push("Conversation Understanding");
    const { decision, culOutput } = await executeConversationUnderstanding(req.body, contextData);
    
    // Fallback variable based on the preferred language evaluated strictly via engine stickiness rules
    const pipelineCurrentLang = (contextData.userState?.preferredLanguage || languageData.language).startsWith("si") ? "si" :
                                (contextData.userState?.preferredLanguage || languageData.language).startsWith("ta") ? "ta" : "en";
    contextData.currentLang = pipelineCurrentLang;

    req.pipelineStages.push("Decision Builder");
    req.debugDecision = decision;
    
    console.log(`[INTENT] Intent Detected (CUL): ${culOutput?.intent?.value || "N/A"}`);
    console.log(`[INTENT] Intent After Overrides: ${decision.intent.value}`);

    // Stage 2.5: Pre-Workflow Interceptions (Legacy Routing that bypasses Workflow Manager)
    const preWfResult = await executePreWorkflowInterceptions(req.body, decision, contextData, sessionId);
    if (preWfResult.earlyReturn) {
      req.debugProviderUsed = preWfResult.providerUsed;
      if (preWfResult.serviceResult) req.debugServiceResult = preWfResult.serviceResult;
      req.pipelineStages.push(preWfResult.pipelineStage || "Commerce Engine");
      
      const { finalPayload } = await executeResponseEngine(
        req.body, parsedIntent || { intent: decision.intent.value, parameters: {} }, contextData, decision, null, false, "", isStream, null, preWfResult.responsePayload?.text
      );
      
      if (isStream) setSSEHeaders(res);
      if (preWfResult.saveUserMessage) {
        saveMessage(sessionId, "user", message).catch(() => {});
        addMessage(sessionId, "user", message).catch(() => {});
      }
      if (finalPayload?.text) {
        if (isStream && !res.writableEnded) {
          res.write(`data: ${JSON.stringify({ type: "chunk", text: finalPayload.text })}\n\n`);
        }
        saveMessage(sessionId, "assistant", finalPayload.text).catch(() => {});
      }
      return sendCompleteAndEnd(res, finalPayload);
    }

    // Stage 3: Workflow Manager
    req.pipelineStages.push("Workflow Manager");
    const { workflowDecision, userState: updatedUserState } = await executeWorkflowManager(req.body, decision, contextData, sessionId);
    contextData.userState = updatedUserState;
    req.debugWorkflowDecision = workflowDecision;
    
    if (context) {
      context.workflow = workflowDecision.workflow;
    }
    
    console.log(`[WORKFLOW] Target Workflow: ${workflowDecision.workflow}`);

    if (!workflowDecision.success || workflowDecision.action === "REQUIRE_USER_INPUT") {
      req.pipelineStages.push("Response Engine");
      const responsePayload = selectResponse(decision, decision.variables, sessionId, workflowDecision);
      let staticPayload = responsePayload;
      if (!staticPayload) {
        const confusedDecision = { ...decision, response: { module: "common", category: "confused" }, llm_response: false };
        req.pipelineStages.push("Response Engine (Fallback)");
        staticPayload = selectResponseWithFallback(confusedDecision, decision.variables, sessionId);
      }
      
      const { finalPayload } = await executeResponseEngine(
        req.body, parsedIntent || { intent: decision.intent.value, parameters: {} }, contextData, decision, null, false, "", isStream, null, staticPayload?.text
      );

      if (isStream) setSSEHeaders(res);
      if (finalPayload.text) {
        saveMessage(sessionId, "assistant", finalPayload.text).catch(() => {});
        if (isStream && !res.writableEnded) {
          res.write(`data: ${JSON.stringify({ type: "chunk", text: finalPayload.text })}\n\n`);
        }
      }
      req.debugProviderUsed = "gemini";
      return sendCompleteAndEnd(res, finalPayload);
    }

    logIncomingMessage(sessionId, message, pipelineCurrentLang);
    saveMessage(sessionId, "user", message).catch(() => { });
    addMessage(sessionId, "user", message).catch(() => { });

    let parsedIntent = {
      intent: decision.intent.value,
      chat_subtype: decision.chat_subtype,
      parameters: {
        message: message,
        query: decision.variables.product_name,
        city: decision.variables.city,
        deliveryDate: decision.variables.delivery_date,
        recipient: decision.variables.recipient,
        occasion: decision.variables.occasion,
        orderNumber: decision.variables.orderNumber || contextData.userState?.order?.orderRef || contextData.userState?.order_id || "",
        order_number: decision.variables.orderNumber || contextData.userState?.order?.orderRef || contextData.userState?.order_id || "",
        filters: {
          category: decision.variables.category,
          brand: decision.variables.brand,
          priceMax: decision.variables.price ? parseFloat(decision.variables.price) || null : null
        }
      }
    };
    if (req.body.intent) {
      parsedIntent.intent = req.body.intent;
      parsedIntent.parameters = { ...parsedIntent.parameters, ...(req.body.parameters || {}) };
    }
    intentLabel = parsedIntent.intent;

    // Stage 4: Reference Engine
    req.pipelineStages.push("Reference Engine");
    const { resolvedReference, decision: updatedDecision, earlyReturn: refEarlyReturn, providerUsed: refProvider, responsePayload: refPayload } = executeReferenceEngine(sessionId, message, decision);
    if (refEarlyReturn) {
      req.debugProviderUsed = refProvider;
      
      const { finalPayload } = await executeResponseEngine(
        req.body, parsedIntent || { intent: decision.intent.value, parameters: {} }, contextData, updatedDecision, null, false, "", isStream, null, refPayload?.text
      );

      if (isStream) setSSEHeaders(res);
      if (isStream && !res.writableEnded && finalPayload.text) {
        res.write(`data: ${JSON.stringify({ type: "chunk", text: finalPayload.text })}\n\n`);
      }
      if (finalPayload.text) {
        saveMessage(sessionId, "assistant", finalPayload.text).catch(() => {});
      }
      return sendCompleteAndEnd(res, finalPayload);
    }

    if (resolvedReference && resolvedReference.action === "PRODUCT_SELECTED" && resolvedReference.internalProduct) {
      parsedIntent.parameters.productId = resolvedReference.internalProduct.id;
      parsedIntent.parameters.product_id = resolvedReference.internalProduct.id;
      parsedIntent.parameters.product = resolvedReference.internalProduct;
    } else if (resolvedReference && resolvedReference.action === "COMPARE_PRODUCTS" && resolvedReference.internalProducts) {
      parsedIntent.parameters.compareProducts = resolvedReference.internalProducts;
    }

    // Stage 5: Commerce / Workflow Services
    const commerceResult = await executeCommerceServices(req.body, updatedDecision, parsedIntent, contextData, workflowDecision, resolvedReference, sessionId);
    if (commerceResult.earlyReturn) {
      if (commerceResult.isResumeChoice) {
        const resumeDecision = { ...updatedDecision, module: "common", category: "resume_previous_search_options", response: { module: "common", category: "resume_previous_search_options" }, llm_response: false };
        const resumeRes = selectResponse(resumeDecision, { search_query: contextData.memory.pendingSearchQuery || "your previous search" }, sessionId);
        const promptText = resumeRes?.text ? "😊 Welcome back!\n\n" + resumeRes.text : "";
        
        req.debugProviderUsed = "gemini";
        req.pipelineStages.push("Response Engine");
        
        const { finalPayload } = await executeResponseEngine(
          req.body, parsedIntent || { intent: decision.intent.value, parameters: {} }, contextData, updatedDecision, null, false, "", isStream, null, promptText
        );
        
        if (isStream) setSSEHeaders(res);
        if (isStream && !res.writableEnded && finalPayload.text) {
          res.write(`data: ${JSON.stringify({ type: "chunk", text: finalPayload.text })}\n\n`);
        }
        saveMessage(sessionId, "assistant", finalPayload.text).catch(() => {});
        return sendCompleteAndEnd(res, finalPayload);
      }

      if (commerceResult.isSmallTalkInDelivery) {
          // Pass down to Response Engine
      }

      if (commerceResult.isDeliveryProcessed) {
        req.debugProviderUsed = "gemini";
        req.pipelineStages.push("Commerce Engine");
        
        const { finalPayload } = await executeResponseEngine(
          req.body, parsedIntent || { intent: decision.intent.value, parameters: {} }, contextData, updatedDecision, null, false, "", isStream, null, commerceResult.serviceResult?.text
        );
        
        if (isStream) setSSEHeaders(res);
        if (isStream && !res.writableEnded && finalPayload.text) {
          res.write(`data: ${JSON.stringify({ type: "chunk", text: finalPayload.text })}\n\n`);
        }
        saveMessage(sessionId, "assistant", finalPayload.text || "").catch(() => {});
        return sendCompleteAndEnd(res, finalPayload);
      }

      if (commerceResult.responsePayload) {
        req.debugProviderUsed = "gemini";
        if (commerceResult.pipelineStage) req.pipelineStages.push(commerceResult.pipelineStage);
        
        const { finalPayload } = await executeResponseEngine(
          req.body, parsedIntent || { intent: decision.intent.value, parameters: {} }, contextData, updatedDecision, null, false, "", isStream, null, commerceResult.responsePayload.text
        );

        if (isStream) setSSEHeaders(res);
        if (isStream && !res.writableEnded && finalPayload.text) {
          res.write(`data: ${JSON.stringify({ type: "chunk", text: finalPayload.text })}\n\n`);
        }
        if (finalPayload.text) {
          saveMessage(sessionId, "assistant", finalPayload.text).catch(() => {});
        }
        return sendCompleteAndEnd(res, finalPayload);
      }
    }

    const { shouldAddReminder, reminderText } = commerceResult;

    // Stage 6: Response Engine
    const onChunk = isStream ? (chunk) => {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify({ type: "chunk", text: chunk })}\n\n`);
    } : null;

    if (isStream) setSSEHeaders(res);
    
    req.pipelineStages.push("Response Engine");
    const { finalPayload, providerUsed: reProvider } = await executeResponseEngine(
      req.body, parsedIntent, contextData, updatedDecision, resolvedReference, shouldAddReminder, reminderText, isStream, onChunk
    );
    providerUsed = reProvider;

    // Post-Pipeline Telemetry
    const assistantText = extractText(finalPayload);
    if (assistantText) {
      saveMessage(sessionId, "assistant", assistantText).then((u) => {
        if (u) {
          logBackground("Memory check", `${u.messages.length} messages in session`);
          checkAndTriggerSummarization(sessionId, u.messages.length).catch(() => { });
        }
      }).catch(() => { });
    }

    logWorkflowTrace({
      sessionId,
      message,
      currentWorkflow: contextData.userState?.workflowContext?.previousWorkflow || "idle",
      workflowStep: contextData.userState?.activeFlow?.currentStep || "browsing",
      intent: updatedDecision?.intent?.value || intentLabel || "general_chat",
      workflowDecision: workflowDecision?.action || "unknown",
      contextUpdates: JSON.stringify({ activeFlow: contextData.userState?.activeFlow }),
      workflowTransition: `${contextData.userState?.workflowContext?.previousWorkflow} -> ${workflowDecision?.workflow}`,
      response: assistantText || JSON.stringify(finalPayload)
    });

    logRequestFooter(intentLabel, Date.now() - requestStart, providerUsed);
    req.debugProviderUsed = providerUsed;
    return sendCompleteAndEnd(res, finalPayload);

  } catch (error) {
    logError("CHAT", `Unhandled error — ${error.message}`);
    return sendErrorAndEnd(res, logs, error.message || "Internal Server Error");
  }
};

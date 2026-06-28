import manageWorkflow from "../../../agent/workflow/05_workflowManager.mjs";
import {
  clearConversationState,
  pauseCurrentFlow,
  saveConversationState
} from "../../../services/commerce/conversationStateService.mjs";
import { updateMemory } from "../../../agent/memoryManager.mjs";
import { logStepStart, logStepDone } from "../../../utils/velora.console.mjs";

export const executeWorkflowManager = async (reqBody, decision, contextData, sessionId) => {
  const { message } = reqBody;
  let { userState, memory, deliverySession } = contextData;

  logStepStart("Workflow Manager validation");
  
  const workflowDecision = manageWorkflow({
    message,
    intent: decision.intent.value,
    decision,
    conversationState: userState,
    memory
  });

  if (!workflowDecision.success || workflowDecision.action === "REQUIRE_USER_INPUT") {
    logStepDone("Workflow Manager", `Validation failed: ${workflowDecision.reason}`);
    return {
      workflowDecision,
      userState
    };
  }

  logStepDone("Workflow Manager", `Transition allowed to: ${workflowDecision.workflow}`);

  // If reset is triggered, clear conversation state
  if (workflowDecision.action === "START_NEW_WORKFLOW" || workflowDecision.resetWorkflow) {
    userState = await clearConversationState(sessionId);
    
    // Reset the temporary memory context
    if (memory) {
      delete memory.waitingForResumeChoice;
      delete memory.resumableContextId;
      delete memory.pendingSearchQuery;
      delete memory.hasRemindedPendingOrder;
      if (memory.shoppingContext) {
        memory.shoppingContext.lastSearchResults = [];
        memory.shoppingContext.selectedProduct = null;
      }
      updateMemory(sessionId, memory);
    }
  } else if (workflowDecision.action === "INTERRUPT_WORKFLOW") {
    // Pause current active flow on global interrupt
    logStepDone("Workflow Manager", "Global Interrupt - Pausing current flow");
    userState = await pauseCurrentFlow(sessionId, "user_interruption") || userState;
  } else {
    // Save state before response generation
    const previousWorkflow = userState?.workflowContext?.currentWorkflow || "idle";
    const updatedWorkflowContext = {
      ...(userState.workflowContext || {}),
      currentWorkflow: workflowDecision.workflow,
      previousWorkflow: previousWorkflow,
      lastTransition: `${previousWorkflow}_to_${workflowDecision.workflow}`,
      workflowStartedAt: userState?.workflowContext?.workflowStartedAt || new Date(),
      awaitingConfirmation: workflowDecision.workflow === "checkout" || (deliverySession && ["WAITING_FOR_CONFIRMATION", "WAITING_FOR_FINAL_ORDER_CONFIRMATION"].includes(deliverySession.state)),
      waitingForPhoneNumber: deliverySession && deliverySession.state === "WAITING_FOR_CONTACT_PHONE",
      waitingForDelivery: deliverySession && ["WAITING_FOR_ADDRESS", "WAITING_FOR_DATE"].includes(deliverySession.state),
      waitingForPayment: deliverySession && deliverySession.state === "PAYMENT_PENDING",
      resumeSearch: workflowDecision.workflow === "product_search" && !!userState?.workflowContext?.previousSearchQuery,
      previousSearchQuery: workflowDecision.workflow === "product_search" ? (userState?.workflowContext?.previousSearchQuery || decision.variables.product_name) : userState?.workflowContext?.previousSearchQuery,
      canInterrupt: true,
      canResume: true
    };

    userState = await saveConversationState(sessionId, {
      activeFlow: {
        type: workflowDecision.workflow,
        status: "active",
        currentStep: decision.conversation_stage
      },
      workflowContext: updatedWorkflowContext
    });
  }

  return {
    workflowDecision,
    userState
  };
};
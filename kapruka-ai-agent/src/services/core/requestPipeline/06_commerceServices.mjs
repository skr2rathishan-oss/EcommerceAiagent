import { selectResponse } from "../../../services/responseService.mjs";
import { resumeFlow, saveConversationState } from "../../../services/commerce/conversationStateService.mjs";
import { getContext } from "../logger.service.mjs";
import { getDeliverySession } from "../../../memory/memoryStore.mjs";
import { logStepDone } from "../../../utils/velora.console.mjs";
import { getRecentHistory } from "../../../services/memory/chatMemory.service.mjs";
import { getShoppingContext, updateMemory } from "../../../agent/memoryManager.mjs";
import { chatWithLLM } from "../../../services/ai/llm.service.mjs";
import {
  handleAddressInput,
  handleAddressConfirmation,
  handleDateInput,
  handleRecoveryChoice,
  handleCancelOptions,
  handleCheckoutConfirmation,
  handleContactNameInput,
  handleContactPhoneInput,
  handleCancelChoice
} from "../../../services/commerce/deliveryFlowService.mjs";
import {
  resumeShoppingContext,
  pauseShoppingContext,
  createShoppingContext
} from "../../../services/commerce/shoppingContextService.mjs";
import { setActiveShoppingContext } from "../../../services/commerce/conversationStateService.mjs";
import { routeIntent } from "../../../agent/intentRouter.mjs";

const activeCollectingStates = [
  "WAITING_FOR_ADDRESS",
  "WAITING_FOR_ADDRESS_CONFIRMATION",
  "WAITING_FOR_DATE",
  "CHECKING_DELIVERY",
  "WAITING_FOR_RECOVERY_CHOICE",
  "WAITING_FOR_ALTERNATIVE_PRODUCT_SELECTION",
  "WAITING_FOR_CONFIRMATION",
  "WAITING_FOR_FINAL_ORDER_CONFIRMATION",
  "WAITING_FOR_CONTACT_NAME",
  "WAITING_FOR_CONTACT_PHONE",
  "WAITING_FOR_CANCEL_CHOICE"
];

export const executeCommerceServices = async (reqBody, decision, parsedIntent, contextData, workflowDecision, resolvedReference, sessionId) => {
  const { message, voiceMode } = reqBody;
  let { userState, memory, deliverySession, deliveryState, currentLang, pendingOrder } = contextData;
  const lowerMsg = message ? message.toLowerCase().trim() : "";

  // ── Gift Planner Workflow Processing ──
  if (workflowDecision.workflow === "gift_planner") {
    const { extractGiftPlannerData, checkAndHandleReplacement, normalizeCategoryAndBrand, mergeMissionItem } = await import("../../commerce/giftPlannerExtractor.mjs");
    const { initShoppingMission, updateShoppingMission, printMissionLogs, calculateRemainingBudget, attachShoppingMissionPresentation } = await import("../../commerce/giftPlannerManager.mjs");
    const { allocateMissionBudgets, orchestrateSequentialSearch } = await import("../../commerce/giftPlannerSearchOrchestrator.mjs");
    const { validateShoppingMission, MISSION_STATUS } = await import("../../commerce/giftPlannerValidator.mjs");
    const { getProductDetails } = await import("../../integration/mcp.service.mjs");

    let mission = userState.shoppingMission;

    // Fresh start check (Step 1): Re-initialize a clean mission if user starts fresh
    const isFreshStart = lowerMsg.includes("help me find a gift") || lowerMsg.includes("find a gift") || lowerMsg.includes("start fresh") || lowerMsg.includes("gift planner");
    if (isFreshStart) {
      mission = null;
    }

    // A. Check and Handle Category Replacement Requests (Step 9)
    if (mission) {
      const wasReset = checkAndHandleReplacement(message, mission);
      if (wasReset) {
        mission.remainingBudget = calculateRemainingBudget(mission);
        attachShoppingMissionPresentation(mission);
      }
    }

    // B. Handle Product Selection (Step 2 & Step 8)
    if (mission && parsedIntent.intent === "select_product") {
      const selectedProd = parsedIntent.parameters.product || reqBody.product;
      if (selectedProd) {
        // Find the active item being selected (first searched item with no selection)
        let activeItem = mission.missionItems.find(item => item.searchCompleted && !item.selectedProduct);
        if (!activeItem) {
          activeItem = mission.missionItems.find(item => !item.selectedProduct);
        }
        if (activeItem) {
          activeItem.selectedProduct = selectedProd;
          activeItem.status = "completed";
          mission.remainingBudget = calculateRemainingBudget(mission);
          attachShoppingMissionPresentation(mission);
          logStepDone("GiftPlanner", `Product selected for category ${activeItem.category}: ${selectedProd.name}`);

          // Advance to the next item: clear its search state to force a fresh search (Step 2)
          const nextItem = mission.missionItems.find(item => !item.selectedProduct);
          if (nextItem) {
            nextItem.searchCompleted = false;
            nextItem.searchResults = [];
            nextItem.recommendedProducts = [];
            nextItem.status = "pending";
            logStepDone("GiftPlanner", `Advancing to next category: ${nextItem.category}`);
          }
        }
      }
    }

    // C. Extract or Update Mission Information
    const currentItems = mission ? mission.missionItems : [];
    // Build plannerContext from the ACCUMULATED mission state so the extractor
    // knows the real collection phase (not just what THIS turn extracted)
    const plannerContext = mission ? {
      currentStep: mission.currentStep,
      occasion: mission.occasion,
      recipient: mission.recipient,
      budget: mission.budget
    } : null;
    const extracted = extractGiftPlannerData(message, decision.variables, currentItems, plannerContext);

    if (!mission) {
      mission = initShoppingMission(sessionId, extracted);
    } else {
      mission = updateShoppingMission(sessionId, mission, extracted);
    }

    // C.1 Deferred Category Memory (Scenario 3 support)
    // If mission is COLLECTING_INFORMATION and CUL detected a category, store it for later
    if (mission && mission.status === MISSION_STATUS.COLLECTING_INFORMATION) {
      const culCategory = decision.variables?.category || decision.variables?.product_name;
      if (culCategory && !(extracted.missionItems?.length > currentItems.length)) {
        mission.deferredCategories = mission.deferredCategories || [];
        const { category: normalizedCat } = normalizeCategoryAndBrand(culCategory);
        if (normalizedCat && !mission.deferredCategories.includes(normalizedCat)) {
          mission.deferredCategories.push(normalizedCat);
          logStepDone("GiftPlanner", `Deferred category "${normalizedCat}" until all required fields are collected`);
        }
      }
    }

    // D. Run Budget Allocation & Guided Sequential Search Cycle
    const validation = validateShoppingMission(mission);
    let searchTriggered = false;

    // D.1 Inject Deferred Categories when mission becomes ready
    if (validation.ready && mission.deferredCategories?.length > 0) {
      const ctx = { currentStep: "Collecting Categories", occasion: mission.occasion, recipient: mission.recipient, budget: mission.budget };
      for (const defCat of mission.deferredCategories) {
        mergeMissionItem(mission.missionItems, defCat, ctx);
        logStepDone("GiftPlanner", `Restored deferred category: "${defCat}"`);
      }
      mission.deferredCategories = [];
      // Re-validate after injecting deferred categories
      const reValidation = validateShoppingMission(mission);
      if (reValidation.ready) {
        mission.currentStep = reValidation.nextStep;
        mission.status = MISSION_STATUS.READY_FOR_SEARCH;
        attachShoppingMissionPresentation(mission);
        // NEW: allocate budgets and start sequential search now that we are ready
        logStepDone("GiftPlanner", "[GiftPlanner LOG] Before allocateMissionBudgets() (deferred categories path)");
        mission = allocateMissionBudgets(mission);
        attachShoppingMissionPresentation(mission);
        const anyPendingSearch = mission.missionItems.some(item => !item.searchCompleted);
        if (anyPendingSearch) {
          logStepDone("GiftPlanner", "[GiftPlanner LOG] Before orchestrateSequentialSearch() (deferred categories path)");
          await orchestrateSequentialSearch(sessionId, mission);
          logStepDone("GiftPlanner", "[GiftPlanner LOG] After orchestrateSequentialSearch() (deferred categories path)");
          searchTriggered = true;
        }
      }
    }

    if (validation.ready && !searchTriggered) {
      logStepDone("GiftPlanner", "[GiftPlanner LOG] Before allocateMissionBudgets()");
      mission = allocateMissionBudgets(mission);
      attachShoppingMissionPresentation(mission);
      // Only sequential search if not complete and not ready for checkout
      const anyPendingSearch = mission.missionItems.some(item => !item.searchCompleted);
      if (anyPendingSearch) {
        logStepDone("GiftPlanner", "[GiftPlanner LOG] Before orchestrateSequentialSearch()");
        await orchestrateSequentialSearch(sessionId, mission);
        logStepDone("GiftPlanner", "[GiftPlanner LOG] After orchestrateSequentialSearch()");
      } else {
        const loggerImport = await import("../../utils/logger.mjs");
        const activeItem = mission.missionItems.find(item => !item.selectedProduct) || {};
        loggerImport.default.info(`\n[GiftPlanner Search]\nSkipped search\nReason: Active item already searched\n`);
      }
    } else if (!validation.ready) {
      const loggerImport = await import("../../utils/logger.mjs");
      loggerImport.default.info(`\n[GiftPlanner Search]\nSkipped search\nReason: Mission not READY_FOR_SEARCH\n`);
    }

    // E. Automatic Completion Transition (Step 1 of Phase 4)
    if (mission && mission.missionItems && mission.missionItems.length > 0 && validation.ready) {
      const allSelected = mission.missionItems.every(item => item.selectedProduct !== null);
      if (allSelected) {
        mission.status = MISSION_STATUS.READY_FOR_CHECKOUT;
      } else {
        const anyPendingSearch = mission.missionItems.some(item => !item.searchCompleted);
        if (anyPendingSearch) {
          mission.status = MISSION_STATUS.SEARCHING;
        } else {
          mission.status = MISSION_STATUS.SELECTING_PRODUCTS;
        }
      }
      attachShoppingMissionPresentation(mission);
    }

    // F. Pre-Checkout Validation (Step 6 / Step 12) & Cart Transition (Step 5 / Step 7)
    if (mission && mission.status === MISSION_STATUS.READY_FOR_CHECKOUT) {
      const isCheckoutRequest = ["checkout", "add to cart", "proceed", "pay", "order summary", "confirm", "yes"].some(kw => lowerMsg.includes(kw));
      if (isCheckoutRequest) {
        // Run validation for each selected product
        logStepDone("GiftPlanner", "Initiating Pre-Checkout Validation Check...");
        let hasChanges = false;
        let validationMsg = "";
        let cartItemsToAdd = [];

        for (const item of mission.missionItems) {
          if (!item.selectedProduct) continue;
          try {
            const details = await getProductDetails(item.selectedProduct.id);
            // Check out of stock
            if (details.stock === false || details.inStock === false) {
              logStepDone("GiftPlanner", `Product Out of Stock: ${item.selectedProduct.name}`);
              item.selectedProduct = null;
              item.searchCompleted = false;
              item.status = "pending";
              item.searchResults = [];
              item.recommendedProducts = [];
              hasChanges = true;
              validationMsg = `Oh no! It looks like ${details.name} is currently out of stock. 😔\nI've refreshed the recommendations for you so we can find a perfect alternative!`;
            } 
            // Check price change
            else if (parseFloat(details.price) !== parseFloat(item.selectedProduct.price)) {
              logStepDone("GiftPlanner", `Price Changed: ${item.selectedProduct.name} from ${item.selectedProduct.price} to ${details.price}`);
              const oldPrice = item.selectedProduct.price;
              item.selectedProduct.price = details.price;
              hasChanges = true;
              validationMsg = `Just a quick heads up! 😊 The price of ${details.name} has changed from Rs.${oldPrice} to Rs.${details.price}.\nWould you still like to proceed with the new price or replace this item?`;
            } else {
              cartItemsToAdd.push({
                product: item.selectedProduct,
                quantity: 1
              });
            }
          } catch (err) {
            logStepDone("GiftPlanner", `Product validation failed for ID ${item.selectedProduct.id}: ${err.message}`);
            // Network Failure -> retry or continue gracefully
            cartItemsToAdd.push({
              product: item.selectedProduct,
              quantity: 1
            });
          }
        }

        if (hasChanges) {
          mission.remainingBudget = calculateRemainingBudget(mission);
          // If we had to reset any item, transition status back
          const allSelected = mission.missionItems.every(i => i.selectedProduct !== null);
          if (!allSelected) {
            mission.status = MISSION_STATUS.SELECTING_PRODUCTS;
            // Run search for the pending item immediately!
            logStepDone("GiftPlanner", "[GiftPlanner LOG] Before orchestrateSequentialSearch() in checkout validation hasChanges block");
            await orchestrateSequentialSearch(sessionId, mission);
            logStepDone("GiftPlanner", "[GiftPlanner LOG] After orchestrateSequentialSearch() in checkout validation hasChanges block");
          }
          userState = await saveConversationState(sessionId, { shoppingMission: mission });
          contextData.userState = userState;

          logStepDone("GiftPlanner", "[GiftPlanner LOG] Early Return: validation failed/hasChanges in checkout confirmation.");
          return {
            earlyReturn: true,
            providerUsed: "response_library",
            responsePayload: { type: "text", text: validationMsg },
            pipelineStage: "Commerce Engine"
          };
        } else {
          // Validation passed successfully! Transition directly to existing checkout overlay (Step 7)
          // Store lightweight history entry & Clean up Shopping Mission conversational states on completion (Step 11 & Step 14)
          logStepDone("GiftPlanner", "Pre-Checkout Validation passed! Transitioning to checkout...");
          
          // Clear active shopping context and transition state to general chat so we can proceed smoothly
          userState = await saveConversationState(sessionId, { 
            shoppingMission: null, // Clear shopping mission conversational states on checkout start (cleanup)
            activeFlow: {
              type: "general_chat",
              status: "active",
              currentStep: "browsing"
            }
          });
          contextData.userState = userState;

          // Clear reference memory context and temporary search results (Step 11)
          const { clearSelection } = await import("../../../agent/reference/01_selectionMemory.mjs");
          clearSelection(sessionId);

          logStepDone("GiftPlanner", "[GiftPlanner LOG] Early Return: checkout validation success transition.");
          return {
            earlyReturn: true,
            providerUsed: "response_library",
            responsePayload: {
              type: "checkout_init",
              text: "Wonderful! 😊 Your gift plan looks complete and everything is in stock.\nI've automatically added all selected products into your cart! Let's proceed to checkout to complete the order.",
              cartItemsToAdd,
              shoppingMission: null
            },
            pipelineStage: "Commerce Engine"
          };
        }
      }
    }

    userState = await saveConversationState(sessionId, { shoppingMission: mission });
    contextData.userState = userState;

    printMissionLogs(mission);

    // G. Gift Planner Blocking Metadata
    // Return structured blocking info so Response Engine can suppress products during COLLECTING_INFORMATION
    if (mission && mission.status === MISSION_STATUS.COLLECTING_INFORMATION) {
      const blockValidation = validateShoppingMission(mission);
      const blockedReasonMap = {
        "Collecting Occasion": "WAITING_FOR_OCCASION",
        "Collecting Recipient": "WAITING_FOR_RECIPIENT",
        "Collecting Budget": "WAITING_FOR_BUDGET",
        "Collecting Categories": "WAITING_FOR_CATEGORIES"
      };
      const giftPlannerBlocking = {
        blocked: true,
        blockedReason: blockedReasonMap[blockValidation.nextStep] || "WAITING_FOR_INFORMATION",
        nextStep: blockValidation.nextStep,
        missingFields: blockValidation.missingFields
      };
      logStepDone("GiftPlanner", `BLOCKED: ${giftPlannerBlocking.blockedReason} | Next step: ${blockValidation.nextStep} | Missing: ${blockValidation.missingFields.join(", ")}`);

      // Set telemetry results
      const context = getContext();
      if (context?.telemetry) {
        context.telemetry.commerceResults = `Status: ${mission.status}, Next Step: ${blockValidation.nextStep}`;
      }

      // Return early with blocking metadata (not earlyReturn — still goes to Response Engine)
      logStepDone("GiftPlanner", "[GiftPlanner LOG] Early Return: giftPlannerBlocking WAITING_FOR_INFORMATION.");
      return {
        earlyReturn: false,
        shouldAddReminder: false,
        reminderText: "",
        giftPlannerBlocking
      };
    }

    // Set telemetry results for successful gift planner workflow
    const context = getContext();
    if (context?.telemetry) {
      context.telemetry.commerceResults = `Status: ${mission.status}, Items: ${mission.missionItems?.length || 0}`;
    }
  }

  // ── CSM Resume Flow Check using Workflow Engine ──
  const shouldResumeDelivery = workflowDecision.workflow === "delivery" && userState?.pausedFlows?.some(f => f.type === "delivery");
  if (shouldResumeDelivery) {
    logStepDone("Interception", "VCSM: Resuming Paused Delivery Flow via Workflow Engine");
    await resumeFlow(sessionId, "delivery");
    
    deliverySession = await getDeliverySession(sessionId);
    deliveryState = deliverySession?.state;

    let category = "continue_delivery_flow";
    let module = "delivery";
    if (deliveryState === "WAITING_FOR_ADDRESS") category = "ask_delivery_address";
    else if (deliveryState === "WAITING_FOR_DATE") category = "ask_delivery_date";
    else if (deliveryState === "WAITING_FOR_CONTACT_NAME") category = "ask_contact_name";
    else if (deliveryState === "WAITING_FOR_CONTACT_PHONE") category = "ask_contact_phone";
    else if (deliveryState === "WAITING_FOR_CONFIRMATION" || deliveryState === "WAITING_FOR_FINAL_ORDER_CONFIRMATION") category = "confirm_order";

    const resumeDecision = {
      ...decision,
      module,
      category,
      response: { module, category },
      llm_response: false
    };
    const resumeRes = selectResponse(resumeDecision, {}, sessionId);
    let promptText = "Welcome back! 😊 " + (resumeRes?.text || "");

    logStepDone("GiftPlanner", "[GiftPlanner LOG] Early Return: Resuming Delivery Flow.");
    return {
      earlyReturn: true,
      providerUsed: "response_library",
      responsePayload: { type: "text", text: promptText },
      pipelineStage: "Response Engine"
    };
  }

  // ── Priority 2: Active Delivery Session & Delivery Protection ──
  if (deliverySession && activeCollectingStates.includes(deliveryState) && deliveryState !== "WAITING_FOR_FINAL_ORDER_CONFIRMATION") {
    if (parsedIntent.intent === "search_products" || parsedIntent.intent === "select_product" || parsedIntent.intent === "get_product_details") {
      logStepDone("Interception", "VCSM: Delivery Protection Triggered");
      const protectDecision = {
        ...decision,
        module: "interruption",
        category: "checkout_in_progress",
        response: { module: "interruption", category: "checkout_in_progress" },
        llm_response: false
      };
      const protectRes = selectResponse(protectDecision, {}, sessionId);
      const protectMsg = protectRes?.text ? "Almost done! " + protectRes.text : "";
      logStepDone("GiftPlanner", "[GiftPlanner LOG] Early Return: Delivery Protection.");
      return {
        earlyReturn: true,
        providerUsed: "response_library",
        responsePayload: { type: "text", text: protectMsg },
        pipelineStage: "Response Engine"
      };
    }
  }

  // ── Small Talk Check during Delivery Flow ──
  if (deliverySession && activeCollectingStates.includes(deliveryState) && parsedIntent.intent === "general_chat") {
    logStepDone("Interception", "VCSM: Small Talk during Active Delivery");
    logStepDone("GiftPlanner", "[GiftPlanner LOG] Early Return: Small talk in delivery.");
    return {
      earlyReturn: true,
      isSmallTalkInDelivery: true,
      providerUsed: "gemini",
      pipelineStage: "Response Engine"
    };
  }
  
  // NOTE: Delivery Flow input routing has been moved to intentRouter (DELIVERY_FLOW_INPUT)

  // ── Priority 3 / 9 / 10 Choice: Shopping Context Resume Choice ──
  if (memory.waitingForResumeChoice && memory.resumableContextId) {
    // Return early return flag so orchestrator can handle it.
    logStepDone("GiftPlanner", "[GiftPlanner LOG] Early Return: Shopping Context Resume Choice.");
    return {
      earlyReturn: true,
      isResumeChoice: true
    };
  }

  // ── Priority 7: Pending Order Reminder Check ──
  let shouldAddReminder = false;
  let reminderText = "";
  if (pendingOrder && (parsedIntent.intent === "search_products" || parsedIntent.intent === "select_product" || parsedIntent.intent === "get_product_details")) {
    if (!memory.hasRemindedPendingOrder) {
      memory.hasRemindedPendingOrder = true;
      updateMemory(sessionId, memory);
      
      const pendingSession = await getDeliverySession(pendingOrder).catch(() => null);
      const pendingProduct = pendingSession?.selected_product?.product_name || "item";
      const reminderDecision = {
        ...decision,
        module: "order",
        category: "pending_order_reminder",
        response: { module: "order", category: "pending_order_reminder" },
        llm_response: false
      };
      const reminderRes = selectResponse(reminderDecision, { product_name: pendingProduct }, sessionId);
      reminderText = (reminderRes?.text || "") + "\n\n";
      shouldAddReminder = true;
    }
  }

  logStepDone("GiftPlanner", "[GiftPlanner LOG] End of executeCommerceServices reached. Returning false earlyReturn.");
  return {
    earlyReturn: false,
    shouldAddReminder,
    reminderText
  };
};
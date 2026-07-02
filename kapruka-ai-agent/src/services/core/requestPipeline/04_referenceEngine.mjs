import { handleReference } from "../../../agent/reference/05_referenceManager.mjs";
import { logStepDone, logStepError } from "../../../utils/velora.console.mjs";

export const executeReferenceEngine = (sessionId, message, decision) => {
  const refResult = handleReference(sessionId, message);
  let resolvedReference = null;

  if (refResult.handled) {
    // Smart bypass: If reference is generic and not product-specific intent, do not intercept
    const isProductSpecificIntent = ["get_product_details", "select_product", "check_delivery"].includes(decision.intent.value);
    const isExplicitRef = refResult.parsed && refResult.parsed.type !== "generic";
    if (!isExplicitRef && !isProductSpecificIntent) {
      refResult.handled = false;
    }
  }

  if (refResult.handled) {
    if (!refResult.success) {
      logStepError("Reference Engine", refResult.reason);
      return {
        earlyReturn: true,
        providerUsed: "reference_engine",
        responsePayload: { type: "text", text: refResult.response }
      };
    } else {
      logStepDone("Reference Engine", `Resolved reference: ${refResult.action}`);
      resolvedReference = refResult;

      // Log follow-up resolution
      const resolvedCount = refResult.action === "PRODUCT_SELECTED" ? 1 : (refResult.internalProducts?.length || refResult.products?.length || 0);
      console.log(`\n[PRODUCT REFERENCES]\nFollow-up:\n${message}\nResolved:\n${resolvedCount} products\nRendering:\nProduct Cards\n`);
      
      if (refResult.action === "PRODUCT_SELECTED" && refResult.internalProduct) {
        decision.variables = decision.variables || {};
        decision.variables.product_id = refResult.internalProduct.id;
        decision.variables.product_name = refResult.internalProduct.name;
        
        if (decision.intent.value === "general_chat") {
          const lowerMsg = message.toLowerCase();
          // Keep as general_chat if it's just asking to see/show cards/images
          const isShowOrSeeOnly = ["show", "see", "display", "image", "images", "picture", "pictures", "card", "cards", "look", "render"].some(word => lowerMsg.includes(word)) &&
                                  !["detail", "info", "spec", "about", "describe"].some(word => lowerMsg.includes(word));

          if (isShowOrSeeOnly) {
            // Keep intent as general_chat so response engine returns product_grid payload with conversational intro
          } else if (["detail", "info", "spec", "about", "describe", "show"].some(word => lowerMsg.includes(word))) {
            decision.intent.value = "get_product_details";
          } else {
            decision.intent.value = "select_product";
          }
        }
      } else if (refResult.action === "COMPARE_PRODUCTS" && refResult.internalProducts) {
        decision.intent.value = "general_chat";
      } else if (refResult.action === "SHOW_ALL_PRODUCTS" && refResult.internalProducts) {
        decision.intent.value = "general_chat";
      }
    }
  }

  return {
    resolvedReference,
    decision,
    earlyReturn: false
  };
};
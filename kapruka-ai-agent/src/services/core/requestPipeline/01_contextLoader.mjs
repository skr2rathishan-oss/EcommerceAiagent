import { getRecentHistory } from "../../../services/memory/chatMemory.service.mjs";
import { getMemory, updateMemory } from "../../../agent/memoryManager.mjs";
import { getDeliverySession } from "../../../memory/memoryStore.mjs";
import { loadConversationState, saveConversationState } from "../../../services/commerce/conversationStateService.mjs";
import { logStepStart, logStepDone } from "../../../utils/velora.console.mjs";

export const executeContextLoader = async (reqBody, headers, sessionId) => {
  const { message, commerceState } = reqBody;

  // ── Cart state update (non-blocking, silent) ──
  if (commerceState) {
    const { cart, wishlist, saved, buyNowProduct, buyNowVariants, deliveryInfo } = commerceState;
    let cartSummary = "Current Cart is empty.";
    if (cart?.length > 0) {
      const itemsText = cart.map(i => `${i.quantity}x ${i.name} - Rs.${i.price}`).join("\\n");
      const total = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
      cartSummary = `Current Cart:\\n${itemsText}\\n\\nTotal:\\nRs.${total}`;
    }

    const memoryUpdates = {
      cart: cart || [],
      wishlist: wishlist || [],
      savedProducts: saved || [],
      cartSummary
    };

    if (buyNowProduct !== undefined) memoryUpdates.buyNowProduct = buyNowProduct;
    if (buyNowVariants !== undefined) memoryUpdates.buyNowVariants = buyNowVariants;
    if (deliveryInfo !== undefined) memoryUpdates.deliveryInfo = deliveryInfo;

    updateMemory(sessionId, memoryUpdates);
  }

  // ── Load Conversation State and History ──
  let userState = await loadConversationState(sessionId);
  
  const lowerMsg = message ? message.toLowerCase().trim() : "";
  const isResumeHistory = ["resume previous chat", "resume my previous chat", "continue my last chat", "continue previous chat", "load previous chat", "load my previous chat", "resume previous chatting", "resume chat"].some(
    phrase => lowerMsg.includes(phrase)
  );

  if (isResumeHistory && userState?.workflowContext?.lastResetAt) {
    logStepStart("Resume previous chat history");
    userState = await saveConversationState(sessionId, {
      workflowContext: {
        ...(userState.workflowContext || {}),
        lastResetAt: null
      }
    });
    logStepDone("Resume previous chat history", "Cleared lastResetAt to restore history");
  }

  const lastResetAt = userState?.workflowContext?.lastResetAt;
  const history = await getRecentHistory(sessionId, lastResetAt);
  const activeDeliveryId = userState?.active_delivery_session || userState?.pending_order;
  const pendingOrder = userState?.pending_order;

  // Load delivery session
  let deliverySession = activeDeliveryId ? await getDeliverySession(activeDeliveryId).catch(() => null) : null;
  let deliveryState = deliverySession?.state;
  
  const memory = getMemory(sessionId);

  // ── Load Shopping Context from DB if not in memory (e.g. after nodemon restart) ──
  const activeShoppingContextId = userState?.active_shopping_context || userState?.shopping?.activeContextId;
  if (activeShoppingContextId) {
    if (!memory.shoppingContext?.lastSearchResults || memory.shoppingContext.lastSearchResults.length === 0) {
      try {
        const ShoppingContext = (await import("../../../database/ShoppingContext.mjs")).default;
        const activeCtx = await ShoppingContext.findOne({ contextId: activeShoppingContextId }).lean();
        if (activeCtx) {
          const { updateShoppingContext } = await import("../../../agent/memoryManager.mjs");
          updateShoppingContext(sessionId, {
            lastSearchResults: activeCtx.lastSearchResults || activeCtx.viewedProducts || [],
            selectedProduct: activeCtx.selectedProduct || null
          });
        }
      } catch (err) {
        console.error("Failed to restore shopping context from DB:", err);
      }
    }
  }

  const cleanMsg = lowerMsg.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, " ").trim();
  const greetingWords = ["hi", "hello", "hey", "hola", "namaste", "vanakkam", "greetings", "good morning", "good evening", "good afternoon", "ada", "heta", "irukkinga", "machan"];
  const isGreetingOnly = greetingWords.includes(cleanMsg) || cleanMsg.split(/\s+/).length <= 1;

  const hasResumeKeywords = ["resume", "continue", "last time", "we were talking", "remember"].some(kw => lowerMsg.includes(kw));
  const shouldSuppressMemory = isGreetingOnly && !hasResumeKeywords;

  return {
    sessionId,
    userState,
    history,
    deliverySession,
    deliveryState,
    pendingOrder,
    memory,
    shouldSuppressMemory
  };
};

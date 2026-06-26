/**
 * useSearch — handles `performSearch`, `handleRetry`, and `handleStop`.
 * Responsible for building the commerce state payload, calling the SSE service,
 * and distributing response types into the message store.
 */
import { useRef } from "react";
import { useApp } from "../contexts/AppContext";
import { sendMessage, abortActiveRequest } from "../services/chatServices";
import { mapBackendProductToUI } from "../services/mapping";
import { useCart } from "../contexts/CartContext";
import { useWishlist } from "../contexts/WishlistContext";

export const useSearch = () => {
  // ── Streaming refs (no React re-renders on write) ─────────────────────────
  const streamBufferRef    = useRef<string>("");   // raw chunks from SSE
  const displayedTextRef   = useRef<string>("");   // what's currently painted
  const firstChunkSeenRef  = useRef<boolean>(false);
  const displayTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamDoneRef      = useRef<boolean>(false); // true once SSE closes
  const finalFullTextRef   = useRef<string>("");
  const finalDataRef       = useRef<any>(null);

  const {
    messages,
    setMessages,
    setIsTyping,
    setActivity,
    setActivityExpanded,
    setShoppingContext,
    setLastCheckedDelivery,
    setNearbyCitiesSuggested,
    setActiveSmartPanel,
    saveOrderToHistory,
    setCheckoutOpen,
    setPhase,
    pendingConfirmProduct,
    pendingConfirmVariants,
  } = useApp();

  const { cartItems } = useCart();
  const { wishlistItems } = useWishlist();

  const performSearch = (trimmed: string, customCommerceState?: any) => {
    // ── Reset all streaming state ──────────────────────────────────────────
    streamBufferRef.current   = "";
    displayedTextRef.current  = "";
    firstChunkSeenRef.current = false;
    streamDoneRef.current     = false;
    finalFullTextRef.current  = "";
    finalDataRef.current      = null;
    if (displayTimerRef.current) {
      clearInterval(displayTimerRef.current);
      displayTimerRef.current = null;
    }
    setIsTyping(true);
    setActivityExpanded(false);
    setActivity({
      currentStep: "UNDERSTANDING",
      currentMessage: "Understanding request...",
      logs: [{ id: "UNDERSTANDING", title: "Understanding request", status: "active", details: [] }],
      error: false
    });

    const lastOrderSummaryMsg = [...messages].reverse().find(m => m.orderSummary);
    const activeDeliveryInfo = lastOrderSummaryMsg?.orderSummary?.deliveryInfo || null;

    const baseCommerceState = {
      cart: cartItems.map(i => ({
        productId: i.productId,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        brand: i.brand,
      })),
      wishlist: wishlistItems.map(i => ({
        productId: i.product.id,
        name: i.product.name,
        price: i.product.price,
      })),
      saved: [],
      buyNowProduct: pendingConfirmProduct ? {
        id: pendingConfirmProduct.id,
        name: pendingConfirmProduct.name,
        price: pendingConfirmProduct.price,
        currency: pendingConfirmProduct.currency,
        brand: pendingConfirmProduct.brand,
        images: pendingConfirmProduct.images
      } : null,
      buyNowVariants: pendingConfirmVariants || null,
      deliveryInfo: activeDeliveryInfo
    };

    const commerceState = customCommerceState
      ? { ...baseCommerceState, ...customCommerceState }
      : baseCommerceState;

    const finalize = (fullText: string, data: any) => {
      setActivity(null);
      setIsTyping(false);

      // If the backend returned a streamed text response and there is no
      // richer structured payload, mark the streaming message as complete
      // (switches from plain-text renderer to ReactMarkdown).
      if (fullText && data && data.type === "text") {
        setMessages(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (updated[lastIdx]?.role === "ai" && updated[lastIdx].streaming) {
            // Final flush: ensure full text is committed, then mark done.
            updated[lastIdx] = { ...updated[lastIdx], text: fullText, streaming: false };
          } else {
            const newMsg = { role: "ai" as const, text: fullText, streaming: false };
            if (updated[lastIdx]?.role === "ai") updated[lastIdx] = newMsg;
            else updated.push(newMsg);
          }
          return updated;
        });
        return;
      }

      if (data && typeof data === "object" && !Array.isArray(data)) {
        if (data.type === "order_confirmation") {
          if (data.order) {
            saveOrderToHistory(data.order);
          }
          setMessages(prev => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            const newMsg = {
              role: "ai" as const,
              type: "order_confirmation" as const,
              text: data.text || "✅ Order Successfully Placed",
              order: data.order
            };
            if (updated[lastIdx]?.role === "ai") updated[lastIdx] = newMsg;
            else updated.push(newMsg);
            return updated;
          });
          return;
        } else if (data.type === "order_tracking") {
          setMessages(prev => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            const newMsg = { role: "ai" as const, type: "order_tracking" as const, text: `Here is the current tracking status for order **${data.tracking?.orderNumber}**:`, tracking: data.tracking };
            if (updated[lastIdx]?.role === "ai") updated[lastIdx] = newMsg;
            else updated.push(newMsg);
            return updated;
          });
          return;
        } else if (data.type === "order_tracking_error") {
          setMessages(prev => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            const newMsg = { role: "ai" as const, type: "order_tracking_error" as const, text: `❌ ${data.message || "Unable to retrieve order status"}`, orderNumber: data.orderNumber };
            if (updated[lastIdx]?.role === "ai") updated[lastIdx] = newMsg;
            else updated.push(newMsg);
            return updated;
          });
          return;
        } else if (data.type === "checkout_init") {
          setPhase("bottom");
          setCheckoutOpen(true);
          setMessages(prev => {
            const updated = [...prev];
            if (updated[updated.length - 1]?.role === "ai" && !updated[updated.length - 1].text) {
              updated.pop();
            }
            return updated;
          });
          return;
        } else if (data.type === "product_details") {
          setMessages(prev => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            const newMsg = { role: "ai" as const, text: `Here are the details for **${data.product?.name || "the product"}**:`, type: "product_details" as const, productDetails: { content: data.content, product: data.product } };
            if (updated[lastIdx]?.role === "ai") updated[lastIdx] = newMsg;
            else updated.push(newMsg);
            return updated;
          });
          return;
        } else if (data.type === "delivery_result") {
          setMessages(prev => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            const newMsg = {
              role: "ai" as const,
              text: data.text,
              type: (data.available && !data.orderSummary && !data.isConversational) ? ("checkout_confirmation" as const) : undefined,
              orderSummary: data.orderSummary
            };
            if (updated[lastIdx]?.role === "ai") updated[lastIdx] = newMsg;
            else updated.push(newMsg);
            return updated;
          });
          if (data.available) {
            setLastCheckedDelivery({ city: data.city || "", deliveryDate: data.deliveryDate || "", productId: data.productId || "" });
          } else {
            setLastCheckedDelivery({ city: data.city || "", deliveryDate: data.deliveryDate || "", productId: data.productId || "" });
            if (data.alternativeCities) setNearbyCitiesSuggested(data.alternativeCities);
          }
          return;
        } else if (data.type === "nearby_cities") {
          setNearbyCitiesSuggested(data.cities || []);
          setMessages(prev => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            const newMsg = { role: "ai" as const, text: data.text };
            if (updated[lastIdx]?.role === "ai") updated[lastIdx] = newMsg;
            else updated.push(newMsg);
            return updated;
          });
          return;
        } else if (data.type === "alternative_date") {
          if (data.city) {
            setLastCheckedDelivery(prev => prev ? { ...prev, city: data.city, productId: data.productId || prev.productId } : { city: data.city, deliveryDate: "", productId: data.productId || "" });
          }
          setMessages(prev => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            const newMsg = { role: "ai" as const, text: data.text };
            if (updated[lastIdx]?.role === "ai") updated[lastIdx] = newMsg;
            else updated.push(newMsg);
            return updated;
          });
          return;
        } else if (data.type === "similar_products") {
          setMessages(prev => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            const newMsg = { role: "ai" as const, text: data.text, products: (data.products || []).map(mapBackendProductToUI) };
            if (updated[lastIdx]?.role === "ai") updated[lastIdx] = newMsg;
            else updated.push(newMsg);
            return updated;
          });
          return;
        } else if (data.type === "text" || (data.type === undefined && typeof data.text === "string")) {
          setMessages(prev => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            const newMsg = { role: "ai" as const, text: data.text };
            if (updated[lastIdx]?.role === "ai") updated[lastIdx] = newMsg;
            else updated.push(newMsg);
            return updated;
          });
          return;
        }
      }

      let introText = "";
      let rawProducts: any[] = [];

      if (data && typeof data === "object" && !Array.isArray(data)) {
        if (data.type === "product_grid") {
          introText = data.text || "";
          rawProducts = data.products || [];
        }
      } else if (Array.isArray(data)) {
        rawProducts = data;
      }

      const mappedProducts = rawProducts.map(mapBackendProductToUI);
      if (mappedProducts.length > 0) {
        setShoppingContext(prev => ({ ...prev, lastSearchResults: mappedProducts }));
      }

      setMessages(prev => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        const newMsg = {
          role: "ai" as const,
          text: introText || (mappedProducts.length > 0
            ? "Here are the live results from the backend:"
            : "I searched but couldn't find any products matching your query."),
          products: mappedProducts,
        };
        if (updated[lastIdx]?.role === "ai") updated[lastIdx] = newMsg;
        else updated.push(newMsg);
        return updated;
      });
    };

    sendMessage(trimmed, (payload) => {
      setActivity({
        currentStep: payload.step,
        currentMessage: payload.message,
        logs: payload.logs,
        error: payload.error
      });
    }, commerceState, (chunk) => {
      // ── Accumulate chunk into the buffer (no React re-render here) ────────
      streamBufferRef.current += chunk;

      if (!firstChunkSeenRef.current) {
        // First chunk: dismiss the loading animation immediately.
        firstChunkSeenRef.current = true;
        setActivity(null);
        // Keep isTyping = true so input stops responding / user can see it is generating.

        // ── Start 40fps display loop ─────────────────────────────────────
        displayTimerRef.current = setInterval(() => {
          const target = streamBufferRef.current;
          const current = displayedTextRef.current;

          if (current.length < target.length) {
            // Smoothly type 3 characters at a time (~120 chars/sec)
            const nextLength = Math.min(current.length + 3, target.length);
            const nextText = target.slice(0, nextLength);
            displayedTextRef.current = nextText;

            setMessages(prev => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === "ai" && last.streaming === true) {
                updated[updated.length - 1] = { ...last, text: nextText };
                return updated;
              }
              // Bubble doesn't exist yet — create it.
              return [...prev, { role: "ai" as const, text: nextText, streaming: true }];
            });
          } else if (streamDoneRef.current) {
            if (displayTimerRef.current) {
              clearInterval(displayTimerRef.current);
              displayTimerRef.current = null;
            }
            finalize(finalFullTextRef.current, finalDataRef.current);
          }
        }, 25); // ~40fps

        // Also paint the very first 3 characters instantly without waiting for the timer.
        const initialText = streamBufferRef.current.slice(0, 3);
        displayedTextRef.current = initialText;
        setMessages(prev => [
          ...prev,
          { role: "ai" as const, text: initialText, streaming: true }
        ]);
      }
    })
      .then((data) => {
        setActivityExpanded(false);
        streamDoneRef.current = true;

        // Grab the full buffered streaming text (if any) and reset the buffer.
        const finalFullText = streamBufferRef.current;
        finalFullTextRef.current = finalFullText;
        finalDataRef.current = data;

        const wasStreaming = firstChunkSeenRef.current;
        if (!wasStreaming) {
          setActivity(prev => {
            const completedLogs = (prev?.logs || []).map(log => ({ ...log, status: "completed" as const }));
            return { currentStep: "READY", currentMessage: "Recommendations ready", logs: completedLogs, error: false };
          });
          setTimeout(() => {
            finalize(finalFullText, data);
          }, 1000);
        }
      })
      .catch((err) => {
        if (err && (err.name === "AbortError" || err.message === "The user aborted a request.")) {
          console.log("Search request aborted by user.");
          setActivity(null);
          setIsTyping(false);
          return;
        }
        console.error("API Error:", err);
        setActivity(prev => {
          const baseLogs = prev?.logs || [{ id: "UNDERSTANDING", title: "Understanding request", status: "error", details: ["Catalog service unavailable"] }];
          const updatedLogs = baseLogs.map(log =>
            log.status === "active" || log.status === "pending" ? { ...log, status: "error" as const, details: ["Catalog service unavailable"] } : log
          );
          return { currentStep: "ERROR", currentMessage: "Search failed", logs: updatedLogs, error: true };
        });
        setIsTyping(false);
      });
  };

  const handleRetry = () => {
    const userMsgs = messages.filter(m => m.role === "user");
    if (userMsgs.length > 0) {
      performSearch(userMsgs[userMsgs.length - 1].text);
    }
  };

  const handleStop = () => {
    abortActiveRequest();
    // Stop the display loop immediately.
    if (displayTimerRef.current) {
      clearInterval(displayTimerRef.current);
      displayTimerRef.current = null;
    }
    streamBufferRef.current   = "";
    displayedTextRef.current  = "";
    firstChunkSeenRef.current = false;
    streamDoneRef.current     = false;
    setIsTyping(false);
    setActivity(null);
  };

  return { performSearch, handleRetry, handleStop };
};

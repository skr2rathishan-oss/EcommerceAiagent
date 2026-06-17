/**
 * useSearch — handles `performSearch`, `handleRetry`, and `handleStop`.
 * Responsible for building the commerce state payload, calling the SSE service,
 * and distributing response types into the message store.
 */
import { useApp } from "../contexts/AppContext";
import { sendMessage, abortActiveRequest } from "../services/chatServices";
import { mapBackendProductToUI } from "../services/mapping";
import { useCart } from "../contexts/CartContext";
import { useWishlist } from "../contexts/WishlistContext";

export const useSearch = () => {
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
  } = useApp();

  const { cartItems } = useCart();
  const { wishlistItems } = useWishlist();

  const performSearch = (trimmed: string) => {
    setIsTyping(true);
    setActivityExpanded(false);
    setActivity({
      currentStep: "UNDERSTANDING",
      currentMessage: "Understanding request...",
      logs: [{ id: "UNDERSTANDING", title: "Understanding request", status: "active", details: [] }],
      error: false
    });

    const commerceState = {
      cart: cartItems.map(i => ({
        productId: i.productId,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        brand: i.brand,
      })),
      wishlist: wishlistItems.map(i => ({
        productId: i.productId,
        name: i.product.name,
        price: i.product.price,
      })),
      saved: [],
    };

    sendMessage(trimmed, (payload) => {
      setActivity({
        currentStep: payload.step,
        currentMessage: payload.message,
        logs: payload.logs,
        error: payload.error
      });
    }, commerceState)
      .then((data) => {
        setActivityExpanded(false);
        setActivity(prev => {
          const completedLogs = (prev?.logs || []).map(log => ({ ...log, status: "completed" as const }));
          return { currentStep: "READY", currentMessage: "Recommendations ready", logs: completedLogs, error: false };
        });

        setTimeout(() => {
          setActivity(null);
          setIsTyping(false);

          if (data && typeof data === "object" && !Array.isArray(data)) {
            if (data.type === "order_tracking") {
              setMessages(prev => [...prev, { role: "ai", type: "order_tracking", text: `Here is the current tracking status for order **${data.tracking?.orderNumber}**:`, tracking: data.tracking }]);
              return;
            } else if (data.type === "order_tracking_error") {
              setMessages(prev => [...prev, { role: "ai", type: "order_tracking_error", text: `❌ ${data.message || "Unable to retrieve order status"}`, orderNumber: data.orderNumber }]);
              return;
            } else if (data.type === "product_details") {
              setMessages(prev => [...prev, { role: "ai", text: `Here are the details for **${data.product?.name || "the product"}**:`, type: "product_details", productDetails: { content: data.content, product: data.product } }]);
              return;
            } else if (data.type === "delivery_result") {
              setMessages(prev => [...prev, { role: "ai", text: data.text }]);
              if (data.available) {
                setLastCheckedDelivery(null);
              } else {
                setLastCheckedDelivery({ city: data.city || "", deliveryDate: data.deliveryDate || "", productId: data.productId || "" });
                if (data.alternativeCities) setNearbyCitiesSuggested(data.alternativeCities);
                setActiveSmartPanel("delivery_recovery");
              }
              return;
            } else if (data.type === "nearby_cities") {
              setNearbyCitiesSuggested(data.cities || []);
              setMessages(prev => [...prev, { role: "ai", text: data.text }]);
              setActiveSmartPanel("nearby_address");
              return;
            } else if (data.type === "alternative_date") {
              setMessages(prev => [...prev, { role: "ai", text: data.text }]);
              setActiveSmartPanel("alternative_date");
              return;
            } else if (data.type === "similar_products") {
              setMessages(prev => [...prev, { role: "ai", text: data.text, products: (data.products || []).map(mapBackendProductToUI) }]);
              return;
            } else if (data.type === "text" || (data.type === undefined && typeof data.text === "string")) {
              setMessages(prev => [...prev, { role: "ai", text: data.text }]);
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

          setMessages(prev => [...prev, {
            role: "ai",
            text: introText || (mappedProducts.length > 0
              ? "Here are the live results from the backend:"
              : "I searched but couldn't find any products matching your query."),
            products: mappedProducts,
          }]);
        }, 1000);
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
    setIsTyping(false);
    setActivity(null);
  };

  return { performSearch, handleRetry, handleStop };
};

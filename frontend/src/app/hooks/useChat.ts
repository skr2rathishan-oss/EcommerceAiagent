import React from "react";
import { useApp } from "../contexts/AppContext";
import { sendMessage, selectProduct, fetchProductDetails, abortActiveRequest } from "../services/chatServices";
import { checkDelivery } from "../services/productServices";
import { mapBackendProductToUI, formatUIPrice } from "../services/mapping";
import { type Product } from "../components/products";
import { type DeliveryInfo, getDefaultSeller } from "../components/InteractiveOrderSummary";
import { trackQueryUsage } from "../components/SuggestedPrompts";

export const useChat = () => {
  const {
    phase, setPhase,
    value, setValue,
    messages, setMessages,
    setSelectedIds,
    setShoppingContext,
    setActivity,
    setActivityExpanded,
    setPendingProductActions,
    setIsTyping,
    setPendingConfirmProduct,
    setPendingConfirmVariants,
    setPendingAddressChoice,
    setWaitingForAddressInput,
    setSelectedDetailProductId,
    pendingConfirmProduct,
    pendingConfirmVariants,
    waitingForAddressInput,
    handleAddToCart,
    handleWishlist,
  } = useApp();

  const getSessionId = () => sessionStorage.getItem("velora_session_id") || "default";

  // Handles when a user selects a product card
  const handleProductSelect = async (product: Product) => {
    setShoppingContext(prev => ({ ...prev, selectedProduct: product }));

    setPendingProductActions({
      product,
      actions: [
        { id: "view_details", label: "Details", emoji: "👀" },
        { id: "check_delivery", label: "Delivery", emoji: "🚚" },
        { id: "add_to_cart", label: "Add Cart", emoji: "🛒" },
        { id: "save_for_later", label: "Wishlist", emoji: "❤️" },
        { id: "compare", label: "Compare", emoji: "⚖️" },
      ],
    });

    try {
      await selectProduct({
        id: product.id,
        name: product.name,
        price: product.price,
        currency: product.currency,
        images: product.images,
        inStock: product.stock > 0,
      });
    } catch {
      console.warn("[ProductSelect] Backend session save failed (non-critical)");
    }
  };

  // Handles actions in the action popup above input box
  const handleProductAction = async (actionId: string, product: Product) => {
    setPendingProductActions(null);
    setSelectedIds({});
    setShoppingContext(prev => ({ ...prev, selectedProduct: null }));

    if (actionId === "view_details") {
      if (phase === "centered") setPhase("bottom");
      setIsTyping(true);
      setActivity({
        currentStep: "UNDERSTANDING",
        currentMessage: "Fetching product details...",
        logs: [
          { id: "UNDERSTANDING", title: "Retrieving details", status: "active", details: [`Product ID: ${product.id}`] },
          { id: "READY", title: "Formatting display", status: "pending", details: [] }
        ]
      });
      try {
        const data = await fetchProductDetails(product.id) as {
          type: string; content: string; product: Product;
        };
        if (data?.type === "product_details" && data.content) {
          setMessages(prev => [...prev, {
            role: "ai",
            text: `Here are the full details for **${product.name}**:`,
            type: "product_details",
            productDetails: { content: data.content, product },
          }]);
        } else {
          setMessages(prev => [...prev, {
            role: "ai",
            text: `**${product.name}**\n\nPrice: ${formatUIPrice(product.price, product.currency)}\n\n${product.description || product.shortDesc || ""}`,
          }]);
        }
      } catch {
        setMessages(prev => [...prev, {
          role: "ai",
          text: "⚠️ I couldn't load the full product details right now. Please try again.",
        }]);
      } finally {
        setIsTyping(false);
        setActivity(null);
      }

    } else if (actionId === "add_to_cart") {
      handleAddToCart(product);

    } else if (actionId === "save_for_later") {
      handleWishlist(product);

    } else if (actionId === "check_delivery") {
      setPendingConfirmProduct(product);
      setPendingAddressChoice(true);
      if (phase === "centered") setPhase("bottom");

    } else if (actionId === "compare") {
      if (phase === "centered") setPhase("bottom");
      setMessages(prev => [...prev, {
        role: "ai",
        text: `🔜 **Compare feature coming soon!**\n\nI'll be able to compare **${product.name}** with similar products side-by-side. For now, you can browse the other products in the search results above.`,
      }]);
    }
  };

  // Triggers search
  const performSearch = (trimmed: string) => {
    setIsTyping(true);
    setActivityExpanded(false);
    setActivity({
      currentStep: "UNDERSTANDING",
      currentMessage: "Understanding request...",
      logs: [
        { id: "UNDERSTANDING", title: "Understanding request", status: "active", details: [] }
      ],
      error: false
    });

    sendMessage(trimmed, (payload) => {
      setActivity({
        currentStep: payload.step,
        currentMessage: payload.message,
        logs: payload.logs,
        error: payload.error
      });
    })
      .then((data) => {
        setActivityExpanded(false);
        setActivity(prev => {
          const baseLogs = prev?.logs || [];
          const completedLogs = baseLogs.map(log => ({ ...log, status: "completed" as const }));
          return {
            currentStep: "READY",
            currentMessage: "Recommendations ready",
            logs: completedLogs,
            error: false
          };
        });

        setTimeout(() => {
          setActivity(null);
          setIsTyping(false);

          if (data && typeof data === "object" && !Array.isArray(data)) {
            if (data.type === "order_tracking") {
              setMessages(prev => [...prev, {
                role: "ai",
                type: "order_tracking",
                text: `Here is the current tracking status for order **${data.tracking?.orderNumber}**:`,
                tracking: data.tracking
              }]);
              return;
            } else if (data.type === "order_tracking_error") {
              setMessages(prev => [...prev, {
                role: "ai",
                type: "order_tracking_error",
                text: `❌ ${data.message || "Unable to retrieve order status"}`,
                orderNumber: data.orderNumber
              }]);
              return;
            } else if (data.type === "product_details") {
              setMessages(prev => [...prev, {
                role: "ai",
                text: `Here are the details for **${data.product?.name || "the product"}**:`,
                type: "product_details",
                productDetails: { content: data.content, product: data.product },
              }]);
              return;
            } else if (data.type === "text" || (data.type === undefined && typeof data.text === "string")) {
              setMessages(prev => [...prev, {
                role: "ai",
                text: data.text,
              }]);
              return;
            }
          }

          let introText = "";
          let rawProducts = [];

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
          const baseLogs = prev?.logs || [
            { id: "UNDERSTANDING", title: "Understanding request", status: "error", details: ["Catalog service unavailable"] }
          ];
          const updatedLogs = baseLogs.map(log =>
            log.status === "active" || log.status === "pending" ? { ...log, status: "error" as const, details: ["Catalog service unavailable"] } : log
          );
          return {
            currentStep: "ERROR",
            currentMessage: "Search failed",
            logs: updatedLogs,
            error: true
          };
        });
      });
  };

  const handleRetry = () => {
    const userMsgs = messages.filter(m => m.role === "user");
    if (userMsgs.length > 0) {
      const lastMsg = userMsgs[userMsgs.length - 1].text;
      performSearch(lastMsg);
    }
  };

  const handleSend = (textOverride?: string) => {
    const trimmed = typeof textOverride === "string" ? textOverride.trim() : value.trim();
    if (!trimmed) return;

    // Track query usage for suggested prompts
    trackQueryUsage(trimmed);

    if (phase === "centered") setPhase("bottom");
    setMessages(prev => [...prev, { role: "user", text: trimmed }]);
    setValue("");

    if (waitingForAddressInput) {
      setIsTyping(true);
      setActivity({
        currentStep: "UNDERSTANDING",
        currentMessage: "Checking delivery availability...",
        logs: [
          { id: "UNDERSTANDING", title: "Validating address", status: "active", details: [`Address: ${trimmed}`] },
          { id: "READY", title: "Checking carrier service", status: "pending", details: [] }
        ]
      });

      const CITIES_LIST = [
        "Colombo 01", "Colombo 02", "Colombo 03", "Colombo 04", "Colombo 05", "Colombo 06", "Colombo 07", "Colombo 08", "Colombo 09", "Colombo 10", "Colombo 11", "Colombo 12", "Colombo 13", "Colombo 14", "Colombo 15",
        "Jaffna", "Galle", "Kandy", "Negombo", "Anuradhapura", "Gampaha", "Kurunegala", "Batticaloa", "Trincomalee", "Matara", "Ratnapura", "Badulla", "Kalutara", "Moratuwa", "Dehiwala", "Mount Lavinia"
      ];
      let detectedCity = "";
      const textLower = trimmed.toLowerCase();
      for (const city of CITIES_LIST) {
        if (textLower.includes(city.toLowerCase())) {
          detectedCity = city;
          break;
        }
      }

      if (!detectedCity) {
        const parts = trimmed.split(",");
        if (parts.length > 0) {
          detectedCity = parts[parts.length - 1].trim();
        }
      }

      if (!detectedCity) {
        detectedCity = "Colombo 03";
      }

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];

      checkDelivery({
        city: detectedCity,
        deliveryDate: tomorrowStr,
        productId: pendingConfirmProduct ? pendingConfirmProduct.id : ""
      })
        .then((res) => {
          if (res.available) {
            setWaitingForAddressInput(false);
            const seller = getDefaultSeller(pendingConfirmProduct!.brand);
            const deliveryInfo = {
              fullName: "Alex Johnson",
              phone: "+94 77 123 4567",
              email: "alex@example.com",
              address: trimmed
            };

            setMessages(prev => [
              ...prev,
              {
                role: "ai",
                text: `✅ Great! Delivery is available for your address in **${res.city}** (Delivery Charge: Rs. ${res.deliveryCharge}). Here is your updated Order Summary:`,
                orderSummary: {
                  product: pendingConfirmProduct!,
                  variants: pendingConfirmVariants,
                  deliveryInfo: deliveryInfo,
                  sellerInfo: seller,
                  status: "pending"
                }
              }
            ]);
            setPendingConfirmProduct(null);
            setPendingConfirmVariants(undefined);
          } else {
            setMessages(prev => [
              ...prev,
              {
                role: "ai",
                text: `❌ Delivery not available for your address. Reason: ${res.warning || "Unsupported delivery city"}. Please enter a different address or city in this format:\n\n**[Street Line 1], [Street Line 2], [City]**`
              }
            ]);
          }
          setActivity(null);
        })
        .catch((err) => {
          setMessages(prev => [
            ...prev,
            {
              role: "ai",
              text: `⚠️ Unable to verify delivery: ${err.message || "Failed to call check service"}. Please try typing the address again.`
            }
          ]);
          setActivity(null);
        })
        .finally(() => {
          setIsTyping(false);
        });

      return;
    }

    performSearch(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStop = () => {
    abortActiveRequest();
    setIsTyping(false);
    setActivity(null);
  };

  return {
    handleProductSelect,
    handleProductAction,
    performSearch,
    handleRetry,
    handleSend,
    handleKeyDown,
    handleStop,
    getSessionId,
  };
};

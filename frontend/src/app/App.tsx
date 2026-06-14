import React, { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ChevronLeft, MapPin, Sparkles } from "lucide-react";
import { ProductShowcase } from "./components/ProductShowcase";
import { type Product, PRODUCTS } from "./components/products";
import { CheckoutPanel } from "./components/CheckoutPanel";
import { getDefaultSeller } from "./components/InteractiveOrderSummary";
import { AppProvider, useApp, type PanelId, type RightPanelId } from "./contexts/AppContext";
import { useChat } from "./hooks/useChat";
import { useCheckout } from "./hooks/useCheckout";
import { Sidebar } from "./components/Sidebar";
import { TopNavbar } from "./components/TopNavbar";
import { MessageArea } from "./components/MessageArea";
import { ChatInputBox } from "./components/ChatInputBox";
import { SuggestedPrompts } from "./components/SuggestedPrompts";
import { PanelPopup } from "./components/PanelPopup";
import { RightSidebar } from "./components/RightSidebar";
import { fetchRecommendations } from "./services/productServices";
import { mapBackendProductToUI, formatUIPrice } from "./services/mapping";

function RecommendationCard({ prod, onClick }: { prod: Product; onClick: () => void }) {
  const [imgErr, setImgErr] = useState(false);
  return (
    <motion.div
      whileHover={{ y: -4, borderColor: "rgba(124, 77, 186, 0.35)", boxShadow: "0 6px 16px rgba(64, 41, 112, 0.1)" }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      style={{
        width: 120,
        flexShrink: 0,
        background: "rgba(255, 255, 255, 0.65)",
        backdropFilter: "blur(10px)",
        border: "1.5px solid rgba(124, 77, 186, 0.15)",
        borderRadius: 14,
        overflow: "hidden",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        transition: "border-color 0.15s, box-shadow 0.15s",
        userSelect: "none"
      }}
    >
      {/* Product Image */}
      <div style={{ width: "100%", aspectRatio: "1/1", background: "linear-gradient(135deg,#f5f0ff,#ede4ff)", overflow: "hidden", position: "relative" }}>
        {!imgErr ? (
          <img
            src={prod.images[0]}
            alt={prod.name}
            onError={() => setImgErr(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Sparkles size={18} color="rgba(124,77,186,0.25)" />
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: "8px 10px 10px", display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
        <span style={{ color: "#9e8dc0", fontSize: 7.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "'Nunito', sans-serif" }}>
          {prod.brand}
        </span>
        <span
          style={{
            color: "#1a1025",
            fontSize: 10.5,
            fontWeight: 700,
            fontFamily: "'Nunito', sans-serif",
            lineHeight: 1.25,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            height: 26
          }}
        >
          {prod.name}
        </span>
        <span style={{ color: "#7c4dba", fontSize: 11.5, fontWeight: 800, fontFamily: "'Nunito', sans-serif", marginTop: "auto" }}>
          {formatUIPrice(prod.price, prod.currency)}
        </span>
      </div>
    </motion.div>
  );
}

function MainApp() {
  const {
    phase, setPhase,
    activePanel, setActivePanel,
    anchorPos, setAnchorPos,
    rightPanel, setRightPanel,
    value, setValue,
    messages, setMessages,
    cartItems, setCartItems,
    wishlistItems, setWishlistItems,
    savedItems, setSavedItems,
    orderedItems,
    selectedIds, setSelectedIds,
    activity,
    activityExpanded, setActivityExpanded,
    pendingProductActions, setPendingProductActions,
    checkoutOpen, setCheckoutOpen,
    pendingConfirmProduct,
    pendingConfirmVariants,
    isTyping,
    pendingAddressChoice, setPendingAddressChoice,
    isEnteringCustomDetails, setIsEnteringCustomDetails,
    customName, setCustomName,
    customPhone, setCustomPhone,
    customEmail, setCustomEmail,
    newStreet1, setNewStreet1,
    newStreet2, setNewStreet2,
    newCity, setNewCity,
    addressError,
    checkingAddress,
    handleAddToCart,
    handleWishlist,
    resetPendingPurchaseState
  } = useApp();

  const {
    handleProductSelect,
    handleProductAction,
    handleRetry,
    handleKeyDown,
    handleSend,
    handleStop,
    handleRequestProductDetails
  } = useChat();

  const {
    handleBuyNow,
    handlePlaceInlineOrder,
    handleCartCheckoutComplete,
    handleVerifyCustomDetails,
    handleUseDefaultAddress
  } = useCheckout();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recsContainerRef = useRef<HTMLDivElement>(null);
  const recsHoveredRef = useRef(false);

  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [loadingRecs, setLoadingRecs] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    setLoadingRecs(true);
    fetchRecommendations()
      .then(products => {
        if (!active) return;
        const mapped = products.map(mapBackendProductToUI);
        setRecommendations(mapped);
        setLoadingRecs(false);
      })
      .catch(err => {
        console.error("Failed to load recommendations:", err);
        if (active) setLoadingRecs(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Frame-rate independent infinite horizontal auto-scroll and center-magnified scaling
  useEffect(() => {
    if (loadingRecs || recommendations.length === 0) return;
    const container = recsContainerRef.current;
    if (!container) return;

    // Force instant scroll updates, bypass any CSS-level smooth scroll delays
    container.style.scrollBehavior = "auto";

    let animationId: number;
    let lastTime: number | null = null;
    const scrollSpeed = 35; // Continuous elegant speed (px/sec)

    const updateCardTransforms = () => {
      const containerWidth = container.clientWidth;
      const containerCenter = containerWidth / 2;
      if (container.children.length === 0) return;

      Array.from(container.children).forEach((childNode) => {
        const child = childNode as HTMLElement;
        const childLeft = child.offsetLeft - container.scrollLeft;
        const childCenter = childLeft + child.clientWidth / 2;

        const dist = childCenter - containerCenter;
        const maxDist = containerWidth / 2 || 1;
        const normalizedDist = Math.max(-1, Math.min(1, dist / maxDist));

        // Scale: center card is enlarged (1.12), edge cards are smaller (0.90)
        const scale = 1.12 - 0.22 * (normalizedDist * normalizedDist);

        // Gap expansion: dynamically push cards outward to widen the gap in the center
        const translateX = normalizedDist * 64 * (1 - Math.abs(normalizedDist));

        child.style.transform = `translateX(${translateX}px) scale(${scale})`;
        child.style.transformOrigin = "center center";
        child.style.transition = "transform 0.05s ease-out";
      });
    };

    const step = (time: number) => {
      if (lastTime === null) {
        lastTime = time;
      }
      const rawDelta = (time - lastTime) / 1000;
      const delta = Math.min(rawDelta, 0.1);
      lastTime = time;

      if (container && !recsHoveredRef.current) {
        let nextScroll = container.scrollLeft + scrollSpeed * delta;
        const N = recommendations.length;
        if (container.children.length > N) {
          const firstChildOfFirstCopy = container.children[0] as HTMLElement;
          const firstChildOfSecondCopy = container.children[N] as HTMLElement;
          if (firstChildOfFirstCopy && firstChildOfSecondCopy) {
            const offset = firstChildOfSecondCopy.offsetLeft - firstChildOfFirstCopy.offsetLeft;
            if (nextScroll >= offset) {
              nextScroll = nextScroll - offset;
            } else if (nextScroll < 0) {
              nextScroll = nextScroll + offset;
            }
          }
        }
        container.scrollLeft = nextScroll;
        updateCardTransforms();
      }
      animationId = requestAnimationFrame(step);
    };

    const handleScroll = () => {
      updateCardTransforms();
    };

    container.addEventListener("scroll", handleScroll, { passive: true });

    // Initial positioning once elements render
    requestAnimationFrame(() => {
      updateCardTransforms();
    });

    animationId = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(animationId);
      container.removeEventListener("scroll", handleScroll);
    };
  }, [loadingRecs, recommendations]);

  const handleItemClick = (label: string, rect: DOMRect) => {
    if (label === "New Chat") {
      setPhase("centered");
      setMessages([]);
      setValue("");
      return;
    }
    if (activePanel === label) {
      setActivePanel(null);
      return;
    }
    setAnchorPos({ x: rect.right + 8, y: rect.top + rect.height / 2 });
    setActivePanel(label as PanelId);
  };

  const handleStartWorkflow = (type: "find_products" | "find_gift" | "track_order") => {
    setPhase("bottom");

    let text = "";
    if (type === "find_products") {
      text = "Let's find the right products for you! I will guide you through a few quick questions to gather your requirements.";
    } else if (type === "find_gift") {
      text = "Let's find the perfect gift! Tell me a bit about who this is for and what the occasion is.";
    } else if (type === "track_order") {
      text = "How would you like to track your order? You can look it up using your Order ID or view recent orders.";
    }

    setMessages(prev => [
      ...prev,
      {
        role: "ai",
        type: "guided_workflow",
        text: text,
        workflow: {
          type,
          step: 0,
          answers: {},
          isCompleted: false,
          loading: false,
          error: null
        }
      }
    ]);
  };

  const canSend = value.trim().length > 0;

  return (
    <div className="h-screen w-screen flex overflow-hidden" style={{ background: "#f0ebfa", fontFamily: "'Nunito',sans-serif" }}>
      {/* Sidebar */}
      <Sidebar onItemClick={handleItemClick} />

      {/* Main */}
      <div className="flex-1 flex flex-col relative overflow-hidden min-h-0">

        {/* Center glow — centered phase only */}
        {phase === "centered" && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center" aria-hidden>
            <div style={{
              width: 560, height: 560, borderRadius: "50%",
              background: "radial-gradient(circle, rgba(167,139,250,0.25) 0%, rgba(139,92,246,0.12) 45%, transparent 70%)",
              filter: "blur(60px)",
            }} />
          </div>
        )}

        {/* Static orbs for chat phase */}
        {phase === "bottom" && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
            <div className="absolute rounded-full blur-3xl opacity-20" style={{ width: 500, height: 500, top: -100, right: -80, background: "radial-gradient(circle,#7c4dba,transparent 70%)" }} />
            <div className="absolute rounded-full blur-3xl opacity-15" style={{ width: 360, height: 360, bottom: 40, left: -60, background: "radial-gradient(circle,#9b59d0,transparent 70%)" }} />
          </div>
        )}

        <TopNavbar
          onRightPanel={(id) => setRightPanel(rightPanel === id ? null : id)}
          onTrackOrder={(orderNumber) => {
            if (phase === "centered") setPhase("bottom");
            setMessages(prev => [...prev, { role: "user", text: `Track order ${orderNumber}` }]);
            // Re-trigger standard track search
            const getSessionId = () => sessionStorage.getItem("velora_session_id") || "default";
            setIsTyping(true);
            fetch("/api/orders/track", {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-session-id": getSessionId() },
              body: JSON.stringify({ orderNumber })
            })
              .then(res => res.json())
              .then(data => {
                setMessages(prev => [...prev, {
                  role: "ai",
                  type: "order_tracking",
                  text: `Here is the current tracking status for order **${orderNumber}**:`,
                  tracking: data
                }]);
              })
              .catch(err => {
                setMessages(prev => [...prev, {
                  role: "ai",
                  type: "order_tracking_error",
                  text: `❌ ${err.message || "Failed to retrieve order status"}`,
                  orderNumber
                }]);
              })
              .finally(() => setIsTyping(false));
          }}
        />

        {/* Centered phase */}
        <AnimatePresence>
          {phase === "centered" && (
            <motion.div
              key="centered"
              className="flex-1 w-full overflow-y-auto flex flex-col items-center justify-center px-4 py-8 custom-scrollbar no-scrollbar"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -24, transition: { duration: 0.3, ease: "easeIn" } }}
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              }}
            >
              <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                  display: none;
                }
                .no-scrollbar::-webkit-scrollbar {
                  display: none;
                }
              `}</style>

              {/* Hero Section */}
              <motion.div
                className="text-center mb-6 select-none w-full max-w-2xl"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.5 } }}
              >
                <h1 style={{ color: "#1a1025", fontSize: "clamp(24px, 5vw, 36px)", fontWeight: 800, letterSpacing: "-0.5px", lineHeight: 1.2, marginBottom: 8 }}>
                  Discover Smart Shopping with Velora
                </h1>
                <p style={{ color: "#7c6a9e", fontSize: 15.5, maxWidth: 460, margin: "0 auto 20px", lineHeight: 1.5 }}>
                  Your intelligent shopping assistant. Ask questions, compare products, find deals, and track orders in one place.
                </p>
              </motion.div>

              {/* Chat Input & Suggested Searches Box */}
              <motion.div className="w-full mb-8" style={{ maxWidth: 672 }}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.15 } }}
              >
                <ChatInputBox value={value} onChange={setValue} onSend={handleSend}
                  onKeyDown={handleKeyDown} canSend={canSend}
                  textareaRef={textareaRef} fileInputRef={fileInputRef}
                  isTyping={isTyping} onStop={handleStop} />

                {/* Quick Actions (Pill Buttons) */}
                <div className="w-full mt-5 flex flex-wrap gap-2.5 justify-center select-none">
                  {[
                    { title: "Find Products", emoji: "🛍️", type: "find_products" as const },
                    { title: "Find Gift", emoji: "🎁", type: "find_gift" as const },
                    { title: "Track My Order", emoji: "📦", type: "track_order" as const }
                  ].map((act, idx) => (
                    <motion.button
                      key={idx}
                      whileHover={{
                        y: -1.5,
                        backgroundColor: "rgba(255, 255, 255, 0.95)",
                        borderColor: "rgba(124, 77, 186, 0.35)",
                        boxShadow: "0 4px 10px rgba(64, 41, 112, 0.05)"
                      }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleStartWorkflow(act.type)}
                      className="cursor-pointer border transition-all duration-150 inline-flex items-center"
                      style={{
                        padding: "6px 12px",
                        background: "rgba(255, 255, 255, 0.65)",
                        backdropFilter: "blur(8px)",
                        borderColor: "rgba(64, 41, 112, 0.12)",
                        borderRadius: 9999,
                        color: "#1a1025",
                        fontSize: 12,
                        fontWeight: 600,
                        fontFamily: "'Nunito', sans-serif"
                      }}
                    >
                      <span style={{ marginRight: 5, fontSize: 13.5, display: "inline-flex", alignItems: "center" }}>{act.emoji}</span>
                      <span>{act.title}</span>
                    </motion.button>
                  ))}
                </div>

                {/* Product Recommendations */}
                <div style={{ marginTop: 68, width: "100%" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, padding: "0 4px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Sparkles size={13} color="#7c4dba" />
                      <span style={{ fontSize: 12.5, fontWeight: 800, color: "#1a1025", letterSpacing: "0.02em", fontFamily: "'Nunito', sans-serif" }}>
                        Top Recommendations
                      </span>
                    </div>
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: "#7c6a9e", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "'Nunito', sans-serif" }}>
                      From Kapruka
                    </span>
                  </div>

                  <div
                    ref={recsContainerRef}
                    onMouseEnter={() => { recsHoveredRef.current = true; }}
                    onMouseLeave={() => { recsHoveredRef.current = false; }}
                    onTouchStart={() => { recsHoveredRef.current = true; }}
                    onTouchEnd={() => { recsHoveredRef.current = false; }}
                    style={(!loadingRecs && recommendations.length > 0) ? {
                      position: "relative",
                      width: "100%",
                      height: 220,
                      cursor: "grab",
                      userSelect: "none",
                      touchAction: "pan-y",
                      display: "flex",
                      gap: 12,
                      overflowX: "auto",
                      paddingBottom: 8,
                      scrollBehavior: "auto",
                      WebkitOverflowScrolling: "touch",
                      scrollbarWidth: "none",
                    } : {
                      display: "flex",
                      gap: 12,
                      overflowX: "auto",
                      paddingBottom: 8,
                      scrollBehavior: "auto",
                      WebkitOverflowScrolling: "touch",
                      scrollbarWidth: "none",
                    }}
                  >
                    {loadingRecs ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <div
                          key={i}
                          style={{
                            width: 120,
                            height: 175,
                            borderRadius: 14,
                            background: "rgba(255, 255, 255, 0.4)",
                            border: "1.5px solid rgba(124, 77, 186, 0.08)",
                            boxShadow: "0 4px 12px rgba(64, 41, 112, 0.03)",
                            position: "relative",
                            overflow: "hidden"
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              inset: 0,
                              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
                              animation: "pulse 1.5s infinite"
                            }}
                          />
                        </div>
                      ))
                    ) : recommendations.length === 0 ? (
                      <div style={{ width: "100%", padding: "20px 0", textAlign: "center", color: "#7c6a9e", fontSize: 12, fontWeight: 600 }}>
                        No recommendations available at the moment.
                      </div>
                    ) : (
                      [...recommendations, ...recommendations, ...recommendations].map((prod, idx) => (
                        <RecommendationCard
                          key={`${prod.id}-${idx}`}
                          prod={prod}
                          onClick={() => {
                            handleRequestProductDetails(prod.id, prod.name);
                          }}
                        />
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom phase */}
        {phase === "bottom" && (
          <div className="flex-1 min-w-0 min-h-0 px-4 pb-3 pt-0 flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <MessageArea
                messages={messages}
                selectedIds={selectedIds}
                setSelectedIds={setSelectedIds}
                onAddToCart={handleAddToCart}
                onBuyNow={handleBuyNow}
                onWishlist={handleWishlist}
                onPlaceInlineOrder={handlePlaceInlineOrder}
                isTyping={isTyping}
                onViewDetails={(id) => {
                  const found = recommendations.find(p => p.id === id) || PRODUCTS.find(p => p.id === id);
                  handleRequestProductDetails(id, found?.name);
                }}
                onContinueShopping={() => textareaRef.current?.focus()}
                onSelectProduct={handleProductSelect}
                activity={activity}
                onRetry={handleRetry}
                activityExpanded={activityExpanded}
                onExpandedChange={setActivityExpanded}
              />
            </div>

            <motion.div
              className="w-full pt-3 flex justify-center flex-none"
              initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } }}
            >
              <div className="w-full" style={{ maxWidth: 720 }}>
                <AnimatePresence>
                  {/* ── Product Actions Popup ─────────────────────────────────────────── */}
                  {pendingProductActions && !pendingConfirmProduct && (
                    <motion.div
                      id="product-actions-popup"
                      key="product-actions-popup"
                      initial={{ opacity: 0, height: 0, y: 10 }}
                      animate={{ opacity: 1, height: "auto", y: 0 }}
                      exit={{ opacity: 0, height: 0, y: 10 }}
                      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                      style={{
                        background: "rgba(255, 255, 255, 0.97)",
                        backdropFilter: "blur(14px)",
                        border: "1.5px solid rgba(124, 77, 186, 0.22)",
                        borderRadius: 18,
                        padding: "13px 16px",
                        marginBottom: 12,
                        boxShadow: "0 8px 28px rgba(64, 41, 112, 0.15)",
                        overflow: "hidden",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 11 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ color: "#1a1025", fontSize: 12.5, fontWeight: 700, margin: 0, lineHeight: 1.45 }}>
                            Great choice! 😊 That looks like a promising option. What would you like to do next?
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setPendingProductActions(null);
                            setSelectedIds({});
                            setShoppingContext(prev => ({ ...prev, selectedProduct: null }));
                          }}
                          style={{ width: 26, height: 26, borderRadius: 7, border: "none", cursor: "pointer", background: "rgba(64,41,112,0.07)", color: "#9e8dc0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                        >
                          <X size={11} strokeWidth={2.5} />
                        </button>
                      </div>

                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {pendingProductActions.actions.map((action) => (
                          <motion.button
                            key={action.id}
                            type="button"
                            whileTap={{ scale: 0.94 }}
                            onClick={() => handleProductAction(action.id, pendingProductActions.product)}
                            style={{
                              flex: 1,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 4,
                              padding: "7px 6px",
                              borderRadius: 9,
                              border: "1.5px solid rgba(64,41,112,0.13)",
                              background: "rgba(64,41,112,0.03)",
                              color: "#402970",
                              fontSize: 10,
                              fontWeight: 700,
                              cursor: "pointer",
                              fontFamily: "'Nunito', sans-serif",
                              transition: "background 0.15s, border-color 0.15s",
                              whiteSpace: "nowrap",
                              minWidth: 0,
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = "rgba(124,77,186,0.10)";
                              e.currentTarget.style.borderColor = "rgba(124,77,186,0.35)";
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = "rgba(64,41,112,0.03)";
                              e.currentTarget.style.borderColor = "rgba(64,41,112,0.13)";
                            }}
                          >
                            <span style={{ fontSize: 13, lineHeight: 1 }}>{action.emoji}</span>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{action.label}</span>
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {pendingConfirmProduct && !pendingAddressChoice && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, y: 10 }}
                      animate={{ opacity: 1, height: "auto", y: 0 }}
                      exit={{ opacity: 0, height: 0, y: 10 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      style={{
                        background: "rgba(255, 255, 255, 0.95)",
                        backdropFilter: "blur(8px)",
                        border: "1.5px solid rgba(124, 77, 186, 0.22)",
                        borderRadius: 16,
                        padding: "12px 16px",
                        marginBottom: 12,
                        boxShadow: "0 8px 24px rgba(64, 41, 112, 0.12)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        overflow: "hidden",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: "linear-gradient(135deg,#f5f0ff,#ede4ff)" }}>
                          <img src={pendingConfirmProduct.images[0]} alt={pendingConfirmProduct.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ color: "#7c6a9e", fontSize: 10, fontWeight: 800, margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>Confirm Purchase</p>
                          <h4 style={{ color: "#1a1025", fontSize: 13, fontWeight: 700, margin: "2px 0 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            Buy {pendingConfirmProduct.name} for ${pendingConfirmProduct.price.toFixed(2)}?
                          </h4>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={resetPendingPurchaseState}
                          style={{ padding: "6px 12px", borderRadius: 8, border: "1.5px solid rgba(64,41,112,0.15)", background: "transparent", color: "#7c6a9e", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingAddressChoice(true)}
                          style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#7c4dba,#402970)", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 10px rgba(64,41,112,0.2)" }}
                        >
                          Confirm
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {pendingConfirmProduct && pendingAddressChoice && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, y: 10 }}
                      animate={{ opacity: 1, height: "auto", y: 0 }}
                      exit={{ opacity: 0, height: 0, y: 10 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      style={{
                        background: "rgba(255, 255, 255, 0.95)",
                        backdropFilter: "blur(8px)",
                        border: "1.5px solid rgba(124, 77, 186, 0.22)",
                        borderRadius: 16,
                        padding: "16px 20px",
                        marginBottom: 12,
                        boxShadow: "0 8px 24px rgba(64, 41, 112, 0.12)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "stretch",
                        justifyContent: "flex-start",
                        gap: 12,
                        overflow: "hidden",
                      }}
                    >
                      {isEnteringCustomDetails ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => setIsEnteringCustomDetails(false)}
                              style={{
                                background: "rgba(64,41,112,0.07)",
                                border: "none",
                                borderRadius: 6,
                                width: 24,
                                height: 24,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#7c6a9e",
                              }}
                            >
                              <ChevronLeft size={14} strokeWidth={2.5} />
                            </button>
                            <div>
                              <p style={{ color: "#7c6a9e", fontSize: 9, fontWeight: 800, margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>Custom Details</p>
                              <h4 style={{ color: "#1a1025", fontSize: 13, fontWeight: 700, margin: 0 }}>
                                Enter Delivery & Owner Info
                              </h4>
                            </div>
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <div style={{ display: "flex", gap: 8 }}>
                              <div style={{ flex: 1 }}>
                                <label style={{ color: "#7c6a9e", fontSize: 9, fontWeight: 700, display: "block", marginBottom: 3 }}>FULL NAME *</label>
                                <input
                                  type="text"
                                  value={customName}
                                  onChange={(e) => setCustomName(e.target.value)}
                                  placeholder="e.g. Alex Johnson"
                                  style={{
                                    width: "100%", padding: "6px 10px", borderRadius: 8, border: "1.5px solid rgba(64,41,112,0.15)", background: "#fff", color: "#1a1025", fontSize: 12, fontFamily: "'Nunito', sans-serif", outline: "none", boxSizing: "border-box"
                                  }}
                                />
                              </div>
                              <div style={{ flex: 1 }}>
                                <label style={{ color: "#7c6a9e", fontSize: 9, fontWeight: 700, display: "block", marginBottom: 3 }}>PHONE NUMBER *</label>
                                <input
                                  type="text"
                                  value={customPhone}
                                  onChange={(e) => setCustomPhone(e.target.value)}
                                  placeholder="e.g. +94 77 123 4567"
                                  style={{
                                    width: "100%", padding: "6px 10px", borderRadius: 8, border: "1.5px solid rgba(64,41,112,0.15)", background: "#fff", color: "#1a1025", fontSize: 12, fontFamily: "'Nunito', sans-serif", outline: "none", boxSizing: "border-box"
                                  }}
                                />
                              </div>
                            </div>

                            <div>
                              <label style={{ color: "#7c6a9e", fontSize: 9, fontWeight: 700, display: "block", marginBottom: 3 }}>EMAIL ADDRESS *</label>
                              <input
                                type="email"
                                value={customEmail}
                                onChange={(e) => setCustomEmail(e.target.value)}
                                placeholder="e.g. alex@example.com"
                                style={{
                                  width: "100%", padding: "6px 10px", borderRadius: 8, border: "1.5px solid rgba(64,41,112,0.15)", background: "#fff", color: "#1a1025", fontSize: 12, fontFamily: "'Nunito', sans-serif", outline: "none", boxSizing: "border-box"
                                }}
                              />
                            </div>

                            <div>
                              <label style={{ color: "#7c6a9e", fontSize: 9, fontWeight: 700, display: "block", marginBottom: 3 }}>STREET LINE 1 *</label>
                              <input
                                type="text"
                                value={newStreet1}
                                onChange={(e) => setNewStreet1(e.target.value)}
                                placeholder="e.g. No 15, Temple Road"
                                style={{
                                  width: "100%", padding: "6px 10px", borderRadius: 8, border: "1.5px solid rgba(64,41,112,0.15)", background: "#fff", color: "#1a1025", fontSize: 12, fontFamily: "'Nunito', sans-serif", outline: "none", boxSizing: "border-box"
                                }}
                              />
                            </div>

                            <div style={{ display: "flex", gap: 8 }}>
                              <div style={{ flex: 1.2 }}>
                                <label style={{ color: "#7c6a9e", fontSize: 9, fontWeight: 700, display: "block", marginBottom: 3 }}>STREET LINE 2 (OPTIONAL)</label>
                                <input
                                  type="text"
                                  value={newStreet2}
                                  onChange={(e) => setNewStreet2(e.target.value)}
                                  placeholder="e.g. Near Kovil"
                                  style={{
                                    width: "100%", padding: "6px 10px", borderRadius: 8, border: "1.5px solid rgba(64,41,112,0.15)", background: "#fff", color: "#1a1025", fontSize: 12, fontFamily: "'Nunito', sans-serif", outline: "none", boxSizing: "border-box"
                                  }}
                                />
                              </div>
                              <div style={{ flex: 0.8 }}>
                                <label style={{ color: "#7c6a9e", fontSize: 9, fontWeight: 700, display: "block", marginBottom: 3 }}>CITY *</label>
                                <input
                                  type="text"
                                  value={newCity}
                                  onChange={(e) => setNewCity(e.target.value)}
                                  placeholder="e.g. Jaffna"
                                  style={{
                                    width: "100%", padding: "6px 10px", borderRadius: 8, border: "1.5px solid rgba(64,41,112,0.15)", background: "#fff", color: "#1a1025", fontSize: 12, fontFamily: "'Nunito', sans-serif", outline: "none", boxSizing: "border-box"
                                  }}
                                />
                              </div>
                            </div>
                          </div>

                          {addressError && (
                            <p style={{ color: "#d4183d", fontSize: 11, margin: "2px 0 0 0", fontWeight: 600 }}>
                              ⚠️ {addressError}
                            </p>
                          )}

                          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                            <button
                              type="button"
                              onClick={() => setIsEnteringCustomDetails(false)}
                              disabled={checkingAddress}
                              style={{
                                padding: "6px 12px", borderRadius: 8, border: "1.5px solid rgba(64,41,112,0.15)", background: "transparent", color: "#7c6a9e", fontSize: 11, fontWeight: 700, cursor: checkingAddress ? "not-allowed" : "pointer"
                              }}
                            >
                              Back
                            </button>
                            <button
                              type="button"
                              onClick={handleVerifyCustomDetails}
                              disabled={checkingAddress}
                              style={{
                                padding: "6px 12px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#7c4dba,#402970)", color: "#fff", fontSize: 11, fontWeight: 700, cursor: checkingAddress ? "not-allowed" : "pointer", boxShadow: "0 4px 10px rgba(64,41,112,0.2)", opacity: checkingAddress ? 0.7 : 1
                              }}
                            >
                              {checkingAddress ? "Verifying..." : "Verify & Confirm"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: "linear-gradient(135deg,#7c4dba,#402970)", display: "flex", alignItems: "center", justifycontent: "center", justifyContent: "center" }}>
                              <MapPin size={20} color="#fff" />
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <p style={{ color: "#7c6a9e", fontSize: 10, fontWeight: 800, margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>Delivery Details</p>
                              <h4 style={{ color: "#1a1025", fontSize: 13, fontWeight: 700, margin: "2px 0 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                Choose shipping location and owner for order
                              </h4>
                            </div>
                          </div>

                          <div style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                            padding: "10px 12px",
                            background: "rgba(64,41,112,0.03)",
                            border: "1px solid rgba(64,41,112,0.07)",
                            borderRadius: 12,
                            fontSize: 11.5,
                            color: "#402970",
                            fontFamily: "'Nunito', sans-serif"
                          }}>
                            <div style={{ display: "flex", gap: 4 }}><span style={{ fontWeight: 700, minWidth: 60, color: "#7c6a9e" }}>Owner:</span><span style={{ color: "#1a1025", fontWeight: 600 }}>{localStorage.getItem("delivery_name") || "Alex Johnson"}</span></div>
                            <div style={{ display: "flex", gap: 4 }}><span style={{ fontWeight: 700, minWidth: 60, color: "#7c6a9e" }}>Phone:</span><span style={{ color: "#1a1025", fontWeight: 600 }}>{localStorage.getItem("delivery_phone") || "+94 77 123 4567"}</span></div>
                            <div style={{ display: "flex", gap: 4 }}><span style={{ fontWeight: 700, minWidth: 60, color: "#7c6a9e" }}>Email:</span><span style={{ color: "#1a1025", fontWeight: 600 }}>{localStorage.getItem("delivery_email") || "alex@example.com"}</span></div>
                            <div style={{ display: "flex", gap: 4 }}><span style={{ fontWeight: 700, minWidth: 60, color: "#7c6a9e" }}>Address:</span><span style={{ color: "#1a1025", fontWeight: 600, wordBreak: "break-all" }}>
                              {[
                                localStorage.getItem("delivery_street1"),
                                localStorage.getItem("delivery_street2"),
                                localStorage.getItem("delivery_city") || "Colombo 03"
                              ].filter(Boolean).join(", ") || "123 Galle Road, Colombo 03, Sri Lanka"}
                            </span></div>
                          </div>

                          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                            <button
                              type="button"
                              onClick={() => {
                                setIsEnteringCustomDetails(true);
                                setCustomName(localStorage.getItem("delivery_name") || "Alex Johnson");
                                setCustomPhone(localStorage.getItem("delivery_phone") || "+94 77 123 4567");
                                setCustomEmail(localStorage.getItem("delivery_email") || "alex@example.com");
                                setNewStreet1(localStorage.getItem("delivery_street1") || "");
                                setNewStreet2(localStorage.getItem("delivery_street2") || "");
                                setNewCity(localStorage.getItem("delivery_city") || "Colombo 03");
                              }}
                              style={{ padding: "6px 12px", borderRadius: 8, border: "1.5px solid rgba(64,41,112,0.15)", background: "transparent", color: "#7c6a9e", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                            >
                              Another Details
                            </button>
                            <button
                              type="button"
                              onClick={handleUseDefaultAddress}
                              style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#7c4dba,#402970)", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 10px rgba(64,41,112,0.2)" }}
                            >
                              Use Default
                            </button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
                <ChatInputBox value={value} onChange={setValue} onSend={handleSend}
                  onKeyDown={handleKeyDown} canSend={canSend}
                  textareaRef={textareaRef} fileInputRef={fileInputRef}
                  isTyping={isTyping} onStop={handleStop} />
                <p className="text-center mt-2 select-none" style={{ color: "#b8aed0", fontSize: 11.5 }}>
                  Enter to send · Shift + Enter for new line
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </div>

      {/* Floating popup panels */}
      <AnimatePresence>
        {activePanel && (
          <PanelPopup id={activePanel} anchor={anchorPos} onClose={() => setActivePanel(null)} />
        )}
      </AnimatePresence>

      {/* Right Drawer */}
      <AnimatePresence>
        {rightPanel && (
          <RightSidebar
            onClose={() => setRightPanel(null)}
            onRemoveCart={id => setCartItems(prev => prev.filter(i => i.product.id !== id))}
            onRemoveWishlist={id => setWishlistItems(prev => prev.filter(i => i.id !== id))}
            onRemoveSaved={id => setSavedItems(prev => prev.filter(i => i.id !== id))}
            onMoveToCart={p => { handleAddToCart(p); setWishlistItems(prev => prev.filter(i => i.id !== p.id)); }}
            onCheckout={() => { setRightPanel(null); setCheckoutOpen(true); }}
          />
        )}
      </AnimatePresence>

      {/* Checkout overlay modal */}
      <AnimatePresence>
        {checkoutOpen && (
          <CheckoutPanel
            cartItems={cartItems}
            onClose={() => setCheckoutOpen(false)}
            onCheckoutComplete={handleCartCheckoutComplete}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}

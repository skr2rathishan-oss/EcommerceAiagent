import React, { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ChevronLeft, MapPin } from "lucide-react";
import { ProductShowcase } from "./components/ProductShowcase";
import { type Product } from "./components/products";
import { CheckoutPanel } from "./components/CheckoutPanel";
import { getDefaultSeller } from "./components/InteractiveOrderSummary";
import { ProductDetailPanel } from "./components/ProductDetailPanel";
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
    selectedDetailProductId, setSelectedDetailProductId,
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
    handleSend
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

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [value]);

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
            <motion.div key="centered" className="flex-1 flex flex-col items-center justify-center px-4"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -24, transition: { duration: 0.3, ease: "easeIn" } }}
            >
              <motion.div className="text-center mb-8 select-none"
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.5 } }}
              >
                <h1 style={{ color: "#1a1025", fontSize: "clamp(22px,4vw,32px)", fontWeight: 700, letterSpacing: "-0.3px", lineHeight: 1.25, marginBottom: 10 }}>
                  How can I help you today?
                </h1>
                <p style={{ color: "#7c6a9e", fontSize: 15, maxWidth: 340, margin: "0 auto", lineHeight: 1.6 }}>
                  Ask me anything — I'm ready to assist you.
                </p>
              </motion.div>
              <motion.div className="w-full" style={{ maxWidth: 620 }}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.1 } }}
              >
                <ChatInputBox value={value} onChange={setValue} onSend={handleSend}
                  onKeyDown={handleKeyDown} canSend={canSend}
                  textareaRef={textareaRef} fileInputRef={fileInputRef} />
                <SuggestedPrompts onSelect={handleSend} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom phase */}
        {phase === "bottom" && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 min-h-0 flex items-stretch gap-0 px-0 pb-0">
              <AnimatePresence mode="popLayout">
                {selectedDetailProductId && (
                  <ProductDetailPanel
                    productId={selectedDetailProductId}
                    onClose={() => setSelectedDetailProductId(null)}
                    onAddToCart={handleAddToCart}
                    onBuyNow={handleBuyNow}
                    onWishlist={handleWishlist}
                  />
                )}
              </AnimatePresence>
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
                    onViewDetails={setSelectedDetailProductId}
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
                      textareaRef={textareaRef} fileInputRef={fileInputRef} />
                    <p className="text-center mt-2 select-none" style={{ color: "#b8aed0", fontSize: 11.5 }}>
                      Enter to send · Shift + Enter for new line
                    </p>
                  </div>
                </motion.div>
              </div>
            </div>
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

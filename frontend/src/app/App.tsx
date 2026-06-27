import React, { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ChevronLeft, ChevronRight, MapPin, Sparkles, ShoppingBag, Gift, Package, Heart, Tag, Percent, Zap, ShoppingCart, Menu, ChevronDown, Bell } from "lucide-react";
import { ProductShowcase } from "./components/ProductShowcase";
import { type Product, PRODUCTS } from "./components/products";
import { getDefaultSeller } from "./components/InteractiveOrderSummary";
import { AppProvider, useApp, type PanelId } from "./contexts/AppContext";
import { ComparisonProvider } from "./contexts/ComparisonContext";
import { useChat } from "./hooks/useChat";
import { useCheckout } from "./hooks/useCheckout";
import { useCart } from "./contexts/CartContext";
import { useWishlist } from "./contexts/WishlistContext";
import { useConcierge } from "./hooks/useConcierge";
import { Sidebar } from "./components/Sidebar";
import { MessageArea } from "./components/MessageArea";
import { ChatInputBox } from "./components/ChatInputBox";
import { VoiceDashboard } from "./components/VoiceDashboard";
import { SuggestedPrompts } from "./components/SuggestedPrompts";
import { PanelPopup } from "./components/PanelPopup";
import { CartScreen } from "./components/CartScreen";
import { WishlistScreen } from "./components/WishlistScreen";
import { SmartInputPanel } from "./components/SmartInputPanel";
import { fetchRecommendations } from "./services/productServices";
import { mapBackendProductToUI, formatUIPrice } from "./services/mapping";
import { useIsMobile } from "./components/ui/use-mobile";

function SpeechBubble({ children, style, tailPosition }: { children: React.ReactNode; style: React.CSSProperties; tailPosition: "bottom-left" | "bottom-right" }) {
  return (
    <motion.div
      animate={{ y: [0, -6, 0] }}
      transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut", delay: Math.random() }}
      className="absolute flex items-center justify-center bg-white rounded-full pointer-events-none z-20"
      style={{
        width: 32,
        height: 32,
        boxShadow: "0 6px 16px rgba(64, 41, 112, 0.12)",
        border: "1px solid rgba(124, 77, 186, 0.15)",
        ...style
      }}
    >
      {children}
      <div
        style={{
          position: "absolute",
          bottom: -4,
          left: tailPosition === "bottom-left" ? 8 : "auto",
          right: tailPosition === "bottom-right" ? 8 : "auto",
          width: 0,
          height: 0,
          borderLeft: "5px solid transparent",
          borderRight: "5px solid transparent",
          borderTop: "5px solid white",
        }}
      />
    </motion.div>
  );
}

const getRatingInfo = (id: string) => {
  const idNum = parseInt(id.replace(/\D/g, "")) || 0;
  const ratings = [4.8, 4.7, 4.9, 4.6, 4.7];
  const reviews = [120, 95, 78, 64, 88];
  const idx = idNum % 5;
  return {
    rating: ratings[idx],
    reviews: reviews[idx]
  };
};

function RecommendationCard({ prod, onClick }: { prod: Product; onClick: () => void }) {
  const isMobile = useIsMobile();
  const [imgErr, setImgErr] = useState(false);
  const { wishlistItems, handleWishlist } = useApp();
  const isWishlisted = wishlistItems.some(item => item.id === prod.id);

  // Simulated discount for visual completeness matching design
  const hasDiscount = (prod.originalPrice && prod.originalPrice > prod.price) || (parseInt(prod.id.replace(/\D/g, "")) % 3 === 0);
  const discountPct = prod.originalPrice && prod.originalPrice > prod.price
    ? Math.round(((prod.originalPrice - prod.price) / prod.originalPrice) * 100)
    : 10;

  const mockRating = getRatingInfo(prod.id);

  return (
    <motion.div
      whileHover={{ y: -3, borderColor: "rgba(124, 77, 186, 0.35)", boxShadow: "0 6px 18px rgba(64, 41, 112, 0.06)" }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-[130px] md:w-[160px] flex-shrink-0 mx-auto"
      style={{
        background: "var(--card-bg, rgba(255, 255, 255, 0.65))",
        backdropFilter: "blur(10px)",
        border: "1.5px solid var(--card-border, rgba(124, 77, 186, 0.15))",
        borderRadius: isMobile ? 8 : 14,
        overflow: "hidden",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        transition: "border-color 0.15s, box-shadow 0.15s",
        userSelect: "none"
      }}
    >
      {/* Product Image */}
      <div style={{ width: "100%", aspectRatio: "1.5/1", background: "linear-gradient(135deg,#f5f0ff,#ede4ff)", overflow: "hidden", position: "relative" }}>
        {hasDiscount && (
          <div style={{
            position: "absolute",
            top: 5,
            left: 5,
            background: "#7c4dba",
            color: "#ffffff",
            fontSize: isMobile ? "6.5px" : "8px",
            fontWeight: 800,
            padding: isMobile ? "1px 3px" : "1.5px 4px",
            borderRadius: 3,
            zIndex: 2,
            fontFamily: "'Nunito', sans-serif",
          }}>
            {discountPct}% OFF
          </div>
        )}
        {!imgErr ? (
          <img
            src={prod.images[0]}
            alt={prod.name}
            onError={() => setImgErr(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Sparkles size={16} color="rgba(124,77,186,0.25)" />
          </div>
        )}
        {isMobile && (
          <motion.button
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.85 }}
            onClick={(e) => {
              e.stopPropagation();
              handleWishlist(prod);
            }}
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              border: "none",
              background: "rgba(255, 255, 255, 0.9)",
              backdropFilter: "blur(4px)",
              boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
              borderRadius: "50%",
              cursor: "pointer",
              width: 18,
              height: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: isWishlisted ? "#ec4899" : "#7c6a9e",
              zIndex: 2,
            }}
          >
            <Heart size={9} fill={isWishlisted ? "#ec4899" : "none"} strokeWidth={2.2} />
          </motion.button>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: isMobile ? "4px 5px 6px" : "8px", display: "flex", flexDirection: "column", gap: isMobile ? 1.5 : 2.5, flex: 1 }}>
        <span style={{ color: "#7c6a9e", fontSize: isMobile ? 7 : 8.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "'Nunito', sans-serif" }}>
          {prod.brand}
        </span>
        <span
          style={{
            color: "var(--text-primary, #1a1025)",
            fontSize: isMobile ? 9 : 11,
            fontWeight: 700,
            fontFamily: "'Nunito', sans-serif",
            lineHeight: 1.15,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 1,
            WebkitBoxOrient: "vertical",
            height: isMobile ? 12 : 14
          }}
        >
          {prod.name}
        </span>

        {/* Rating and Reviews */}
        <div style={{ display: "flex", alignItems: "center", gap: 2, marginTop: 0.5 }}>
          <span style={{ color: "#fbbf24", fontSize: 9, lineHeight: 1 }}>★</span>
          <span style={{ color: "var(--text-secondary, #7c6a9e)", fontSize: isMobile ? 8 : 9.5, fontWeight: 700, fontFamily: "'Nunito', sans-serif" }}>
            {mockRating.rating} {!isMobile && `(${mockRating.reviews})`}
          </span>
        </div>

        {/* Bottom Row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: 1 }}>
          <span style={{ color: "#7c4dba", fontSize: isMobile ? 9.5 : 12, fontWeight: 800, fontFamily: "'Nunito', sans-serif" }}>
            {formatUIPrice(prod.price, prod.currency)}
          </span>

          {!isMobile && (
            <motion.button
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.85 }}
              onClick={(e) => {
                e.stopPropagation();
                handleWishlist(prod);
              }}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: 3,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: isWishlisted ? "#ec4899" : "#7c6a9e",
              }}
            >
              <Heart size={14} fill={isWishlisted ? "#ec4899" : "none"} strokeWidth={2.2} />
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function MainApp() {
  const { removeFromCart } = useCart();
  const {
    phase, setPhase,
    sidebarOpen, setSidebarOpen,
    activePanel, setActivePanel,
    anchorPos, setAnchorPos,
    value, setValue,
    messages, setMessages,
    cartItems,
    wishlistItems,
    savedItems,
    orderedItems,
    activeScreen, setActiveScreen,
    selectedIds, setSelectedIds,
    displayedCounts, setDisplayedCounts,
    activity,
    activityExpanded, setActivityExpanded,
    pendingProductActions, setPendingProductActions,
    checkoutOpen, setCheckoutOpen,
    pendingConfirmProduct,
    pendingConfirmVariants,
    isTyping, setIsTyping,
    shoppingContext,
    setShoppingContext,
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
    resetPendingPurchaseState,
    activeSmartPanel,
    setActiveSmartPanel,
    voiceDashboardOpen,
    setVoiceDashboardOpen,
    activeDetailsProduct,
    setActiveDetailsProduct,
    setLastCheckedDelivery,
    setPendingConfirmProduct,
    setNearbyCitiesSuggested,
    setIsCartCheckout
  } = useApp();



  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (profileOpen && profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [profileOpen]);

  const {
    handleProductSelect,
    handleProductAction,
    handleRetry,
    handleKeyDown,
    handleSend,
    handleStop,
    handleRequestProductDetails,
    getSessionId
  } = useChat();

  const {
    handlePlaceInlineOrder,
    handleCartCheckoutComplete,
    handleVerifyCustomDetails,
    handleUseDefaultAddress
  } = useCheckout();

  const isMobile = useIsMobile();
  const { fetchAddresses, checkDelivery } = useConcierge(getSessionId());

  const startConversationalCheckout = async (cartCheckout: boolean, p?: Product) => {
    setActiveDetailsProduct(null);

    setMessages(prev => [...prev, { role: "user", text: cartCheckout ? "I want to checkout my cart." : `I confirmed the order for ${p?.name}.` }]);
    setIsTyping(true);
    setIsCartCheckout(cartCheckout);

    try {
      const addresses = await fetchAddresses();
      const defaultAddr = addresses.find(a => a.isDefault) || (addresses.length > 0 ? addresses[0] : null);

      const targetProductId = cartCheckout ? "cart" : p?.id || "";
      const confirmProduct: Product = cartCheckout
        ? { id: "cart", name: "Cart Items", price: 0, currency: "Rs.", stock: 1, category: "cart", images: [], description: "", shortDesc: "", brand: "", rating: 0, reviewCount: 0, specs: [], variants: [], delivery: "" }
        : p!;

      if (!defaultAddr) {
        setIsTyping(false);
        setMessages(prev => [...prev, {
          role: "ai",
          text: `To proceed with your order, could you please provide your delivery city and address?`,
        }]);
        setPendingConfirmProduct(confirmProduct);
        setLastCheckedDelivery({ city: "", deliveryDate: new Date().toISOString().split("T")[0], productId: targetProductId });
        return;
      }

      setIsTyping(false);
      setPendingConfirmProduct(confirmProduct);
      setLastCheckedDelivery({ city: defaultAddr.city, deliveryDate: new Date().toISOString().split("T")[0], productId: targetProductId });

      setMessages(prev => [...prev, {
        role: "ai",
        text: `I noticed you have a saved address in **${defaultAddr.city}**. Would you like to use this address or deliver somewhere else?`,
        type: "address_prompt"
      }]);
    } catch (err) {
      setIsTyping(false);
      setMessages(prev => [...prev, { role: "ai", text: `An error occurred while verifying delivery. Please try again.` }]);
    }
  };

  const handleConfirmOrder = (p: Product, variants?: Record<string, string>) => {
    startConversationalCheckout(false, p);
  };

  useEffect(() => {
    if (checkoutOpen) {
      setCheckoutOpen(false);
      startConversationalCheckout(true);
    }
  }, [checkoutOpen]);

  useEffect(() => {
    if (pendingAddressChoice && pendingConfirmProduct) {
      setPendingAddressChoice(false);
      startConversationalCheckout(false, pendingConfirmProduct);
    }
  }, [pendingAddressChoice, pendingConfirmProduct]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [loadingRecs, setLoadingRecs] = useState<boolean>(true);
  const [showBuyConfirm, setShowBuyConfirm] = useState<boolean>(false);

  useEffect(() => {
    setShowBuyConfirm(false);
  }, [activeDetailsProduct]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const [savedDelivery] = useState(() => ({
    name: localStorage.getItem("delivery_name") || "Alex Johnson",
    phone: localStorage.getItem("delivery_phone") || "+94 77 123 4567",
    email: localStorage.getItem("delivery_email") || "alex@example.com",
    street1: localStorage.getItem("delivery_street1") || "",
    street2: localStorage.getItem("delivery_street2") || "",
    city: localStorage.getItem("delivery_city") || "Colombo 03",
  }));

  const checkScrollLimits = () => {
    const el = scrollContainerRef.current;
    if (el) {
      setCanScrollLeft(el.scrollLeft > 10);
      setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
    }
  };

  useEffect(() => {
    if (!loadingRecs) {
      const timer = setTimeout(checkScrollLimits, 150);
      return () => clearTimeout(timer);
    }
  }, [loadingRecs, recommendations]);

  useEffect(() => {
    window.addEventListener("resize", checkScrollLimits);
    return () => window.removeEventListener("resize", checkScrollLimits);
  }, []);

  const handleScrollEvent = () => {
    checkScrollLimits();
  };

  const scrollLeft = () => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollBy({ left: -360, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollBy({ left: 360, behavior: "smooth" });
    }
  };

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



  const handleItemClick = (label: string, rect: DOMRect) => {
    if (label === "New Chat") {
      setPhase("centered");
      setMessages([]);
      setValue("");
      setActiveScreen("chat");
      return;
    }
    if (label === "Recent Conversations") {
      setActiveScreen("chat");
    }
    if (label === "Cart") {
      setActiveScreen("cart");
      return;
    }
    if (label === "Wishlist") {
      setActiveScreen("wishlist");
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

    if (type === "find_gift" || type === "find_products") {
      setActiveSmartPanel("recommendation");
    } else if (type === "track_order") {
      setActiveSmartPanel("track_order");
    }
  };

  const canSend = value.trim().length > 0;

  // Find the last AI message with products
  const lastAiMsgIndex = [...messages].reverse().findIndex(msg => msg.role === "ai" && msg.products && msg.products.length > 0);
  const lastAiMsgOrigIndex = lastAiMsgIndex !== -1 ? messages.length - 1 - lastAiMsgIndex : -1;
  const lastAiMsg = lastAiMsgOrigIndex !== -1 ? messages[lastAiMsgOrigIndex] : null;

  const showLoadMoreQuickAction = (() => {
    if (!lastAiMsg || phase !== "bottom") return false;
    const total = lastAiMsg.products?.length || 0;
    const currentCount = displayedCounts[lastAiMsgOrigIndex] ?? (total >= 10 ? 10 : total);
    const showCount = Math.min(currentCount, 15);
    return showCount < total;
  })();

  return (
    <div className="h-screen w-screen flex overflow-hidden" style={{ background: "var(--app-bg, #f0ebfa)", fontFamily: "'Nunito',sans-serif" }}>
      {/* Sidebar */}
      <Sidebar onItemClick={handleItemClick} />

      {/* Main */}
      <div className="flex-1 flex flex-col relative overflow-hidden min-h-0">
        {/* Floating Header Bar */}
        <div
          className="absolute top-6 left-0 right-0 z-30 w-full select-none"
          style={{ height: 48 }}
        >
          <div className="w-full px-4 md:px-8 flex items-center justify-between">
            {/* Left Side: Hamburger trigger + Logo */}
            <div className="flex items-center gap-3">


              <div
                onClick={() => {
                  setPhase("centered");
                  setMessages([]);
                  setValue("");
                  setActiveScreen("chat");
                }}
                className="flex items-center gap-2.5 cursor-pointer group"
                title="Go to Home"
              >
                <img
                  src="/logo.png"
                  alt="Velora"
                  className="object-contain group-hover:scale-102 transition-transform duration-200"
                  style={{
                    height: 32,
                    flexShrink: 0,
                  }}
                />
              </div>
            </div>

            {/* Right Side: Notification Bell + Profile Button */}
            <AnimatePresence>
              {phase === "centered" && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-6"
                >
                  {/* Notification Bell */}
                  <button
                    type="button"
                    className="relative flex items-center justify-center text-[#7c4dba] hover:bg-[rgba(124,77,186,0.06)] transition-all"
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 12,
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                    }}
                  >
                    <Bell size={20} strokeWidth={2} />
                    <span
                      style={{
                        position: "absolute",
                        top: 9,
                        right: 9,
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "#ec4899",
                      }}
                    />
                  </button>

                  {/* Profile Dropdown Button */}
                  <div ref={profileRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setProfileOpen(o => !o)}
                      className="flex items-center gap-2.5"
                      style={{
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      {/* Avatar */}
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: "50%",
                          background: "linear-gradient(135deg, #a855f7, #7c3aed)",
                          color: "#ffffff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: 15,
                          fontFamily: "'Nunito', sans-serif",
                          flexShrink: 0,
                          boxShadow: "0 2px 8px rgba(124, 77, 186, 0.22)",
                        }}
                      >
                        V
                      </div>
                      {/* User Info Text */}
                      <div className="hidden sm:flex flex-col text-left justify-center">
                        <span style={{ fontSize: 9.5, fontWeight: 600, color: "#9e8dc0", lineHeight: 1.1 }}>Welcome back,</span>
                        <span style={{ fontSize: 12, fontWeight: 800, color: "#1a1025", fontFamily: "'Nunito', sans-serif", display: "flex", alignItems: "center", gap: 3 }}>
                          Velora User <ChevronDown size={12} strokeWidth={2.5} color="#9e8dc0" />
                        </span>
                      </div>
                    </button>

                    <AnimatePresence>
                      {profileOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -6, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -6, scale: 0.96 }}
                          transition={{ duration: 0.15, ease: "easeOut" }}
                          style={{
                            position: "absolute",
                            top: "calc(100% + 6px)",
                            right: 0,
                            width: 210,
                            background: "rgba(255, 255, 255, 0.98)",
                            backdropFilter: "blur(20px)",
                            borderRadius: 14,
                            border: "1px solid rgba(124, 77, 186, 0.18)",
                            boxShadow: "0 10px 30px rgba(64, 41, 112, 0.12)",
                            zIndex: 100,
                            padding: "10px 12px",
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid rgba(64, 41, 112, 0.08)", paddingBottom: 8 }}>
                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#f0ebfa", color: "#7c4dba", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13 }}>
                              V
                            </div>
                            <div style={{ minWidth: 0, textAlign: "left" }}>
                              <h5 style={{ color: "#1a1025", fontSize: 12.5, fontWeight: 800, margin: 0, fontFamily: "'Nunito', sans-serif" }}>Velora User</h5>
                              <p style={{ color: "#7c6a9e", fontSize: 10, margin: 0, overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Nunito', sans-serif" }}>user@velora.ai</p>
                            </div>
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: 4, textAlign: "left" }}>
                            <button
                              onClick={(e) => {
                                setProfileOpen(false);
                                const rect = e.currentTarget.getBoundingClientRect();
                                setAnchorPos({ x: rect.left - 10, y: rect.bottom + 10 });
                                setActivePanel("Profile");
                              }}
                              className="px-2 py-1.5 rounded-lg text-left hover:bg-[#f5f3fa] transition-colors"
                              style={{ border: "none", background: "transparent", fontSize: 12, fontWeight: 700, color: "#402970", cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}
                            >
                              My Account
                            </button>
                            <button
                              onClick={() => {
                                setProfileOpen(false);
                              }}
                              className="px-2 py-1.5 rounded-lg text-left hover:bg-[#f5f3fa] transition-colors"
                              style={{ border: "none", background: "transparent", fontSize: 12, fontWeight: 700, color: "#402970", cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}
                            >
                              Purchase History
                            </button>
                            <button
                              onClick={() => {
                                setProfileOpen(false);
                              }}
                              className="px-2 py-1.5 rounded-lg text-left hover:bg-[#fff0f3] transition-colors"
                              style={{ border: "none", background: "transparent", fontSize: 12, fontWeight: 700, color: "#d4183d", cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}
                            >
                              Sign Out
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {activeScreen === "cart" ? (
          <CartScreen
            onContinueShopping={() => setActiveScreen("chat")}
            onCheckout={() => {
              setActiveScreen("chat");
              setPhase("bottom");
              setCheckoutOpen(true);
            }}
          />
        ) : activeScreen === "wishlist" ? (
          <WishlistScreen
            onContinueShopping={() => setActiveScreen("chat")}
          />
        ) : (
          <>
            {/* Centered phase */}
            <AnimatePresence>
              {phase === "centered" && (
                <motion.div
                  key="centered"
                  className="flex-1 w-full overflow-y-auto flex flex-col items-center justify-start px-4 pt-4 pb-16 custom-scrollbar no-scrollbar"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, y: -24, transition: { duration: 0.3, ease: "easeIn" } }}
                  style={{
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                    paddingTop: 84,
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

                  {/* Hero Banner Card */}
                  <motion.div
                    className="hero-banner relative w-full max-w-7xl rounded-3xl border p-6 py-20 md:py-24 md:px-16 mb-4 flex flex-col items-center justify-center overflow-hidden min-h-[380px]"
                    style={{
                      borderColor: "var(--banner-border)",
                      boxShadow: "0 20px 40px rgba(64, 41, 112, 0.08)",
                    }}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0, transition: { duration: 0.5 } }}
                  >
                    {/* Content Wrapper */}
                    <div className="relative z-10 w-full max-w-2xl flex flex-col items-center">
                      <h1 className="text-center font-extrabold tracking-tight mb-2 flex flex-col items-center justify-center gap-1"
                        style={{ color: "var(--text-primary)", fontSize: "clamp(26px, 4.5vw, 38px)", fontWeight: 800, lineHeight: 1.2 }}>
                        <span>Discover Smart Shopping</span>
                        <span className="inline-flex items-center gap-1.5 text-[#7c4dba] dark:text-[#bda6ff]">
                          with Velora <Sparkles size={22} className="text-[#a855f7]" fill="#a855f7" />
                        </span>
                      </h1>

                      <p className="text-center mb-6" style={{ color: "var(--text-secondary)", fontSize: "14px", maxWidth: "560px", lineHeight: 1.5 }}>
                        Your <strong style={{ color: "var(--text-primary)", fontWeight: 700 }}>intelligent</strong> shopping assistant. Ask questions, <strong style={{ color: "var(--text-primary)", fontWeight: 700 }}>compare products</strong>, <strong style={{ color: "var(--text-primary)", fontWeight: 700 }}>find the best gifts</strong> and <strong style={{ color: "var(--text-primary)", fontWeight: 700 }}>track your orders</strong> — all in one place.
                      </p>

                      <div className="w-full">
                        <ChatInputBox value={value} onChange={setValue} onSend={handleSend}
                          onKeyDown={handleKeyDown} canSend={canSend}
                          textareaRef={textareaRef} fileInputRef={fileInputRef}
                          isTyping={isTyping} onStop={handleStop} variant="centered" onOpenVoiceChat={() => setVoiceDashboardOpen(true)} />
                      </div>

                      {/* Quick Actions (Pill Buttons) */}
                      <div className="w-full mt-5 flex flex-nowrap overflow-x-auto no-scrollbar gap-2.5 justify-center select-none pb-1"
                        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
                        {[
                          { title: "Find Products", mobileTitle: "Products", icon: ShoppingBag, color: "#7c4dba", fill: "#efeaff", type: "find_products" as const },
                          { title: "Find Gift", mobileTitle: "Gift", icon: Gift, color: "#ec4899", fill: "#fce7f3", type: "find_gift" as const },
                          { title: "Track My Order", mobileTitle: "Track", icon: Package, color: "#f97316", fill: "#ffedd5", type: "track_order" as const }
                        ].map((act, idx) => {
                          const Icon = act.icon;
                          return (
                            <motion.button
                              key={idx}
                              whileHover={{
                                y: -1.5,
                                backgroundColor: "var(--card-hover-bg, rgba(255, 255, 255, 0.95))",
                                borderColor: "var(--card-hover-border, rgba(124, 77, 186, 0.35))",
                                boxShadow: "0 4px 10px rgba(64, 41, 112, 0.05)"
                              }}
                              whileTap={{ scale: 0.97 }}
                              onClick={() => handleStartWorkflow(act.type)}
                              className="cursor-pointer border transition-all duration-150 inline-flex items-center gap-1.5"
                              style={{
                                padding: "8px 16px",
                                background: "var(--card-bg, rgba(255, 255, 255, 0.65))",
                                backdropFilter: "blur(8px)",
                                borderColor: "var(--card-border, rgba(64, 41, 112, 0.12))",
                                borderRadius: 9999,
                                color: "var(--text-primary, #1a1025)",
                                fontSize: 12.5,
                                fontWeight: 700,
                                fontFamily: "'Nunito', sans-serif"
                              }}
                            >
                              <Icon size={14} color={act.color} fill={act.fill} strokeWidth={2.5} />
                              <span className="hidden md:inline">{act.title}</span>
                              <span className="inline md:hidden">{act.mobileTitle}</span>
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>

                  {/* Product Recommendations Section */}
                  <div className="w-full max-w-7xl select-none" style={{ marginTop: 0 }}>
                    {/* Section Header */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, padding: "0 4px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Sparkles size={16} color="#7c4dba" fill="#7c4dba" />
                        <span style={{ fontSize: "16px", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.01em", fontFamily: "'Nunito', sans-serif" }}>
                          Top Recommendations
                        </span>
                      </div>
                      <button
                        type="button"
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "#7c4dba",
                          fontSize: "13px",
                          fontWeight: 800,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 2,
                          fontFamily: "'Nunito', sans-serif",
                        }}
                      >
                        View all <ChevronRight size={14} strokeWidth={2.5} />
                      </button>
                    </div>

                    {/* Recommendations Carousel Row with Arrow Buttons */}
                    <div className="relative w-full group">
                      {/* Left Scroll Button */}
                      <AnimatePresence>
                        {canScrollLeft && (
                          <motion.button
                            key="left-scroll-btn"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            type="button"
                            onClick={scrollLeft}
                            className="absolute left-[-20px] top-1/2 -translate-y-1/2 z-20 flex items-center justify-center cursor-pointer"
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 9999,
                              background: "var(--card-bg, #ffffff)",
                              border: "1.5px solid var(--card-border, rgba(124, 77, 186, 0.15))",
                              boxShadow: "0 6px 20px rgba(64, 41, 112, 0.12)",
                              color: "#7c4dba",
                            }}
                          >
                            <ChevronLeft size={20} strokeWidth={2.5} />
                          </motion.button>
                        )}
                      </AnimatePresence>

                      {/* Right Scroll Button */}
                      <AnimatePresence>
                        {canScrollRight && (
                          <motion.button
                            key="right-scroll-btn"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            type="button"
                            onClick={scrollRight}
                            className="absolute right-[-20px] top-1/2 -translate-y-1/2 z-20 flex items-center justify-center cursor-pointer"
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 9999,
                              background: "var(--card-bg, #ffffff)",
                              border: "1.5px solid var(--card-border, rgba(124, 77, 186, 0.15))",
                              boxShadow: "0 6px 20px rgba(64, 41, 112, 0.12)",
                              color: "#7c4dba",
                            }}
                          >
                            <ChevronRight size={20} strokeWidth={2.5} />
                          </motion.button>
                        )}
                      </AnimatePresence>

                      {/* Card Row or Grid */}
                      <div
                        ref={scrollContainerRef}
                        onScroll={handleScrollEvent}
                        className="no-scrollbar flex overflow-x-auto gap-3 md:gap-5"
                        style={{
                          padding: "8px 4px 16px",
                          scrollbarWidth: "none",
                          msOverflowStyle: "none",
                          WebkitOverflowScrolling: "touch",
                        }}
                      >
                        {loadingRecs ? (
                          Array.from({ length: 5 }).map((_, i) => (
                            <div
                              key={i}
                              className="w-[130px] md:w-[160px] flex-shrink-0 h-[115px] md:h-[202px] mx-auto"
                              style={{
                                borderRadius: 14,
                                background: "var(--card-bg, rgba(255, 255, 255, 0.4))",
                                border: "1.5px solid var(--card-border, rgba(124, 77, 186, 0.08))",
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
                          <div style={{ width: "100%", padding: "40px 0", textAlign: "center", color: "var(--text-secondary, #7c6a9e)", fontSize: 13, fontWeight: 600 }}>
                            No recommendations available at the moment.
                          </div>
                        ) : (
                          recommendations.map((prod) => (
                            <RecommendationCard
                              key={prod.id}
                              prod={prod}
                              onClick={() => {
                                handleRequestProductDetails(prod.id, prod.name);
                              }}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bottom phase */}
            {phase === "bottom" && (
              <div className="flex-1 min-w-0 min-h-0 px-4 pb-6 md:pb-3 pt-0 flex flex-col overflow-hidden">
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                  <MessageArea
                    messages={messages}
                    selectedIds={selectedIds}
                    setSelectedIds={setSelectedIds}
                    onAddToCart={handleAddToCart}
                    onBuyNow={handleConfirmOrder}
                    onWishlist={handleWishlist}
                    onPlaceInlineOrder={handlePlaceInlineOrder}
                    isTyping={isTyping}
                    onViewDetails={(id) => {
                      const found = recommendations.find(p => p.id === id) || PRODUCTS.find(p => p.id === id) || shoppingContext.lastSearchResults.find(p => p.id === id);
                      setSelectedIds({});
                      setShoppingContext(prev => ({ ...prev, selectedProduct: null }));
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
                      {/* ── Smart Contextual Input Panels ─────────────────────────────────── */}
                      {activeSmartPanel && (
                        <SmartInputPanel key="smart-input-panel" />
                      )}

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



                      {activeDetailsProduct && !pendingConfirmProduct && (
                        <motion.div
                          id="details-actions-popup"
                          key="details-actions-popup"
                          initial={{ opacity: 0, height: 0, y: 10 }}
                          animate={{ opacity: 1, height: "auto", y: 0 }}
                          exit={{ opacity: 0, height: 0, y: 10 }}
                          transition={{ duration: 0.25, ease: "easeOut" }}
                          style={{
                            background: "rgba(255, 255, 255, 0.98)",
                            backdropFilter: "blur(16px)",
                            border: "1.5px solid rgba(124, 77, 186, 0.25)",
                            borderRadius: 16,
                            padding: "10px 14px",
                            marginBottom: 10,
                            boxShadow: "0 8px 24px rgba(64, 41, 112, 0.16)",
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            width: "100%",
                          }}
                        >
                          {/* Product Mini Info */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                            <div style={{
                              width: 38,
                              height: 38,
                              borderRadius: 8,
                              overflow: "hidden",
                              background: "#fff",
                              border: "1px solid rgba(64,41,112,0.08)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0
                            }}>
                              {activeDetailsProduct.images?.[0] ? (
                                <img src={activeDetailsProduct.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              ) : (
                                <Package size={18} color="#7c4dba" />
                              )}
                            </div>
                            <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
                              <h4 style={{ color: "#1a1025", fontSize: 12.5, fontWeight: 800, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "'Nunito', sans-serif" }}>
                                {activeDetailsProduct.name}
                              </h4>
                              <span style={{ color: "#7c4dba", fontSize: 11, fontWeight: 700, fontFamily: "'Nunito', sans-serif" }}>
                                {formatUIPrice(activeDetailsProduct.price || 0, activeDetailsProduct.currency)}
                              </span>
                            </div>
                          </div>

                          {/* CTA Buttons in Popup */}
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {showBuyConfirm ? (
                              <>
                                <motion.button
                                  type="button"
                                  whileTap={{ scale: 0.96 }}
                                  onClick={() => {
                                    setShowBuyConfirm(false);
                                    handleConfirmOrder(activeDetailsProduct);
                                  }}
                                  style={{
                                    display: "flex", alignItems: "center", gap: 4,
                                    padding: "6px 14px", borderRadius: 8, border: "none",
                                    background: "linear-gradient(135deg, #10b981, #059669)",
                                    color: "#fff",
                                    fontSize: 11, fontWeight: 700, cursor: "pointer",
                                    fontFamily: "'Nunito', sans-serif",
                                    boxShadow: "0 2px 6px rgba(16,185,129,0.2)",
                                  }}
                                  title="Confirm Order"
                                >
                                  Confirm
                                </motion.button>

                                <motion.button
                                  type="button"
                                  whileTap={{ scale: 0.96 }}
                                  onClick={() => setShowBuyConfirm(false)}
                                  style={{
                                    display: "flex", alignItems: "center", gap: 4,
                                    padding: "6px 14px", borderRadius: 8,
                                    border: "1.5px solid rgba(64,41,112,0.2)",
                                    background: "transparent",
                                    color: "#402970",
                                    fontSize: 11, fontWeight: 700, cursor: "pointer",
                                    fontFamily: "'Nunito', sans-serif",
                                  }}
                                  title="Cancel"
                                >
                                  Cancel
                                </motion.button>
                              </>
                            ) : (
                              <>
                                <motion.button
                                  type="button"
                                  whileTap={activeDetailsProduct.stock > 0 ? { scale: 0.96 } : {}}
                                  onClick={() => { if (activeDetailsProduct.stock > 0) setShowBuyConfirm(true); }}
                                  disabled={activeDetailsProduct.stock === 0}
                                  style={{
                                    display: "flex", alignItems: "center", justifySelf: "center", gap: isMobile ? 0 : 4,
                                    padding: isMobile ? "6px 8px" : "6px 12px", borderRadius: 8, border: "none",
                                    background: activeDetailsProduct.stock > 0
                                      ? "linear-gradient(135deg,#7c4dba,#402970)"
                                      : "rgba(64,41,112,0.12)",
                                    color: activeDetailsProduct.stock > 0 ? "#fff" : "#b8aed0",
                                    fontSize: 11, fontWeight: 700, cursor: activeDetailsProduct.stock > 0 ? "pointer" : "not-allowed",
                                    fontFamily: "'Nunito', sans-serif",
                                    boxShadow: activeDetailsProduct.stock > 0 ? "0 2px 6px rgba(124,77,186,0.15)" : "none",
                                  }}
                                  title="Buy Now"
                                >
                                  <Zap size={11} strokeWidth={2.5} />
                                  {!isMobile && "Buy Now"}
                                </motion.button>

                                <motion.button
                                  type="button"
                                  whileTap={activeDetailsProduct.stock > 0 ? { scale: 0.96 } : {}}
                                  onClick={() => { if (activeDetailsProduct.stock > 0) handleAddToCart(activeDetailsProduct); }}
                                  disabled={activeDetailsProduct.stock === 0}
                                  style={{
                                    display: "flex", alignItems: "center", justifySelf: "center", gap: isMobile ? 0 : 4,
                                    padding: isMobile ? "6px 8px" : "6px 12px", borderRadius: 8,
                                    border: `1.5px solid ${activeDetailsProduct.stock > 0 ? "rgba(64,41,112,0.2)" : "rgba(64,41,112,0.08)"}`,
                                    background: "transparent",
                                    color: activeDetailsProduct.stock > 0 ? "#402970" : "#b8aed0",
                                    fontSize: 11, fontWeight: 700, cursor: activeDetailsProduct.stock > 0 ? "pointer" : "not-allowed",
                                    fontFamily: "'Nunito', sans-serif",
                                  }}
                                  title="Add to Cart"
                                >
                                  <ShoppingCart size={11} strokeWidth={2.5} />
                                  {!isMobile && "Add Cart"}
                                </motion.button>

                                <motion.button
                                  type="button"
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => handleWishlist(activeDetailsProduct)}
                                  style={{
                                    width: 28, height: 28, borderRadius: 8, border: "1.5px solid rgba(64,41,112,0.12)",
                                    background: "transparent", cursor: "pointer",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                  }}
                                  title="Add to Wishlist"
                                >
                                  <Heart size={12} strokeWidth={2} color="#9e8dc0" />
                                </motion.button>
                              </>
                            )}

                            <div style={{ width: "1px", height: 20, background: "rgba(64,41,112,0.12)", margin: "0 2px" }} />

                            <button
                              type="button"
                              onClick={() => {
                                if (activeDetailsProduct) {
                                  setMessages(prev => prev.map(m =>
                                    m.type === "product_details" && m.productDetails?.product.id === activeDetailsProduct.id
                                      ? { ...m, isDetailsClosed: true }
                                      : m
                                  ));
                                }
                                setActiveDetailsProduct(null);
                              }}
                              style={{
                                width: 24, height: 24, borderRadius: 6, border: "none", cursor: "pointer",
                                background: "rgba(64,41,112,0.06)", color: "#7c4dba",
                                display: "flex", alignItems: "center", justifyContent: "center",
                              }}
                              title="Dismiss actions"
                            >
                              <X size={12} strokeWidth={2.5} />
                            </button>
                          </div>
                        </motion.div>
                      )}

                    </AnimatePresence>
                    <ChatInputBox value={value} onChange={setValue} onSend={handleSend}
                      onKeyDown={handleKeyDown} canSend={canSend}
                      textareaRef={textareaRef} fileInputRef={fileInputRef}
                      isTyping={isTyping} onStop={handleStop} onOpenVoiceChat={() => setVoiceDashboardOpen(true)} />
                    <p className="text-center mt-2 select-none" style={{ color: "#b8aed0", fontSize: 11.5 }}>
                      Enter to send · Shift + Enter for new line
                    </p>
                  </div>
                </motion.div>
              </div>
            )}
          </>
        )}

        {/* Voice Dashboard Overlay (Inside main content area) */}
        <VoiceDashboard
          isOpen={voiceDashboardOpen}
          onClose={() => setVoiceDashboardOpen(false)}
          messages={messages}
          onSendMessage={(text) => handleSend(text)}
          onAddToCart={handleAddToCart}
          onBuyNow={handleConfirmOrder}
          onWishlist={handleWishlist}
          onViewDetails={(id) => {
            const found = recommendations.find(p => p.id === id) || PRODUCTS.find(p => p.id === id) || shoppingContext.lastSearchResults.find(p => p.id === id);
            setSelectedIds({});
            setShoppingContext(prev => ({ ...prev, selectedProduct: null }));
            handleRequestProductDetails(id, found?.name);
          }}
        />
      </div>

      {/* Floating popup panels */}
      <AnimatePresence>
        {activePanel && (
          <PanelPopup id={activePanel} anchor={anchorPos} onClose={() => setActivePanel(null)} />
        )}
      </AnimatePresence>



      {/* Checkout overlay modal removed to favor conversational checkout */}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <ComparisonProvider>
        <MainApp />
      </ComparisonProvider>
    </AppProvider>
  );
}

// ── SVG Illustrations for Hero Banner ────────────────────────────────────────

function ShoppingBagsIllustration() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 240 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="bagsShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="rgba(64, 41, 112, 0.15)" />
        </filter>
        <linearGradient id="purpleBagGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b292f7" />
          <stop offset="100%" stopColor="#7c4dba" />
        </linearGradient>
        <linearGradient id="whiteBagGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f3effe" />
        </linearGradient>
        <linearGradient id="potGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#eae6f5" />
          <stop offset="100%" stopColor="#d1c9e8" />
        </linearGradient>
        <linearGradient id="leafGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a3e635" />
          <stop offset="100%" stopColor="#15803d" />
        </linearGradient>
      </defs>

      <ellipse cx="110" cy="162" rx="90" ry="7" fill="rgba(64, 41, 112, 0.08)" />

      <g filter="url(#bagsShadow)">
        <path d="M110 88 C110 70, 130 70, 130 88" fill="none" stroke="#d5cdf3" strokeWidth="4.5" strokeLinecap="round" />
        <path d="M92 88 L87 154 C87 158 90 160 94 160 L146 160 C150 160 153 158 153 154 L148 88 Z" fill="url(#whiteBagGrad)" />
        <path d="M120 88 L120 160" stroke="rgba(64, 41, 112, 0.03)" strokeWidth="2" />
      </g>

      <g filter="url(#bagsShadow)">
        <path d="M50 72 C50 50, 75 50, 75 72" fill="none" stroke="#dcd0ff" strokeWidth="5.5" strokeLinecap="round" />
        <path d="M30 72 L24 152 C24 157 28 160 32 160 L92 160 C96 160 100 157 100 152 L94 72 Z" fill="url(#purpleBagGrad)" />
        <path d="M65 72 L65 160" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="2.5" />
      </g>

      <g filter="url(#bagsShadow)">
        <path d="M165 130 Q150 110 135 112 C132 112, 132 125, 142 126 Z" fill="url(#leafGrad)" />
        <path d="M175 130 Q190 105 198 112 C202 116, 192 128, 182 128 Z" fill="url(#leafGrad)" />
        <path d="M170 130 Q170 95 160 90 C155 88, 155 108, 162 118 Z" fill="url(#leafGrad)" />
        <path d="M170 130 Q182 100 178 95 C174 91, 168 112, 172 122 Z" fill="url(#leafGrad)" />
        <path d="M170 130 Q155 118 152 110 C149 105, 155 122, 164 125 Z" fill="url(#leafGrad)" />
        <path d="M152 130 L155 158 C155 160 157 162 159 162 L181 162 C183 162 185 160 185 158 L188 130 Z" fill="url(#potGrad)" />
        <ellipse cx="170" cy="130" rx="19" ry="4" fill="#cfc7ea" />
      </g>
    </svg>
  );
}

function ShoppingCartIllustration() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 240 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="cartShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="10" stdDeviation="8" floodColor="rgba(124, 77, 186, 0.22)" />
        </filter>
        <linearGradient id="cartWireGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#dcd0ff" />
          <stop offset="50%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#7c4dba" />
        </linearGradient>
      </defs>

      <ellipse cx="120" cy="158" rx="85" ry="7" fill="rgba(64, 41, 112, 0.08)" />

      <g filter="url(#cartShadow)">
        <circle cx="85" cy="148" r="11" fill="#7c4dba" />
        <circle cx="85" cy="148" r="5" fill="#ffffff" />
        <path d="M85 137 L85 128" stroke="#7c4dba" strokeWidth="4.5" strokeLinecap="round" />

        <circle cx="155" cy="148" r="11" fill="#7c4dba" />
        <circle cx="155" cy="148" r="5" fill="#ffffff" />
        <path d="M155 137 L155 128" stroke="#7c4dba" strokeWidth="4.5" strokeLinecap="round" />

        <path d="M75 128 L165 128 C170 128, 172 125, 172 120" fill="none" stroke="url(#cartWireGrad)" strokeWidth="6" strokeLinecap="round" />
        <path d="M75 128 L60 85" fill="none" stroke="url(#cartWireGrad)" strokeWidth="6" strokeLinecap="round" />

        <path d="M80 82 L185 82 C192 82 195 85 192 90 L175 130 C173 133 170 135 166 135 L90 135 C85 135 82 132 80 126 L65 82 Z" fill="none" stroke="url(#cartWireGrad)" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />

        <path d="M72 95 L186 95" stroke="#bda6ff" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M78 110 L180 110" stroke="#bda6ff" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M84 122 L172 122" stroke="#bda6ff" strokeWidth="3.5" strokeLinecap="round" />

        <path d="M96 82 L98 135" stroke="#bda6ff" strokeWidth="3" />
        <path d="M120 82 L120 135" stroke="#bda6ff" strokeWidth="3" />
        <path d="M144 82 L142 135" stroke="#bda6ff" strokeWidth="3" />
        <path d="M168 82 L164 135" stroke="#bda6ff" strokeWidth="3" />

        <path d="M65 82 L55 82 C50 82 46 86 46 91 L48 102" fill="none" stroke="#7c4dba" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

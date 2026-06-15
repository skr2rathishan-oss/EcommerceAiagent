import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Gift, Truck, Package, CreditCard, ArrowRight, Calendar, MapPin, User, Phone, MessageSquare, AlertCircle } from "lucide-react";
import { useApp } from "../contexts/AppContext";
import { useCart } from "../contexts/CartContext";
import { sendIntentMessage } from "../services/chatServices";
import { checkDelivery } from "../services/productServices";
import { mapBackendProductToUI } from "../services/mapping";
import { type DeliveryInfo, getDefaultSeller } from "./InteractiveOrderSummary";

const logPanelEvent = (panel: "recommendation" | "delivery" | "track_order" | "checkout", event: "opened" | "submitted") => {
  const label = event === "opened" ? "Opened" : "Submitted";
  console.log(`[PANEL] ${panel.charAt(0).toUpperCase() + panel.slice(1)} Panel ${label}`);
  
  try {
    const key = "velora_panel_analytics";
    const raw = localStorage.getItem(key);
    const data = raw ? JSON.parse(raw) : {
      recommendation: { opened: 0, completed: 0 },
      delivery: { opened: 0, completed: 0 },
      track_order: { opened: 0, completed: 0 },
      checkout: { opened: 0, completed: 0 }
    };
    
    if (data[panel]) {
      if (event === "opened") {
        data[panel].opened += 1;
      } else {
        data[panel].completed += 1;
      }
      localStorage.setItem(key, JSON.stringify(data));
    }
  } catch (err) {
    console.error("Failed to write panel analytics:", err);
  }
};

export const SmartInputPanel: React.FC = () => {
  const {
    activeSmartPanel,
    setActiveSmartPanel,
    setMessages,
    setIsTyping,
    setActivity,
    saveOrderToHistory,
    pendingConfirmProduct,
    pendingConfirmVariants,
  } = useApp();

  const { cartItems, clearCart } = useCart();

  useEffect(() => {
    if (activeSmartPanel) {
      logPanelEvent(activeSmartPanel, "opened");
    }
  }, [activeSmartPanel]);

  if (!activeSmartPanel) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0, y: 20 }}
      animate={{ opacity: 1, height: "auto", y: 0 }}
      exit={{ opacity: 0, height: 0, y: 20 }}
      transition={{ type: "spring", stiffness: 350, damping: 28 }}
      style={{
        background: "var(--card-bg, rgba(255, 255, 255, 0.96))",
        backdropFilter: "blur(16px)",
        border: "1.5px solid var(--card-border, rgba(124, 77, 186, 0.22))",
        borderRadius: 20,
        padding: "16px 20px",
        marginBottom: 12,
        boxShadow: "0 10px 30px rgba(64, 41, 112, 0.16)",
        overflow: "hidden",
        width: "100%",
        boxSizing: "border-box",
      }}
      className="smart-input-panel"
    >
      <div className="flex items-center justify-between mb-4 pb-2" style={{ borderBottom: "1px solid rgba(64, 41, 112, 0.08)" }}>
        <h3 style={{ color: "var(--text-primary, #1a1025)", fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
          {activeSmartPanel === "recommendation" && <><Gift size={18} className="text-purple-600" /> 🎁 Find The Perfect Gift</>}
          {activeSmartPanel === "delivery" && <><Truck size={18} className="text-purple-600" /> 🚚 Delivery Information</>}
          {activeSmartPanel === "track_order" && <><Package size={18} className="text-purple-600" /> 📦 Track Order</>}
          {activeSmartPanel === "checkout" && <><CreditCard size={18} className="text-purple-600" /> 💳 Checkout Confirmation</>}
        </h3>
        <button
          onClick={() => setActiveSmartPanel(null)}
          style={{
            background: "rgba(64, 41, 112, 0.08)",
            border: "none",
            borderRadius: 8,
            width: 28,
            height: 28,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-secondary, #7c6a9e)",
            transition: "background 0.2s"
          }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(64, 41, 112, 0.15)"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(64, 41, 112, 0.08)"}
        >
          <X size={14} strokeWidth={2.5} />
        </button>
      </div>

      <div style={{ maxHeight: 320, overflowY: "auto", paddingRight: 4 }} className="custom-scrollbar">
        {activeSmartPanel === "recommendation" && <RecommendationForm />}
        {activeSmartPanel === "delivery" && <DeliveryForm />}
        {activeSmartPanel === "track_order" && <TrackOrderForm />}
        {activeSmartPanel === "checkout" && <CheckoutForm />}
      </div>
    </motion.div>
  );
};

// ── 1. RECOMMENDATION FORM ──────────────────────────────────────────────────
const RecommendationForm: React.FC = () => {
  const { setMessages, setIsTyping, setActivity, setActiveSmartPanel } = useApp();
  
  const [recipient, setRecipient] = useState("");
  const [occasion, setOccasion] = useState("");
  const [budget, setBudget] = useState("");
  const [interest, setInterest] = useState("");
  const [customInterest, setCustomInterest] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [error, setError] = useState("");

  const recipients = ["Mother", "Father", "Wife", "Husband", "Friend", "Child", "Other"];
  const occasions = ["Birthday", "Anniversary", "Wedding", "Graduation", "New Baby", "Thank You", "Other"];
  const budgets = ["Under Rs.3000", "Rs.3000–5000", "Rs.5000–10000", "Rs.10000+"];
  const interests = ["Technology", "Gardening", "Fashion", "Beauty", "Food", "Travel", "Books", "Sports", "Custom Text"];

  const getSessionId = () => sessionStorage.getItem("velora_session_id") || "default";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient || !occasion || !budget || !interest) {
      setError("Please fill out all required fields.");
      return;
    }
    if (interest === "Custom Text" && !customInterest.trim()) {
      setError("Please specify your custom interest.");
      return;
    }

    setError("");
    const finalInterest = interest === "Custom Text" ? customInterest.trim() : interest;
    
    logPanelEvent("recommendation", "submitted");
    setActiveSmartPanel(null);

    // Formulate a clean, structured query for display and logging
    const userDisplayMsg = `I need a gift recommendation for my ${recipient} for a ${occasion}. Budget: ${budget}, Interests: ${finalInterest}.${deliveryLocation ? ` Delivery Location: ${deliveryLocation}.` : ""}`;
    setMessages(prev => [...prev, { role: "user", text: userDisplayMsg }]);

    // Trigger loader state
    setIsTyping(true);
    setActivity({
      currentStep: "UNDERSTANDING",
      currentMessage: "Processing gift preferences...",
      logs: [
        { id: "UNDERSTANDING", title: "Applying preferences", status: "completed", details: [`Recipient: ${recipient}`, `Occasion: ${occasion}`, `Budget: ${budget}`, `Interests: ${finalInterest}`] },
        { id: "SEARCHING", title: "Searching gift catalog", status: "active", details: [] },
        { id: "FILTERING", title: "Filtering recommendations", status: "pending", details: [] },
        { id: "RANKING", title: "Sorting by relevance", status: "pending", details: [] },
        { id: "READY", title: "Gifts ready", status: "pending", details: [] }
      ]
    });

    // Map budget string to min/max
    const filters: any = { category: "gift" };
    if (budget === "Under Rs.3000") {
      filters.priceMax = 3000;
    } else if (budget === "Rs.3000–5000") {
      filters.priceMin = 3000;
      filters.priceMax = 5000;
    } else if (budget === "Rs.5000–10000") {
      filters.priceMin = 5000;
      filters.priceMax = 10000;
    } else if (budget === "Rs.10000+") {
      filters.priceMin = 10000;
    }

    const mcpSearchQuery = `${recipient} gift ${occasion} ${finalInterest}`.trim();

    try {
      const data = await sendIntentMessage(
        userDisplayMsg,
        "search_products",
        {
          query: mcpSearchQuery,
          filters
        },
        (payload) => {
          if (payload.step) {
            setActivity(prev => {
              if (!prev) return null;
              const logs = prev.logs.map(log => {
                if (log.id === payload.step) return { ...log, status: "active" as const };
                if (prev.logs.findIndex(s => s.id === log.id) < prev.logs.findIndex(s => s.id === payload.step)) {
                  return { ...log, status: "completed" as const };
                }
                return log;
              });
              return {
                ...prev,
                currentStep: payload.step,
                currentMessage: payload.message || prev.currentMessage,
                logs
              };
            });
          }
        }
      );

      setIsTyping(false);
      setActivity(null);

      let rawProducts = [];
      let text = "";
      if (data && typeof data === "object") {
        if (data.type === "product_grid") {
          text = data.text;
          rawProducts = data.products || [];
        }
      } else if (Array.isArray(data)) {
        rawProducts = data;
      }

      const mappedProducts = rawProducts.map(mapBackendProductToUI);

      setMessages(prev => [...prev, {
        role: "ai",
        text: text || `Here are some thoughtful gift suggestions for your **${recipient}** on their **${occasion}**:`,
        products: mappedProducts
      }]);

    } catch (err: any) {
      setIsTyping(false);
      setActivity(null);
      setMessages(prev => [...prev, {
        role: "ai",
        text: `⚠️ I ran into an error finding recommendations: ${err.message || "Failed to search product database"}.`
      }]);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 font-sans text-xs">
      <div>
        <label className="block mb-1 font-bold text-gray-700 dark:text-gray-300">Recipient *</label>
        <div className="flex flex-wrap gap-1.5">
          {recipients.map(r => (
            <button
              key={r}
              type="button"
              onClick={() => setRecipient(r)}
              style={{
                padding: "5px 10px",
                borderRadius: 20,
                border: "none",
                background: recipient === r ? "linear-gradient(135deg,#7c4dba,#402970)" : "rgba(64,41,112,0.06)",
                color: recipient === r ? "#fff" : "var(--text-primary, #1a1025)",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.15s"
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block mb-1 font-bold text-gray-700 dark:text-gray-300">Occasion *</label>
        <div className="flex flex-wrap gap-1.5">
          {occasions.map(o => (
            <button
              key={o}
              type="button"
              onClick={() => setOccasion(o)}
              style={{
                padding: "5px 10px",
                borderRadius: 20,
                border: "none",
                background: occasion === o ? "linear-gradient(135deg,#7c4dba,#402970)" : "rgba(64,41,112,0.06)",
                color: occasion === o ? "#fff" : "var(--text-primary, #1a1025)",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.15s"
              }}
            >
              {o}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block mb-1 font-bold text-gray-700 dark:text-gray-300">Budget Limit *</label>
        <div className="flex flex-wrap gap-1.5">
          {budgets.map(b => (
            <button
              key={b}
              type="button"
              onClick={() => setBudget(b)}
              style={{
                padding: "5px 10px",
                borderRadius: 20,
                border: "none",
                background: budget === b ? "linear-gradient(135deg,#7c4dba,#402970)" : "rgba(64,41,112,0.06)",
                color: budget === b ? "#fff" : "var(--text-primary, #1a1025)",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.15s"
              }}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block mb-1 font-bold text-gray-700 dark:text-gray-300">Interests *</label>
        <div className="flex flex-wrap gap-1.5">
          {interests.map(i => (
            <button
              key={i}
              type="button"
              onClick={() => setInterest(i)}
              style={{
                padding: "5px 10px",
                borderRadius: 20,
                border: "none",
                background: interest === i ? "linear-gradient(135deg,#7c4dba,#402970)" : "rgba(64,41,112,0.06)",
                color: interest === i ? "#fff" : "var(--text-primary, #1a1025)",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.15s"
              }}
            >
              {i}
            </button>
          ))}
        </div>
        {interest === "Custom Text" && (
          <input
            type="text"
            placeholder="Specify interest (e.g. Gardening, Gaming)..."
            value={customInterest}
            onChange={e => setCustomInterest(e.target.value)}
            style={{
              marginTop: 8,
              width: "100%",
              padding: "8px 12px",
              borderRadius: 10,
              border: "1.5px solid var(--card-border, rgba(64, 41, 112, 0.15))",
              background: "var(--input-background, #fff)",
              color: "var(--text-primary, #1a1025)",
              outline: "none",
              boxSizing: "border-box"
            }}
          />
        )}
      </div>

      <div>
        <label className="block mb-1 font-bold text-gray-700 dark:text-gray-300">Delivery Location (Optional)</label>
        <input
          type="text"
          placeholder="e.g. Colombo, Jaffna..."
          value={deliveryLocation}
          onChange={e => setDeliveryLocation(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: 10,
            border: "1.5px solid var(--card-border, rgba(64, 41, 112, 0.15))",
            background: "var(--input-background, #fff)",
            color: "var(--text-primary, #1a1025)",
            outline: "none",
            boxSizing: "border-box"
          }}
        />
      </div>

      {error && (
        <div style={{ color: "#d4183d", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <button
        type="submit"
        style={{
          marginTop: 6,
          padding: "10px",
          borderRadius: 12,
          border: "none",
          background: "linear-gradient(135deg,#7c4dba,#402970)",
          color: "#fff",
          fontWeight: 800,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          boxShadow: "0 4px 12px rgba(124, 77, 186, 0.25)"
        }}
      >
        <span>Find Gifts</span> <ArrowRight size={14} />
      </button>
    </form>
  );
};

// ── 2. DELIVERY FORM ────────────────────────────────────────────────────────
const DeliveryForm: React.FC = () => {
  const { setMessages, setIsTyping, setActivity, setActiveSmartPanel, pendingConfirmProduct } = useApp();
  
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!city.trim() || !preferredDate) {
      setError("City and Date are required.");
      return;
    }
    setError("");

    logPanelEvent("delivery", "submitted");
    setActiveSmartPanel(null);

    const userDisplayMsg = `Check delivery to ${city}${district ? `, ${district}` : ""} on ${preferredDate}`;
    setMessages(prev => [...prev, { role: "user", text: userDisplayMsg }]);

    setIsTyping(true);
    setActivity({
      currentStep: "UNDERSTANDING",
      currentMessage: "Checking delivery availability...",
      logs: [
        { id: "UNDERSTANDING", title: "Validating delivery parameters", status: "active", details: [`City: ${city}`, `Date: ${preferredDate}`] }
      ]
    });

    try {
      const res = await checkDelivery({
        city: city.trim(),
        deliveryDate: preferredDate,
        productId: pendingConfirmProduct ? pendingConfirmProduct.id : ""
      });

      setIsTyping(false);
      setActivity(null);

      if (res.available) {
        setMessages(prev => [...prev, {
          role: "ai",
          text: `✅ Delivery is available for **${city}** on **${preferredDate}**.\n\n- **Delivery Charge**: Rs. ${res.deliveryCharge}\n- **Service Carrier**: Next-day dispatch qualified.`
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: "ai",
          text: `❌ Delivery not available for **${city}** on **${preferredDate}**.\n\nReason: ${res.warning || "Unsupported delivery city."}`
        }]);
      }
    } catch (err: any) {
      setIsTyping(false);
      setActivity(null);
      setMessages(prev => [...prev, {
        role: "ai",
        text: `⚠️ Carrier service check failed: ${err.message || "Unable to reach servers"}.`
      }]);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 font-sans text-xs">
      <div className="flex gap-3">
        <div style={{ flex: 1.2 }}>
          <label className="block mb-1 font-bold text-gray-700 dark:text-gray-300">City *</label>
          <input
            type="text"
            placeholder="e.g. Colombo 03, Jaffna"
            value={city}
            onChange={e => setCity(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 10,
              border: "1.5px solid var(--card-border, rgba(64, 41, 112, 0.15))",
              background: "var(--input-background, #fff)",
              color: "var(--text-primary, #1a1025)",
              outline: "none",
              boxSizing: "border-box"
            }}
          />
        </div>
        <div style={{ flex: 0.8 }}>
          <label className="block mb-1 font-bold text-gray-700 dark:text-gray-300">District</label>
          <input
            type="text"
            placeholder="e.g. Colombo"
            value={district}
            onChange={e => setDistrict(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 10,
              border: "1.5px solid var(--card-border, rgba(64, 41, 112, 0.15))",
              background: "var(--input-background, #fff)",
              color: "var(--text-primary, #1a1025)",
              outline: "none",
              boxSizing: "border-box"
            }}
          />
        </div>
      </div>

      <div>
        <label className="block mb-1 font-bold text-gray-700 dark:text-gray-300">Preferred Date *</label>
        <input
          type="date"
          value={preferredDate}
          onChange={e => setPreferredDate(e.target.value)}
          min={new Date().toISOString().split("T")[0]}
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: 10,
            border: "1.5px solid var(--card-border, rgba(64, 41, 112, 0.15))",
            background: "var(--input-background, #fff)",
            color: "var(--text-primary, #1a1025)",
            outline: "none",
            boxSizing: "border-box",
            cursor: "pointer"
          }}
        />
      </div>

      {error && (
        <div style={{ color: "#d4183d", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <button
        type="submit"
        style={{
          marginTop: 6,
          padding: "10px",
          borderRadius: 12,
          border: "none",
          background: "linear-gradient(135deg,#7c4dba,#402970)",
          color: "#fff",
          fontWeight: 800,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          boxShadow: "0 4px 12px rgba(124, 77, 186, 0.25)"
        }}
      >
        <span>Check Delivery</span> <ArrowRight size={14} />
      </button>
    </form>
  );
};

// ── 3. TRACK ORDER FORM ──────────────────────────────────────────────────────
const TrackOrderForm: React.FC = () => {
  const { setMessages, setIsTyping, setActiveSmartPanel } = useApp();
  const [orderId, setOrderId] = useState("");
  const [error, setError] = useState("");

  const getSessionId = () => sessionStorage.getItem("velora_session_id") || "default";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId.trim()) {
      setError("Please enter an Order ID.");
      return;
    }
    setError("");

    logPanelEvent("track_order", "submitted");
    setActiveSmartPanel(null);

    const userDisplayMsg = `Track order ${orderId.trim()}`;
    setMessages(prev => [...prev, { role: "user", text: userDisplayMsg }]);

    setIsTyping(true);

    try {
      const res = await fetch("/api/orders/track", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-id": getSessionId() },
        body: JSON.stringify({ orderNumber: orderId.trim() })
      });
      const data = await res.json();
      
      setIsTyping(false);

      if (res.ok) {
        setMessages(prev => [...prev, {
          role: "ai",
          type: "order_tracking",
          text: `Here is the current tracking status for order **${orderId.trim()}**:`,
          tracking: data
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: "ai",
          type: "order_tracking_error",
          text: `❌ ${data.message || "Unable to retrieve order details."}`,
          orderNumber: orderId.trim()
        }]);
      }
    } catch (err: any) {
      setIsTyping(false);
      setMessages(prev => [...prev, {
        role: "ai",
        type: "order_tracking_error",
        text: `⚠️ Connection failed: ${err.message || "Failed to reach order tracking servers."}`,
        orderNumber: orderId.trim()
      }]);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 font-sans text-xs">
      <div>
        <label className="block mb-1 font-bold text-gray-700 dark:text-gray-300">Order ID *</label>
        <input
          type="text"
          placeholder="e.g. VIMP34456CB2"
          value={orderId}
          onChange={e => setOrderId(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: 10,
            border: "1.5px solid var(--card-border, rgba(64, 41, 112, 0.15))",
            background: "var(--input-background, #fff)",
            color: "var(--text-primary, #1a1025)",
            outline: "none",
            boxSizing: "border-box"
          }}
        />
      </div>

      {error && (
        <div style={{ color: "#d4183d", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <button
        type="submit"
        style={{
          marginTop: 6,
          padding: "10px",
          borderRadius: 12,
          border: "none",
          background: "linear-gradient(135deg,#7c4dba,#402970)",
          color: "#fff",
          fontWeight: 800,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          boxShadow: "0 4px 12px rgba(124, 77, 186, 0.25)"
        }}
      >
        <span>Track Order</span> <ArrowRight size={14} />
      </button>
    </form>
  );
};

// ── 4. CHECKOUT FORM ────────────────────────────────────────────────────────
const CheckoutForm: React.FC = () => {
  const { setMessages, setActiveSmartPanel, saveOrderToHistory } = useApp();
  const { cartItems, clearCart } = useCart();
  
  const [address, setAddress] = useState(() => localStorage.getItem("delivery_street1") || "");
  const [phone, setPhone] = useState(() => localStorage.getItem("delivery_phone") || "+94 77 123 4567");
  const [giftMessage, setGiftMessage] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [error, setError] = useState("");

  const cartTotal = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  const getSessionId = () => sessionStorage.getItem("velora_session_id") || "default";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim() || !phone.trim() || !deliveryDate) {
      setError("Address, Phone, and Delivery Date are required.");
      return;
    }
    setError("");

    logPanelEvent("checkout", "submitted");
    setActiveSmartPanel(null);

    // Formulate recipient delivery info
    const deliveryInfo: DeliveryInfo = {
      fullName: localStorage.getItem("delivery_name") || "Alex Johnson",
      phone: phone.trim(),
      email: localStorage.getItem("delivery_email") || "alex@example.com",
      address: address.trim()
    };

    // Calculate dates & reference numbers
    const now = new Date();
    const formatDate = (date: Date) => {
      const day = String(date.getDate()).padStart(2, "0");
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${day} ${months[date.getMonth()]} ${date.getFullYear()}`;
    };

    const parsedDeliveryDate = new Date(deliveryDate);
    const referenceNumber = `KAP-${now.getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const orderNumber = `VIMP${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    const orderDetails = {
      referenceNumber,
      orderNumber,
      orderDate: formatDate(now),
      estimatedDelivery: formatDate(parsedDeliveryDate),
      paymentStatus: "Paid",
      recipient: deliveryInfo,
      items: cartItems.map(item => ({
        id: item.productId,
        name: item.name,
        image: item.image,
        qty: item.quantity,
        price: item.price,
        currency: item.product.currency
      })),
      summary: {
        subtotal: cartTotal,
        deliveryCharge: 0,
        discount: 0,
        total: cartTotal
      }
    };

    saveOrderToHistory(orderDetails);

    // Track interaction asynchronously
    cartItems.forEach(item => {
      fetch("/api/products/interaction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": getSessionId(),
        },
        body: JSON.stringify({
          productId: item.productId,
          productName: item.name,
          category: item.product.category,
          action: "purchase"
        })
      }).catch(err => console.error("Failed to track purchase:", err));
    });

    setMessages(prev => [
      ...prev,
      {
        role: "ai",
        type: "order_confirmation",
        text: `✅ Order Successfully Placed. ${giftMessage.trim() ? `\n\n**Gift Message**: "${giftMessage.trim()}"` : ""}`,
        order: orderDetails
      }
    ]);

    clearCart();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 font-sans text-xs">
      <div>
        <label className="block mb-1 font-bold text-gray-700 dark:text-gray-300">Shipping Address *</label>
        <textarea
          placeholder="e.g. No 15, Temple Road, Colombo 03"
          value={address}
          onChange={e => setAddress(e.target.value)}
          rows={2}
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: 10,
            border: "1.5px solid var(--card-border, rgba(64, 41, 112, 0.15))",
            background: "var(--input-background, #fff)",
            color: "var(--text-primary, #1a1025)",
            outline: "none",
            resize: "none",
            boxSizing: "border-box",
            lineHeight: 1.4
          }}
        />
      </div>

      <div className="flex gap-3">
        <div style={{ flex: 1 }}>
          <label className="block mb-1 font-bold text-gray-700 dark:text-gray-300">Phone Number *</label>
          <input
            type="text"
            placeholder="e.g. +94 77 123 4567"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 10,
              border: "1.5px solid var(--card-border, rgba(64, 41, 112, 0.15))",
              background: "var(--input-background, #fff)",
              color: "var(--text-primary, #1a1025)",
              outline: "none",
              boxSizing: "border-box"
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label className="block mb-1 font-bold text-gray-700 dark:text-gray-300">Delivery Date *</label>
          <input
            type="date"
            value={deliveryDate}
            onChange={e => setDeliveryDate(e.target.value)}
            min={new Date().toISOString().split("T")[0]}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 10,
              border: "1.5px solid var(--card-border, rgba(64, 41, 112, 0.15))",
              background: "var(--input-background, #fff)",
              color: "var(--text-primary, #1a1025)",
              outline: "none",
              boxSizing: "border-box",
              cursor: "pointer"
            }}
          />
        </div>
      </div>

      <div>
        <label className="block mb-1 font-bold text-gray-700 dark:text-gray-300">Gift Message (Optional)</label>
        <input
          type="text"
          placeholder="e.g. Happy Birthday Mom! Love you."
          value={giftMessage}
          onChange={e => setGiftMessage(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: 10,
            border: "1.5px solid var(--card-border, rgba(64, 41, 112, 0.15))",
            background: "var(--input-background, #fff)",
            color: "var(--text-primary, #1a1025)",
            outline: "none",
            boxSizing: "border-box"
          }}
        />
      </div>

      {error && (
        <div style={{ color: "#d4183d", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <div className="flex justify-between items-center py-2 px-1 font-bold text-gray-800 dark:text-gray-200" style={{ borderTop: "1px solid rgba(64, 41, 112, 0.08)" }}>
        <span>Total Amount:</span>
        <span style={{ color: "#7c4dba", fontSize: 16 }}>Rs. {cartTotal.toLocaleString()}</span>
      </div>

      <button
        type="submit"
        style={{
          padding: "10px",
          borderRadius: 12,
          border: "none",
          background: "linear-gradient(135deg, #3fc78e, #2a9e6a)",
          color: "#fff",
          fontWeight: 800,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          boxShadow: "0 4px 12px rgba(42, 158, 106, 0.25)"
        }}
      >
        <span>Place Order</span> <ArrowRight size={14} />
      </button>
    </form>
  );
};

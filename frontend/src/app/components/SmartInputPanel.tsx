import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Gift, Truck, Package, CreditCard, ArrowRight, Calendar, MapPin, User, Phone, MessageSquare, AlertCircle } from "lucide-react";
import { useApp } from "../contexts/AppContext";
import { useCart } from "../contexts/CartContext";
import { useChat } from "../hooks/useChat";
import { sendIntentMessage } from "../services/chatServices";
import { checkDelivery } from "../services/productServices";
import { mapBackendProductToUI } from "../services/mapping";
import { type DeliveryInfo, getDefaultSeller } from "./InteractiveOrderSummary";
import { generateSearchStrategy, searchProducts as runAISearch, rankProducts as runAIRanking } from "../services/recommendationService";

const logPanelEvent = (panel: string, event: "opened" | "submitted") => {
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
        <h3 style={{ color: "var(--text-primary, #1a1025)", fontWeight: 700, fontSize: 13.5, display: "flex", alignItems: "center", gap: 8 }}>
          {activeSmartPanel === "recommendation" && <><Gift size={16} className="text-purple-600" /> 🎁 Find The Perfect Gift</>}
          {activeSmartPanel === "delivery" && <><Truck size={16} className="text-purple-600" /> 🚚 Delivery Information</>}
          {activeSmartPanel === "track_order" && <><Package size={16} className="text-purple-600" /> 📦 Track Order</>}
          {activeSmartPanel === "checkout" && <><CreditCard size={16} className="text-purple-600" /> 💳 Checkout Confirmation</>}
          {activeSmartPanel === "delivery_recovery" && <><AlertCircle size={16} className="text-purple-600" /> 🚚 Delivery Recovery Options</>}
          {activeSmartPanel === "nearby_address" && <><MapPin size={16} className="text-purple-600" /> 📍 Nearby Delivery Form</>}
          {activeSmartPanel === "alternative_date" && <><Calendar size={16} className="text-purple-600" /> 📅 Choose Another Delivery Date</>}
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
        {activeSmartPanel === "delivery_recovery" && <DeliveryRecoveryPanel />}
        {activeSmartPanel === "nearby_address" && <NearbyAddressPanel />}
        {activeSmartPanel === "alternative_date" && <AlternativeDatePanel />}
      </div>
    </motion.div>
  );
};

const RecommendationForm: React.FC = () => {
  const { setMessages, setIsTyping, setActivity, setActiveSmartPanel } = useApp();
  
  const [step, setStep] = useState(0);
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

    let numericBudget = 5000;
    if (budget === "Under Rs.3000") {
      numericBudget = 3000;
    } else if (budget === "Rs.3000–5000") {
      numericBudget = 5000;
    } else if (budget === "Rs.5000–10000") {
      numericBudget = 10000;
    } else if (budget === "Rs.10000+") {
      numericBudget = 30000;
    }

    // Formulate a clean, structured query for display and logging
    const userDisplayMsg = `I need a gift recommendation for my ${recipient} for a ${occasion}. Budget: ${budget}, Interests: ${finalInterest}.${deliveryLocation ? ` Delivery Location: ${deliveryLocation}.` : ""}`;
    setMessages(prev => [...prev, { role: "user", text: userDisplayMsg }]);

    console.log(`[RECOMMENDATION]\nPanel Submitted\nRecipient: ${recipient}\nOccasion: ${occasion}\nBudget: ${numericBudget}`);

    // Trigger loader state
    setIsTyping(true);
    
    const initialLogs = [
      { id: "UNDERSTANDING", title: "Applying preferences", status: "active" as const, details: [`Recipient: ${recipient}`, `Occasion: ${occasion}`, `Budget: ${budget}`, `Interests: ${finalInterest}`] },
      { id: "SEARCHING", title: "Searching gift catalog", status: "pending" as const, details: [] },
      { id: "FILTERING", title: "Filtering recommendations", status: "pending" as const, details: [] },
      { id: "RANKING", title: "Sorting by relevance", status: "pending" as const, details: [] },
      { id: "READY", title: "Gifts ready", status: "pending" as const, details: [] }
    ];

    setActivity({
      currentStep: "UNDERSTANDING",
      currentMessage: "Generating AI search strategy...",
      logs: initialLogs
    });

    const prefs = { recipient, occasion, budget: numericBudget, interests: finalInterest };

    try {
      // Step 1: AI Search Strategy
      const strategy = await generateSearchStrategy(prefs);
      console.log(`[AI]\nGenerated Query:\n${strategy.query}`);
      
      const updatedLogs1 = [
        { id: "UNDERSTANDING", title: "Applying preferences", status: "completed" as const, details: [`Query: "${strategy.query}"`, `Category: "${strategy.category}"`, `Reason: "${strategy.reason}"`] },
        { id: "SEARCHING", title: "Searching gift catalog", status: "active" as const, details: [] },
        { id: "FILTERING", title: "Filtering recommendations", status: "pending" as const, details: [] },
        { id: "RANKING", title: "Sorting by relevance", status: "pending" as const, details: [] },
        { id: "READY", title: "Gifts ready", status: "pending" as const, details: [] }
      ];
      setActivity({
        currentStep: "SEARCHING",
        currentMessage: `Searching catalog for "${strategy.query}"...`,
        logs: updatedLogs1
      });

      // Step 2: Kapruka Product Search
      const products = await runAISearch(strategy.query, strategy.category, numericBudget);
      console.log(`[KAPRUKA]\nProducts Found: ${products.length}`);

      const updatedLogs2 = [
        { id: "UNDERSTANDING", title: "Applying preferences", status: "completed" as const, details: [`Query: "${strategy.query}"`, `Category: "${strategy.category}"`, `Reason: "${strategy.reason}"`] },
        { id: "SEARCHING", title: "Searching gift catalog", status: "completed" as const, details: [`Found ${products.length} products`] },
        { id: "FILTERING", title: "Filtering recommendations", status: "active" as const, details: [] },
        { id: "RANKING", title: "Sorting by relevance", status: "pending" as const, details: [] },
        { id: "READY", title: "Gifts ready", status: "pending" as const, details: [] }
      ];
      setActivity({
        currentStep: "FILTERING",
        currentMessage: "Applying filters...",
        logs: updatedLogs2
      });

      const updatedLogs3 = [
        { id: "UNDERSTANDING", title: "Applying preferences", status: "completed" as const, details: [`Query: "${strategy.query}"`, `Category: "${strategy.category}"`, `Reason: "${strategy.reason}"`] },
        { id: "SEARCHING", title: "Searching gift catalog", status: "completed" as const, details: [`Found ${products.length} products`] },
        { id: "FILTERING", title: "Filtering recommendations", status: "completed" as const, details: ["Applied budget and category filters"] },
        { id: "RANKING", title: "Sorting by relevance", status: "active" as const, details: [] },
        { id: "READY", title: "Gifts ready", status: "pending" as const, details: [] }
      ];
      setActivity({
        currentStep: "RANKING",
        currentMessage: "Ranking products for relevance...",
        logs: updatedLogs3
      });

      // Step 3: Product Ranking
      const rankings = await runAIRanking(products, prefs);
      console.log(`[RANKING]\nTop Products Selected: ${rankings.length}`);

      const rankedProducts = rankings.map(rank => {
        const prod = products.find(p => p.id === rank.productId);
        if (!prod) return null;
        return {
          ...prod,
          score: rank.score,
          recommendationType: rank.recommendationType,
          recommendationReason: rank.recommendationReason
        };
      }).filter(Boolean) as any[];

      const updatedLogs4 = [
        { id: "UNDERSTANDING", title: "Applying preferences", status: "completed" as const, details: [`Query: "${strategy.query}"`, `Category: "${strategy.category}"`, `Reason: "${strategy.reason}"`] },
        { id: "SEARCHING", title: "Searching gift catalog", status: "completed" as const, details: [`Found ${products.length} products`] },
        { id: "FILTERING", title: "Filtering recommendations", status: "completed" as const, details: ["Applied budget and category filters"] },
        { id: "RANKING", title: "Sorting by relevance", status: "completed" as const, details: [`Selected top ${rankedProducts.length} recommendations`] },
        { id: "READY", title: "Gifts ready", status: "active" as const, details: [] }
      ];
      setActivity({
        currentStep: "READY",
        currentMessage: "Preparing display...",
        logs: updatedLogs4
      });

      console.log(`[RECOMMENDATION]\nResponse Generated`);

      // Store recommendation session
      const session = {
        recipient,
        occasion,
        budget: numericBudget,
        interests: finalInterest,
        generatedQuery: strategy.query,
        productsFound: products.length,
        recommendations: rankedProducts
      };
      sessionStorage.setItem("velora_recommendation_session", JSON.stringify(session));

      // Map to UI Products
      const mappedProducts = rankedProducts.map(p => {
        const mapped = mapBackendProductToUI(p);
        mapped.score = p.score;
        mapped.recommendationType = p.recommendationType;
        mapped.recommendationReason = p.recommendationReason;
        return mapped;
      });

      setTimeout(() => {
        setIsTyping(false);
        setActivity(null);
        setMessages(prev => [...prev, {
          role: "ai",
          text: `Here are the top gift recommendations for your **${recipient}** on their **${occasion}** matching your interests:`,
          products: mappedProducts
        }]);
      }, 800);

    } catch (err: any) {
      console.error("AI Recommendation workflow failed:", err);
      // Fallback: search raw and display without ranking
      try {
        const fallbackQuery = `${finalInterest} gift`;
        const products = await runAISearch(fallbackQuery, "", numericBudget);
        const mappedProducts = products.map(mapBackendProductToUI);
        
        setIsTyping(false);
        setActivity(null);
        setMessages(prev => [...prev, {
          role: "ai",
          text: `⚠️ AI strategy ranking failed, but I found these catalog search matches for "${fallbackQuery}":`,
          products: mappedProducts
        }]);
      } catch (fallbackErr: any) {
        setIsTyping(false);
        setActivity(null);
        setMessages(prev => [...prev, {
          role: "ai",
          text: `⚠️ I ran into an error finding recommendations: ${err.message || "Failed to search product database"}.`
        }]);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 font-sans text-xs">
      {/* Visual Progress Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", gap: 4 }}>
          {Array.from({ length: 5 }).map((_, idx) => (
            <div
              key={idx}
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                background: idx <= step ? "linear-gradient(135deg,#7c4dba,#402970)" : "rgba(64,41,112,0.1)",
                transition: "background 0.3s"
              }}
            />
          ))}
        </div>
        <span style={{ fontSize: 10, color: "var(--text-secondary, #7c6a9e)", fontWeight: 500 }}>
          Step {step + 1} of 5
        </span>
      </div>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="step-recipient"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-2.5"
          >
            <label style={{ fontSize: 11.5, fontWeight: 500, color: "var(--text-primary, #1a1025)" }}>
              Who is this gift for?
            </label>
            <div className="flex flex-wrap gap-1.5">
              {recipients.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setRecipient(r);
                    setStep(1);
                  }}
                  style={{
                    padding: "5px 11px",
                    borderRadius: 20,
                    border: "none",
                    background: recipient === r ? "linear-gradient(135deg,#7c4dba,#402970)" : "rgba(64,41,112,0.06)",
                    color: recipient === r ? "#fff" : "var(--text-primary, #1a1025)",
                    fontWeight: 500,
                    fontSize: 11,
                    cursor: "pointer",
                    transition: "all 0.15s"
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            key="step-occasion"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-2.5"
          >
            <label style={{ fontSize: 11.5, fontWeight: 500, color: "var(--text-primary, #1a1025)" }}>
              What is the occasion?
            </label>
            <div className="flex flex-wrap gap-1.5">
              {occasions.map(o => (
                <button
                  key={o}
                  type="button"
                  onClick={() => {
                    setOccasion(o);
                    setStep(2);
                  }}
                  style={{
                    padding: "5px 11px",
                    borderRadius: 20,
                    border: "none",
                    background: occasion === o ? "linear-gradient(135deg,#7c4dba,#402970)" : "rgba(64,41,112,0.06)",
                    color: occasion === o ? "#fff" : "var(--text-primary, #1a1025)",
                    fontWeight: 500,
                    fontSize: 11,
                    cursor: "pointer",
                    transition: "all 0.15s"
                  }}
                >
                  {o}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step-budget"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-2.5"
          >
            <label style={{ fontSize: 11.5, fontWeight: 500, color: "var(--text-primary, #1a1025)" }}>
              What is your budget limit?
            </label>
            <div className="flex flex-wrap gap-1.5">
              {budgets.map(b => (
                <button
                  key={b}
                  type="button"
                  onClick={() => {
                    setBudget(b);
                    setStep(3);
                  }}
                  style={{
                    padding: "5px 11px",
                    borderRadius: 20,
                    border: "none",
                    background: budget === b ? "linear-gradient(135deg,#7c4dba,#402970)" : "rgba(64,41,112,0.06)",
                    color: budget === b ? "#fff" : "var(--text-primary, #1a1025)",
                    fontWeight: 500,
                    fontSize: 11,
                    cursor: "pointer",
                    transition: "all 0.15s"
                  }}
                >
                  {b}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="step-interests"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-2.5"
          >
            <label style={{ fontSize: 11.5, fontWeight: 500, color: "var(--text-primary, #1a1025)" }}>
              What are their interests?
            </label>
            <div className="flex flex-wrap gap-1.5">
              {interests.map(i => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setInterest(i);
                    if (i !== "Custom Text") {
                      setStep(4);
                      setError("");
                    }
                  }}
                  style={{
                    padding: "5px 11px",
                    borderRadius: 20,
                    border: "none",
                    background: interest === i ? "linear-gradient(135deg,#7c4dba,#402970)" : "rgba(64,41,112,0.06)",
                    color: interest === i ? "#fff" : "var(--text-primary, #1a1025)",
                    fontWeight: 500,
                    fontSize: 11,
                    cursor: "pointer",
                    transition: "all 0.15s"
                  }}
                >
                  {i}
                </button>
              ))}
            </div>
            {interest === "Custom Text" && (
              <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 8 }}>
                <input
                  type="text"
                  placeholder="Specify interest (e.g. Gardening, Gaming)..."
                  value={customInterest}
                  onChange={e => setCustomInterest(e.target.value)}
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
                <button
                  type="button"
                  onClick={() => {
                    if (customInterest.trim()) {
                      setStep(4);
                      setError("");
                    } else {
                      setError("Please specify your custom interest.");
                    }
                  }}
                  style={{
                    alignSelf: "flex-end",
                    padding: "6px 14px",
                    borderRadius: 10,
                    border: "none",
                    background: "linear-gradient(135deg,#7c4dba,#402970)",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  Next →
                </button>
              </div>
            )}
          </motion.div>
        )}

        {step === 4 && (
          <motion.div
            key="step-location"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-2.5"
          >
            <label style={{ fontSize: 11.5, fontWeight: 500, color: "var(--text-primary, #1a1025)" }}>
              Where should we deliver? (Optional)
            </label>
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
            <button
              type="submit"
              style={{
                marginTop: 6,
                padding: "10px",
                borderRadius: 12,
                border: "none",
                background: "linear-gradient(135deg,#7c4dba,#402970)",
                color: "#fff",
                fontWeight: 700,
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
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div style={{ color: "#d4183d", fontWeight: 700, display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Navigation Buttons footer row */}
      {step > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(64,41,112,0.06)", paddingTop: 8, marginTop: 4 }}>
          <button
            type="button"
            onClick={() => setStep(prev => prev - 1)}
            style={{
              padding: "5px 12px",
              borderRadius: 8,
              border: "1.5px solid rgba(64,41,112,0.15)",
              background: "transparent",
              color: "#7c6a9e",
              fontSize: 10,
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4
            }}
          >
            ← Back
          </button>
        </div>
      )}
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

// ── 5. DELIVERY RECOVERY PANEL ───────────────────────────────────────────────
const DeliveryRecoveryPanel: React.FC = () => {
  const { handleSend } = useChat();
  const { setActiveSmartPanel } = useApp();

  const handleAction = (text: string) => {
    setActiveSmartPanel(null);
    handleSend(text);
  };

  return (
    <div className="flex flex-col gap-3 font-sans text-xs">
      <p style={{ color: "var(--text-secondary, #7c6a9e)", marginBottom: 8, fontSize: 11.5 }}>
        Unfortunately, delivery to your selected location is unavailable. Velora AI Recovery Agent is ready to guide you:
      </p>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => handleAction("Try nearby location")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            borderRadius: 12,
            border: "1.5px solid var(--card-border, rgba(124, 77, 186, 0.22))",
            background: "rgba(124, 77, 186, 0.05)",
            color: "var(--text-primary, #1a1025)",
            fontWeight: 600,
            cursor: "pointer",
            textAlign: "left",
            transition: "all 0.2s"
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "rgba(124, 77, 186, 0.12)";
            e.currentTarget.style.borderColor = "rgba(124, 77, 186, 0.4)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "rgba(124, 77, 186, 0.05)";
            e.currentTarget.style.borderColor = "var(--card-border, rgba(124, 77, 186, 0.22))";
          }}
        >
          <span style={{ fontSize: 16 }}>📍</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 11.5 }}>Try Nearby Location</div>
            <div style={{ fontSize: 10, color: "var(--text-secondary, #7c6a9e)", marginTop: 2 }}>Suggest close supported cities and open address form</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleAction("Try another date")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            borderRadius: 12,
            border: "1.5px solid var(--card-border, rgba(124, 77, 186, 0.22))",
            background: "rgba(124, 77, 186, 0.05)",
            color: "var(--text-primary, #1a1025)",
            fontWeight: 600,
            cursor: "pointer",
            textAlign: "left",
            transition: "all 0.2s"
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "rgba(124, 77, 186, 0.12)";
            e.currentTarget.style.borderColor = "rgba(124, 77, 186, 0.4)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "rgba(124, 77, 186, 0.05)";
            e.currentTarget.style.borderColor = "var(--card-border, rgba(124, 77, 186, 0.22))";
          }}
        >
          <span style={{ fontSize: 16 }}>📅</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 11.5 }}>Choose Another Delivery Date</div>
            <div style={{ fontSize: 10, color: "var(--text-secondary, #7c6a9e)", marginTop: 2 }}>Select Tomorrow, Next Day, or a Custom Date</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleAction("Find something similar")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            borderRadius: 12,
            border: "1.5px solid var(--card-border, rgba(124, 77, 186, 0.22))",
            background: "rgba(124, 77, 186, 0.05)",
            color: "var(--text-primary, #1a1025)",
            fontWeight: 600,
            cursor: "pointer",
            textAlign: "left",
            transition: "all 0.2s"
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "rgba(124, 77, 186, 0.12)";
            e.currentTarget.style.borderColor = "rgba(124, 77, 186, 0.4)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "rgba(124, 77, 186, 0.05)";
            e.currentTarget.style.borderColor = "var(--card-border, rgba(124, 77, 186, 0.22))";
          }}
        >
          <span style={{ fontSize: 16 }}>🎁</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 11.5 }}>Find Similar Deliverable Products</div>
            <div style={{ fontSize: 10, color: "var(--text-secondary, #7c6a9e)", marginTop: 2 }}>Browse alternative products deliverable to your location</div>
          </div>
        </button>
      </div>
    </div>
  );
};

// ── 6. NEARBY ADDRESS PANEL ──────────────────────────────────────────────────
const NearbyAddressPanel: React.FC = () => {
  const {
    nearbyCitiesSuggested,
    setMessages,
    setIsTyping,
    setActivity,
    setActiveSmartPanel,
    pendingConfirmProduct,
    lastCheckedDelivery
  } = useApp();

  const [recipientName, setRecipientName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState(lastCheckedDelivery?.city || "");
  const [phone, setPhone] = useState("");
  const [preferredDate, setPreferredDate] = useState(lastCheckedDelivery?.deliveryDate || "");
  const [error, setError] = useState("");

  useEffect(() => {
    if (lastCheckedDelivery) {
      if (lastCheckedDelivery.city) setCity(lastCheckedDelivery.city);
      if (lastCheckedDelivery.deliveryDate) setPreferredDate(lastCheckedDelivery.deliveryDate);
    }
  }, [lastCheckedDelivery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName.trim() || !addressLine1.trim() || !city.trim() || !phone.trim() || !preferredDate) {
      setError("Please fill out all required fields (*).");
      return;
    }
    setError("");

    setActiveSmartPanel(null);

    const fullAddress = `${addressLine1}${addressLine2 ? `, ${addressLine2}` : ""}, ${city}`;
    const userDisplayMsg = `Please check delivery to:
Name: ${recipientName}
Phone: ${phone}
Address: ${fullAddress}
Preferred Date: ${preferredDate}`;

    setMessages(prev => [...prev, { role: "user", text: userDisplayMsg }]);

    setIsTyping(true);
    setActivity({
      currentStep: "UNDERSTANDING",
      currentMessage: "Checking delivery availability for new address...",
      logs: [
        { id: "UNDERSTANDING", title: "Validating recipient address details", status: "active", details: [`Recipient: ${recipientName}`, `City: ${city}`, `Phone: ${phone}`] }
      ]
    });

    try {
      const res = await checkDelivery({
        city: city.trim(),
        deliveryDate: preferredDate,
        productId: pendingConfirmProduct ? pendingConfirmProduct.id : (lastCheckedDelivery?.productId || "")
      });

      setIsTyping(false);
      setActivity(null);

      if (res.available) {
        console.log("[DELIVERY] Delivery Available");
        setMessages(prev => [...prev, {
          role: "ai",
          text: `✅ Great news! Delivery is available for **${recipientName}** at **${city}** on **${preferredDate}**.\n\n- **Address**: ${fullAddress}\n- **Phone**: ${phone}\n- **Delivery Charge**: Rs. ${res.deliveryCharge}\n- **Carrier Status**: Available for delivery.`,
          orderSummary: {
            product: pendingConfirmProduct || { id: lastCheckedDelivery?.productId || "", name: "Velora Product", price: 0 } as any,
            deliveryInfo: {
              fullName: recipientName,
              phone: phone,
              email: "customer@velora.com",
              address: fullAddress
            },
            sellerInfo: getDefaultSeller(pendingConfirmProduct?.brand || ""),
            status: "pending"
          }
        }]);
      } else {
        console.log("[DELIVERY] Check Failed");
        console.log("[RECOVERY] Recovery Flow Started");
        setMessages(prev => [...prev, {
          role: "ai",
          text: `Unfortunately, this item still cannot be delivered to **${city}** on your selected date.\n\nI can help find another delivery location, another date, or a similar product that can be delivered. Which option would you like to try?`
        }]);
        setActiveSmartPanel("delivery_recovery");
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
      {nearbyCitiesSuggested && nearbyCitiesSuggested.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          <label style={{ fontWeight: 600, color: "var(--text-secondary, #7c6a9e)", display: "block", marginBottom: 6 }}>
            🚚 Nearby Delivery Options:
          </label>
          <div className="flex flex-wrap gap-1.5">
            {nearbyCitiesSuggested.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setCity(c)}
                style={{
                  padding: "5px 10px",
                  borderRadius: 16,
                  border: city === c ? "1.5px solid var(--purple-primary, #7c4dba)" : "1.5px solid rgba(64, 41, 112, 0.1)",
                  background: city === c ? "rgba(124, 77, 186, 0.08)" : "transparent",
                  color: city === c ? "var(--purple-primary, #7c4dba)" : "var(--text-primary, #1a1025)",
                  fontWeight: 600,
                  fontSize: 10.5,
                  cursor: "pointer",
                  transition: "all 0.15s"
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div>
          <label className="block mb-1 font-bold text-gray-700 dark:text-gray-300">Recipient Name *</label>
          <input
            type="text"
            placeholder="e.g. Alex Johnson"
            value={recipientName}
            onChange={e => setRecipientName(e.target.value)}
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

        <div className="flex gap-2">
          <div style={{ flex: 1 }}>
            <label className="block mb-1 font-bold text-gray-700 dark:text-gray-300">Address Line 1 *</label>
            <input
              type="text"
              placeholder="Street or house number"
              value={addressLine1}
              onChange={e => setAddressLine1(e.target.value)}
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
            <label className="block mb-1 font-bold text-gray-700 dark:text-gray-300">Address Line 2</label>
            <input
              type="text"
              placeholder="Apartment, suite, etc. (optional)"
              value={addressLine2}
              onChange={e => setAddressLine2(e.target.value)}
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

        <div className="flex gap-2">
          <div style={{ flex: 1.2 }}>
            <label className="block mb-1 font-bold text-gray-700 dark:text-gray-300">City *</label>
            <input
              type="text"
              placeholder="e.g. Jaffna, Colombo"
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
            <label className="block mb-1 font-bold text-gray-700 dark:text-gray-300">Phone Number *</label>
            <input
              type="text"
              placeholder="+94 77 123 4567"
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
      </div>

      {error && (
        <div style={{ color: "#d4183d", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button
          type="button"
          onClick={() => setActiveSmartPanel("delivery_recovery")}
          style={{
            flex: 1,
            padding: "10px",
            borderRadius: 12,
            border: "1.5px solid rgba(64, 41, 112, 0.15)",
            background: "transparent",
            color: "#7c6a9e",
            fontWeight: 700,
            cursor: "pointer"
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          style={{
            flex: 2,
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
          <span>Submit & Check</span> <ArrowRight size={14} />
        </button>
      </div>
    </form>
  );
};

// ── 7. ALTERNATIVE DATE PANEL ────────────────────────────────────────────────
const AlternativeDatePanel: React.FC = () => {
  const {
    setMessages,
    setIsTyping,
    setActivity,
    setActiveSmartPanel,
    pendingConfirmProduct,
    lastCheckedDelivery
  } = useApp();

  const [customDate, setCustomDate] = useState("");
  const [error, setError] = useState("");

  const handleDateSelect = async (dateStr: string, label: string) => {
    setActiveSmartPanel(null);

    const userDisplayMsg = `Please check delivery for date: ${label} (${dateStr})`;
    setMessages(prev => [...prev, { role: "user", text: userDisplayMsg }]);

    setIsTyping(true);
    setActivity({
      currentStep: "UNDERSTANDING",
      currentMessage: "Checking delivery availability for new date...",
      logs: [
        { id: "UNDERSTANDING", title: "Validating delivery date", status: "active", details: [`Selected Date: ${dateStr} (${label})`] }
      ]
    });

    try {
      const res = await checkDelivery({
        city: lastCheckedDelivery?.city || "Colombo 03",
        deliveryDate: dateStr,
        productId: pendingConfirmProduct ? pendingConfirmProduct.id : (lastCheckedDelivery?.productId || "")
      });

      setIsTyping(false);
      setActivity(null);

      if (res.available) {
        console.log("[DELIVERY] Delivery Available");
        setMessages(prev => [...prev, {
          role: "ai",
          text: `✅ Success! Delivery is available on **${dateStr}** for **${res.city}**.\n\n- **Delivery Charge**: Rs. ${res.deliveryCharge}\n- **Status**: Route cleared for delivery.`
        }]);
      } else {
        console.log("[DELIVERY] Check Failed");
        console.log("[RECOVERY] Recovery Flow Started");
        setMessages(prev => [...prev, {
          role: "ai",
          text: `Unfortunately, this item cannot be delivered on **${dateStr}** either.\n\nI can help find another delivery location, another date, or a similar product that can be delivered. Which option would you like to try?`
        }]);
        setActiveSmartPanel("delivery_recovery");
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

  const getTomorrowStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  };

  const getNextDayStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split("T")[0];
  };

  return (
    <div className="flex flex-col gap-3 font-sans text-xs">
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => handleDateSelect(getTomorrowStr(), "Tomorrow")}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1.5px solid var(--card-border, rgba(124, 77, 186, 0.22))",
            background: "rgba(124, 77, 186, 0.05)",
            color: "var(--text-primary, #1a1025)",
            fontWeight: 700,
            cursor: "pointer",
            textAlign: "left",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            transition: "all 0.2s"
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "rgba(124, 77, 186, 0.12)";
            e.currentTarget.style.borderColor = "rgba(124, 77, 186, 0.4)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "rgba(124, 77, 186, 0.05)";
            e.currentTarget.style.borderColor = "var(--card-border, rgba(124, 77, 186, 0.22))";
          }}
        >
          <div>Tomorrow</div>
          <div style={{ fontSize: 10, color: "var(--text-secondary, #7c6a9e)" }}>{getTomorrowStr()}</div>
        </button>

        <button
          type="button"
          onClick={() => handleDateSelect(getNextDayStr(), "Next Day")}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1.5px solid var(--card-border, rgba(124, 77, 186, 0.22))",
            background: "rgba(124, 77, 186, 0.05)",
            color: "var(--text-primary, #1a1025)",
            fontWeight: 700,
            cursor: "pointer",
            textAlign: "left",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            transition: "all 0.2s"
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "rgba(124, 77, 186, 0.12)";
            e.currentTarget.style.borderColor = "rgba(124, 77, 186, 0.4)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "rgba(124, 77, 186, 0.05)";
            e.currentTarget.style.borderColor = "var(--card-border, rgba(124, 77, 186, 0.22))";
          }}
        >
          <div>Next Day</div>
          <div style={{ fontSize: 10, color: "var(--text-secondary, #7c6a9e)" }}>{getNextDayStr()}</div>
        </button>

        <div style={{ borderTop: "1px solid rgba(64,41,112,0.06)", paddingTop: 10, marginTop: 4 }}>
          <label style={{ fontWeight: 600, color: "var(--text-secondary, #7c6a9e)", display: "block", marginBottom: 6 }}>
            Choose Custom Date:
          </label>
          <div className="flex gap-2">
            <input
              type="date"
              value={customDate}
              onChange={e => setCustomDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              style={{
                flex: 1.5,
                padding: "8px 12px",
                borderRadius: 10,
                border: "1.5px solid var(--card-border, rgba(64, 41, 112, 0.15))",
                background: "var(--input-background, #fff)",
                color: "var(--text-primary, #1a1025)",
                outline: "none",
                cursor: "pointer"
              }}
            />
            <button
              type="button"
              onClick={() => {
                if (customDate) {
                  handleDateSelect(customDate, "Custom Date");
                } else {
                  setError("Please select a date first.");
                }
              }}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: 10,
                border: "none",
                background: "linear-gradient(135deg,#7c4dba,#402970)",
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              Select
            </button>
          </div>
          {error && (
            <div style={{ color: "#d4183d", fontWeight: 700, marginTop: 4 }}>
              {error}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button
          type="button"
          onClick={() => setActiveSmartPanel("delivery_recovery")}
          style={{
            flex: 1,
            padding: "8px",
            borderRadius: 10,
            border: "1.5px solid rgba(64, 41, 112, 0.15)",
            background: "transparent",
            color: "#7c6a9e",
            fontWeight: 700,
            cursor: "pointer"
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

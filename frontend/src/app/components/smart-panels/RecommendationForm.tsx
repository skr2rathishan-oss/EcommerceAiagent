import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, AlertCircle } from "lucide-react";
import { useApp } from "../../contexts/AppContext";
import { generateSearchStrategy, searchProducts as runAISearch, rankProducts as runAIRanking } from "../../services/recommendationService";
import { mapBackendProductToUI } from "../../services/mapping";
import { logPanelEvent } from "../../utils/panelAnalytics";

export const RecommendationForm: React.FC = () => {
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

    const userDisplayMsg = `I need a gift recommendation for my ${recipient} for a ${occasion}. Budget: ${budget}, Interests: ${finalInterest}.${deliveryLocation ? ` Delivery Location: ${deliveryLocation}.` : ""}`;
    setMessages(prev => [...prev, { role: "user", text: userDisplayMsg }]);

    console.log(`[RECOMMENDATION]\nPanel Submitted\nRecipient: ${recipient}\nOccasion: ${occasion}\nBudget: ${numericBudget}`);

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

  const chipStyle = (selected: boolean) => ({
    padding: "5px 11px",
    borderRadius: 20,
    border: "none",
    background: selected ? "linear-gradient(135deg,#7c4dba,#402970)" : "rgba(64,41,112,0.06)",
    color: selected ? "#fff" : "var(--text-primary, #1a1025)",
    fontWeight: 500,
    fontSize: 11,
    cursor: "pointer",
    transition: "all 0.15s"
  });

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
          <motion.div key="step-recipient" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }} transition={{ duration: 0.2 }} className="flex flex-col gap-2.5">
            <label style={{ fontSize: 9.5, fontWeight: 600, color: "var(--text-primary, #1a1025)" }}>Who is this gift for?</label>
            <div className="flex flex-wrap gap-1.5">
              {recipients.map(r => (
                <button key={r} type="button" onClick={() => { setRecipient(r); setStep(1); }} style={chipStyle(recipient === r)}>{r}</button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div key="step-occasion" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }} transition={{ duration: 0.2 }} className="flex flex-col gap-2.5">
            <label style={{ fontSize: 9.5, fontWeight: 600, color: "var(--text-primary, #1a1025)" }}>What is the occasion?</label>
            <div className="flex flex-wrap gap-1.5">
              {occasions.map(o => (
                <button key={o} type="button" onClick={() => { setOccasion(o); setStep(2); }} style={chipStyle(occasion === o)}>{o}</button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="step-budget" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }} transition={{ duration: 0.2 }} className="flex flex-col gap-2.5">
            <label style={{ fontSize: 9.5, fontWeight: 600, color: "var(--text-primary, #1a1025)" }}>What is your budget limit?</label>
            <div className="flex flex-wrap gap-1.5">
              {budgets.map(b => (
                <button key={b} type="button" onClick={() => { setBudget(b); setStep(3); }} style={chipStyle(budget === b)}>{b}</button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="step-interests" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }} transition={{ duration: 0.2 }} className="flex flex-col gap-2.5">
            <label style={{ fontSize: 9.5, fontWeight: 600, color: "var(--text-primary, #1a1025)" }}>What are their interests?</label>
            <div className="flex flex-wrap gap-1.5">
              {interests.map(i => (
                <button key={i} type="button" onClick={() => { setInterest(i); if (i !== "Custom Text") { setStep(4); setError(""); } }} style={chipStyle(interest === i)}>{i}</button>
              ))}
            </div>
            {interest === "Custom Text" && (
              <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 8 }}>
                <input type="text" placeholder="Specify interest (e.g. Gardening, Gaming)..." value={customInterest} onChange={e => setCustomInterest(e.target.value)}
                  style={{ width: "100%", padding: "5px 8px", borderRadius: 8, border: "1.5px solid var(--card-border, rgba(64, 41, 112, 0.15))", background: "var(--input-background, #fff)", color: "var(--text-primary, #1a1025)", outline: "none", fontSize: 9.5, boxSizing: "border-box" }} />
                <button type="button" onClick={() => { if (customInterest.trim()) { setStep(4); setError(""); } else { setError("Please specify your custom interest."); } }}
                  style={{ alignSelf: "flex-end", padding: "6px 14px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#7c4dba,#402970)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                  Next →
                </button>
              </div>
            )}
          </motion.div>
        )}

        {step === 4 && (
          <motion.div key="step-location" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }} transition={{ duration: 0.2 }} className="flex flex-col gap-2.5">
            <label style={{ fontSize: 9.5, fontWeight: 600, color: "var(--text-primary, #1a1025)" }}>Where should we deliver? (Optional)</label>
            <input type="text" placeholder="e.g. Colombo, Jaffna..." value={deliveryLocation} onChange={e => setDeliveryLocation(e.target.value)}
              style={{ width: "100%", padding: "5px 8px", borderRadius: 8, border: "1.5px solid var(--card-border, rgba(64, 41, 112, 0.15))", background: "var(--input-background, #fff)", color: "var(--text-primary, #1a1025)", outline: "none", fontSize: 9.5, boxSizing: "border-box" }} />
            <button type="submit" style={{ alignSelf: "center", width: "fit-content", marginTop: 6, padding: "6px 14px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#7c4dba,#402970)", color: "#fff", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, boxShadow: "0 4px 12px rgba(124, 77, 186, 0.25)", fontSize: 11 }}>
              <span>Find Gifts</span> <ArrowRight size={13} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div style={{ color: "#d4183d", fontWeight: 700, display: "flex", alignItems: "center", gap: 4, marginTop: 4, fontSize: "8.5px" }}>
          <AlertCircle size={10} /> {error}
        </div>
      )}

      {step > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(64,41,112,0.06)", paddingTop: 8, marginTop: 4 }}>
          <button type="button" onClick={() => setStep(prev => prev - 1)}
            style={{ padding: "5px 12px", borderRadius: 8, border: "1.5px solid rgba(64,41,112,0.15)", background: "transparent", color: "#7c6a9e", fontSize: 10, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            ← Back
          </button>
        </div>
      )}
    </form>
  );
};

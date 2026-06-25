/**
 * SmartInputPanel — Shell router.
 * Renders the correct panel based on `activeSmartPanel` from AppContext.
 * Each panel is its own file in ./smart-panels/
 */
import React, { useEffect } from "react";
import { motion } from "motion/react";
import { X, Gift, Package, CreditCard } from "lucide-react";
import { useApp } from "../../contexts/AppContext";
import { logPanelEvent } from "../../utils/panelAnalytics";

import { RecommendationForm } from "./RecommendationForm";
import { TrackOrderForm } from "./TrackOrderForm";
import { CheckoutForm } from "./CheckoutForm";

const PANEL_TITLES: Record<string, React.ReactNode> = {
  recommendation: <><Gift size={16} className="text-purple-600" /> 🎁 Find The Perfect Gift</>,
  track_order: <><Package size={16} className="text-purple-600" /> 📦 Track Order</>,
  checkout: <><CreditCard size={16} className="text-purple-600" /> 💳 Checkout Confirmation</>,
};

export const SmartInputPanelShell: React.FC = () => {
  const { activeSmartPanel, setActiveSmartPanel } = useApp();

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
        borderRadius: 12,
        padding: "10px 14px",
        marginBottom: 8,
        boxShadow: "0 8px 24px rgba(64, 41, 112, 0.12)",
        overflow: "hidden",
        width: "100%",
        boxSizing: "border-box",
      }}
      className="smart-input-panel"
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between mb-2 pb-1.5" style={{ borderBottom: "1px solid rgba(64, 41, 112, 0.08)" }}>
        <h3 style={{ color: "var(--text-primary, #1a1025)", fontWeight: 700, fontSize: 11.5, display: "flex", alignItems: "center", gap: 6 }}>
          {PANEL_TITLES[activeSmartPanel]}
        </h3>
        <button
          onClick={() => setActiveSmartPanel(null)}
          style={{ background: "rgba(64, 41, 112, 0.06)", border: "none", borderRadius: 6, width: 22, height: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary, #7c6a9e)", transition: "background 0.2s" }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(64, 41, 112, 0.12)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(64, 41, 112, 0.06)")}
        >
          <X size={12} strokeWidth={2.5} />
        </button>
      </div>

      {/* Panel Body */}
      <div style={{ maxHeight: 220, overflowY: "auto", paddingRight: 4 }} className="custom-scrollbar">
        {activeSmartPanel === "recommendation" && <RecommendationForm />}
        {activeSmartPanel === "track_order" && <TrackOrderForm />}
        {activeSmartPanel === "checkout" && <CheckoutForm />}
      </div>
    </motion.div>
  );
};

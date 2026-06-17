/**
 * SmartInputPanel — Shell router (~90 lines).
 * Renders the correct panel based on `activeSmartPanel` from AppContext.
 * Each panel is its own file in ./smart-panels/
 */
import React, { useEffect } from "react";
import { motion } from "motion/react";
import { X, Gift, Truck, Package, CreditCard, Calendar, MapPin, AlertCircle } from "lucide-react";
import { useApp } from "../../contexts/AppContext";
import { logPanelEvent } from "../../utils/panelAnalytics";

import { RecommendationForm } from "./RecommendationForm";
import { DeliveryForm } from "./DeliveryForm";
import { TrackOrderForm } from "./TrackOrderForm";
import { CheckoutForm } from "./CheckoutForm";
import { DeliveryRecoveryPanel } from "./DeliveryRecoveryPanel";
import { NearbyAddressPanel } from "./NearbyAddressPanel";
import { AlternativeDatePanel } from "./AlternativeDatePanel";

const PANEL_TITLES: Record<string, React.ReactNode> = {
  recommendation: <><Gift size={16} className="text-purple-600" /> 🎁 Find The Perfect Gift</>,
  delivery: <><Truck size={16} className="text-purple-600" /> 🚚 Delivery Information</>,
  track_order: <><Package size={16} className="text-purple-600" /> 📦 Track Order</>,
  checkout: <><CreditCard size={16} className="text-purple-600" /> 💳 Checkout Confirmation</>,
  delivery_recovery: <><AlertCircle size={16} className="text-purple-600" /> 🚚 Delivery Recovery Options</>,
  nearby_address: <><MapPin size={16} className="text-purple-600" /> 📍 Nearby Delivery Form</>,
  alternative_date: <><Calendar size={16} className="text-purple-600" /> 📅 Choose Another Delivery Date</>,
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
      {/* Panel Header */}
      <div className="flex items-center justify-between mb-4 pb-2" style={{ borderBottom: "1px solid rgba(64, 41, 112, 0.08)" }}>
        <h3 style={{ color: "var(--text-primary, #1a1025)", fontWeight: 700, fontSize: 13.5, display: "flex", alignItems: "center", gap: 8 }}>
          {PANEL_TITLES[activeSmartPanel]}
        </h3>
        <button
          onClick={() => setActiveSmartPanel(null)}
          style={{ background: "rgba(64, 41, 112, 0.08)", border: "none", borderRadius: 8, width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary, #7c6a9e)", transition: "background 0.2s" }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(64, 41, 112, 0.15)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(64, 41, 112, 0.08)")}
        >
          <X size={14} strokeWidth={2.5} />
        </button>
      </div>

      {/* Panel Body */}
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

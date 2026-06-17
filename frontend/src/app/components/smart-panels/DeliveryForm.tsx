import React, { useState } from "react";
import { ArrowRight, AlertCircle } from "lucide-react";
import { useApp } from "../../contexts/AppContext";
import { checkDelivery } from "../../services/productServices";
import { logPanelEvent } from "../../utils/panelAnalytics";

export const DeliveryForm: React.FC = () => {
  const { setMessages, setIsTyping, setActivity, setActiveSmartPanel, pendingConfirmProduct } = useApp();

  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [error, setError] = useState("");

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 10,
    border: "1.5px solid var(--card-border, rgba(64, 41, 112, 0.15))",
    background: "var(--input-background, #fff)",
    color: "var(--text-primary, #1a1025)",
    outline: "none",
    boxSizing: "border-box"
  };

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
          <input type="text" placeholder="e.g. Colombo 03, Jaffna" value={city} onChange={e => setCity(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ flex: 0.8 }}>
          <label className="block mb-1 font-bold text-gray-700 dark:text-gray-300">District</label>
          <input type="text" placeholder="e.g. Colombo" value={district} onChange={e => setDistrict(e.target.value)} style={inputStyle} />
        </div>
      </div>

      <div>
        <label className="block mb-1 font-bold text-gray-700 dark:text-gray-300">Preferred Date *</label>
        <input type="date" value={preferredDate} onChange={e => setPreferredDate(e.target.value)} min={new Date().toISOString().split("T")[0]}
          style={{ ...inputStyle, cursor: "pointer" }} />
      </div>

      {error && (
        <div style={{ color: "#d4183d", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <button type="submit" style={{ marginTop: 6, padding: "10px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#7c4dba,#402970)", color: "#fff", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxShadow: "0 4px 12px rgba(124, 77, 186, 0.25)" }}>
        <span>Check Delivery</span> <ArrowRight size={14} />
      </button>
    </form>
  );
};

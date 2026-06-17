import React, { useState } from "react";
import { ArrowRight, AlertCircle } from "lucide-react";
import { useApp } from "../../contexts/AppContext";
import { logPanelEvent } from "../../utils/panelAnalytics";

export const TrackOrderForm: React.FC = () => {
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

      <button type="submit" style={{ marginTop: 6, padding: "10px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#7c4dba,#402970)", color: "#fff", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxShadow: "0 4px 12px rgba(124, 77, 186, 0.25)" }}>
        <span>Track Order</span> <ArrowRight size={14} />
      </button>
    </form>
  );
};

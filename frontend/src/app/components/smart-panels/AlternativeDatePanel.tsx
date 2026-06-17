import React, { useState } from "react";
import { useApp } from "../../contexts/AppContext";
import { checkDelivery } from "../../services/productServices";

export const AlternativeDatePanel: React.FC = () => {
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

  const quickBtnStyle: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1.5px solid var(--card-border, rgba(124, 77, 186, 0.22))",
    background: "rgba(124, 77, 186, 0.05)",
    color: "var(--text-primary, #1a1025)",
    fontWeight: 700,
    cursor: "pointer",
    textAlign: "left" as const,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    transition: "all 0.2s"
  };

  const onHoverIn = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = "rgba(124, 77, 186, 0.12)";
    e.currentTarget.style.borderColor = "rgba(124, 77, 186, 0.4)";
  };

  const onHoverOut = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = "rgba(124, 77, 186, 0.05)";
    e.currentTarget.style.borderColor = "var(--card-border, rgba(124, 77, 186, 0.22))";
  };

  return (
    <div className="flex flex-col gap-3 font-sans text-xs">
      <div className="flex flex-col gap-2">
        <button type="button" onClick={() => handleDateSelect(getTomorrowStr(), "Tomorrow")} style={quickBtnStyle} onMouseEnter={onHoverIn} onMouseLeave={onHoverOut}>
          <div>Tomorrow</div>
          <div style={{ fontSize: 10, color: "var(--text-secondary, #7c6a9e)" }}>{getTomorrowStr()}</div>
        </button>

        <button type="button" onClick={() => handleDateSelect(getNextDayStr(), "Next Day")} style={quickBtnStyle} onMouseEnter={onHoverIn} onMouseLeave={onHoverOut}>
          <div>Next Day</div>
          <div style={{ fontSize: 10, color: "var(--text-secondary, #7c6a9e)" }}>{getNextDayStr()}</div>
        </button>

        <div style={{ borderTop: "1px solid rgba(64,41,112,0.06)", paddingTop: 10, marginTop: 4 }}>
          <label style={{ fontWeight: 600, color: "var(--text-secondary, #7c6a9e)", display: "block", marginBottom: 6 }}>
            Choose Custom Date:
          </label>
          <div className="flex gap-2">
            <input type="date" value={customDate} onChange={e => setCustomDate(e.target.value)} min={new Date().toISOString().split("T")[0]}
              style={{ flex: 1.5, padding: "8px 12px", borderRadius: 10, border: "1.5px solid var(--card-border, rgba(64, 41, 112, 0.15))", background: "var(--input-background, #fff)", color: "var(--text-primary, #1a1025)", outline: "none", cursor: "pointer" }} />
            <button type="button" onClick={() => { if (customDate) { handleDateSelect(customDate, "Custom Date"); } else { setError("Please select a date first."); } }}
              style={{ flex: 1, padding: "8px 12px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#7c4dba,#402970)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
              Select
            </button>
          </div>
          {error && (
            <div style={{ color: "#d4183d", fontWeight: 700, marginTop: 4 }}>{error}</div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button type="button" onClick={() => setActiveSmartPanel("delivery_recovery")}
          style={{ flex: 1, padding: "8px", borderRadius: 10, border: "1.5px solid rgba(64, 41, 112, 0.15)", background: "transparent", color: "#7c6a9e", fontWeight: 700, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );
};

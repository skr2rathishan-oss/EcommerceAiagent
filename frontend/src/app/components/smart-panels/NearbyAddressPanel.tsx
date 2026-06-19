import React, { useState, useEffect } from "react";
import { ArrowRight, AlertCircle } from "lucide-react";
import { useApp } from "../../contexts/AppContext";
import { checkDelivery } from "../../services/productServices";
import { getDefaultSeller } from "../InteractiveOrderSummary";

export const NearbyAddressPanel: React.FC = () => {
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
    if (!recipientName.trim() || !addressLine1.trim() || !city.trim() || !phone.trim() || !preferredDate) {
      setError("Please fill out all required fields (*).");
      return;
    }
    setError("");

    setActiveSmartPanel(null);

    const fullAddress = `${addressLine1}${addressLine2 ? `, ${addressLine2}` : ""}, ${city}`;
    const userDisplayMsg = `Please check delivery to:\nName: ${recipientName}\nPhone: ${phone}\nAddress: ${fullAddress}\nPreferred Date: ${preferredDate}`;

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
              <button key={c} type="button" onClick={() => setCity(c)}
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
                }}>{c}</button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div>
          <label className="block mb-1 font-bold text-gray-700 dark:text-gray-300">Recipient Name *</label>
          <input type="text" placeholder="e.g. Alex Johnson" value={recipientName} onChange={e => setRecipientName(e.target.value)} style={inputStyle} />
        </div>

        <div className="flex gap-2">
          <div style={{ flex: 1 }}>
            <label className="block mb-1 font-bold text-gray-700 dark:text-gray-300">Address Line 1 *</label>
            <input type="text" placeholder="Street or house number" value={addressLine1} onChange={e => setAddressLine1(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="block mb-1 font-bold text-gray-700 dark:text-gray-300">Address Line 2</label>
            <input type="text" placeholder="Apartment, suite, etc. (optional)" value={addressLine2} onChange={e => setAddressLine2(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div className="flex gap-2">
          <div style={{ flex: 1.2 }}>
            <label className="block mb-1 font-bold text-gray-700 dark:text-gray-300">City *</label>
            <input type="text" placeholder="e.g. Jaffna, Colombo" value={city} onChange={e => setCity(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ flex: 0.8 }}>
            <label className="block mb-1 font-bold text-gray-700 dark:text-gray-300">Phone Number *</label>
            <input type="text" placeholder="+94 77 123 4567" value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div>
          <label className="block mb-1 font-bold text-gray-700 dark:text-gray-300">Preferred Date *</label>
          <input type="date" value={preferredDate} onChange={e => setPreferredDate(e.target.value)} min={new Date().toISOString().split("T")[0]}
            style={{ ...inputStyle, cursor: "pointer" }} />
        </div>
      </div>

      {error && (
        <div style={{ color: "#d4183d", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button type="button" onClick={() => setActiveSmartPanel("delivery_recovery")}
          style={{ flex: 1, padding: "10px", borderRadius: 12, border: "1.5px solid rgba(64, 41, 112, 0.15)", background: "transparent", color: "#7c6a9e", fontWeight: 700, cursor: "pointer" }}>
          Cancel
        </button>
        <button type="submit"
          style={{ flex: 2, padding: "10px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#7c4dba,#402970)", color: "#fff", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxShadow: "0 4px 12px rgba(124, 77, 186, 0.25)" }}>
          <span>Submit & Check</span> <ArrowRight size={14} />
        </button>
      </div>
    </form>
  );
};

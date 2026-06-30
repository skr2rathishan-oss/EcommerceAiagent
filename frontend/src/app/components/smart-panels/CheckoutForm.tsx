import React, { useState } from "react";
import { ArrowRight, AlertCircle } from "lucide-react";
import { useApp } from "../../contexts/AppContext";
import { useCart } from "../../contexts/CartContext";
import { type DeliveryInfo, getDefaultSeller } from "../InteractiveOrderSummary";
import { logPanelEvent } from "../../utils/panelAnalytics";
import { apiFetch } from "../../services/api";

export const CheckoutForm: React.FC = () => {
  const { setMessages, setActiveSmartPanel, saveOrderToHistory } = useApp();
  const { cartItems, clearCart } = useCart();

  const [address, setAddress] = useState(() => localStorage.getItem("delivery_street1") || "");
  const [phone, setPhone] = useState(() => localStorage.getItem("delivery_phone") || "+94 77 123 4567");
  const [giftMessage, setGiftMessage] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [error, setError] = useState("");

  const cartTotal = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  const getSessionId = () => sessionStorage.getItem("velora_session_id") || "default";

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "5px 8px",
    borderRadius: 8,
    border: "1.5px solid var(--card-border, rgba(64, 41, 112, 0.15))",
    background: "var(--input-background, #fff)",
    color: "var(--text-primary, #1a1025)",
    outline: "none",
    fontSize: 9.5,
    boxSizing: "border-box"
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim() || !phone.trim() || !deliveryDate) {
      setError("Address, Phone, and Delivery Date are required.");
      return;
    }
    setError("");

    logPanelEvent("checkout", "submitted");
    setActiveSmartPanel(null);

    const deliveryInfo: DeliveryInfo = {
      fullName: localStorage.getItem("delivery_name") || "Alex Johnson",
      phone: phone.trim(),
      email: localStorage.getItem("delivery_email") || "alex@example.com",
      address: address.trim()
    };

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
      recipient: {
        name: deliveryInfo.fullName,
        phone: deliveryInfo.phone,
        email: deliveryInfo.email,
        address: deliveryInfo.address
      },
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
      apiFetch("/api/products/interaction", {
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
        text: `✅ Order Successfully Placed\n\n- **Reference Number**: ${orderDetails.referenceNumber}\n- **Order Number**: ${orderDetails.orderNumber}${giftMessage.trim() ? `\n\n**Gift Message**: "${giftMessage.trim()}"` : ""}`,
        order: orderDetails
      }
    ]);

    clearCart();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 font-sans text-xs">
      <div>
        <label className="block mb-1 font-bold text-gray-700 dark:text-gray-300" style={{ fontSize: "9px" }}>Shipping Address *</label>
        <textarea placeholder="e.g. No 15, Temple Road, Colombo 03" value={address} onChange={e => setAddress(e.target.value)} rows={2}
          style={{ ...inputStyle, resize: "none", lineHeight: 1.4 }} />
      </div>

      <div className="flex gap-3">
        <div style={{ flex: 1 }}>
          <label className="block mb-1 font-bold text-gray-700 dark:text-gray-300" style={{ fontSize: "9px" }}>Phone Number *</label>
          <input type="text" placeholder="e.g. +94 77 123 4567" value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="block mb-1 font-bold text-gray-700 dark:text-gray-300" style={{ fontSize: "9px" }}>Delivery Date *</label>
          <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} min={new Date().toISOString().split("T")[0]}
            style={{ ...inputStyle, cursor: "pointer" }} />
        </div>
      </div>

      <div>
        <label className="block mb-1 font-bold text-gray-700 dark:text-gray-300" style={{ fontSize: "9px" }}>Gift Message (Optional)</label>
        <input type="text" placeholder="e.g. Happy Birthday Mom! Love you." value={giftMessage} onChange={e => setGiftMessage(e.target.value)} style={inputStyle} />
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

      <button type="submit" style={{ alignSelf: "center", width: "fit-content", padding: "6px 14px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #3fc78e, #2a9e6a)", color: "#fff", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxShadow: "0 4px 12px rgba(42, 158, 106, 0.25)", fontSize: 11 }}>
        <span>Place Order</span> <ArrowRight size={14} />
      </button>
    </form>
  );
};

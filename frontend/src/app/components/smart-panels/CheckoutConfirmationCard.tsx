import React from "react";
import { useApp } from "../../contexts/AppContext";
import { useCart } from "../../contexts/CartContext";
import { CheckCircle, ArrowRight, ShoppingBag } from "lucide-react";
import { formatUIPrice } from "../../services/mapping";

export const CheckoutConfirmationCard: React.FC<{ messageIndex: number; onComplete: () => void }> = ({ messageIndex, onComplete }) => {
  const { setMessages, pendingConfirmProduct, lastCheckedDelivery, isCartCheckout } = useApp();
  const { grandTotal } = useCart();

  if (!pendingConfirmProduct || !lastCheckedDelivery) return null;

  const handlePlaceOrder = () => {
    // Reply as user
    setMessages(prev => [...prev, { role: "user", text: isCartCheckout ? "Yes, place the order for my cart." : "Yes, place the order." }]);
    onComplete();
  };

  const productInfo = pendingConfirmProduct || { name: "Product", price: 0 };

  return (
    <div style={{
      padding: "16px",
      borderRadius: "16px",
      border: "1.5px solid rgba(124, 77, 186, 0.2)",
      background: "linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(245, 240, 255, 0.95))",
      boxShadow: "0 8px 24px rgba(64, 41, 112, 0.08)",
      width: "100%",
      maxWidth: "380px",
      marginTop: "12px",
      fontFamily: "'Nunito', sans-serif"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
        <div style={{ width: 36, height: 36, borderRadius: "10px", background: "linear-gradient(135deg,#7c4dba,#402970)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ShoppingBag size={18} color="#fff" />
        </div>
        <div>
          <p style={{ color: "#7c6a9e", fontSize: "10px", fontWeight: 800, margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>Ready to order</p>
          <h4 style={{ color: "#1a1025", fontSize: "14px", fontWeight: 750, margin: "2px 0 0 0" }}>Order Summary</h4>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "12px", background: "#fff", borderRadius: "12px", border: "1px solid rgba(64, 41, 112, 0.08)" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: "12px", color: "#7c6a9e", fontWeight: 600 }}>{isCartCheckout ? "Items" : "Product"}</span>
          <span style={{ fontSize: "12px", color: "#1a1025", fontWeight: 700 }}>{productInfo.name}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: "12px", color: "#7c6a9e", fontWeight: 600 }}>Total</span>
          <span style={{ fontSize: "12px", color: "#7c4dba", fontWeight: 800 }}>{formatUIPrice(isCartCheckout ? grandTotal : productInfo.price, productInfo.currency)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: "12px", color: "#7c6a9e", fontWeight: 600 }}>City</span>
          <span style={{ fontSize: "12px", color: "#1a1025", fontWeight: 700 }}>{lastCheckedDelivery.city}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: "12px", color: "#7c6a9e", fontWeight: 600 }}>Date</span>
          <span style={{ fontSize: "12px", color: "#1a1025", fontWeight: 700 }}>{lastCheckedDelivery.deliveryDate}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: "12px", color: "#7c6a9e", fontWeight: 600 }}>Delivery Fee</span>
          <span style={{ fontSize: "12px", color: "#1a1025", fontWeight: 700 }}>Included</span>
        </div>
      </div>

      <button
        onClick={handlePlaceOrder}
        style={{
          marginTop: "16px",
          width: "100%",
          display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "12px 16px",
          borderRadius: "12px", border: "none",
          background: "linear-gradient(135deg, #3fc78e, #2a9e6a)", color: "#fff",
          fontSize: "14px", fontWeight: 750, cursor: "pointer",
          boxShadow: "0 4px 12px rgba(63, 199, 142, 0.3)"
        }}
      >
        Place Order <CheckCircle size={16} />
      </button>
    </div>
  );
};

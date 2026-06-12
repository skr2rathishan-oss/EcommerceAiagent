import { motion } from "motion/react";
import { User, Phone, Mail, MapPin, Package, CheckCircle } from "lucide-react";
import type { DeliveryInfo } from "./CheckoutPanel";
import type { Product } from "./products";

interface CartItem {
  product: Product;
  qty: number;
}

interface Props {
  info: DeliveryInfo;
  items: CartItem[];
}

export function OrderSummaryCard({ info, items }: Props) {
  const cartTotal = items.reduce((sum, i) => sum + i.product.price * i.qty, 0);
  const itemCount = items.reduce((sum, i) => sum + i.qty, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      style={{
        background: "#fff",
        borderRadius: 16,
        border: "1.5px solid rgba(63,199,142,0.3)",
        boxShadow: "0 8px 30px rgba(63,199,142,0.12)",
        overflow: "hidden",
        width: "100%",
        maxWidth: 420,
        marginTop: 12,
      }}
    >
      {/* Header */}
      <div style={{ padding: "16px 20px", background: "linear-gradient(135deg,rgba(63,199,142,0.15),rgba(42,158,106,0.05))", borderBottom: "1px solid rgba(63,199,142,0.2)", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#3fc78e", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0, boxShadow: "0 4px 12px rgba(63,199,142,0.4)" }}>
          <CheckCircle size={20} strokeWidth={2.5} />
        </div>
        <div>
          <h3 style={{ color: "#1a1025", fontSize: 16, fontWeight: 800, fontFamily: "'Nunito',sans-serif", margin: 0 }}>Order Confirmed</h3>
          <p style={{ color: "#2a9e6a", fontSize: 12, fontWeight: 600, fontFamily: "'Nunito',sans-serif", margin: "2px 0 0 0" }}>Thank you for your purchase!</p>
        </div>
      </div>

      <div style={{ padding: "20px" }}>
        {/* Delivery Info */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ color: "#7c6a9e", fontSize: 10, fontWeight: 800, fontFamily: "'Nunito',sans-serif", letterSpacing: "0.06em", marginBottom: 12, textTransform: "uppercase" }}>Delivery Details</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { icon: User, value: info.fullName },
              { icon: Phone, value: info.phone },
              { icon: Mail, value: info.email },
              { icon: MapPin, value: info.address },
            ].map((detail, idx) => {
              const Icon = detail.icon;
              return (
                <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{ color: "#9e8dc0", marginTop: 2 }}><Icon size={14} strokeWidth={2.5} /></span>
                  <span style={{ color: "#1a1025", fontSize: 13, fontWeight: 600, fontFamily: "'Nunito',sans-serif", lineHeight: 1.4, wordBreak: "break-word" }}>{detail.value}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ height: 1, background: "rgba(64,41,112,0.08)", marginBottom: 20 }} />

        {/* Items */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ color: "#7c6a9e", fontSize: 10, fontWeight: 800, fontFamily: "'Nunito',sans-serif", letterSpacing: "0.06em", marginBottom: 12, textTransform: "uppercase" }}>Order Items ({itemCount})</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {items.map((item, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 10, background: "linear-gradient(135deg,#f5f0ff,#ede4ff)", overflow: "hidden", flexShrink: 0 }}>
                  <img src={item.product.images[0]} alt={item.product.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: "#1a1025", fontSize: 13, fontWeight: 700, fontFamily: "'Nunito',sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>{item.product.name}</p>
                  <p style={{ color: "#7c6a9e", fontSize: 11, fontFamily: "'Nunito',sans-serif", margin: "2px 0 0 0" }}>Qty: {item.qty} &nbsp;·&nbsp; ${item.product.price.toFixed(2)}</p>
                </div>
                <div style={{ color: "#402970", fontSize: 13, fontWeight: 800, fontFamily: "'Nunito',sans-serif", flexShrink: 0 }}>
                  ${(item.product.price * item.qty).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Total */}
        <div style={{ padding: "14px 16px", background: "rgba(64,41,112,0.03)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: "#1a1025", fontSize: 14, fontWeight: 800, fontFamily: "'Nunito',sans-serif" }}>Total Paid</span>
          <span style={{ color: "#3fc78e", fontSize: 18, fontWeight: 900, fontFamily: "'Nunito',sans-serif" }}>${cartTotal.toFixed(2)}</span>
        </div>
      </div>
    </motion.div>
  );
}

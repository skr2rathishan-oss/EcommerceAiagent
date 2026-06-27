import { useState } from "react";
import { motion } from "motion/react";
import {
  CheckCircle, Check, Copy, ShoppingBag, User,
  MapPin, Truck, ExternalLink
} from "lucide-react";
import { formatUIPrice } from "../services/mapping";

export interface OrderConfirmationDetails {
  referenceNumber: string;
  orderNumber: string;
  orderDate: string;
  estimatedDelivery: string;
  paymentStatus: string;
  paymentUrl?: string;
  recipient: {
    name: string;
    phone: string;
    email: string;
    address: string;
  };
  items: Array<{
    id: string;
    name: string;
    image: string;
    qty: number;
    price: number;
    currency?: string;
  }>;
  summary: {
    subtotal: number;
    deliveryCharge: number;
    discount: number;
    total: number;
  };
}

interface Props {
  order: OrderConfirmationDetails;
  onContinueShopping?: () => void;
  onTrackOrder?: (orderNumber: string) => void;
}

const STEPPER_LABELS = [
  "Received",
  "Preparing",
  "Shipped",
  "Delivered"
];

export function OrderConfirmationCard({ order, onContinueShopping, onTrackOrder }: Props) {
  const [copied, setCopied] = useState(false);
  const [trackerStep, setTrackerStep] = useState(0); // Mock delivery tracking: 0 to 3
  const [trackingAlert, setTrackingAlert] = useState("");

  const handleCopyReference = () => {
    navigator.clipboard.writeText(order.referenceNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTrackOrder = () => {
    if (onTrackOrder) {
      onTrackOrder(order.orderNumber);
    } else {
      if (trackerStep < 3) {
        const next = trackerStep + 1;
        setTrackerStep(next);
        setTrackingAlert(`🚚 shipment: ${STEPPER_LABELS[next]}`);
        setTimeout(() => setTrackingAlert(""), 3500);
      } else {
        setTrackingAlert("✅ Delivered!");
        setTimeout(() => setTrackingAlert(""), 3500);
      }
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      style={{
        background: "#ffffff",
        borderRadius: 16,
        border: "1.5px solid rgba(63, 199, 142, 0.25)",
        boxShadow: "0 10px 30px rgba(42, 158, 106, 0.08), 0 2px 8px rgba(0, 0, 0, 0.02)",
        overflow: "hidden",
        width: "100%",
        maxWidth: "840px",
        marginTop: 12,
        fontFamily: "'Nunito', sans-serif",
        boxSizing: "border-box",
        position: "relative"
      }}
    >
      {/* Decorative Top Bar */}
      <div style={{ height: 5, background: "linear-gradient(90deg, #3fc78e, #2a9e6a)" }} />

      {/* Ticket Body: Side-by-Side Flex Layout */}
      <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap" }}>
        
        {/* Left Side: Order & Delivery details (70% width) */}
        <div style={{ flex: "1 1 500px", padding: "20px 24px", boxSizing: "border-box" }}>
          
          {/* Header row */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: "rgba(63, 199, 142, 0.12)",
              color: "#2a9e6a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <CheckCircle size={22} strokeWidth={2.5} />
            </div>
            <div>
              <h3 style={{ color: "#1a1025", fontSize: 16, fontWeight: 900, margin: 0 }}>🎉 Order Confirmed</h3>
              <p style={{ color: "#7c6a9e", fontSize: 11.5, margin: 0 }}>Your order has been placed successfully.</p>
            </div>
          </div>

          {/* Dotted Divider */}
          <div style={{ borderTop: "1.5px dotted rgba(64, 41, 112, 0.1)", margin: "12px 0" }} />

          {/* Horizontal Metadata Row */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
            background: "rgba(64, 41, 112, 0.02)",
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid rgba(64, 41, 112, 0.04)",
            fontSize: 11.5,
            marginBottom: 16
          }}>
            <div>
              <span style={{ color: "#7c6a9e", display: "block", fontSize: 9, fontWeight: 800, letterSpacing: "0.04em" }}>REFERENCE NO</span>
              <span style={{ color: "#1a1025", fontWeight: 700, fontFamily: "monospace", fontSize: 11.5 }}>{order.referenceNumber}</span>
            </div>
            <div>
              <span style={{ color: "#7c6a9e", display: "block", fontSize: 9, fontWeight: 800, letterSpacing: "0.04em" }}>ORDER NO</span>
              <span style={{ color: "#1a1025", fontWeight: 700, fontFamily: "monospace", fontSize: 11.5 }}>{order.orderNumber}</span>
            </div>
            <div>
              <span style={{ color: "#7c6a9e", display: "block", fontSize: 9, fontWeight: 800, letterSpacing: "0.04em" }}>EST. DELIVERY</span>
              <span style={{ color: "#402970", fontWeight: 700 }}>{order.estimatedDelivery}</span>
            </div>
          </div>

          {/* Horizontal Items Ordered strip */}
          <div style={{ marginBottom: 16 }}>
            <div style={{
              display: "flex",
              gap: 8,
              overflowX: "auto",
              paddingBottom: 6,
              boxSizing: "border-box"
            }}>
              {order.items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "4px 8px",
                    background: "rgba(64, 41, 112, 0.03)",
                    border: "1px solid rgba(64, 41, 112, 0.06)",
                    borderRadius: 8,
                    flexShrink: 0,
                    fontSize: 11,
                  }}
                >
                  <img src={item.image} alt={item.name} style={{ width: 22, height: 22, borderRadius: 4, objectFit: "cover" }} />
                  <span style={{ color: "#1a1025", fontWeight: 700 }}>{item.qty}x {item.name.length > 15 ? item.name.slice(0, 15) + "…" : item.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recipient Details: Single Line Compact format */}
          <div style={{
            fontSize: 11,
            color: "#7c6a9e",
            background: "rgba(64, 41, 112, 0.01)",
            border: "1px dashed rgba(64, 41, 112, 0.08)",
            padding: "8px 12px",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 16
          }}>
            <User size={13} color="#9e8dc0" />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <strong>Ship to:</strong> {order.recipient.name} ({order.recipient.phone}) · <em>{order.recipient.address}</em>
            </span>
          </div>

          {/* Compact Stepper */}
          <div>
            {trackingAlert && (
              <div style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#2a9e6a",
                textAlign: "center",
                marginBottom: 6
              }}>
                {trackingAlert}
              </div>
            )}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              position: "relative",
              padding: "0 8px",
              height: 36
            }}>
              {/* Stepper connector lines */}
              <div style={{ position: "absolute", top: 12, left: 16, right: 16, height: 2, background: "rgba(64, 41, 112, 0.06)", zIndex: 0 }} />
              <div style={{
                position: "absolute",
                top: 12,
                left: 16,
                width: `${(trackerStep / 3) * 90}%`,
                height: 2,
                background: "linear-gradient(90deg, #3fc78e, #2a9e6a)",
                transition: "width 0.4s ease-out",
                zIndex: 1
              }} />

              {STEPPER_LABELS.map((label, idx) => {
                const active = idx <= trackerStep;
                return (
                  <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 2, width: 56 }}>
                    <div style={{
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      background: active ? "linear-gradient(135deg, #3fc78e, #2a9e6a)" : "#ffffff",
                      border: `1.5px solid ${active ? "#2a9e6a" : "rgba(64, 41, 112, 0.15)"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                      {active && <Check size={8} color="#fff" strokeWidth={3} />}
                    </div>
                    <span style={{
                      fontSize: 8.5,
                      fontWeight: active ? 800 : 600,
                      color: active ? "#2a9e6a" : "#9e8dc0",
                      marginTop: 4,
                      whiteSpace: "nowrap"
                    }}>
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Vertical Dotted Divider with Notches (Desktop Only, handled by container relative notches) */}
        <div style={{
          position: "absolute",
          top: -8,
          right: "260px",
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "#f8f6fc", // Matches typical background
          border: "1.5px solid rgba(63, 199, 142, 0.25)",
          borderTopColor: "transparent",
          borderLeftColor: "transparent",
          transform: "rotate(45deg)",
          zIndex: 3
        }} />
        <div style={{
          position: "absolute",
          bottom: -8,
          right: "260px",
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "#f8f6fc",
          border: "1.5px solid rgba(63, 199, 142, 0.25)",
          borderBottomColor: "transparent",
          borderRightColor: "transparent",
          transform: "rotate(45deg)",
          zIndex: 3
        }} />

        {/* Right Side: Price Stub & Actions (30% width) */}
        <div style={{
          flex: "1 0 240px",
          padding: "20px",
          boxSizing: "border-box",
          background: "rgba(64, 41, 112, 0.015)",
          borderLeft: "1.5px dashed rgba(64, 41, 112, 0.08)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}>
          {/* Total Amount box */}
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <span style={{ color: "#7c6a9e", fontSize: 10, fontWeight: 800, letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>TOTAL AMOUNT</span>
            <span style={{ color: "#402970", fontSize: 22, fontWeight: 900 }}>{formatUIPrice(order.summary.total, order.items[0]?.currency)}</span>
            
            <div style={{ marginTop: 6 }}>
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                color: "#2a9e6a",
                fontWeight: 800,
                background: "rgba(63,199,142,0.12)",
                padding: "2px 8px",
                borderRadius: 4,
                fontSize: 10
              }}>
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#3fc78e" }} /> {order.paymentStatus}
              </span>
            </div>
          </div>

          {/* Action buttons list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              type="button"
              onClick={handleTrackOrder}
              style={{
                padding: "8px",
                borderRadius: 8,
                border: "none",
                background: "linear-gradient(135deg,#7c4dba,#402970)",
                color: "#fff",
                fontSize: 11,
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(64, 41, 112, 0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                fontFamily: "'Nunito', sans-serif"
              }}
            >
              <Truck size={13} />
              Track Status
            </button>

            {order.paymentUrl && (
              <a
                href={order.paymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: "8px",
                  borderRadius: 8,
                  border: "none",
                  background: "linear-gradient(135deg, #f59e0b, #d97706)",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  fontFamily: "'Nunito', sans-serif",
                  textDecoration: "none",
                  boxShadow: "0 2px 6px rgba(245,158,11,0.2)",
                }}
              >
                <ExternalLink size={13} />
                Pay Now
              </a>
            )}

            <button
              type="button"
              onClick={handleCopyReference}
              style={{
                padding: "8px",
                borderRadius: 8,
                border: "none",
                background: copied ? "linear-gradient(135deg, #3fc78e, #2a9e6a)" : "linear-gradient(135deg, #a78bfa, #7c4dba)",
                color: "#fff",
                fontSize: 11,
                fontWeight: 800,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                fontFamily: "'Nunito', sans-serif",
                transition: "background 0.3s"
              }}
            >
              {copied ? <Check size={12} strokeWidth={2.5} /> : <Copy size={12} />}
              {copied ? "Copied!" : "Copy Reference"}
            </button>

            <button
              type="button"
              onClick={onContinueShopping}
              style={{
                padding: "8px",
                borderRadius: 8,
                border: "1.5px solid rgba(64, 41, 112, 0.15)",
                background: "transparent",
                color: "#402970",
                fontSize: 11,
                fontWeight: 800,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                fontFamily: "'Nunito', sans-serif"
              }}
            >
              <ShoppingBag size={12} />
              Continue Shopping
            </button>
          </div>

        </div>

      </div>
    </motion.div>
  );
}

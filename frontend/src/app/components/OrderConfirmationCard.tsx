import { useState } from "react";
import { motion } from "motion/react";
import {
  CheckCircle, Check, Copy, ShoppingBag, User,
  Phone, Mail, MapPin, Truck, Calendar, Hash, ExternalLink
} from "lucide-react";

export interface OrderConfirmationDetails {
  referenceNumber: string;
  orderNumber: string;
  orderDate: string;
  estimatedDelivery: string;
  paymentStatus: string;
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
}

const STEPPER_LABELS = [
  "Order Received",
  "Preparing Order",
  "Out For Delivery",
  "Delivered"
];

export function OrderConfirmationCard({ order, onContinueShopping }: Props) {
  const [copied, setCopied] = useState(false);
  const [trackerStep, setTrackerStep] = useState(0); // Mock delivery tracking: 0 to 3
  const [trackingAlert, setTrackingAlert] = useState("");

  const handleCopyReference = () => {
    navigator.clipboard.writeText(order.referenceNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTrackOrder = () => {
    if (trackerStep < 3) {
      const next = trackerStep + 1;
      setTrackerStep(next);
      setTrackingAlert(`🚚 Shipment Status Updated: ${STEPPER_LABELS[next]}`);
      setTimeout(() => setTrackingAlert(""), 3500);
    } else {
      setTrackingAlert("✅ Your package has been delivered!");
      setTimeout(() => setTrackingAlert(""), 3500);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      style={{
        background: "#ffffff",
        borderRadius: 20,
        border: "1.5px solid rgba(63, 199, 142, 0.25)",
        boxShadow: "0 10px 30px rgba(42, 158, 106, 0.08), 0 2px 8px rgba(0, 0, 0, 0.02)",
        overflow: "hidden",
        width: "100%",
        maxWidth: "580px",
        marginTop: 12,
        fontFamily: "'Nunito', sans-serif",
        boxSizing: "border-box",
      }}
    >
      {/* Receipt Top Header Decorative Bar */}
      <div style={{ height: 6, background: "linear-gradient(90deg, #3fc78e, #2a9e6a)" }} />

      <div style={{ padding: "20px 24px" }}>
        {/* Success Icon & Title */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 20 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "rgba(63, 199, 142, 0.12)",
            color: "#2a9e6a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 10,
          }}>
            <CheckCircle size={28} strokeWidth={2.5} />
          </div>
          <h3 style={{ color: "#1a1025", fontSize: 18, fontWeight: 900, margin: 0 }}>🎉 Order Confirmed</h3>
          <p style={{ color: "#7c6a9e", fontSize: 12.5, margin: "4px 0 0 0" }}>Thank you! Your order has been placed successfully.</p>
        </div>

        {/* Dotted Divider */}
        <div style={{ borderTop: "2px dotted rgba(64, 41, 112, 0.12)", margin: "16px 0" }} />

        {/* Order Details Metadata */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px 16px",
          background: "rgba(64, 41, 112, 0.02)",
          padding: "12px 14px",
          borderRadius: 12,
          border: "1px solid rgba(64, 41, 112, 0.05)",
          fontSize: 12,
        }}>
          <div>
            <span style={{ color: "#7c6a9e", display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.04em" }}>REFERENCE NUMBER</span>
            <span style={{ color: "#1a1025", fontWeight: 700, fontFamily: "monospace", fontSize: 12 }}>{order.referenceNumber}</span>
          </div>
          <div>
            <span style={{ color: "#7c6a9e", display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.04em" }}>ORDER NUMBER</span>
            <span style={{ color: "#1a1025", fontWeight: 700, fontFamily: "monospace", fontSize: 12 }}>{order.orderNumber}</span>
          </div>
          <div>
            <span style={{ color: "#7c6a9e", display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.04em" }}>ORDER DATE</span>
            <span style={{ color: "#1a1025", fontWeight: 600 }}>{order.orderDate}</span>
          </div>
          <div>
            <span style={{ color: "#7c6a9e", display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.04em" }}>ESTIMATED DELIVERY</span>
            <span style={{ color: "#402970", fontWeight: 700 }}>{order.estimatedDelivery}</span>
          </div>
          <div>
            <span style={{ color: "#7c6a9e", display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.04em" }}>PAYMENT STATUS</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#2a9e6a", fontWeight: 800, background: "rgba(63,199,142,0.12)", padding: "1px 6px", borderRadius: 4, fontSize: 11 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#3fc78e" }} /> {order.paymentStatus}
            </span>
          </div>
        </div>

        {/* Recipient Details */}
        <div style={{ marginTop: 20 }}>
          <h4 style={{ color: "#1a1025", fontSize: 12.5, fontWeight: 800, margin: "0 0 10px 0", display: "flex", alignItems: "center", gap: 6 }}>
            <User size={15} color="#7c6a9e" /> Recipient Details
          </h4>
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: "12px 14px",
            border: "1.5px solid rgba(64, 41, 112, 0.08)",
            borderRadius: 14,
            fontSize: 12,
            color: "#7c6a9e",
          }}>
            <div style={{ display: "flex", gap: 4 }}><span style={{ fontWeight: 700, minWidth: 60 }}>Name:</span><span style={{ color: "#1a1025", fontWeight: 600 }}>{order.recipient.name}</span></div>
            <div style={{ display: "flex", gap: 4 }}><span style={{ fontWeight: 700, minWidth: 60 }}>Phone:</span><span style={{ color: "#1a1025", fontWeight: 600 }}>{order.recipient.phone}</span></div>
            <div style={{ display: "flex", gap: 4 }}><span style={{ fontWeight: 700, minWidth: 60 }}>Email:</span><span style={{ color: "#1a1025", fontWeight: 600 }}>{order.recipient.email}</span></div>
            <div style={{ display: "flex", gap: 4 }}><span style={{ fontWeight: 700, minWidth: 60 }}>Address:</span><span style={{ color: "#1a1025", fontWeight: 600, lineHeight: 1.4 }}>{order.recipient.address}</span></div>
          </div>
        </div>

        {/* Items Ordered */}
        <div style={{ marginTop: 20 }}>
          <h4 style={{ color: "#1a1025", fontSize: 12.5, fontWeight: 800, margin: "0 0 10px 0", display: "flex", alignItems: "center", gap: 6 }}>
            <ShoppingBag size={15} color="#7c6a9e" /> Items Ordered
          </h4>
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            border: "1.5px solid rgba(64, 41, 112, 0.08)",
            borderRadius: 14,
            overflow: "hidden",
          }}>
            {order.items.map((item, index) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  background: index % 2 === 0 ? "#fff" : "rgba(64, 41, 112, 0.01)",
                  borderBottom: index < order.items.length - 1 ? "1px solid rgba(64, 41, 112, 0.06)" : "none",
                }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: "linear-gradient(135deg,#f5f0ff,#ede4ff)", border: "1px solid rgba(64, 41, 112, 0.05)" }}>
                  <img src={item.image} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: "#1a1025", fontSize: 12, fontWeight: 700, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</p>
                  <span style={{ color: "#9e8dc0", fontSize: 10, fontWeight: 600 }}>Qty: {item.qty} · Price: ${item.price.toFixed(2)}</span>
                </div>
                <span style={{ color: "#402970", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                  ${(item.price * item.qty).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Summary */}
        <div style={{ marginTop: 20 }}>
          <div style={{
            padding: "12px 14px",
            borderRadius: 14,
            background: "rgba(64, 41, 112, 0.03)",
            border: "1.5px solid rgba(64, 41, 112, 0.06)",
            fontSize: 12,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ color: "#7c6a9e" }}>Subtotal</span>
              <span style={{ color: "#1a1025", fontWeight: 600 }}>${order.summary.subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ color: "#7c6a9e" }}>Delivery Charge</span>
              <span style={{ color: "#2a9e6a", fontWeight: 700 }}>FREE</span>
            </div>
            {order.summary.discount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "#d4183d" }}>Discount</span>
                <span style={{ color: "#d4183d", fontWeight: 600 }}>-${order.summary.discount.toFixed(2)}</span>
              </div>
            )}
            <div style={{ height: 1, background: "rgba(64, 41, 112, 0.1)", margin: "8px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#1a1025", fontSize: 13, fontWeight: 800 }}>Total Amount</span>
              <span style={{ color: "#402970", fontSize: 16, fontWeight: 900 }}>${order.summary.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Delivery Progress Stepper */}
        <div style={{ marginTop: 20 }}>
          <h4 style={{ color: "#1a1025", fontSize: 12.5, fontWeight: 800, margin: "0 0 12px 0", display: "flex", alignItems: "center", gap: 6 }}>
            <Truck size={15} color="#7c6a9e" /> Delivery Progress
          </h4>

          {trackingAlert && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#2a9e6a",
                background: "rgba(63, 199, 142, 0.08)",
                border: "1px solid rgba(63, 199, 142, 0.2)",
                padding: "6px 10px",
                borderRadius: 8,
                marginBottom: 10,
                textAlign: "center"
              }}
            >
              {trackingAlert}
            </motion.div>
          )}

          {/* Horizontal Stepper container */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "relative",
            padding: "0 10px",
            marginTop: 8
          }}>
            {/* Background Line Connector */}
            <div style={{
              position: "absolute",
              top: 10,
              left: 20,
              right: 20,
              height: 2.5,
              background: "rgba(64, 41, 112, 0.08)",
              zIndex: 0,
            }} />
            
            {/* Active Line Fill */}
            <div style={{
              position: "absolute",
              top: 10,
              left: 20,
              width: `${(trackerStep / 3) * 88}%`,
              height: 2.5,
              background: "linear-gradient(90deg, #3fc78e, #2a9e6a)",
              transition: "width 0.4s ease-out",
              zIndex: 1,
            }} />

            {STEPPER_LABELS.map((label, idx) => {
              const active = idx <= trackerStep;
              return (
                <div key={label} style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  position: "relative",
                  zIndex: 2,
                  width: 65,
                }}>
                  {/* Step Bubble */}
                  <div style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: active ? "linear-gradient(135deg, #3fc78e, #2a9e6a)" : "#ffffff",
                    border: `2px solid ${active ? "#2a9e6a" : "rgba(64, 41, 112, 0.15)"}`,
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: active ? "0 2px 6px rgba(42, 158, 106, 0.25)" : "none",
                    transition: "background 0.3s, border-color 0.3s",
                  }}>
                    {active && <Check size={10} strokeWidth={3} />}
                  </div>
                  
                  {/* Step Label */}
                  <span style={{
                    fontSize: 8.5,
                    fontWeight: active ? 800 : 600,
                    color: active ? "#2a9e6a" : "#9e8dc0",
                    marginTop: 6,
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    fontFamily: "'Nunito', sans-serif",
                    letterSpacing: "-0.01em"
                  }}>
                    {label.split(" ")[0]}
                    <br />
                    {label.split(" ")[1] || ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Receipt Action Buttons */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginTop: 24
        }}>
          <button
            type="button"
            onClick={handleTrackOrder}
            style={{
              padding: "10px",
              borderRadius: 10,
              border: "none",
              background: "linear-gradient(135deg,#7c4dba,#402970)",
              color: "#fff",
              fontSize: 11.5,
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(64, 41, 112, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              fontFamily: "'Nunito', sans-serif"
            }}
          >
            <Truck size={13} />
            Track Order
          </button>
          <button
            type="button"
            onClick={handlePrintReceipt}
            style={{
              padding: "10px",
              borderRadius: 10,
              border: "1.5px solid rgba(64, 41, 112, 0.15)",
              background: "transparent",
              color: "#402970",
              fontSize: 11.5,
              fontWeight: 800,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              fontFamily: "'Nunito', sans-serif"
            }}
          >
            <ExternalLink size={13} />
            View Full Receipt
          </button>
          <button
            type="button"
            onClick={onContinueShopping}
            style={{
              padding: "10px",
              borderRadius: 10,
              border: "1.5px solid rgba(64, 41, 112, 0.15)",
              background: "transparent",
              color: "#402970",
              fontSize: 11.5,
              fontWeight: 800,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              fontFamily: "'Nunito', sans-serif"
            }}
          >
            <ShoppingBag size={13} />
            Continue Shopping
          </button>
          <button
            type="button"
            onClick={handleCopyReference}
            style={{
              padding: "10px",
              borderRadius: 10,
              border: "none",
              background: copied ? "linear-gradient(135deg, #3fc78e, #2a9e6a)" : "linear-gradient(135deg, #a78bfa, #7c4dba)",
              color: "#fff",
              fontSize: 11.5,
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(124, 77, 186, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              fontFamily: "'Nunito', sans-serif",
              transition: "background 0.3s"
            }}
          >
            {copied ? <Check size={13} strokeWidth={2.5} /> : <Copy size={13} />}
            {copied ? "Copied!" : "Copy Reference"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Truck, Calendar, Hash, User, MapPin, Loader2,
  AlertTriangle, Check, Copy, ShoppingBag, RefreshCw
} from "lucide-react";
import type { OrderTrackingDetails } from "../types/orderTracking";
import { apiFetch } from "../services/api";

interface Props {
  orderNumber: string;
  initialTracking?: OrderTrackingDetails;
  onContinueShopping?: () => void;
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = d.getDate();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
};

export function OrderTrackingCard({ orderNumber, initialTracking, onContinueShopping }: Props) {
  const [tracking, setTracking] = useState<OrderTrackingDetails | null>(initialTracking || null);
  const [loading, setLoading] = useState(!initialTracking);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const fetchTracking = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/orders/track", {
        method: "POST",
        body: JSON.stringify({ orderNumber })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Unable to retrieve order status");
      }
      const data = await res.json();
      setTracking(data);
      const now = new Date();
      setLastUpdated(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Unable to retrieve order status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialTracking) {
      fetchTracking();
    } else {
      const now = new Date();
      setLastUpdated(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }
  }, [orderNumber]);

  const handleCopy = () => {
    navigator.clipboard.writeText(orderNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div style={{
        background: "#ffffff",
        borderRadius: 20,
        border: "1.5px solid rgba(124, 77, 186, 0.15)",
        boxShadow: "0 6px 20px rgba(64, 41, 112, 0.05)",
        padding: "20px 24px",
        width: "100%",
        maxWidth: "520px",
        marginTop: 10,
        fontFamily: "'Nunito', sans-serif"
      }}>
        {/* Header Skeleton */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(64,41,112,0.08)" }} />
          <div style={{ width: 140, height: 18, borderRadius: 4, background: "rgba(64,41,112,0.08)" }} />
        </div>
        {/* Content Skeleton */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
          <div style={{ width: "80%", height: 14, borderRadius: 4, background: "rgba(64,41,112,0.05)" }} />
          <div style={{ width: "60%", height: 14, borderRadius: 4, background: "rgba(64,41,112,0.05)" }} />
          <div style={{ width: "40%", height: 14, borderRadius: 4, background: "rgba(64,41,112,0.05)" }} />
        </div>
        {/* Loading Spinner */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "10px 0" }}>
          <Loader2 className="animate-spin" size={24} color="#7c4dba" />
          <span style={{ marginLeft: 8, color: "#7c6a9e", fontSize: 13, fontWeight: 600 }}>Retrieving live shipment data...</span>
        </div>
      </div>
    );
  }

  if (error || !tracking) {
    return (
      <div style={{
        background: "#ffffff",
        borderRadius: 20,
        border: "1.5px solid rgba(212, 24, 61, 0.25)",
        boxShadow: "0 6px 20px rgba(212, 24, 61, 0.05)",
        padding: "20px 24px",
        width: "100%",
        maxWidth: "520px",
        marginTop: 10,
        fontFamily: "'Nunito', sans-serif",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12
      }}>
        <AlertTriangle size={36} color="#d4183d" />
        <h4 style={{ color: "#1a1025", fontSize: 15, fontWeight: 700, margin: 0 }}>❌ Unable to retrieve order status</h4>
        <p style={{ color: "#7c6a9e", fontSize: 12.5, margin: 0, lineHeight: 1.45 }}>
          {error || "We couldn't connect to the Kapruka tracking service. Please make sure the order number is correct and try again."}
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button
            type="button"
            onClick={fetchTracking}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: "linear-gradient(135deg,#7c4dba,#402970)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(64,41,112,0.15)"
            }}
          >
            Retry Tracking
          </button>
          {onContinueShopping && (
            <button
              type="button"
              onClick={onContinueShopping}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1.5px solid rgba(64,41,112,0.15)",
                background: "transparent",
                color: "#402970",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              Continue Shopping
            </button>
          )}
        </div>
      </div>
    );
  }

  // Pre-process step names to fit requirements
  const getStepLabel = (stepName: string) => {
    if (stepName.toLowerCase().includes("receive")) return "Order Received";
    if (stepName.toLowerCase().includes("confirm")) return "Confirmed";
    if (stepName.toLowerCase().includes("prepare") || stepName.toLowerCase().includes("prepar")) return "Preparing Order";
    if (stepName.toLowerCase().includes("out for") || stepName.toLowerCase().includes("delivery")) {
      if (stepName.toLowerCase().includes("delivered")) return "Delivered";
      return "Out For Delivery";
    }
    return stepName;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      style={{
        background: "#ffffff",
        borderRadius: 20,
        border: "1.5px solid rgba(124, 77, 186, 0.22)",
        boxShadow: "0 8px 24px rgba(64, 41, 112, 0.08)",
        overflow: "hidden",
        width: "100%",
        maxWidth: "520px",
        marginTop: 10,
        fontFamily: "'Nunito', sans-serif",
        boxSizing: "border-box"
      }}
    >
      {/* Receipts Top Line */}
      <div style={{ height: 5, background: "linear-gradient(90deg, #7c4dba, #402970)" }} />

      <div style={{ padding: "18px 20px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <div style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "rgba(124,77,186,0.1)",
            color: "#7c4dba",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <Truck size={15} strokeWidth={2.2} />
          </div>
          <span style={{ color: "#1a1025", fontSize: 13.5, fontWeight: 800 }}>📦 Order Tracking</span>
        </div>

        {/* Tracking Details Metadata */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "10px 14px",
          background: "rgba(64, 41, 112, 0.02)",
          padding: "12px 14px",
          borderRadius: 12,
          border: "1px solid rgba(64, 41, 112, 0.05)",
          fontSize: 11.5,
          marginBottom: 16
        }}>
          <div>
            <span style={{ color: "#7c6a9e", display: "block", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.04em" }}>ORDER NUMBER</span>
            <span style={{ color: "#1a1025", fontWeight: 700, fontFamily: "monospace", fontSize: 11.5 }}>{tracking.orderNumber}</span>
          </div>
          <div>
            <span style={{ color: "#7c6a9e", display: "block", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.04em" }}>CURRENT STATUS</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: tracking.status === "Delivered" ? "#2a9e6a" : "#7c4dba", fontWeight: 800, background: tracking.status === "Delivered" ? "rgba(63,199,142,0.12)" : "rgba(124,77,186,0.08)", padding: "1px 6px", borderRadius: 4, fontSize: 10.5 }}>
              {tracking.status}
            </span>
          </div>
          <div>
            <span style={{ color: "#7c6a9e", display: "block", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.04em" }}>RECIPIENT NAME</span>
            <span style={{ color: "#1a1025", fontWeight: 600 }}>{tracking.recipient.name}</span>
          </div>
          <div>
            <span style={{ color: "#7c6a9e", display: "block", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.04em" }}>DELIVERY CITY</span>
            <span style={{ color: "#1a1025", fontWeight: 600 }}>{tracking.recipient.city}</span>
          </div>
          <div>
            <span style={{ color: "#7c6a9e", display: "block", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.04em" }}>ESTIMATED DELIVERY</span>
            <span style={{ color: "#402970", fontWeight: 700 }}>{formatDate(tracking.deliveryDate)}</span>
          </div>
          {lastUpdated && (
            <div>
              <span style={{ color: "#7c6a9e", display: "block", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.04em" }}>LAST UPDATED</span>
              <span style={{ color: "#7c6a9e", fontWeight: 500 }}>{lastUpdated}</span>
            </div>
          )}
        </div>

        {/* Stepper Timeline */}
        <div style={{ position: "relative", padding: "4px 8px 16px 8px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Vertical Connecting Line */}
          <div style={{
            position: "absolute",
            left: 17,
            top: 10,
            bottom: 24,
            width: 2.5,
            background: "rgba(64, 41, 112, 0.08)",
            zIndex: 0
          }} />

          {/* Active Connector Line Fill */}
          {(() => {
            const completedCount = tracking.progress.filter(p => p.completed).length;
            const totalSteps = tracking.progress.length;
            const heightPercentage = totalSteps > 1 ? ((completedCount - 1) / (totalSteps - 1)) * 100 : 0;
            return (
              <div style={{
                position: "absolute",
                left: 17,
                top: 10,
                height: `${Math.max(0, heightPercentage)}%`,
                maxHeight: "calc(100% - 34px)",
                width: 2.5,
                background: "linear-gradient(180deg,#7c4dba,#402970)",
                transition: "height 0.4s ease-out",
                zIndex: 1
              }} />
            );
          })()}

          {tracking.progress.map((step, idx) => {
            const active = step.completed;
            return (
              <div key={idx} style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                position: "relative",
                zIndex: 2
              }}>
                {/* step bubble */}
                <div style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: active ? "linear-gradient(135deg,#7c4dba,#402970)" : "#ffffff",
                  border: `2.5px solid ${active ? "#402970" : "rgba(64, 41, 112, 0.15)"}`,
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: active ? "0 2px 6px rgba(64,41,112,0.2)" : "none",
                  transition: "all 0.3s"
                }}>
                  {active && <Check size={10} strokeWidth={3} />}
                </div>

                {/* step label */}
                <span style={{
                  fontSize: 11.5,
                  fontWeight: active ? 700 : 500,
                  color: active ? "#1a1025" : "#9e8dc0",
                  fontFamily: "'Nunito', sans-serif"
                }}>
                  {getStepLabel(step.step)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          marginTop: 10
        }}>
          <button
            type="button"
            onClick={fetchTracking}
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
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh Status
          </button>
          <button
            type="button"
            onClick={handleCopy}
            style={{
              padding: "10px",
              borderRadius: 10,
              border: "1.5px solid rgba(64, 41, 112, 0.15)",
              background: copied ? "rgba(63,199,142,0.08)" : "transparent",
              borderColor: copied ? "rgba(63,199,142,0.3)" : "rgba(64, 41, 112, 0.15)",
              color: copied ? "#2a9e6a" : "#402970",
              fontSize: 11.5,
              fontWeight: 800,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              fontFamily: "'Nunito', sans-serif",
              transition: "all 0.2s"
            }}
          >
            {copied ? <Check size={13} strokeWidth={2.5} /> : <Copy size={13} />}
            {copied ? "Copied!" : "Copy Order ID"}
          </button>
          {onContinueShopping && (
            <button
              type="button"
              onClick={onContinueShopping}
              style={{
                gridColumn: "span 2",
                padding: "9px",
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
          )}
        </div>
      </div>
    </motion.div>
  );
}

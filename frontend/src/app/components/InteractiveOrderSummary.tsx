import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { User, Phone, Mail, MapPin, CheckCircle, Edit2, Star, Save, ShoppingCart, Maximize2, Minimize2 } from "lucide-react";
import type { Product } from "./products";

export interface DeliveryInfo {
  fullName: string;
  phone: string;
  email: string;
  address: string;
}

export interface SellerInfo {
  name: string;
  rating: number;
  email: string;
  phone: string;
  location: string;
}

interface Props {
  product: Product;
  variants?: Record<string, string>;
  deliveryInfo: DeliveryInfo;
  sellerInfo: SellerInfo;
  status: "pending" | "placed";
  onPlaceOrder: (info: DeliveryInfo) => void;
}

const SELLER_MAP: Record<string, SellerInfo> = {
  "SoundFlow": { name: "SoundFlow Audio Ltd.", rating: 4.8, email: "support@soundflow.com", phone: "+1 800-555-0199", location: "New York, USA" },
  "Vega": { name: "Vega Official Store", rating: 4.7, email: "orders@vegatech.com", phone: "+1 888-222-0133", location: "San Francisco, USA" },
  "AirStep": { name: "AirStep Footwear Outlet", rating: 4.9, email: "sales@airstep.com", phone: "+1 800-444-9876", location: "Boston, USA" },
  "ProBook": { name: "ProBook Authorized Retailer", rating: 4.6, email: "premium-support@probook.com", phone: "+1 877-333-8899", location: "Seattle, USA" },
  "ClearSound": { name: "ClearSound Direct", rating: 4.5, email: "service@clearsound.com", phone: "+1 800-987-6543", location: "Austin, USA" },
  "Flux": { name: "Flux Keyboards", rating: 4.9, email: "hello@fluxkeyboards.com", phone: "+1 800-111-2233", location: "Denver, USA" },
};

export const getDefaultSeller = (brand: string): SellerInfo => {
  return SELLER_MAP[brand] || {
    name: `${brand} Official Store`,
    rating: 4.7,
    email: `contact@${brand.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
    phone: "+1 800-555-0100",
    location: "Global Distribution Center",
  };
};

export function InteractiveOrderSummary({
  product,
  variants,
  deliveryInfo,
  sellerInfo,
  status,
  onPlaceOrder,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [isEnlarged, setIsEnlarged] = useState(false);
  const [info, setInfo] = useState<DeliveryInfo>({ ...deliveryInfo });
  const [errors, setErrors] = useState<Partial<DeliveryInfo>>({});

  const validate = () => {
    const errs: Partial<DeliveryInfo> = {};
    if (!info.fullName.trim()) errs.fullName = "Required";
    if (!info.phone.trim()) errs.phone = "Required";
    if (!info.email.trim()) errs.email = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(info.email.trim())) errs.email = "Invalid";
    if (!info.address.trim()) errs.address = "Required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = () => {
    if (validate()) {
      setIsEditing(false);
    }
  };

  const handlePlaceOrderClick = () => {
    if (validate()) {
      onPlaceOrder(info);
    } else {
      setIsEditing(true);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      style={{
        background: "#ffffff",
        borderRadius: 16,
        border: status === "placed" ? "1.5px solid rgba(63,199,142,0.3)" : "1.5px solid rgba(124,77,186,0.15)",
        boxShadow: "0 4px 20px rgba(64,41,112,0.05)",
        overflow: "hidden",
        width: "100%",
        maxWidth: isEnlarged ? "100%" : "580px",
        marginTop: 10,
        fontFamily: "'Nunito', sans-serif",
        transition: "max-width 0.25s ease-in-out",
      }}
    >
      {/* Top compact header */}
      <div style={{
        padding: "10px 14px",
        background: status === "placed" 
          ? "rgba(63,199,142,0.08)" 
          : "rgba(124,77,186,0.04)",
        borderBottom: "1px solid rgba(64,41,112,0.06)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: status === "placed" ? "#3fc78e" : "#7c4dba",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            flexShrink: 0,
          }}>
            {status === "placed" ? <CheckCircle size={13} strokeWidth={2.5} /> : <ShoppingCart size={12} strokeWidth={2} />}
          </div>
          <span style={{ color: "#1a1025", fontSize: 12, fontWeight: 800 }}>
            {status === "placed" ? "Order Placed Successfully" : "Order Summary & Checkout"}
          </span>
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={() => setIsEnlarged(!isEnlarged)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              border: "none",
              background: "transparent",
              color: "#7c4dba",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              padding: "2px 6px",
              borderRadius: 4,
            }}
          >
            {isEnlarged ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
            <span style={{ fontSize: 10.5 }}>{isEnlarged ? "Shrink" : "Enlarge"}</span>
          </button>

          {status === "pending" && (
            <button
              type="button"
              onClick={isEditing ? handleSave : () => setIsEditing(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                border: "none",
                background: "transparent",
                color: "#7c4dba",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                padding: "2px 6px",
                borderRadius: 4,
              }}
            >
              {isEditing ? <Save size={11} /> : <Edit2 size={11} />}
              <span style={{ fontSize: 10.5 }}>{isEditing ? "Save Info" : "Edit Delivery"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Body (2 Columns Layout) */}
      <div style={{
        padding: "14px",
        display: "grid",
        gridTemplateColumns: isEnlarged ? "1fr 1.5fr" : "1fr 1.1fr",
        gap: "14px",
        alignItems: "start",
      }}>
        
        {/* Left Column: Product & Seller Details */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Product Row */}
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ width: 44, height: 44, borderRadius: 6, overflow: "hidden", flexShrink: 0, background: "linear-gradient(135deg,#f5f0ff,#ede4ff)" }}>
              <img src={product.images[0]} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h5 style={{ color: "#1a1025", fontSize: 12, fontWeight: 755, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{product.name}</h5>
              <p style={{ color: "#9e8dc0", fontSize: 10.5, fontWeight: 600, margin: "2px 0 0 0" }}>
                Price: <span style={{ color: "#1a1025", fontWeight: 700 }}>${product.price.toFixed(2)}</span>
              </p>
              {variants && Object.keys(variants).length > 0 && (
                <p style={{ color: "#b8aed0", fontSize: 9.5, margin: "1px 0 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {Object.entries(variants).map(([k, v]) => `${k}: ${v}`).join(", ")}
                </p>
              )}
            </div>
          </div>

          <div style={{ height: 1, background: "rgba(64,41,112,0.06)" }} />

          {/* Seller Row */}
          <div style={{ fontSize: 11 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
              <span style={{ color: "#1a1025", fontWeight: 700 }}>{sellerInfo.name}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 1.5, fontSize: 9.5, fontWeight: 700, color: "#f59e0b", background: "rgba(245,158,11,0.08)", padding: "1px 4px", borderRadius: 4 }}>
                <Star size={8} fill="#f59e0b" strokeWidth={0} /> {sellerInfo.rating}
              </span>
            </div>
            <p style={{ margin: "2px 0 0 0", color: "#7c6a9e", fontSize: 10 }}>Email: <span style={{ color: "#1a1025" }}>{sellerInfo.email}</span></p>
            <p style={{ margin: "2px 0 0 0", color: "#7c6a9e", fontSize: 10 }}>Ship from: <span style={{ color: "#1a1025" }}>{sellerInfo.location}</span></p>
          </div>
        </div>

        {/* Right Column: Delivery Details (Forms or read-only view) */}
        <div style={{ borderLeft: "1px solid rgba(64,41,112,0.06)", paddingLeft: "14px", minHeight: "105px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <AnimatePresence mode="wait">
            {isEditing ? (
              <motion.div
                key="form-edit"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ display: "flex", flexDirection: "column", gap: 6 }}
              >
                <div>
                  <input
                    type="text"
                    value={info.fullName}
                    onChange={e => setInfo(p => ({ ...p, fullName: e.target.value }))}
                    placeholder="Full Name"
                    style={{ width: "100%", padding: "5px 8px", borderRadius: 6, border: `1px solid ${errors.fullName ? "#d4183d" : "rgba(64,41,112,0.15)"}`, outline: "none", fontSize: 11, boxSizing: "border-box" }}
                  />
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    type="text"
                    value={info.phone}
                    onChange={e => setInfo(p => ({ ...p, phone: e.target.value }))}
                    placeholder="Phone"
                    style={{ width: "50%", padding: "5px 8px", borderRadius: 6, border: `1px solid ${errors.phone ? "#d4183d" : "rgba(64,41,112,0.15)"}`, outline: "none", fontSize: 11, boxSizing: "border-box" }}
                  />
                  <input
                    type="email"
                    value={info.email}
                    onChange={e => setInfo(p => ({ ...p, email: e.target.value }))}
                    placeholder="Email"
                    style={{ width: "50%", padding: "5px 8px", borderRadius: 6, border: `1px solid ${errors.email ? "#d4183d" : "rgba(64,41,112,0.15)"}`, outline: "none", fontSize: 11, boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <textarea
                    value={info.address}
                    onChange={e => setInfo(p => ({ ...p, address: e.target.value }))}
                    placeholder="Address"
                    rows={2}
                    style={{ width: "100%", padding: "5px 8px", borderRadius: 6, border: `1px solid ${errors.address ? "#d4183d" : "rgba(64,41,112,0.15)"}`, outline: "none", fontSize: 11, resize: "none", boxSizing: "border-box" }}
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="read-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ display: "flex", flexDirection: "column", gap: 6 }}
              >
                {[
                  { icon: User, value: info.fullName || "Name required" },
                  { icon: Phone, value: info.phone || "Phone required" },
                  { icon: Mail, value: info.email || "Email required" },
                  { icon: MapPin, value: info.address || "Address required" },
                ].map((detail, idx) => {
                  const Icon = detail.icon;
                  return (
                    <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                      <span style={{ color: "#9e8dc0", marginTop: 2, display: "flex" }}><Icon size={11} strokeWidth={2} /></span>
                      <span style={{ color: "#1a1025", fontSize: 11, fontWeight: 600, lineHeight: 1.25, wordBreak: "break-word" }}>{detail.value}</span>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>

      {/* Bottom compact row: Total price & Place Order Action */}
      <div style={{
        padding: "10px 14px",
        background: "rgba(64,41,112,0.03)",
        borderTop: "1px solid rgba(64,41,112,0.06)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ color: "#7c6a9e", fontSize: 11, fontWeight: 600 }}>Total:</span>
          <span style={{ color: "#402970", fontSize: 15, fontWeight: 900 }}>${product.price.toFixed(2)}</span>
          <span style={{ color: "#3fc78e", fontSize: 10, fontWeight: 700, marginLeft: 4 }}>FREE SHIPPING</span>
        </div>

        <div>
          {status === "pending" ? (
            <motion.button
              type="button"
              onClick={isEditing ? handleSave : handlePlaceOrderClick}
              whileTap={{ scale: 0.97 }}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: isEditing ? "linear-gradient(135deg,#7c4dba,#402970)" : "linear-gradient(135deg,#3fc78e,#2a9e6a)",
                color: "#fff",
                fontSize: 11.5,
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {isEditing ? "Save Info" : "Place Order"}
            </motion.button>
          ) : (
            <div style={{
              padding: "6px 12px",
              borderRadius: 6,
              background: "rgba(63,199,142,0.12)",
              border: "1px solid rgba(63,199,142,0.2)",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}>
              <CheckCircle size={12} color="#3fc78e" strokeWidth={2.5} />
              <span style={{ color: "#2a9e6a", fontSize: 11, fontWeight: 800 }}>Order Dispatched</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

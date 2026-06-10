import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X, User, Phone, Mail, MapPin, CheckCircle,
  Zap, ArrowRight, ChevronLeft, Package, Star, ShoppingBag
} from "lucide-react";
import type { Product } from "./products";

export interface DeliveryInfo {
  fullName: string;
  phone: string;
  email: string;
  address: string;
}

interface SellerInfo {
  name: string;
  rating: number;
  email: string;
  phone: string;
  location: string;
}

const SELLER_MAP: Record<string, SellerInfo> = {
  "SoundFlow": { name: "SoundFlow Audio Ltd.", rating: 4.8, email: "support@soundflow.com", phone: "+1 800-555-0199", location: "New York, USA" },
  "Vega": { name: "Vega Official Store", rating: 4.7, email: "orders@vegatech.com", phone: "+1 888-222-0133", location: "San Francisco, USA" },
  "AirStep": { name: "AirStep Footwear Outlet", rating: 4.9, email: "sales@airstep.com", phone: "+1 800-444-9876", location: "Boston, USA" },
  "ProBook": { name: "ProBook Authorized Retailer", rating: 4.6, email: "premium-support@probook.com", phone: "+1 877-333-8899", location: "Seattle, USA" },
  "ClearSound": { name: "ClearSound Direct", rating: 4.5, email: "service@clearsound.com", phone: "+1 800-987-6543", location: "Austin, USA" },
  "Flux": { name: "Flux Keyboards", rating: 4.9, email: "hello@fluxkeyboards.com", phone: "+1 800-111-2233", location: "Denver, USA" },
};

const getDefaultSeller = (brand: string): SellerInfo => {
  return SELLER_MAP[brand] || {
    name: `${brand} Official Store`,
    rating: 4.7,
    email: `contact@${brand.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
    phone: "+1 800-555-0100",
    location: "Global Distribution Center",
  };
};

type Step = "confirm" | "delivery" | "summary" | "success";

interface Props {
  product: Product;
  selectedVariants?: Record<string, string>;
  onClose: () => void;
  onOrderPlaced: (info: DeliveryInfo) => void;
}

const FIELD_STYLE = (focused: boolean, error: boolean): React.CSSProperties => ({
  width: "100%",
  padding: "11px 14px 11px 40px",
  borderRadius: 12,
  border: `1.5px solid ${error ? "rgba(212,24,61,0.5)" : focused ? "rgba(64,41,112,0.55)" : "rgba(64,41,112,0.15)"}`,
  background: focused ? "#fff" : "rgba(64,41,112,0.03)",
  color: "#1a1025",
  fontSize: 13,
  fontWeight: 600,
  fontFamily: "'Nunito',sans-serif",
  outline: "none",
  transition: "border 0.15s, background 0.15s",
  boxSizing: "border-box" as const,
});

function FormField({
  label, icon: Icon, value, onChange, type = "text", placeholder, error,
}: {
  label: string; icon: React.ElementType; value: string;
  onChange: (v: string) => void; type?: string; placeholder: string; error?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <p style={{ color: "#7c6a9e", fontSize: 11, fontWeight: 700, marginBottom: 6, fontFamily: "'Nunito',sans-serif", letterSpacing: "0.04em" }}>{label}</p>
      <div className="relative">
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: focused ? "#402970" : "#9e8dc0", display: "flex", pointerEvents: "none", transition: "color 0.15s" }}>
          <Icon size={16} strokeWidth={2} />
        </span>
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          style={FIELD_STYLE(focused, !!error)}
        />
      </div>
      {error && <p style={{ color: "#d4183d", fontSize: 11, marginTop: 4, fontFamily: "'Nunito',sans-serif" }}>{error}</p>}
    </div>
  );
}

function AddressField({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <p style={{ color: "#7c6a9e", fontSize: 11, fontWeight: 700, marginBottom: 6, fontFamily: "'Nunito',sans-serif", letterSpacing: "0.04em" }}>Delivery Address</p>
      <div className="relative">
        <span style={{ position: "absolute", left: 12, top: 13, color: focused ? "#402970" : "#9e8dc0", display: "flex", pointerEvents: "none", transition: "color 0.15s" }}>
          <MapPin size={16} strokeWidth={2} />
        </span>
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Street, City, State, ZIP, Country"
          rows={3}
          style={{
            width: "100%",
            padding: "11px 14px 11px 40px",
            borderRadius: 12,
            border: `1.5px solid ${error ? "rgba(212,24,61,0.5)" : focused ? "rgba(64,41,112,0.55)" : "rgba(64,41,112,0.15)"}`,
            background: focused ? "#fff" : "rgba(64,41,112,0.03)",
            color: "#1a1025",
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "'Nunito',sans-serif",
            outline: "none",
            resize: "none",
            transition: "border 0.15s, background 0.15s",
            boxSizing: "border-box",
            lineHeight: 1.5,
          }}
        />
      </div>
      {error && <p style={{ color: "#d4183d", fontSize: 11, marginTop: 4, fontFamily: "'Nunito',sans-serif" }}>{error}</p>}
    </div>
  );
}

export function PurchaseFlowModal({ product, selectedVariants, onClose, onOrderPlaced }: Props) {
  const [step, setStep] = useState<Step>("confirm");
  const [info, setInfo] = useState<DeliveryInfo>({ fullName: "", phone: "", email: "", address: "" });
  const [errors, setErrors] = useState<Partial<DeliveryInfo>>({});

  const seller = getDefaultSeller(product.brand);

  const validate = () => {
    const errs: Partial<DeliveryInfo> = {};
    if (!info.fullName.trim()) errs.fullName = "Full name is required";
    if (!info.phone.trim()) errs.phone = "Phone number is required";
    else if (!/^\+?[\d\s\-().]{7,}$/.test(info.phone.trim())) errs.phone = "Enter a valid phone number";
    if (!info.email.trim()) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(info.email.trim())) errs.email = "Enter a valid email address";
    if (!info.address.trim()) errs.address = "Delivery address is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleConfirmPurchase = () => {
    setStep("delivery");
  };

  const handleDeliverySubmit = () => {
    if (validate()) {
      setStep("summary");
    }
  };

  const handlePlaceOrder = () => {
    setStep("success");
    onOrderPlaced(info);
  };

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 1000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
    }}>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={step !== "success" ? onClose : undefined}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(26, 16, 37, 0.4)",
          backdropFilter: "blur(6px)",
        }}
      />

      {/* Card Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: "spring", stiffness: 350, damping: 28 }}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "540px",
          maxHeight: "95vh",
          background: "#ffffff",
          borderRadius: 24,
          boxShadow: "0 20px 50px rgba(64, 41, 112, 0.22), 0 4px 12px rgba(0,0,0,0.08)",
          border: "1px solid rgba(64, 41, 112, 0.08)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: "'Nunito', sans-serif",
          zIndex: 1001,
        }
      >
        {/* Header */}
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid rgba(64,41,112,0.08)",
          background: "linear-gradient(135deg,rgba(124,77,186,0.06),rgba(64,41,112,0.03))",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }} className="justify-between">
          <div className="flex items-center gap-2">
            {step === "delivery" && (
              <motion.button type="button" onClick={() => setStep("confirm")} whileTap={{ scale: 0.9 }}
                style={{ width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer", background: "rgba(64,41,112,0.07)", color: "#7c6a9e", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <ChevronLeft size={15} strokeWidth={2.5} />
              </motion.button>
            )}
            {step === "summary" && (
              <motion.button type="button" onClick={() => setStep("delivery")} whileTap={{ scale: 0.9 }}
                style={{ width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer", background: "rgba(64,41,112,0.07)", color: "#7c6a9e", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <ChevronLeft size={15} strokeWidth={2.5} />
              </motion.button>
            )}
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#7c4dba,#402970)", display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <ShoppingBag size={16} color="#fff" strokeWidth={2} />
            </div>
            <div>
              <h3 style={{ color: "#1a1025", fontSize: 15, fontWeight: 850, margin: 0, lineHeight: 1.2 }}>
                {step === "confirm" && "Confirm Purchase"}
                {step === "delivery" && "Delivery Info"}
                {step === "summary" && "Order Summary"}
                {step === "success" && "Order Placed!"}
              </h3>
              <p style={{ color: "#9e8dc0", fontSize: 11, margin: "2px 0 0 0", fontWeight: 600 }}>
                {step === "confirm" && "Step 1 of 3 — Confirm Item"}
                {step === "delivery" && "Step 2 of 3 — Shipping Details"}
                {step === "summary" && "Step 3 of 3 — Review Order"}
                {step === "success" && "Success"}
              </p>
            </div>
          </div>
          {step !== "success" && (
            <motion.button type="button" onClick={onClose} whileTap={{ scale: 0.9 }}
              style={{ width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer", background: "rgba(64,41,112,0.07)", color: "#7c6a9e", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            >
              <X size={14} strokeWidth={2.5} />
            </motion.button>
          )}
        </div>

        {/* Progress bar */}
        {step !== "success" && (
          <div style={{ height: 3, background: "rgba(64,41,112,0.08)", flexShrink: 0 }}>
            <motion.div
              animate={{ width: step === "confirm" ? "33%" : step === "delivery" ? "66%" : "100%" }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              style={{ height: "100%", background: "linear-gradient(90deg,#7c4dba,#402970)", borderRadius: "0 2px 2px 0" }}
            />
          </div>
        )}

        {/* Scrollable Content */}
        <div style={{ overflowY: "auto", padding: "20px", flex: 1, scrollbarWidth: "none" }}>
          <AnimatePresence mode="wait">
            {step === "confirm" && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.2 }}
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(124,77,186,0.06)", border: "1px solid rgba(124,77,186,0.12)" }}>
                  <p style={{ color: "#402970", fontSize: 13, fontWeight: 600, margin: 0, lineHeight: 1.5 }}>
                    You are purchasing the following item. Please confirm below to proceed to delivery details.
                  </p>
                </div>

                {/* Product Preview Card */}
                <div style={{ display: "flex", gap: 14, padding: "14px", borderRadius: 16, border: "1.5px solid rgba(64,41,112,0.1)", background: "rgba(64,41,112,0.02)" }}>
                  <div style={{ width: 80, height: 80, borderRadius: 12, overflow: "hidden", flexShrink: 0, background: "linear-gradient(135deg,#f5f0ff,#ede4ff)" }}>
                    <img src={product.images[0]} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, minWidth: 0 }}>
                    <span style={{ color: "#9e8dc0", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>{product.brand}</span>
                    <h4 style={{ color: "#1a1025", fontSize: 15, fontWeight: 800, margin: "2px 0 4px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{product.name}</h4>
                    
                    {selectedVariants && Object.keys(selectedVariants).length > 0 && (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                        {Object.entries(selectedVariants).map(([k, v]) => (
                          <span key={k} style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 6, background: "rgba(124,77,186,0.1)", color: "#402970" }}>
                            {k}: {v}
                          </span>
                        ))}
                      </div>
                    )}

                    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                      <span style={{ color: "#1a1025", fontSize: 16, fontWeight: 850 }}>${product.price.toFixed(2)}</span>
                      {product.originalPrice && (
                        <span style={{ color: "#b8aed0", fontSize: 12, textDecoration: "line-through" }}>${product.originalPrice.toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 12, color: "#7c6a9e", padding: "0 4px" }}>
                  <div className="flex items-center gap-2">
                    <span style={{ color: "#3fc78e" }}>✓</span>
                    <span>Ships immediately via {product.delivery.toLowerCase()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{ color: "#3fc78e" }}>✓</span>
                    <span>1-year manufacturer warranty included</span>
                  </div>
                </div>
              </motion.div>
            )}

            {step === "delivery" && (
              <motion.div
                key="delivery"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.2 }}
                style={{ display: "flex", flexDirection: "column", gap: 14 }}
              >
                <FormField label="FULL NAME" icon={User} value={info.fullName} onChange={v => setInfo(p => ({ ...p, fullName: v }))} placeholder="e.g. Alex Smith" error={errors.fullName} />
                <FormField label="PHONE NUMBER" icon={Phone} value={info.phone} onChange={v => setInfo(p => ({ ...p, phone: v }))} type="tel" placeholder="e.g. +1 555 123 4567" error={errors.phone} />
                <FormField label="EMAIL ADDRESS" icon={Mail} value={info.email} onChange={v => setInfo(p => ({ ...p, email: v }))} type="email" placeholder="e.g. alex@example.com" error={errors.email} />
                <AddressField value={info.address} onChange={v => setInfo(p => ({ ...p, address: v }))} error={errors.address} />
              </motion.div>
            )}

            {step === "summary" && (
              <motion.div
                key="summary"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.2 }}
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                {/* Product Section */}
                <div style={{ borderRadius: 14, border: "1.5px solid rgba(64,41,112,0.08)", overflow: "hidden" }}>
                  <div style={{ padding: "8px 12px", background: "linear-gradient(135deg,rgba(124,77,186,0.06),rgba(64,41,112,0.03))", borderBottom: "1px solid rgba(64,41,112,0.06)" }}>
                    <p style={{ color: "#402970", fontSize: 10, fontWeight: 800, margin: 0, letterSpacing: "0.05em" }}>PRODUCT DETAILS</p>
                  </div>
                  <div style={{ padding: "12px", display: "flex", gap: 12 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: "linear-gradient(135deg,#f5f0ff,#ede4ff)" }}>
                      <img src={product.images[0]} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                    <div style={{ minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                      <h4 style={{ color: "#1a1025", fontSize: 13, fontWeight: 700, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{product.name}</h4>
                      <p style={{ color: "#7c6a9e", fontSize: 11, margin: "2px 0 0 0" }}>Price: ${product.price.toFixed(2)}</p>
                      {selectedVariants && Object.keys(selectedVariants).length > 0 && (
                        <p style={{ color: "#9e8dc0", fontSize: 10, margin: "2px 0 0 0", fontWeight: 600 }}>
                          {Object.entries(selectedVariants).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Seller/Owner Details Section */}
                <div style={{ borderRadius: 14, border: "1.5px solid rgba(64,41,112,0.08)", overflow: "hidden" }}>
                  <div style={{ padding: "8px 12px", background: "linear-gradient(135deg,rgba(124,77,186,0.06),rgba(64,41,112,0.03))", borderBottom: "1px solid rgba(64,41,112,0.06)" }}>
                    <p style={{ color: "#402970", fontSize: 10, fontWeight: 800, margin: 0, letterSpacing: "0.05em" }}>SELLER & OWNER DETAILS</p>
                  </div>
                  <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", justifyItems: "center", justifyContent: "space-between", alignItems: "center" }} className="justify-between">
                      <span style={{ color: "#1a1025", fontSize: 13, fontWeight: 700 }}>{seller.name}</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, color: "#f59e0b", background: "rgba(245,158,11,0.08)", padding: "2px 6px", borderRadius: 20 }}>
                        <Star size={10} fill="#f59e0b" strokeWidth={0} /> {seller.rating}
                      </span>
                    </div>
                    <div style={{ height: 1, background: "rgba(64,41,112,0.05)" }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#7c6a9e" }}>
                      <p style={{ margin: 0 }}>Email: <span style={{ color: "#1a1025", fontWeight: 600 }}>{seller.email}</span></p>
                      <p style={{ margin: 0 }}>Phone: <span style={{ color: "#1a1025", fontWeight: 600 }}>{seller.phone}</span></p>
                      <p style={{ margin: 0 }}>Location: <span style={{ color: "#1a1025", fontWeight: 600 }}>{seller.location}</span></p>
                    </div>
                  </div>
                </div>

                {/* Delivery Details Section */}
                <div style={{ borderRadius: 14, border: "1.5px solid rgba(64,41,112,0.08)", overflow: "hidden" }}>
                  <div style={{ padding: "8px 12px", background: "linear-gradient(135deg,rgba(124,77,186,0.06),rgba(64,41,112,0.03))", borderBottom: "1px solid rgba(64,41,112,0.06)" }}>
                    <p style={{ color: "#402970", fontSize: 10, fontWeight: 800, margin: 0, letterSpacing: "0.05em" }}>DELIVERY DETAILS</p>
                  </div>
                  <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: 6, fontSize: 11, color: "#7c6a9e" }}>
                    <p style={{ margin: 0 }}>Name: <span style={{ color: "#1a1025", fontWeight: 600 }}>{info.fullName}</span></p>
                    <p style={{ margin: 0 }}>Phone: <span style={{ color: "#1a1025", fontWeight: 600 }}>{info.phone}</span></p>
                    <p style={{ margin: 0 }}>Email: <span style={{ color: "#1a1025", fontWeight: 600 }}>{info.email}</span></p>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 4, marginTop: 4 }}>
                      <span style={{ flexShrink: 0 }}>Address: </span>
                      <span style={{ color: "#1a1025", fontWeight: 600, lineHeight: 1.4 }}>{info.address}</span>
                    </div>
                  </div>
                </div>

                {/* Order Total breakdown */}
                <div style={{ padding: "12px 14px", borderRadius: 14, background: "rgba(64,41,112,0.04)", border: "1px solid rgba(64,41,112,0.08)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }} className="justify-between">
                    <span style={{ color: "#7c6a9e" }}>Item Price</span>
                    <span style={{ color: "#1a1025", fontWeight: 600 }}>${product.price.toFixed(2)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, marginTop: 4 }} className="justify-between">
                    <span style={{ color: "#7c6a9e" }}>Shipping & Handling</span>
                    <span style={{ color: "#3fc78e", fontWeight: 700 }}>FREE</span>
                  </div>
                  <div style={{ height: 1, background: "rgba(64,41,112,0.1)", margin: "8px 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }} className="justify-between">
                    <span style={{ color: "#1a1025", fontSize: 13, fontWeight: 800 }}>Total</span>
                    <span style={{ color: "#402970", fontSize: 17, fontWeight: 900 }}>${product.price.toFixed(2)}</span>
                  </div>
                </div>
              </motion.div>
            )}

            {step === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, type: "spring" }}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 10px", textAlign: "center" }}
              >
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(63,199,142,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#3fc78e", marginBottom: 20 }}>
                  <CheckCircle size={36} strokeWidth={2.5} />
                </div>
                <h4 style={{ color: "#1a1025", fontSize: 18, fontWeight: 900, margin: 0 }}>Order Placed Successfully!</h4>
                <p style={{ color: "#7c6a9e", fontSize: 13, margin: "8px 0 20px 0", lineHeight: 1.6, maxWidth: "320px" }}>
                  Thank you for your purchase. We have sent the order confirmation details to <strong style={{ color: "#1a1025" }}>{info.email}</strong>.
                </p>
                
                {/* Success Summary details block */}
                <div style={{ width: "100%", padding: "14px", borderRadius: 16, background: "rgba(63,199,142,0.05)", border: "1.5px dashed rgba(63,199,142,0.3)", textAlign: "left", fontSize: 12 }}>
                  <p style={{ margin: "0 0 6px 0", color: "#2a9e6a", fontWeight: 800, textTransform: "uppercase", fontSize: 9, letterSpacing: "0.06em" }}>Order Info Summary</p>
                  <p style={{ margin: "4px 0", color: "#7c6a9e" }}>Product: <span style={{ color: "#1a1025", fontWeight: 700 }}>{product.name}</span></p>
                  <p style={{ margin: "4px 0", color: "#7c6a9e" }}>Total Amount: <span style={{ color: "#402970", fontWeight: 800 }}>${product.price.toFixed(2)}</span></p>
                  <p style={{ margin: "4px 0", color: "#7c6a9e" }}>Deliver To: <span style={{ color: "#1a1025", fontWeight: 700 }}>{info.fullName}</span></p>
                  <p style={{ margin: "4px 0", color: "#7c6a9e" }}>Address: <span style={{ color: "#1a1025", fontWeight: 600 }}>{info.address}</span></p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Actions */}
        <div style={{
          padding: "16px 20px",
          borderTop: "1px solid rgba(64,41,112,0.08)",
          flexShrink: 0,
          background: "#ffffff",
        }}>
          {step === "confirm" && (
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={onClose}
                style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1.5px solid rgba(64,41,112,0.15)", background: "transparent", color: "#7c6a9e", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button type="button" onClick={handleConfirmPurchase}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "12px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#7c4dba,#402970)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(64,41,112,0.25)" }}
              >
                Confirm Purchase
              </button>
            </div>
          )}

          {step === "delivery" && (
            <button type="button" onClick={handleDeliverySubmit}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "13px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#7c4dba,#402970)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(64,41,112,0.25)" }}
            >
              Proceed to Summary
              <ArrowRight size={15} strokeWidth={2.5} />
            </button>
          )}

          {step === "summary" && (
            <button type="button" onClick={handlePlaceOrder}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "13px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#3fc78e,#2a9e6a)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(42,158,106,0.3)" }}
            >
              Place Order
              <CheckCircle size={15} strokeWidth={2.5} />
            </button>
          )}

          {step === "success" && (
            <button type="button" onClick={onClose}
              style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#7c4dba,#402970)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              Return to Chat
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

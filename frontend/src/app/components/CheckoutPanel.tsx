import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, User, Phone, Mail, MapPin, CheckCircle, ShoppingBag, ArrowRight, ChevronLeft, ExternalLink } from "lucide-react";
import type { Product } from "./products";

interface CartItem { product: Product; qty: number }

interface DeliveryInfo {
  fullName: string;
  phone: string;
  email: string;
  address: string;
}

type Step = "form" | "summary";

interface Props {
  cartItems: CartItem[];
  onClose: () => void;
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

export function CheckoutPanel({ cartItems, onClose }: Props) {
  const [step, setStep] = useState<Step>("form");
  const [info, setInfo] = useState<DeliveryInfo>({ fullName: "", phone: "", email: "", address: "" });
  const [errors, setErrors] = useState<Partial<DeliveryInfo>>({});

  const cartTotal = cartItems.reduce((sum, i) => sum + i.product.price * i.qty, 0);
  const itemCount = cartItems.reduce((sum, i) => sum + i.qty, 0);

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

  const handleContinue = () => {
    if (validate()) setStep("summary");
  };

  return (
    <>
      <motion.div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(26,16,37,0.3)", backdropFilter: "blur(2px)" }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.22 }}
        onClick={onClose}
      />
      <motion.aside
        className="fixed top-0 right-0 h-full z-50 flex flex-col"
        style={{ width: 360, background: "#fff", boxShadow: "-8px 0 40px rgba(64,41,112,0.18)", borderLeft: "1px solid rgba(64,41,112,0.1)" }}
        initial={{ x: 360 }} animate={{ x: 0 }} exit={{ x: 360 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(64,41,112,0.09)", background: "linear-gradient(135deg,rgba(124,77,186,0.06),rgba(64,41,112,0.03))", flexShrink: 0 }}>
          <div className="flex items-center gap-2">
            {step === "summary" && (
              <motion.button type="button" onClick={() => setStep("form")} whileTap={{ scale: 0.9 }}
                className="flex items-center justify-center"
                style={{ width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer", background: "rgba(64,41,112,0.07)", color: "#7c6a9e", marginRight: 2 }}
              >
                <ChevronLeft size={15} strokeWidth={2.5} />
              </motion.button>
            )}
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#7c4dba,#402970)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ShoppingBag size={17} color="#fff" strokeWidth={2} />
            </div>
            <div>
              <h2 style={{ color: "#1a1025", fontWeight: 700, fontSize: 15, fontFamily: "'Nunito',sans-serif", lineHeight: 1.2 }}>
                {step === "form" ? "Checkout" : "Order Summary"}
              </h2>
              <p style={{ color: "#9e8dc0", fontSize: 11, fontFamily: "'Nunito',sans-serif" }}>
                {step === "form" ? "Step 1 of 2 — Delivery Info" : "Step 2 of 2 — Review & Pay"}
              </p>
            </div>
          </div>
          <motion.button type="button" onClick={onClose} whileTap={{ scale: 0.9 }}
            className="flex items-center justify-center"
            style={{ width: 30, height: 30, borderRadius: 9, border: "none", cursor: "pointer", background: "rgba(64,41,112,0.07)", color: "#7c6a9e" }}
          >
            <X size={14} strokeWidth={2.5} />
          </motion.button>
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: "rgba(64,41,112,0.08)", flexShrink: 0 }}>
          <motion.div
            animate={{ width: step === "form" ? "50%" : "100%" }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            style={{ height: "100%", background: "linear-gradient(90deg,#7c4dba,#402970)", borderRadius: "0 2px 2px 0" }}
          />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5" style={{ scrollbarWidth: "none" }}>
          <AnimatePresence mode="wait">
            {step === "form" ? (
              <motion.div key="form" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.25 }}
                className="flex flex-col gap-4"
              >
                <div style={{ padding: "12px 14px", borderRadius: 12, background: "linear-gradient(135deg,rgba(124,77,186,0.08),rgba(64,41,112,0.04))", border: "1px solid rgba(64,41,112,0.1)" }}>
                  <p style={{ color: "#402970", fontSize: 12, fontWeight: 600, fontFamily: "'Nunito',sans-serif", lineHeight: 1.5 }}>
                    Please fill in your delivery details below. Your information will be used to deliver your order.
                  </p>
                </div>

                <FormField label="FULL NAME" icon={User} value={info.fullName} onChange={v => setInfo(p => ({ ...p, fullName: v }))} placeholder="e.g. Jane Smith" error={errors.fullName} />
                <FormField label="PHONE NUMBER" icon={Phone} value={info.phone} onChange={v => setInfo(p => ({ ...p, phone: v }))} type="tel" placeholder="e.g. +1 555 000 1234" error={errors.phone} />
                <FormField label="EMAIL ADDRESS" icon={Mail} value={info.email} onChange={v => setInfo(p => ({ ...p, email: v }))} type="email" placeholder="e.g. jane@example.com" error={errors.email} />
                <AddressField value={info.address} onChange={v => setInfo(p => ({ ...p, address: v }))} error={errors.address} />

                {/* Cart mini-summary */}
                <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(64,41,112,0.04)", border: "1px solid rgba(64,41,112,0.08)" }}>
                  <p style={{ color: "#7c6a9e", fontSize: 11, fontWeight: 700, fontFamily: "'Nunito',sans-serif", letterSpacing: "0.04em", marginBottom: 8 }}>ORDER ITEMS</p>
                  <div className="flex flex-col gap-2">
                    {cartItems.map(item => (
                      <div key={item.product.id} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div style={{ width: 28, height: 28, borderRadius: 7, overflow: "hidden", flexShrink: 0, background: "linear-gradient(135deg,#f5f0ff,#ede4ff)" }}>
                            <img src={item.product.images[0]} alt={item.product.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          </div>
                          <p style={{ color: "#1a1025", fontSize: 12, fontWeight: 600, fontFamily: "'Nunito',sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.product.name}</p>
                        </div>
                        <span style={{ color: "#402970", fontSize: 12, fontWeight: 700, fontFamily: "'Nunito',sans-serif", flexShrink: 0 }}>×{item.qty}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="summary" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.25 }}
                className="flex flex-col gap-4"
              >
                {/* Delivery Info */}
                <div style={{ borderRadius: 14, border: "1px solid rgba(64,41,112,0.1)", overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", background: "linear-gradient(135deg,rgba(124,77,186,0.08),rgba(64,41,112,0.04))", borderBottom: "1px solid rgba(64,41,112,0.08)" }}>
                    <p style={{ color: "#402970", fontSize: 11, fontWeight: 700, fontFamily: "'Nunito',sans-serif", letterSpacing: "0.05em" }}>DELIVERY DETAILS</p>
                  </div>
                  <div className="flex flex-col gap-3 p-4">
                    {[
                      { icon: User, label: "Full Name", value: info.fullName },
                      { icon: Phone, label: "Phone", value: info.phone },
                      { icon: Mail, label: "Email", value: info.email },
                      { icon: MapPin, label: "Address", value: info.address },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="flex items-start gap-3">
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(64,41,112,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                          <Icon size={14} color="#402970" strokeWidth={2} />
                        </div>
                        <div className="min-w-0">
                          <p style={{ color: "#9e8dc0", fontSize: 10, fontWeight: 700, fontFamily: "'Nunito',sans-serif", letterSpacing: "0.04em" }}>{label.toUpperCase()}</p>
                          <p style={{ color: "#1a1025", fontSize: 13, fontWeight: 600, fontFamily: "'Nunito',sans-serif", marginTop: 1, lineHeight: 1.4, wordBreak: "break-word" }}>{value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Order Items */}
                <div style={{ borderRadius: 14, border: "1px solid rgba(64,41,112,0.1)", overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", background: "linear-gradient(135deg,rgba(124,77,186,0.08),rgba(64,41,112,0.04))", borderBottom: "1px solid rgba(64,41,112,0.08)" }}>
                    <p style={{ color: "#402970", fontSize: 11, fontWeight: 700, fontFamily: "'Nunito',sans-serif", letterSpacing: "0.05em" }}>ORDER ITEMS ({itemCount})</p>
                  </div>
                  <div className="flex flex-col" style={{ padding: "8px 0" }}>
                    {cartItems.map((item, i) => (
                      <div key={item.product.id} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: i < cartItems.length - 1 ? "1px solid rgba(64,41,112,0.06)" : "none" }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: "linear-gradient(135deg,#f5f0ff,#ede4ff)" }}>
                          <img src={item.product.images[0]} alt={item.product.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p style={{ color: "#1a1025", fontSize: 13, fontWeight: 600, fontFamily: "'Nunito',sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.product.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span style={{ color: "#9e8dc0", fontSize: 11, fontFamily: "'Nunito',sans-serif" }}>Qty: {item.qty}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 20, background: "rgba(64,41,112,0.08)", color: "#7c6a9e", fontFamily: "'Nunito',sans-serif" }}>{item.product.category}</span>
                          </div>
                        </div>
                        <span style={{ color: "#402970", fontSize: 13, fontWeight: 700, fontFamily: "'Nunito',sans-serif", flexShrink: 0 }}>${(item.product.price * item.qty).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totals */}
                <div style={{ padding: "14px 16px", borderRadius: 14, background: "rgba(64,41,112,0.04)", border: "1px solid rgba(64,41,112,0.1)" }}>
                  <div className="flex justify-between items-center mb-2">
                    <span style={{ color: "#7c6a9e", fontSize: 12, fontFamily: "'Nunito',sans-serif" }}>Subtotal ({itemCount} items)</span>
                    <span style={{ color: "#1a1025", fontSize: 13, fontWeight: 600, fontFamily: "'Nunito',sans-serif" }}>${cartTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center mb-3">
                    <span style={{ color: "#7c6a9e", fontSize: 12, fontFamily: "'Nunito',sans-serif" }}>Delivery</span>
                    <span style={{ color: "#3fc78e", fontSize: 12, fontWeight: 700, fontFamily: "'Nunito',sans-serif" }}>Free</span>
                  </div>
                  <div style={{ height: 1, background: "rgba(64,41,112,0.1)", marginBottom: 10 }} />
                  <div className="flex justify-between items-center">
                    <span style={{ color: "#1a1025", fontSize: 14, fontWeight: 700, fontFamily: "'Nunito',sans-serif" }}>Total</span>
                    <span style={{ color: "#402970", fontSize: 18, fontWeight: 800, fontFamily: "'Nunito',sans-serif" }}>${cartTotal.toFixed(2)}</span>
                  </div>
                </div>

                {/* Payment notice */}
                <div className="flex items-start gap-2" style={{ padding: "10px 14px", borderRadius: 12, background: "rgba(63,199,142,0.08)", border: "1px solid rgba(63,199,142,0.25)" }}>
                  <CheckCircle size={15} color="#3fc78e" strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 1 }} />
                  <p style={{ color: "#2a9e6a", fontSize: 11, fontWeight: 600, fontFamily: "'Nunito',sans-serif", lineHeight: 1.5 }}>
                    Your delivery information is confirmed. Click below to complete your payment securely on our payment portal.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-5 pb-6 pt-3" style={{ borderTop: "1px solid rgba(64,41,112,0.09)", flexShrink: 0 }}>
          {step === "form" ? (
            <motion.button type="button" onClick={handleContinue} whileTap={{ scale: 0.97 }}
              className="flex items-center justify-center gap-2 w-full"
              style={{ padding: "13px", borderRadius: 14, border: "none", background: "linear-gradient(135deg,#7c4dba,#402970)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Nunito',sans-serif", boxShadow: "0 4px 16px rgba(64,41,112,0.3)" }}
            >
              Review Order
              <ArrowRight size={16} strokeWidth={2.5} />
            </motion.button>
          ) : (
            <motion.a
              href="https://payment.example.com/checkout"
              target="_blank"
              rel="noopener noreferrer"
              whileTap={{ scale: 0.97 }}
              className="flex items-center justify-center gap-2 w-full"
              style={{ padding: "13px", borderRadius: 14, border: "none", background: "linear-gradient(135deg,#3fc78e,#2a9e6a)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Nunito',sans-serif", textDecoration: "none", boxShadow: "0 4px 16px rgba(42,158,106,0.35)", display: "flex" }}
            >
              Proceed to Payment
              <ExternalLink size={15} strokeWidth={2.5} />
            </motion.a>
          )}
        </div>
      </motion.aside>
    </>
  );
}

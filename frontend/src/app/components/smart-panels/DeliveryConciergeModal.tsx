import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, CheckCircle, XCircle, ChevronRight, X, Loader2 } from "lucide-react";
import { useConcierge, Address } from "../../hooks/useConcierge";
import { useApp } from "../../contexts/AppContext";

interface DeliveryConciergeModalProps {
  onClose: () => void;
  onContinueOrder: (address: Address) => void;
}

export const DeliveryConciergeModal: React.FC<DeliveryConciergeModalProps> = ({ onClose, onContinueOrder }) => {
  const { pendingConfirmProduct } = useApp();
  const sessionId = sessionStorage.getItem("velora_session_id") || "default";
  const { fetchAddresses, saveAddress, checkDelivery, checkNearestArea, loading } = useConcierge(sessionId);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [activeAddress, setActiveAddress] = useState<Address | null>(null);
  
  type Step = "INIT" | "CHECKING" | "AVAILABLE" | "UNAVAILABLE" | "NEAREST_FOUND" | "NEW_ADDRESS";
  const [step, setStep] = useState<Step>("INIT");

  const [nearestArea, setNearestArea] = useState<{ areaName: string, alternatives: string[] } | null>(null);
  
  // New Address Form State
  const [formData, setFormData] = useState({
    label: "Home",
    fullName: "",
    phone: "",
    address: "",
    city: "",
    province: "",
    postalCode: "",
    isDefault: true
  });

  useEffect(() => {
    initConcierge();
  }, []);

  const initConcierge = async () => {
    setStep("INIT");
    const userAddresses = await fetchAddresses();
    setAddresses(userAddresses);
    
    const defaultAddr = userAddresses.find(a => a.isDefault) || (userAddresses.length > 0 ? userAddresses[0] : null);
    
    if (defaultAddr) {
      setActiveAddress(defaultAddr);
      await performDeliveryCheck(defaultAddr);
    } else {
      setStep("NEW_ADDRESS");
    }
  };

  const performDeliveryCheck = async (address: Address) => {
    setStep("CHECKING");
    if (!pendingConfirmProduct) return;
    
    // Simulate current date (or let backend use today)
    const today = new Date().toISOString().split("T")[0];
    const result = await checkDelivery(address.city, today, pendingConfirmProduct.id);
    
    if (result && result.success && result.available) {
      setStep("AVAILABLE");
    } else {
      setStep("UNAVAILABLE");
    }
  };

  const handleFindNearest = async () => {
    if (!activeAddress) return;
    setStep("CHECKING");
    const nearest = await checkNearestArea(activeAddress.city);
    if (nearest) {
      setNearestArea(nearest);
      setStep("NEAREST_FOUND");
    } else {
      // Fallback if no nearest area found
      setStep("UNAVAILABLE");
      alert("Sorry, we couldn't find a nearby supported area.");
    }
  };

  const handleSaveNewAddress = async () => {
    if (!formData.fullName || !formData.phone || !formData.address || !formData.city) {
      alert("Please fill in all required fields.");
      return;
    }
    const updated = await saveAddress(formData as Address);
    setAddresses(updated);
    
    // Find the newly saved address
    const newAddr = updated[updated.length - 1];
    setActiveAddress(newAddr);
    await performDeliveryCheck(newAddr);
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0, y: 10 }}
      animate={{ opacity: 1, height: "auto", y: 0 }}
      exit={{ opacity: 0, height: 0, y: 10 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      style={{
        background: "rgba(255, 255, 255, 0.98)",
        backdropFilter: "blur(16px)",
        border: "1.5px solid rgba(124, 77, 186, 0.22)",
        borderRadius: 16,
        padding: "16px 20px",
        marginBottom: 12,
        boxShadow: "0 12px 32px rgba(64, 41, 112, 0.15)",
        display: "flex", flexDirection: "column", gap: 12,
        position: "relative",
        overflow: "hidden"
      }}
    >
      <button
        type="button"
        onClick={onClose}
        style={{ position: "absolute", top: 12, right: 12, width: 24, height: 24, borderRadius: 6, border: "none", cursor: "pointer", background: "rgba(64,41,112,0.05)", color: "#9e8dc0", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}
      >
        <X size={14} strokeWidth={2.5} />
      </button>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: "linear-gradient(135deg,#7c4dba,#402970)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <MapPin size={18} color="#fff" />
        </div>
        <div>
          <p style={{ color: "#7c6a9e", fontSize: 10, fontWeight: 800, margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>Velora Concierge</p>
          <h4 style={{ color: "#1a1025", fontSize: 14, fontWeight: 700, margin: "2px 0 0 0" }}>
            Delivery Validation
          </h4>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {(step === "INIT" || step === "CHECKING" || loading) && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ padding: "20px 0", textAlign: "center" }}>
            <Loader2 className="animate-spin mx-auto mb-2" size={24} color="#7c4dba" />
            <p style={{ fontSize: 12, color: "#7c6a9e", fontWeight: 600 }}>{step === "INIT" ? "Fetching your profile..." : "Validating delivery coverage..."}</p>
          </motion.div>
        )}

        {step === "AVAILABLE" && !loading && (
          <motion.div key="available" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div style={{ display: "flex", gap: 10, background: "rgba(16, 185, 129, 0.1)", padding: 12, borderRadius: 8, border: "1px solid rgba(16, 185, 129, 0.2)", marginBottom: 16 }}>
              <CheckCircle size={20} color="#10b981" style={{ flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 13, color: "#065f46", fontWeight: 700, margin: "0 0 4px 0" }}>Delivery Available!</p>
                <p style={{ fontSize: 12, color: "#064e3b", margin: 0 }}>We can deliver to your {activeAddress?.label.toLowerCase()} address in {activeAddress?.city}.</p>
              </div>
            </div>
            
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setStep("NEW_ADDRESS")} style={{ padding: "8px 14px", borderRadius: 8, border: "1.5px solid rgba(64,41,112,0.15)", background: "transparent", color: "#402970", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                Change Address
              </button>
              <button type="button" onClick={() => activeAddress && onContinueOrder(activeAddress)} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#7c4dba,#402970)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(64,41,112,0.2)" }}>
                Continue Order
              </button>
            </div>
          </motion.div>
        )}

        {step === "UNAVAILABLE" && !loading && (
          <motion.div key="unavailable" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
             <div style={{ display: "flex", gap: 10, background: "rgba(239, 68, 68, 0.1)", padding: 12, borderRadius: 8, border: "1px solid rgba(239, 68, 68, 0.2)", marginBottom: 16 }}>
              <XCircle size={20} color="#ef4444" style={{ flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 13, color: "#991b1b", fontWeight: 700, margin: "0 0 4px 0" }}>Delivery Unavailable</p>
                <p style={{ fontSize: 12, color: "#7f1d1d", margin: 0 }}>We can't currently deliver this item to {activeAddress?.city}. Would you like me to check the nearest delivery-supported area?</p>
              </div>
            </div>
            
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setStep("NEW_ADDRESS")} style={{ padding: "8px 14px", borderRadius: 8, border: "1.5px solid rgba(64,41,112,0.15)", background: "transparent", color: "#402970", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                No, Change Address
              </button>
              <button type="button" onClick={handleFindNearest} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#7c4dba,#402970)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(64,41,112,0.2)" }}>
                Yes, Check Nearby
              </button>
            </div>
          </motion.div>
        )}

        {step === "NEAREST_FOUND" && !loading && nearestArea && (
          <motion.div key="nearest" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
             <div style={{ display: "flex", gap: 10, background: "rgba(245, 158, 11, 0.1)", padding: 12, borderRadius: 8, border: "1px solid rgba(245, 158, 11, 0.2)", marginBottom: 16 }}>
              <MapPin size={20} color="#f59e0b" style={{ flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 13, color: "#92400e", fontWeight: 700, margin: "0 0 4px 0" }}>Nearest Area Found</p>
                <p style={{ fontSize: 12, color: "#78350f", margin: 0 }}>We can deliver to <b>{nearestArea.areaName}</b>, which is nearby.</p>
              </div>
            </div>
            
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setStep("NEW_ADDRESS")} style={{ padding: "8px 14px", borderRadius: 8, border: "1.5px solid rgba(64,41,112,0.15)", background: "transparent", color: "#402970", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                Choose Another
              </button>
              <button type="button" onClick={() => {
                // Update active address city to nearest
                const updated = { ...activeAddress, city: nearestArea.areaName } as Address;
                onContinueOrder(updated);
              }} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#7c4dba,#402970)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(64,41,112,0.2)" }}>
                Use This Location
              </button>
            </div>
          </motion.div>
        )}

        {step === "NEW_ADDRESS" && !loading && (
          <motion.div key="new_address" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontSize: 12, color: "#402970", fontWeight: 600, margin: "0 0 8px 0" }}>Add Delivery Address</p>
            
            <div style={{ display: "flex", gap: 8 }}>
              {["Home", "Office", "Other"].map(lbl => (
                <button
                  key={lbl}
                  type="button"
                  onClick={() => setFormData({...formData, label: lbl})}
                  style={{
                    padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: "pointer",
                    border: formData.label === lbl ? "1.5px solid #7c4dba" : "1.5px solid rgba(64,41,112,0.15)",
                    background: formData.label === lbl ? "rgba(124,77,186,0.1)" : "transparent",
                    color: formData.label === lbl ? "#402970" : "#7c6a9e"
                  }}
                >
                  {lbl}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <input type="text" placeholder="Full Name *" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} style={inputStyle} />
              <input type="text" placeholder="Phone Number *" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} style={inputStyle} />
            </div>
            <input type="text" placeholder="Street Address *" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} style={inputStyle} />
            
            <div style={{ display: "flex", gap: 8 }}>
              <input type="text" placeholder="City *" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} style={inputStyle} />
              <input type="text" placeholder="Province (Optional)" value={formData.province} onChange={e => setFormData({...formData, province: e.target.value})} style={inputStyle} />
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#402970", fontWeight: 600, cursor: "pointer", marginTop: 4 }}>
              <input type="checkbox" checked={formData.isDefault} onChange={e => setFormData({...formData, isDefault: e.target.checked})} style={{ accentColor: "#7c4dba" }} />
              Save as default address
            </label>

            <button type="button" onClick={handleSaveNewAddress} style={{ marginTop: 8, padding: "10px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#7c4dba,#402970)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(64,41,112,0.2)", width: "100%" }}>
              Save & Validate Delivery
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const inputStyle = {
  flex: 1, padding: "8px 12px", borderRadius: 8, border: "1.5px solid rgba(64,41,112,0.15)",
  background: "#fff", color: "#1a1025", fontSize: 12, fontFamily: "'Nunito', sans-serif", outline: "none",
  boxSizing: "border-box" as const
};

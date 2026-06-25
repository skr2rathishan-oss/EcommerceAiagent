import React from "react";
import { useApp } from "../../contexts/AppContext";
import { MapPin, CheckCircle } from "lucide-react";

export const AddressDetectionButtons: React.FC<{ messageIndex: number; onComplete: () => void }> = ({ messageIndex, onComplete }) => {
  const { setMessages, deliverySession } = useApp();

  const handleUseAddress = () => {
    // Reply as user
    setMessages(prev => [...prev, { role: "user", text: "Yes, use my default address." }]);
    onComplete();
  };

  const handleOtherAddress = () => {
    // Reply as user
    setMessages(prev => [...prev, { role: "user", text: "Deliver somewhere else." }]);
    onComplete();
  };

  return (
    <div style={{ display: "flex", gap: "10px", marginTop: "12px", flexDirection: "column" }}>
      <button 
        onClick={handleUseAddress}
        style={{
          display: "flex", alignItems: "center", gap: "8px", padding: "10px 16px",
          borderRadius: "12px", border: "1.5px solid rgba(63, 199, 142, 0.4)",
          background: "rgba(63, 199, 142, 0.08)", color: "#2a9e6a",
          fontSize: "13px", fontWeight: 700, cursor: "pointer",
          fontFamily: "'Nunito', sans-serif"
        }}
      >
        <CheckCircle size={16} /> Use my address
      </button>

      <button 
        onClick={handleOtherAddress}
        style={{
          display: "flex", alignItems: "center", gap: "8px", padding: "10px 16px",
          borderRadius: "12px", border: "1.5px solid rgba(64, 41, 112, 0.15)",
          background: "#fff", color: "#402970",
          fontSize: "13px", fontWeight: 700, cursor: "pointer",
          fontFamily: "'Nunito', sans-serif"
        }}
      >
        <MapPin size={16} /> Deliver somewhere else
      </button>
    </div>
  );
};

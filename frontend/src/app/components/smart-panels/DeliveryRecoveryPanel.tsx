import React from "react";
import { useApp } from "../../contexts/AppContext";
import { useChat } from "../../hooks/useChat";

export const DeliveryRecoveryPanel: React.FC = () => {
  const { handleSend } = useChat();
  const { setActiveSmartPanel } = useApp();

  const handleAction = (text: string) => {
    setActiveSmartPanel(null);
    handleSend(text);
  };

  const optionStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    borderRadius: 12,
    border: "1.5px solid var(--card-border, rgba(124, 77, 186, 0.22))",
    background: "rgba(124, 77, 186, 0.05)",
    color: "var(--text-primary, #1a1025)",
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "left" as const,
    transition: "all 0.2s"
  };

  const onHoverIn = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = "rgba(124, 77, 186, 0.12)";
    e.currentTarget.style.borderColor = "rgba(124, 77, 186, 0.4)";
  };

  const onHoverOut = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = "rgba(124, 77, 186, 0.05)";
    e.currentTarget.style.borderColor = "var(--card-border, rgba(124, 77, 186, 0.22))";
  };

  return (
    <div className="flex flex-col gap-3 font-sans text-xs">
      <p style={{ color: "var(--text-secondary, #7c6a9e)", marginBottom: 8, fontSize: 11.5 }}>
        Unfortunately, delivery to your selected location is unavailable. Velora AI Recovery Agent is ready to guide you:
      </p>
      <div className="flex flex-col gap-2">
        <button type="button" onClick={() => handleAction("Try nearby location")} style={optionStyle} onMouseEnter={onHoverIn} onMouseLeave={onHoverOut}>
          <span style={{ fontSize: 16 }}>📍</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 11.5 }}>Try Nearby Location</div>
            <div style={{ fontSize: 10, color: "var(--text-secondary, #7c6a9e)", marginTop: 2 }}>Suggest close supported cities and open address form</div>
          </div>
        </button>

        <button type="button" onClick={() => handleAction("Try another date")} style={optionStyle} onMouseEnter={onHoverIn} onMouseLeave={onHoverOut}>
          <span style={{ fontSize: 16 }}>📅</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 11.5 }}>Choose Another Delivery Date</div>
            <div style={{ fontSize: 10, color: "var(--text-secondary, #7c6a9e)", marginTop: 2 }}>Select Tomorrow, Next Day, or a Custom Date</div>
          </div>
        </button>

        <button type="button" onClick={() => handleAction("Find something similar")} style={optionStyle} onMouseEnter={onHoverIn} onMouseLeave={onHoverOut}>
          <span style={{ fontSize: 16 }}>🎁</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 11.5 }}>Find Similar Deliverable Products</div>
            <div style={{ fontSize: 10, color: "var(--text-secondary, #7c6a9e)", marginTop: 2 }}>Browse alternative products deliverable to your location</div>
          </div>
        </button>
      </div>
    </div>
  );
};

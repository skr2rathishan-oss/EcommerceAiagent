import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Heart, ShoppingCart, Bookmark, Package, ChevronDown, PanelLeft, Sparkles,
  DollarSign, Euro, PoundSterling, IndianRupee, Coins
} from "lucide-react";
import { useApp, type RightPanelId } from "../contexts/AppContext";
import { formatUIPrice } from "../services/mapping";
import { type OrderConfirmationDetails } from "./OrderConfirmationCard";

export const CURRENCIES = [
  { code: "USD", symbol: "$", label: "USD – US Dollar", icon: DollarSign },
  { code: "EUR", symbol: "€", label: "EUR – Euro", icon: Euro },
  { code: "GBP", symbol: "£", label: "GBP – British Pound", icon: PoundSterling },
  { code: "LKR", symbol: "Rs", label: "LKR – Sri Lankan Rupee", icon: Coins },
  { code: "INR", symbol: "₹", label: "INR – Indian Rupee", icon: IndianRupee },
];

interface TopNavbarProps {
  onRightPanel: (id: RightPanelId) => void;
  onTrackOrder: (orderNumber: string) => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({ onRightPanel, onTrackOrder }) => {
  const { sidebarOpen, setSidebarOpen, orderedItems } = useApp();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div
      className="relative z-10 flex items-center justify-between px-4"
      style={{
        height: 56,
        background: "rgba(255,255,255,0.55)",
        backdropFilter: "blur(14px)",
        borderBottom: "1px solid rgba(64,41,112,0.10)",
        flexShrink: 0,
      }}
    >
      <ToggleButton open={sidebarOpen} onClick={() => setSidebarOpen(o => !o)} />

      <div className="flex items-center gap-1">
        <NavbarIconBtn icon={<Heart size={19} strokeWidth={1.9} />} label="Wishlist" onClick={() => onRightPanel("Wishlist")} />
        <NavbarIconBtn icon={<ShoppingCart size={19} strokeWidth={1.9} />} label="Cart" onClick={() => onRightPanel("Cart")} />
        <NavbarIconBtn icon={<Bookmark size={19} strokeWidth={1.9} />} label="Saved" onClick={() => onRightPanel("Saved")} />
        <div style={{ width: 1, height: 22, background: "rgba(64,41,112,0.15)", margin: "0 6px" }} />

        <div ref={dropRef} className="relative">
          <button
            type="button"
            onClick={() => setDropdownOpen(o => !o)}
            className="flex items-center gap-1.5 relative"
            style={{
              height: 34,
              padding: "0 12px",
              borderRadius: 9999,
              border: `1px solid ${dropdownOpen ? "rgba(124, 77, 186, 0.45)" : "rgba(64, 41, 112, 0.18)"}`,
              background: dropdownOpen ? "rgba(124, 77, 186, 0.08)" : "rgba(255, 255, 255, 0.7)",
              color: "#402970",
              cursor: "pointer",
              fontFamily: "'Nunito', sans-serif",
              fontSize: 13,
              fontWeight: 600,
              transition: "all 0.15s",
              whiteSpace: "nowrap",
            }}
          >
            <Package size={14} strokeWidth={2} />
            <span>Ordered Items</span>
            {orderedItems.length > 0 && (
              <span
                style={{
                  background: "linear-gradient(135deg, #7c4dba, #402970)",
                  color: "#ffffff",
                  fontSize: 9,
                  fontWeight: 800,
                  borderRadius: "50%",
                  width: 16,
                  height: 16,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginLeft: 2,
                  boxShadow: "0 2px 5px rgba(64,41,112,0.2)",
                }}
              >
                {orderedItems.length}
              </span>
            )}
            <motion.span animate={{ rotate: dropdownOpen ? 180 : 0 }} transition={{ duration: 0.2 }} style={{ display: "flex", alignItems: "center" }}>
              <ChevronDown size={13} strokeWidth={2.5} />
            </motion.span>
          </button>

          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.96 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  width: 320,
                  background: "rgba(255, 255, 255, 0.98)",
                  backdropFilter: "blur(20px)",
                  borderRadius: 16,
                  border: "1px solid rgba(124, 77, 186, 0.18)",
                  boxShadow: "0 10px 30px rgba(64, 41, 112, 0.15)",
                  zIndex: 100,
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "1px solid rgba(64, 41, 112, 0.08)",
                    paddingBottom: 8,
                    marginBottom: 4,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#1a1025", fontFamily: "'Nunito', sans-serif" }}>📦 Order History</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#7c6a9e" }}>{orderedItems.length} order(s)</span>
                </div>

                {orderedItems.length === 0 ? (
                  <div
                    style={{
                      padding: "24px 10px",
                      textAlign: "center",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Package size={28} style={{ color: "rgba(64, 41, 112, 0.25)" }} />
                    <p style={{ margin: 0, fontSize: 11.5, color: "#7c6a9e", fontWeight: 600, fontFamily: "'Nunito', sans-serif", lineHeight: 1.4 }}>
                      No orders placed yet.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", maxHeight: 300, paddingRight: 2 }}>
                    {orderedItems.map((order) => (
                      <div
                        key={order.orderNumber}
                        style={{
                          background: "rgba(64, 41, 112, 0.02)",
                          border: "1.5px solid rgba(64, 41, 112, 0.06)",
                          borderRadius: 12,
                          padding: 10,
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                          transition: "all 0.2s",
                        }}
                      >
                        <div style={{ display: "flex", justifycontent: "space-between", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 10.5, fontWeight: 800, color: "#7c4dba", fontFamily: "monospace" }}>
                            {order.orderNumber}
                          </span>
                          <span style={{ fontSize: 9.5, fontWeight: 600, color: "#7c6a9e" }}>
                            {order.orderDate}
                          </span>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {order.items.map(item => (
                            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <img
                                src={item.image}
                                alt={item.name}
                                style={{
                                  width: 22,
                                  height: 22,
                                  borderRadius: 4,
                                  objectFit: "cover",
                                  border: "1px solid rgba(64, 41, 112, 0.08)",
                                }}
                              />
                              <span
                                style={{
                                  flex: 1,
                                  fontSize: 10.5,
                                  fontWeight: 600,
                                  color: "#1a1025",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {item.name}
                              </span>
                              <span style={{ fontSize: 9.5, fontWeight: 700, color: "#7c6a9e" }}>
                                x{item.qty}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            borderTop: "1.5px solid rgba(64, 41, 112, 0.04)",
                            paddingTop: 6,
                            marginTop: 2,
                          }}
                        >
                          <span style={{ fontSize: 10.5, fontWeight: 800, color: "#402970" }}>
                            Total: {formatUIPrice(order.summary.total, order.items[0]?.currency)}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              onTrackOrder(order.orderNumber);
                              setDropdownOpen(false);
                            }}
                            style={{
                              padding: "4px 8px",
                              borderRadius: 6,
                              background: "linear-gradient(135deg, #7c4dba, #402970)",
                              color: "#ffffff",
                              border: "none",
                              fontSize: 9.5,
                              fontWeight: 800,
                              cursor: "pointer",
                              boxShadow: "0 2px 4px rgba(64, 41, 112, 0.15)",
                            }}
                          >
                            Track
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

// Toggle Button Component
const ToggleButton: React.FC<{ open: boolean; onClick: () => void }> = ({ open, onClick }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div className="flex items-center gap-2" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <motion.button
        type="button"
        onClick={onClick}
        whileTap={{ scale: 0.9 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        className="flex items-center justify-center"
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          border: "none",
          cursor: "pointer",
          background: hovered || open ? "linear-gradient(135deg,#7c4dba,#402970)" : "rgba(255,255,255,0.7)",
          boxShadow: hovered || open ? "0 4px 16px rgba(64,41,112,0.28)" : "0 1px 6px rgba(64,41,112,0.10)",
          backdropFilter: "blur(8px)",
          transition: "background 0.2s,box-shadow 0.2s",
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {hovered || open ? (
            <motion.span
              key="panel"
              initial={{ opacity: 0, scale: 0.7, rotate: -15 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.7, rotate: 15 }}
              transition={{ duration: 0.16 }}
              style={{ display: "flex" }}
            >
              <PanelLeft size={18} color="#fff" strokeWidth={2} />
            </motion.span>
          ) : (
            <motion.span
              key="sparkles"
              initial={{ opacity: 0, scale: 0.7, rotate: 15 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.7, rotate: -15 }}
              transition={{ duration: 0.16 }}
              style={{ display: "flex" }}
            >
              <Sparkles size={18} color="#7c4dba" strokeWidth={2} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.15 }}
            style={{
              background: "rgba(26,16,37,0.82)",
              backdropFilter: "blur(8px)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 500,
              padding: "5px 10px",
              borderRadius: 8,
              whiteSpace: "nowrap",
              pointerEvents: "none",
              letterSpacing: "0.01em",
              fontFamily: "'Nunito',sans-serif",
            }}
          >
            {open ? "Close sidebar" : "Open sidebar"}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Navbar Icon Button
const NavbarIconBtn: React.FC<{ icon: React.ReactNode; label: string; onClick?: () => void }> = ({ icon, label, onClick }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div className="relative flex items-center justify-center">
      <motion.button
        type="button"
        whileTap={{ scale: 0.88 }}
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="flex items-center justify-center"
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          border: "none",
          cursor: "pointer",
          background: hovered ? "rgba(64,41,112,0.09)" : "transparent",
          color: hovered ? "#402970" : "#7c6a9e",
          transition: "background 0.15s,color 0.15s",
        }}
      >
        {icon}
      </motion.button>
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.13 }}
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(26,16,37,0.84)",
              backdropFilter: "blur(8px)",
              color: "#fff",
              fontSize: 11,
              fontWeight: 500,
              padding: "4px 9px",
              borderRadius: 7,
              whiteSpace: "nowrap",
              pointerEvents: "none",
              fontFamily: "'Nunito',sans-serif",
              zIndex: 50,
            }}
          >
            {label}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

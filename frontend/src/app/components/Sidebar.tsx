import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { SquarePen, Clock, Settings, HelpCircle, UserCircle, ShoppingCart, Heart } from "lucide-react";
import { useApp } from "../contexts/AppContext";
import { AdminPanel } from "./AdminPanel";

const NAV_TOP = [
  { icon: SquarePen, label: "New Chat" },
  { icon: Clock, label: "Recent Conversations" },
];

const NAV_BOTTOM = [
  { icon: Settings, label: "Settings" },
  { icon: HelpCircle, label: "Help & Support" },
  { icon: UserCircle, label: "Profile" },
];

interface SidebarProps {
  onItemClick: (label: string, rect: DOMRect) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onItemClick }) => {
  const { sidebarOpen, setSidebarOpen, activeScreen, activePanel, cartItems, wishlistItems } = useApp();
  const [adminOpen, setAdminOpen] = useState(false);

  const cartCount = cartItems?.reduce((acc, item) => acc + item.quantity, 0) || 0;
  const wishlistCount = wishlistItems?.length || 0;

  return (
    <>
      <motion.aside
        className="relative z-40 flex flex-col h-full left-0 top-0 bottom-0"
        animate={{ width: sidebarOpen ? 200 : 68 }}
        transition={{ type: "spring", stiffness: 350, damping: 32 }}
        style={{
          background: "linear-gradient(180deg,#4e337f 0%,#402970 60%,#301e56 100%)",
          borderRight: "none",
          overflow: "visible",
          flexShrink: 0,
        }}
      >
        {/* Velora logo brand toggle button */}
        <div style={{ height: 64, display: "flex", alignItems: "center", padding: sidebarOpen ? "0 16px" : "0", justifyContent: sidebarOpen ? "flex-start" : "center" }}>
          <motion.div
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            <img
              src="/logo.png"
              alt="Velora"
              style={{
                height: 28,
                width: 28,
                objectFit: "contain",
                borderRadius: "6px",
              }}
            />
            {sidebarOpen && (
              <motion.span
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }}
                style={{
                  color: "#ffffff",
                  fontWeight: 800,
                  fontSize: 16,
                  fontFamily: "'Nunito', sans-serif",
                  letterSpacing: "0.02em"
                }}
              >
                Velora
              </motion.span>
            )}
          </motion.div>
        </div>

        <div style={{ height: 1, width: sidebarOpen ? "85%" : 36, background: "rgba(255,255,255,0.12)", margin: "0 auto 8px" }} />

        <nav className="flex flex-col gap-1.5 px-3 pt-1 flex-1" style={{ width: "100%", alignItems: sidebarOpen ? "stretch" : "center" }}>
          {NAV_TOP.map(({ icon: Icon, label }) => {
            const active = label === "New Chat"
              ? activeScreen === "chat" && !activePanel
              : activePanel === label;
            return (
              <SidebarItem key={label} icon={<Icon size={20} strokeWidth={1.8} />} label={label} onClick={onItemClick} active={active} />
            );
          })}

          <div style={{ height: 1, width: sidebarOpen ? "100%" : 36, background: "rgba(255,255,255,0.12)", margin: "6px 0 8px" }} />

          <SidebarItem 
            key="Cart" 
            icon={<ShoppingCart size={20} strokeWidth={1.8} />} 
            label="Cart" 
            onClick={onItemClick} 
            badgeCount={cartCount} 
            active={activeScreen === "cart" && !activePanel}
          />
          <SidebarItem 
            key="Wishlist" 
            icon={<Heart size={20} strokeWidth={1.8} />} 
            label="Wishlist" 
            onClick={onItemClick} 
            badgeCount={wishlistCount} 
            active={activeScreen === "wishlist" && !activePanel}
          />
        </nav>
        <nav className="flex flex-col gap-1.5 px-3 pb-4" style={{ width: "100%", alignItems: sidebarOpen ? "stretch" : "center" }}>
          <div style={{ height: 1, width: sidebarOpen ? "100%" : 36, background: "rgba(255,255,255,0.12)", margin: "6px 0 8px" }} />
          {NAV_BOTTOM.map(({ icon: Icon, label }) => {
            if (label === "Settings") {
              const active = adminOpen || activePanel === "Settings";
              return (
                <SidebarItem
                  key={label}
                  icon={<Icon size={20} strokeWidth={1.8} />}
                  label={label}
                  onClick={() => setAdminOpen(true)}
                  active={active}
                />
              );
            }
            const active = activePanel === label;
            return (
              <SidebarItem key={label} icon={<Icon size={20} strokeWidth={1.8} />} label={label} onClick={onItemClick} active={active} />
            );
          })}
        </nav>
      </motion.aside>

      {/* AI Environment Admin Panel */}
      <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} />
    </>
  );
};

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  onClick?: ((label: string, rect: DOMRect) => void) | (() => void);
  badgeCount?: number;
  active?: boolean;
}

const getHoverLabel = (lbl: string) => {
  switch (lbl) {
    case "New Chat":
      return "📝 New Chat";
    case "Recent Conversations":
      return "🕒 History";
    case "Settings":
      return "⚙️ Settings";
    case "Help & Support":
      return "❓ Help";
    case "Profile":
      return "👤 Profile";
    case "Cart":
      return "🛒 Cart";
    case "Wishlist":
      return "❤️ Wishlist";
    default:
      return lbl;
  }
};

const SidebarItem: React.FC<SidebarItemProps> = ({ icon, label, onClick, badgeCount = 0, active = false }) => {
  const [hovered, setHovered] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const { sidebarOpen } = useApp();

  return (
    <div className="relative flex items-center" style={{ width: "100%", justifyContent: sidebarOpen ? "stretch" : "center" }}>
      <motion.button
        ref={btnRef}
        type="button"
        whileTap={{ scale: 0.98 }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => {
          if (!onClick) return;
          if (onClick.length === 0) {
            (onClick as () => void)();
          } else if (btnRef.current) {
            (onClick as (label: string, rect: DOMRect) => void)(label, btnRef.current.getBoundingClientRect());
          }
        }}
        className="flex items-center"
        style={{
          width: "100%",
          height: 44,
          borderRadius: 12,
          border: "none",
          cursor: "pointer",
          padding: sidebarOpen ? "0 12px" : "0",
          justifyContent: sidebarOpen ? "flex-start" : "center",
          gap: sidebarOpen ? 12 : 0,
          background: active 
            ? "#ffffff" 
            : hovered 
              ? "rgba(255,255,255,0.15)" 
              : "transparent",
          color: active 
            ? "#7c4dba" 
            : hovered 
              ? "#fff" 
              : "rgba(255,255,255,0.6)",
          transition: "background 0.18s ease,color 0.18s ease",
          boxShadow: active ? "0 4px 12px rgba(0,0,0,0.15)" : "none",
        }}
      >
        <div className="relative flex items-center justify-center" style={{ flexShrink: 0 }}>
          {icon}
          {badgeCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: -8,
                right: -8,
                background: "#7c4dba",
                color: "#ffffff",
                fontSize: 9,
                fontWeight: 800,
                borderRadius: "50%",
                minWidth: 15,
                height: 15,
                padding: "0 2px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                border: "2px solid #402970",
                boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
              }}
            >
              {badgeCount}
            </span>
          )}
        </div>

        {sidebarOpen && (
          <motion.span
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.15 }}
            style={{
              fontSize: 13,
              fontWeight: 700,
              whiteSpace: "nowrap",
              fontFamily: "'Nunito', sans-serif"
            }}
          >
            {label}
          </motion.span>
        )}
      </motion.button>

      <AnimatePresence>
        {hovered && !sidebarOpen && (
          <motion.div
            initial={{ opacity: 0, x: -8, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -8, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            style={{
              position: "absolute",
              left: 54,
              top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(26,16,37,0.92)",
              backdropFilter: "blur(10px)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              padding: "6px 12px",
              borderRadius: 8,
              whiteSpace: "nowrap",
              pointerEvents: "none",
              letterSpacing: "0.015em",
              fontFamily: "'Nunito',sans-serif",
              zIndex: 999,
              boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
            }}
          >
            <span
              style={{
                position: "absolute",
                left: -5,
                top: "50%",
                transform: "translateY(-50%)",
                width: 0,
                height: 0,
                borderTop: "5px solid transparent",
                borderBottom: "5px solid transparent",
                borderRight: "5px solid rgba(26,16,37,0.92)",
              }}
            />
            {getHoverLabel(label)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

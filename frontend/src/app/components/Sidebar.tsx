import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { SquarePen, Clock, Settings, HelpCircle, UserCircle } from "lucide-react";
import { useApp, type PanelId } from "../contexts/AppContext";
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
  const { sidebarOpen, setSidebarOpen } = useApp();
  const [adminOpen, setAdminOpen] = useState(false);

  return (
    <>
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              className="absolute inset-0 z-30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              style={{ background: "transparent" }}
              onClick={() => setSidebarOpen(false)}
            />

            <motion.aside
              className="relative z-40 flex flex-col h-full"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 68, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              style={{
                background: "linear-gradient(180deg,#4e337f 0%,#402970 60%,#301e56 100%)",
                borderRight: "none",
                overflow: "visible",
                flexShrink: 0,
              }}
            >
              <div style={{ height: 64 }} />
              <nav className="flex flex-col items-center gap-1 px-2 flex-1">
                {NAV_TOP.map(({ icon: Icon, label }) => (
                  <SidebarItem key={label} icon={<Icon size={20} strokeWidth={1.8} />} label={label} onClick={onItemClick} />
                ))}
              </nav>
              <nav className="flex flex-col items-center gap-1 px-2 pb-4">
                <div style={{ height: 1, width: 36, background: "rgba(255,255,255,0.15)", margin: "6px 0 8px" }} />
                {NAV_BOTTOM.map(({ icon: Icon, label }) => {
                  if (label === "Settings") {
                    return (
                      <SidebarItem
                        key={label}
                        icon={<Icon size={20} strokeWidth={1.8} />}
                        label={label}
                        onClick={() => setAdminOpen(true)}
                      />
                    );
                  }
                  return (
                    <SidebarItem key={label} icon={<Icon size={20} strokeWidth={1.8} />} label={label} onClick={onItemClick} />
                  );
                })}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* AI Environment Admin Panel */}
      <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} />
    </>
  );
};

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  onClick?: ((label: string, rect: DOMRect) => void) | (() => void);
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
    default:
      return lbl;
  }
};

const SidebarItem: React.FC<SidebarItemProps> = ({ icon, label, onClick }) => {
  const [hovered, setHovered] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="relative flex items-center" style={{ width: "100%" }}>
      <motion.button
        ref={btnRef}
        type="button"
        whileTap={{ scale: 0.9 }}
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
        className="flex items-center justify-center"
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          border: "none",
          cursor: "pointer",
          background: hovered ? "rgba(255,255,255,0.15)" : "transparent",
          color: hovered ? "#fff" : "rgba(255,255,255,0.6)",
          transition: "background 0.18s ease,color 0.18s ease",
        }}
      >
        {icon}
      </motion.button>

      <AnimatePresence>
        {hovered && (
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

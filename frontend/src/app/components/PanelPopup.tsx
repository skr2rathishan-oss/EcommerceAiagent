import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X, MessageSquare, Moon, Bell, Shield, Coins, MapPin, CheckCircle,
  FileText, HelpCircle, Mail, Phone, ChevronRight, User, Camera, LogOut,
  DollarSign, Euro, PoundSterling, IndianRupee
} from "lucide-react";
import * as profileService from "../services/profileService";
import { useApp, type PanelId, type AnchorPos } from "../contexts/AppContext";
import { formatUIPrice } from "../services/mapping";

export const CURRENCIES = [
  { code: "USD", symbol: "$", label: "USD – US Dollar", icon: DollarSign },
  { code: "EUR", symbol: "€", label: "EUR – Euro", icon: Euro },
  { code: "GBP", symbol: "£", label: "GBP – British Pound", icon: PoundSterling },
  { code: "LKR", symbol: "Rs", label: "LKR – Sri Lankan Rupee", icon: Coins },
  { code: "INR", symbol: "₹", label: "INR – Indian Rupee", icon: IndianRupee },
];

const POPUP_W = 340;
const POPUP_MAX_H = 480;
const ARROW_SIZE = 8;

interface PanelPopupProps {
  id: PanelId;
  anchor: AnchorPos;
  onClose: () => void;
}

export const PanelPopup: React.FC<PanelPopupProps> = ({ id, anchor, onClose }) => {
  const popupRef = useRef<HTMLDivElement>(null);

  // Clamp vertical so it never goes off screen
  const rawTop = anchor.y - POPUP_MAX_H / 2;
  const clampedTop = Math.max(8, Math.min(rawTop, window.innerHeight - POPUP_MAX_H - 8));
  // Arrow offset relative to popup top
  const arrowOffset = anchor.y - clampedTop - ARROW_SIZE;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) onClose();
    };
    const t = setTimeout(() => document.addEventListener("mousedown", handler), 50);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", handler);
    };
  }, [onClose]);

  return (
    <motion.div
      ref={popupRef}
      initial={{ opacity: 0, x: -12, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -12, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      style={{
        position: "fixed",
        left: anchor.x,
        top: clampedTop,
        width: POPUP_W,
        maxHeight: POPUP_MAX_H,
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
        background: "rgba(255,255,255,0.98)",
        borderRadius: 16,
        boxShadow: "0 12px 40px rgba(64,41,112,0.24), 0 2px 8px rgba(64,41,112,0.12)",
        border: "1px solid rgba(64,41,112,0.16)",
        overflow: "hidden",
        backdropFilter: "none",
      }}
    >
      {/* Left arrow */}
      <span
        style={{
          position: "absolute",
          left: -ARROW_SIZE,
          top: Math.max(16, Math.min(arrowOffset, POPUP_MAX_H - 32)),
          width: 0,
          height: 0,
          borderTop: `${ARROW_SIZE}px solid transparent`,
          borderBottom: `${ARROW_SIZE}px solid transparent`,
          borderRight: `${ARROW_SIZE}px solid rgba(255,255,255,0.98)`,
          filter: "drop-shadow(-2px 0 2px rgba(64,41,112,0.08))",
          pointerEvents: "none",
        }}
      />

      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{
          borderBottom: "1px solid rgba(64,41,112,0.08)",
          flexShrink: 0,
          background: "linear-gradient(135deg,rgba(124,77,186,0.06),rgba(64,41,112,0.04))",
        }}
      >
        <h3 style={{ color: "var(--text-primary, #1a1025)", fontWeight: 700, fontSize: 14, fontFamily: "'Nunito',sans-serif", letterSpacing: "-0.1px" }}>{id}</h3>
        <motion.button
          type="button"
          onClick={onClose}
          whileTap={{ scale: 0.9 }}
          className="flex items-center justify-center"
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            background: "rgba(64,41,112,0.07)",
            color: "#7c6a9e",
            flexShrink: 0,
          }}
        >
          <X size={13} strokeWidth={2.5} />
        </motion.button>
      </div>

      {/* Scrollable content */}
      <div style={{ overflowY: "auto", scrollbarWidth: "none", flex: 1 }}>
        {id === "Recent Conversations" && <PanelHistory />}
        {id === "Settings" && <PanelSettings />}
        {id === "Help & Support" && <PanelHelp />}
        {id === "Profile" && <PanelProfile />}
      </div>
    </motion.div>
  );
};

// ── Panel: Recent Conversations ────────────────────────────────────────────
const HISTORY = [
  { title: "How to improve productivity?", time: "2 mins ago", tag: "General" },
  { title: "Explain quantum computing", time: "1 hour ago", tag: "Science" },
  { title: "Write a cover letter for a designer", time: "Yesterday", tag: "Writing" },
  { title: "Best restaurants in Colombo", time: "2 days ago", tag: "Travel" },
  { title: "React state management patterns", time: "3 days ago", tag: "Code" },
  { title: "Summarise this research paper", time: "Last week", tag: "Research" },
];

const PanelHistory: React.FC = () => {
  return (
    <div className="px-5 py-4 flex flex-col gap-2">
      {HISTORY.map((h, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          className="flex items-center justify-between gap-3 cursor-pointer group"
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            background: "rgba(64,41,112,0.04)",
            border: "1px solid rgba(64,41,112,0.08)",
            transition: "background 0.15s",
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = "rgba(64,41,112,0.09)")}
          onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = "rgba(64,41,112,0.04)")}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "linear-gradient(135deg,#7c4dba,#402970)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <MessageSquare size={16} color="#fff" strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <p
                style={{
                  color: "var(--text-primary, #1a1025)",
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "'Nunito',sans-serif",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {h.title}
              </p>
              <p style={{ color: "var(--text-secondary, #9e8dc0)", fontSize: 11, fontFamily: "'Nunito',sans-serif", marginTop: 2 }}>{h.time}</p>
            </div>
          </div>
          <div style={{ flexShrink: 0 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: "3px 8px",
                borderRadius: 20,
                background: "rgba(64,41,112,0.1)",
                color: "#402970",
                fontFamily: "'Nunito',sans-serif",
                letterSpacing: "0.03em",
              }}
            >
              {h.tag}
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

// ── Panel: Settings ────────────────────────────────────────────────────────
const PanelSettings: React.FC = () => {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });
  const [notifs, setNotifs] = useState(true);
  const [privacy, setPrivacy] = useState(false);
  const [currency, setCurrency] = useState("USD");

  const [addressName, setAddressName] = useState(() => localStorage.getItem("delivery_address_name") || "Home");
  const [street1, setStreet1] = useState(() => localStorage.getItem("delivery_street1") || "");
  const [street2, setStreet2] = useState(() => localStorage.getItem("delivery_street2") || "");
  const [city, setCity] = useState(() => localStorage.getItem("delivery_city") || "Colombo 03");
  const [addressSaved, setAddressSaved] = useState(false);

  const toggleDarkMode = (val: boolean) => {
    setDarkMode(val);
    if (typeof window !== "undefined") {
      if (val) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
    }
  };

  const saveAddress = () => {
    localStorage.setItem("delivery_address_name", addressName);
    localStorage.setItem("delivery_street1", street1);
    localStorage.setItem("delivery_street2", street2);
    localStorage.setItem("delivery_city", city);
    setAddressSaved(true);
    setTimeout(() => setAddressSaved(false), 2000);
  };

  const rows = [
    { icon: <Moon size={18} strokeWidth={2} />, label: "Dark Mode", sub: "Switch to dark theme", value: darkMode, set: toggleDarkMode },
    { icon: <Bell size={18} strokeWidth={2} />, label: "Notifications", sub: "Get updates and alerts", value: notifs, set: setNotifs },
    { icon: <Shield size={18} strokeWidth={2} />, label: "Privacy Mode", sub: "Hide chat history", value: privacy, set: setPrivacy },
  ];

  const links = [
    { icon: <FileText size={16} strokeWidth={2} />, label: "Terms of Service" },
    { icon: <Shield size={16} strokeWidth={2} />, label: "Privacy Policy" },
    { icon: <HelpCircle size={16} strokeWidth={2} />, label: "About" },
  ];

  return (
    <div className="px-5 py-4 flex flex-col gap-4">
      <p style={{ color: "#9e8dc0", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", fontFamily: "'Nunito',sans-serif", textTransform: "uppercase" }}>Preferences</p>
      <div className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="flex items-center justify-between"
            style={{ padding: "14px 16px", borderRadius: 14, background: "rgba(64,41,112,0.04)", border: "1px solid rgba(64,41,112,0.08)" }}
          >
            <div className="flex items-center gap-3">
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: r.value ? "linear-gradient(135deg,#7c4dba,#402970)" : "rgba(64,41,112,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.2s",
                  color: r.value ? "#fff" : "#7c6a9e",
                }}
              >
                {r.icon}
              </div>
              <div>
                <p style={{ color: "var(--text-primary, #1a1025)", fontSize: 13, fontWeight: 600, fontFamily: "'Nunito',sans-serif" }}>{r.label}</p>
                <p style={{ color: "var(--text-secondary, #9e8dc0)", fontSize: 11, fontFamily: "'Nunito',sans-serif", marginTop: 1 }}>{r.sub}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => r.set(!r.value)}
              style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                border: "none",
                cursor: "pointer",
                background: r.value ? "#402970" : "rgba(64,41,112,0.2)",
                position: "relative",
                transition: "background 0.2s",
                flexShrink: 0,
              }}
            >
              <motion.span
                animate={{ x: r.value ? 20 : 2 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                style={{ position: "absolute", top: 3, left: 0, width: 18, height: 18, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }}
              />
            </button>
          </motion.div>
        ))}
      </div>

      <p style={{ color: "#9e8dc0", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", fontFamily: "'Nunito',sans-serif", textTransform: "uppercase", marginTop: 8 }}>Currency</p>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        style={{ padding: "14px 16px", borderRadius: 14, background: "rgba(64,41,112,0.04)", border: "1px solid rgba(64,41,112,0.08)" }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#7c4dba,#402970)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Coins size={18} color="#fff" strokeWidth={2} />
          </div>
          <div>
            <p style={{ color: "var(--text-primary, #1a1025)", fontSize: 13, fontWeight: 600, fontFamily: "'Nunito',sans-serif" }}>Currency</p>
            <p style={{ color: "var(--text-secondary, #9e8dc0)", fontSize: 11, fontFamily: "'Nunito',sans-serif", marginTop: 1 }}>Select display currency</p>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          {CURRENCIES.map((c) => {
            const CIcon = c.icon;
            const active = currency === c.code;
            return (
              <button
                key={c.code}
                type="button"
                onClick={() => setCurrency(c.code)}
                className="flex items-center gap-2 w-full"
                style={{
                  padding: "9px 12px",
                  borderRadius: 10,
                  border: `1.5px solid ${active ? "rgba(64,41,112,0.45)" : "rgba(64,41,112,0.1)"}`,
                  background: active ? "rgba(64,41,112,0.1)" : "transparent",
                  cursor: "pointer",
                  transition: "background 0.15s,border-color 0.15s",
                  textAlign: "left",
                }}
              >
                <CIcon size={14} strokeWidth={2} color={active ? "#402970" : "#9e8dc0"} />
                <span style={{ color: active ? "#402970" : "#3a2a55", fontSize: 13, fontWeight: active ? 700 : 500, fontFamily: "'Nunito',sans-serif", flex: 1 }}>{c.label}</span>
                {active && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#402970", flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      </motion.div>

      <p style={{ color: "#9e8dc0", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", fontFamily: "'Nunito',sans-serif", textTransform: "uppercase", marginTop: 8 }}>Delivery Address</p>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22 }}
        style={{ padding: "14px 16px", borderRadius: 14, background: "rgba(64,41,112,0.04)", border: "1px solid rgba(64,41,112,0.08)" }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#7c4dba,#402970)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MapPin size={18} color="#fff" strokeWidth={2} />
          </div>
          <div>
            <p style={{ color: "var(--text-primary, #1a1025)", fontSize: 13, fontWeight: 600, fontFamily: "'Nunito',sans-serif" }}>Delivery Address</p>
            <p style={{ color: "var(--text-secondary, #9e8dc0)", fontSize: 11, fontFamily: "'Nunito',sans-serif", marginTop: 1 }}>Configure your primary shipping address</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label style={{ color: "var(--text-secondary, #7c6a9e)", fontSize: 11, fontWeight: 700, fontFamily: "'Nunito',sans-serif", display: "block", marginBottom: 4 }}>Address Label (e.g. Home, Office)</label>
            <input
              type="text"
              value={addressName}
              onChange={(e) => setAddressName(e.target.value)}
              placeholder="e.g. Home, Office"
              style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid var(--card-border, rgba(64,41,112,0.15))", background: "var(--input-background, #fff)", color: "var(--text-primary, #1a1025)", fontSize: 12.5, fontFamily: "'Nunito',sans-serif", outline: "none", boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ color: "var(--text-secondary, #7c6a9e)", fontSize: 11, fontWeight: 700, fontFamily: "'Nunito',sans-serif", display: "block", marginBottom: 4 }}>Street Line 1</label>
            <input
              type="text"
              value={street1}
              onChange={(e) => setStreet1(e.target.value)}
              placeholder="Street Address, P.O. Box"
              style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid var(--card-border, rgba(64,41,112,0.15))", background: "var(--input-background, #fff)", color: "var(--text-primary, #1a1025)", fontSize: 12.5, fontFamily: "'Nunito',sans-serif", outline: "none", boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ color: "var(--text-secondary, #7c6a9e)", fontSize: 11, fontWeight: 700, fontFamily: "'Nunito',sans-serif", display: "block", marginBottom: 4 }}>Street Line 2</label>
            <input
              type="text"
              value={street2}
              onChange={(e) => setStreet2(e.target.value)}
              placeholder="Apartment, suite, unit, building, floor, etc."
              style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid var(--card-border, rgba(64,41,112,0.15))", background: "var(--input-background, #fff)", color: "var(--text-primary, #1a1025)", fontSize: 12.5, fontFamily: "'Nunito',sans-serif", outline: "none", boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ color: "var(--text-secondary, #7c6a9e)", fontSize: 11, fontWeight: 700, fontFamily: "'Nunito',sans-serif", display: "block", marginBottom: 4 }}>City</label>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid var(--card-border, rgba(64,41,112,0.15))", background: "var(--input-background, #fff)", color: "var(--text-primary, #1a1025)", fontSize: 12.5, fontFamily: "'Nunito',sans-serif", outline: "none", cursor: "pointer", boxSizing: "border-box" }}
            >
              <option value="Colombo 03">Colombo 03</option>
              <option value="Colombo 01">Colombo 01</option>
              <option value="Colombo 02">Colombo 02</option>
              <option value="Colombo 04">Colombo 04</option>
              <option value="Colombo 05">Colombo 05</option>
              <option value="Colombo 07">Colombo 07</option>
              <option value="Jaffna">Jaffna</option>
              <option value="Galle">Galle</option>
              <option value="Kandy">Kandy</option>
              <option value="Negombo">Negombo</option>
              <option value="Anuradhapura">Anuradhapura</option>
              <option value="Gampaha">Gampaha</option>
              <option value="Kurunegala">Kurunegala</option>
              <option value="Batticaloa">Batticaloa</option>
              <option value="Trincomalee">Trincomalee</option>
              <option value="Matara">Matara</option>
              <option value="Ratnapura">Ratnapura</option>
              <option value="Badulla">Badulla</option>
              <option value="Kalutara">Kalutara</option>
              <option value="Moratuwa">Moratuwa</option>
              <option value="Dehiwala">Dehiwala</option>
              <option value="Mount Lavinia">Mount Lavinia</option>
            </select>
          </div>

          <button
            type="button"
            onClick={saveAddress}
            style={{
              marginTop: 6,
              padding: "10px",
              borderRadius: 10,
              border: "none",
              background: "linear-gradient(135deg,#7c4dba,#402970)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "'Nunito',sans-serif",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            Save Address
          </button>

          <AnimatePresence>
            {addressSaved && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 mt-1"
                style={{ padding: "8px 12px", borderRadius: 10, background: "rgba(63,199,142,0.12)", border: "1px solid rgba(63,199,142,0.3)" }}
              >
                <CheckCircle size={14} color="#3fc78e" strokeWidth={2.5} />
                <span style={{ color: "#2a9e6a", fontSize: 11.5, fontWeight: 600, fontFamily: "'Nunito',sans-serif" }}>Delivery address saved</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <p style={{ color: "#9e8dc0", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", fontFamily: "'Nunito',sans-serif", textTransform: "uppercase", marginTop: 8 }}>More</p>
      <div className="flex flex-col gap-2">
        {links.map((l, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 + i * 0.06 }}
            className="flex items-center justify-between cursor-pointer"
            style={{ padding: "13px 16px", borderRadius: 14, background: "rgba(64,41,112,0.04)", border: "1px solid rgba(64,41,112,0.08)", transition: "background 0.15s" }}
            onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = "rgba(64,41,112,0.09)")}
            onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = "rgba(64,41,112,0.04)")}
          >
            <div className="flex items-center gap-3" style={{ color: "#7c6a9e" }}>
              {l.icon}
              <span style={{ color: "#1a1025", fontSize: 13, fontWeight: 600, fontFamily: "'Nunito',sans-serif" }}>{l.label}</span>
            </div>
            <ChevronRight size={15} strokeWidth={2} color="#9e8dc0" />
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// ── Panel: Help & Support ──────────────────────────────────────────────────
const FAQS = [
  { q: "How do I start a new chat?", a: "Click the New Chat icon in the sidebar or press the New Chat button." },
  { q: "Can I upload files to the chat?", a: "Yes — click the paperclip icon in the chat input bar to attach files." },
  { q: "How do I change the language?", a: "Use the language selector in the top navbar to switch between English, Tamil, and Sinhala." },
  { q: "Is my chat history saved?", a: "Recent conversations are listed under the Recent Conversations section in the sidebar." },
];

const PanelHelp: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="px-5 py-4 flex flex-col gap-4">
      <p style={{ color: "#9e8dc0", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", fontFamily: "'Nunito',sans-serif", textTransform: "uppercase" }}>Contact Us</p>
      <div className="flex flex-col gap-2">
        {[
          { icon: <Mail size={18} strokeWidth={2} />, label: "Email Support", sub: "support@example.com", color: "#6d3fc7" },
          { icon: <Phone size={18} strokeWidth={2} />, label: "Phone Support", sub: "+94 77 123 4567", color: "#3f7fc7" },
          { icon: <MessageSquare size={18} strokeWidth={2} />, label: "Live Chat", sub: "Available 9 AM – 6 PM", color: "#3fc78e" },
        ].map((c, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="flex items-center gap-3 cursor-pointer"
            style={{ padding: "13px 16px", borderRadius: 14, background: "rgba(64,41,112,0.04)", border: "1px solid rgba(64,41,112,0.08)", transition: "background 0.15s" }}
            onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = "rgba(64,41,112,0.09)")}
            onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = "rgba(64,41,112,0.04)")}
          >
            <div style={{ width: 38, height: 38, borderRadius: 11, background: `${c.color}18`, display: "flex", alignItems: "center", justifyContent: "center", color: c.color, flexShrink: 0 }}>
              {c.icon}
            </div>
            <div>
              <p style={{ color: "#1a1025", fontSize: 13, fontWeight: 600, fontFamily: "'Nunito',sans-serif" }}>{c.label}</p>
              <p style={{ color: "#9e8dc0", fontSize: 11, fontFamily: "'Nunito',sans-serif", marginTop: 1 }}>{c.sub}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <p style={{ color: "#9e8dc0", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", fontFamily: "'Nunito',sans-serif", textTransform: "uppercase", marginTop: 8 }}>FAQs</p>
      <div className="flex flex-col gap-2">
        {FAQS.map((f, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.21 + i * 0.06 }}
            style={{ borderRadius: 14, background: "rgba(64,41,112,0.04)", border: "1px solid rgba(64,41,112,0.08)", overflow: "hidden" }}
          >
            <button
              type="button"
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
              className="flex items-center justify-between w-full"
              style={{ padding: "13px 16px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
            >
              <span style={{ color: "#1a1025", fontSize: 13, fontWeight: 600, fontFamily: "'Nunito',sans-serif", paddingRight: 12 }}>{f.q}</span>
              <motion.span animate={{ rotate: openFaq === i ? 90 : 0 }} transition={{ duration: 0.2 }} style={{ flexShrink: 0, color: "#9e8dc0", display: "flex" }}>
                <ChevronRight size={15} strokeWidth={2.5} />
              </motion.span>
            </button>
            <AnimatePresence>
              {openFaq === i && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  style={{ overflow: "hidden" }}
                >
                  <p style={{ color: "#7c6a9e", fontSize: 12, fontFamily: "'Nunito',sans-serif", lineHeight: 1.65, padding: "0 16px 14px" }}>{f.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// ── Panel: Profile ─────────────────────────────────────────────────────────
const PanelProfile: React.FC = () => {
  const [name, setName] = useState("Alex Johnson");
  const [email, setEmail] = useState("alex@example.com");
  const [mobile, setMobile] = useState("+94 77 123 4567");
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeSection, setActiveSection] = useState<"profile" | "delivery" | "shopping" | "language" | "account" | null>("profile");
  const [deliveryData, setDeliveryData] = useState<any>(null);
  const [preferencesData, setPreferencesData] = useState<any>(null);
  const [languageData, setLanguageData] = useState<any>(null);
  const [deliveryEditing, setDeliveryEditing] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState<string>("");
  const [deliveryCityField, setDeliveryCityField] = useState<string>("");
  const [deliveryPostal, setDeliveryPostal] = useState<string>("");
  const [deliverySavedLocal, setDeliverySavedLocal] = useState(false);

  const [prefsEditing, setPrefsEditing] = useState(false);
  const [budgetRange, setBudgetRange] = useState<string>("");
  const [favoriteCategories, setFavoriteCategories] = useState<string>("");
  const [favoriteBrands, setFavoriteBrands] = useState<string>("");
  const [prefsSaved, setPrefsSaved] = useState(false);

  const [languageEditing, setLanguageEditing] = useState(false);
  const [languageSelectedLocal, setLanguageSelectedLocal] = useState<string>("English");
  const [languageSavedLocal, setLanguageSavedLocal] = useState(false);

  const handleSave = () => {
    // persist profile to backend via frontend service
    profileService.updateProfile({ name, email, mobile })
      .then(() => {
        setEditing(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      })
      .catch(() => {
        // fallback UX: still close edit mode but show failure via console
        setEditing(false);
        console.error("Failed to save profile");
      });
  };

  useEffect(() => {
    let mounted = true;
    // load current profile values if available from backend
    profileService.getProfile()
      .then((p: any) => {
        if (!mounted) return;
        if (p?.name) setName(p.name);
        if (p?.email) setEmail(p.email);
        if (p?.mobile) setMobile(p.mobile);
      })
      .catch(() => {
        // ignore - local defaults remain
      });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    if (activeSection === 'delivery') {
      profileService.getDelivery().then((d: any) => { if (mounted) setDeliveryData(d); }).catch(() => {});
    } else if (activeSection === 'shopping') {
      profileService.getPreferences().then((p: any) => { if (mounted) setPreferencesData(p); }).catch(() => {});
    } else if (activeSection === 'language') {
      profileService.getLanguage().then((l: any) => { if (mounted) setLanguageData(l); }).catch(() => {});
    }
    return () => { mounted = false; };
  }, [activeSection]);

  const sections = [
    { key: "profile", label: "Profile", icon: "👤", description: "Edit your personal details and profile picture" },
    { key: "delivery", label: "Delivery Information", icon: "📍", description: "Update your delivery addresses" },
    { key: "shopping", label: "Shopping Preferences", icon: "🛍️", description: "Set your budget, categories and favorite brands" },
    { key: "language", label: "Language", icon: "🌐", description: "Choose your preferred language" },
    { key: "account", label: "Account", icon: "🔐", description: "Manage password and account security" },
  ] as const;

  const renderSectionContent = () => {
    switch (activeSection) {
      case "profile":
        return (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p style={{ color: "#1a1025", fontSize: 13, fontWeight: 700, fontFamily: "'Nunito',sans-serif" }}>Profile Details</p>
              {!editing ? (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  style={{ padding: "7px 10px", borderRadius: 10, border: "1px solid rgba(64,41,112,0.14)", background: "transparent", color: "#402970", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "'Nunito',sans-serif" }}
                >
                  Edit
                </button>
              ) : null}
            </div>

            {editing ? (
              <div className="flex flex-col gap-2">
                {[
                  { label: "Full Name", value: name, set: setName },
                  { label: "Email", value: email, set: setEmail },
                  { label: "Mobile Number", value: mobile, set: setMobile },
                ].map((field) => (
                  <div key={field.label}>
                    <p style={{ color: "#7c6a9e", fontSize: 11, fontWeight: 700, marginBottom: 5, fontFamily: "'Nunito',sans-serif" }}>{field.label}</p>
                    <input
                      value={field.value}
                      onChange={(e) => field.set(e.target.value)}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(64,41,112,0.18)", background: "#fff", color: "#1a1025", fontSize: 12.5, fontWeight: 600, fontFamily: "'Nunito',sans-serif", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                ))}
                <div className="flex gap-2 mt-1">
                  <button type="button" onClick={() => setEditing(false)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid rgba(64,41,112,0.16)", background: "transparent", color: "#7c6a9e", cursor: "pointer", fontSize: 12.5, fontWeight: 700, fontFamily: "'Nunito',sans-serif" }}>
                    Cancel
                  </button>
                  <button type="button" onClick={handleSave} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#7c4dba,#402970)", color: "#fff", cursor: "pointer", fontSize: 12.5, fontWeight: 700, fontFamily: "'Nunito',sans-serif" }}>
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2" style={{ color: "#7c6a9e", fontSize: 12.5, fontFamily: "'Nunito',sans-serif" }}>
                <span>👤 {name}</span>
                <span>📧 {email}</span>
                <span>📱 {mobile}</span>
              </div>
            )}

            <AnimatePresence>
              {saved && (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2" style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(63,199,142,0.12)", border: "1px solid rgba(63,199,142,0.3)" }}>
                  <CheckCircle size={15} color="#3fc78e" strokeWidth={2.5} />
                  <span style={{ color: "#2a9e6a", fontSize: 12, fontWeight: 600, fontFamily: "'Nunito',sans-serif" }}>Profile updated</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      case "delivery":
        return (
          <div>
            {!deliveryEditing ? (
              <div className="flex flex-col gap-2" style={{ color: "#7c6a9e", fontSize: 12.5, fontFamily: "'Nunito',sans-serif" }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>Default Delivery Address</div>
                    <div style={{ color: '#9e8dc0', marginTop: 4 }}>{deliveryAddress || 'Not set'}</div>
                  </div>
                  <button type="button" onClick={() => setDeliveryEditing(true)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(64,41,112,0.08)', background: 'transparent', color: '#402970', fontWeight: 700 }}>Manage Addresses</button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>City / District</div>
                    <div style={{ color: '#9e8dc0', marginTop: 4 }}>{deliveryCityField || 'Not set'}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700 }}>Postal Code</div>
                    <div style={{ color: '#9e8dc0', marginTop: 4 }}>{deliveryPostal || 'Not set'}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div>
                  <p style={{ color: '#7c6a9e', fontSize: 11, fontWeight: 700 }}>Address</p>
                  <input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid rgba(64,41,112,0.12)' }} />
                </div>
                <div>
                  <p style={{ color: '#7c6a9e', fontSize: 11, fontWeight: 700 }}>City</p>
                  <input value={deliveryCityField} onChange={(e) => setDeliveryCityField(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid rgba(64,41,112,0.12)' }} />
                </div>
                <div>
                  <p style={{ color: '#7c6a9e', fontSize: 11, fontWeight: 700 }}>Postal Code</p>
                  <input value={deliveryPostal} onChange={(e) => setDeliveryPostal(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid rgba(64,41,112,0.12)' }} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => setDeliveryEditing(false)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid rgba(64,41,112,0.12)', background: 'transparent' }}>Cancel</button>
                  <button type="button" onClick={() => {
                    // persist delivery to backend
                    profileService.updateDelivery({ address: deliveryAddress, city: deliveryCityField, postal: deliveryPostal })
                      .then(() => {
                        setDeliveryEditing(false);
                        setDeliverySavedLocal(true);
                        setTimeout(() => setDeliverySavedLocal(false), 2000);
                      })
                      .catch(() => {
                        setDeliveryEditing(false);
                        console.error('Failed to save delivery');
                      });
                  }} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#7c4dba,#402970)', color: '#fff' }}>Save</button>
                </div>
                {deliverySavedLocal && <div style={{ marginTop: 8, padding: '8px', borderRadius: 8, background: 'rgba(63,199,142,0.12)', border: '1px solid rgba(63,199,142,0.3)' }}>Saved</div>}
              </div>
            )}
          </div>
        );
      case "shopping":
        return (
          <div>
            {!prefsEditing ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>Shopping Preferences</div>
                  <div style={{ color: '#9e8dc0', marginTop: 4 }}>{favoriteCategories || 'No categories set'}</div>
                </div>
                <button type="button" onClick={() => setPrefsEditing(true)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(64,41,112,0.08)', background: 'transparent', color: '#402970', fontWeight: 700 }}>Set Preferences</button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div>
                  <p style={{ color: '#7c6a9e', fontSize: 11, fontWeight: 700 }}>Budget Range</p>
                  <input value={budgetRange} onChange={(e) => setBudgetRange(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid rgba(64,41,112,0.12)' }} />
                </div>
                <div>
                  <p style={{ color: '#7c6a9e', fontSize: 11, fontWeight: 700 }}>Favorite Categories</p>
                  <input value={favoriteCategories} onChange={(e) => setFavoriteCategories(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid rgba(64,41,112,0.12)' }} />
                </div>
                <div>
                  <p style={{ color: '#7c6a9e', fontSize: 11, fontWeight: 700 }}>Favorite Brands</p>
                  <input value={favoriteBrands} onChange={(e) => setFavoriteBrands(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid rgba(64,41,112,0.12)' }} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => setPrefsEditing(false)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid rgba(64,41,112,0.12)', background: 'transparent' }}>Cancel</button>
                  <button type="button" onClick={() => {
                    profileService.updatePreferences({ budgetRange, favoriteCategories, favoriteBrands })
                      .then(() => {
                        setPrefsEditing(false);
                        setPrefsSaved(true);
                        setTimeout(() => setPrefsSaved(false), 2000);
                      })
                      .catch(() => {
                        setPrefsEditing(false);
                        console.error('Failed to save preferences');
                      });
                  }} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#7c4dba,#402970)', color: '#fff' }}>Save</button>
                </div>
                {prefsSaved && <div style={{ marginTop: 8, padding: '8px', borderRadius: 8, background: 'rgba(63,199,142,0.12)', border: '1px solid rgba(63,199,142,0.3)' }}>Saved</div>}
              </div>
            )}
          </div>
        );
      case "language":
        return (
          <div>
            {!languageEditing ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>Language</div>
                  <div style={{ color: '#9e8dc0', marginTop: 4 }}>{languageSelectedLocal || 'English'}</div>
                </div>
                <button type="button" onClick={() => setLanguageEditing(true)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(64,41,112,0.08)', background: 'transparent', color: '#402970', fontWeight: 700 }}>Change</button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div>
                  <p style={{ color: '#7c6a9e', fontSize: 11, fontWeight: 700 }}>Select Language</p>
                  <select value={languageSelectedLocal} onChange={(e) => setLanguageSelectedLocal(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid rgba(64,41,112,0.12)' }}>
                    <option>English</option>
                    <option>සිංහල</option>
                    <option>தமிழ்</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => setLanguageEditing(false)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid rgba(64,41,112,0.12)', background: 'transparent' }}>Cancel</button>
                  <button type="button" onClick={() => {
                    profileService.updateLanguage({ language: languageSelectedLocal })
                      .then(() => {
                        setLanguageEditing(false);
                        setLanguageSavedLocal(true);
                        setTimeout(() => setLanguageSavedLocal(false), 2000);
                      })
                      .catch(() => {
                        setLanguageEditing(false);
                        console.error('Failed to save language');
                      });
                  }} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#7c4dba,#402970)', color: '#fff' }}>Save</button>
                </div>
                {languageSavedLocal && <div style={{ marginTop: 8, padding: '8px', borderRadius: 8, background: 'rgba(63,199,142,0.12)', border: '1px solid rgba(63,199,142,0.3)' }}>Saved</div>}
              </div>
            )}
          </div>
        );
      case "account":
        return (
          <div className="flex flex-col gap-2">
            <button type="button" style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(64,41,112,0.12)", background: "transparent", color: "#402970", cursor: "pointer", textAlign: "left", fontSize: 12.5, fontWeight: 700, fontFamily: "'Nunito',sans-serif" }}>
              🔐 Change Password
            </button>
            <motion.button type="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center gap-2" style={{ padding: "10px", borderRadius: 10, border: "1.5px solid rgba(212,24,61,0.25)", background: "rgba(212,24,61,0.05)", color: "#d4183d", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "'Nunito',sans-serif" }}>
              <LogOut size={15} strokeWidth={2.5} />
              Log Out
            </motion.button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="px-5 py-4 flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {sections.map((section) => {
          const isActive = activeSection === section.key;
          return (
            <div key={section.key} style={{ width: '100%' }}>
              <button
                type="button"
                onClick={() => setActiveSection(isActive ? null : section.key)}
                className="flex items-center justify-between w-full"
                style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${isActive ? "rgba(124,77,186,0.12)" : "rgba(64,41,112,0.05)"}`, background: isActive ? "rgba(250,250,252,1)" : "rgba(255,255,255,0.98)", color: "#1a1025", cursor: "pointer", textAlign: "left", display: 'flex', alignItems: 'center', height: 40 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: isActive ? 'rgba(255,240,241,1)' : 'rgba(248,248,250,1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c6a9e', fontSize: 13 }}>{section.icon}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Nunito',sans-serif" }}>{section.label}</div>
                  </div>
                </div>
                <ChevronRight size={14} strokeWidth={2} style={{ color: '#9e8dc0', transform: isActive ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.18s' }} />
              </button>

              <AnimatePresence>
                {isActive && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    style={{ overflow: 'hidden', marginTop: 8 }}
                  >
                    <div style={{ padding: '10px 10px', borderRadius: 8, background: 'rgba(64,41,112,0.04)', border: '1px solid rgba(64,41,112,0.06)' }}>
                      {renderSectionContent()}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* consolidated: removed duplicate bottom render to avoid duplicate content */}
    </div>
  );
};

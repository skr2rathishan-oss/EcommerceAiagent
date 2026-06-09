import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Paperclip, Mic, ArrowUp, Sparkles, PanelLeft,
  SquarePen, Clock, Settings, HelpCircle, UserCircle,
  Heart, ShoppingCart, Bookmark, Globe, ChevronDown,
  X, Bell, Shield, Moon, MessageSquare, ChevronRight,
  Mail, Phone, FileText, User, Camera, LogOut,
  CheckCircle, DollarSign, Euro, PoundSterling, IndianRupee, Coins,
} from "lucide-react";
import { ProductShowcase } from "./components/ProductShowcase";
import { PRODUCTS, type Product } from "./components/products";
import { CheckoutPanel } from "./components/CheckoutPanel";

type Phase        = "centered" | "bottom";
type PanelId      = "Recent Conversations" | "Settings" | "Help & Support" | "Profile" | null;
type RightPanelId = "Wishlist" | "Cart" | "Saved" | null;
interface AnchorPos { x: number; y: number }
interface Message { role: "user" | "ai"; text: string; products?: Product[] }
interface CartItem { product: Product; qty: number }

// Demo: initial AI recommendation shown on first message
const DEMO_PRODUCTS = PRODUCTS.slice(0, 4);

// ── Sidebar items ──────────────────────────────────────────────────────────
const NAV_TOP: { icon: React.ElementType; label: string }[] = [
  { icon: SquarePen,   label: "New Chat" },
  { icon: Clock,       label: "Recent Conversations" },
];
const NAV_BOTTOM: { icon: React.ElementType; label: string }[] = [
  { icon: Settings,   label: "Settings" },
  { icon: HelpCircle, label: "Help & Support" },
  { icon: UserCircle, label: "Profile" },
];

// ── App ────────────────────────────────────────────────────────────────────
export default function App() {
  const [phase, setPhase]             = useState<Phase>("centered");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<PanelId>(null);
  const [anchorPos, setAnchorPos]     = useState<AnchorPos>({ x: 0, y: 0 });
  const [rightPanel, setRightPanel]     = useState<RightPanelId>(null);
  const [value, setValue]               = useState("");
  const [messages, setMessages]         = useState<Message[]>([]);
  const [cartItems, setCartItems]       = useState<CartItem[]>([]);
  const [wishlistItems, setWishlistItems] = useState<Product[]>([]);
  const [savedItems, setSavedItems]     = useState<Product[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [value]);

  const handleAddToCart = (p: Product) => {
    setCartItems(prev => {
      const exists = prev.find(i => i.product.id === p.id);
      if (exists) return prev.map(i => i.product.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { product: p, qty: 1 }];
    });
    setRightPanel("Cart");
  };

  const handleBuyNow = (p: Product) => {
    setCartItems(prev => {
      const exists = prev.find(i => i.product.id === p.id);
      if (exists) return prev.map(i => i.product.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { product: p, qty: 1 }];
    });
    setRightPanel("Cart");
  };

  const handleWishlist = (p: Product) => {
    setWishlistItems(prev =>
      prev.find(i => i.id === p.id) ? prev.filter(i => i.id !== p.id) : [...prev, p]
    );
    setRightPanel("Wishlist");
  };

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (phase === "centered") setPhase("bottom");
    setMessages(prev => [...prev, { role: "user", text: trimmed }]);
    setValue("");
    const lower = trimmed.toLowerCase();
    const isProductQuery = ["show", "find", "recommend", "suggest", "product", "buy", "search", "look", "headphone", "watch", "shoe", "laptop", "keyboard", "earbud"].some(k => lower.includes(k));
    setTimeout(() => {
      if (isProductQuery) {
        setMessages(prev => [...prev, {
          role: "ai",
          text: "Here are some top picks I found for you! Click any product to explore the details, or add directly to your cart.",
          products: DEMO_PRODUCTS,
        }]);
      } else {
        setMessages(prev => [...prev, { role: "ai", text: "I received your message. How else can I help you today? Try asking me to show you products or make a recommendation!" }]);
      }
    }, 800);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleItemClick = (label: string, rect: DOMRect) => {
    if (label === "New Chat") { setPhase("centered"); setMessages([]); setValue(""); return; }
    // If same panel clicked again, close it
    if (activePanel === label) { setActivePanel(null); return; }
    setAnchorPos({ x: rect.right + 8, y: rect.top + rect.height / 2 });
    setActivePanel(label as PanelId);
  };

  const canSend = value.trim().length > 0;

  return (
    <div className="size-full flex overflow-hidden" style={{ background: "#f0ebfa", fontFamily: "'Nunito',sans-serif" }}>
      {/* Sidebar */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onItemClick={handleItemClick} />

      {/* Main */}
      <div className="flex-1 flex flex-col relative overflow-hidden">

        {/* Center glow — centered phase only */}
        {phase === "centered" && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center" aria-hidden>
            <div style={{
              width: 560, height: 560, borderRadius: "50%",
              background: "radial-gradient(circle, rgba(167,139,250,0.25) 0%, rgba(139,92,246,0.12) 45%, transparent 70%)",
              filter: "blur(60px)",
            }} />
          </div>
        )}

{/* Static orbs for chat phase */}
        {phase === "bottom" && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
            <div className="absolute rounded-full blur-3xl opacity-20" style={{ width:500,height:500,top:-100,right:-80,background:"radial-gradient(circle,#7c4dba,transparent 70%)" }} />
            <div className="absolute rounded-full blur-3xl opacity-15" style={{ width:360,height:360,bottom:40,left:-60,background:"radial-gradient(circle,#9b59d0,transparent 70%)" }} />
          </div>
        )}

        <TopNavbar sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen(o => !o)} onRightPanel={(id) => setRightPanel(p => p === id ? null : id)} />

        {/* Centered phase */}
        <AnimatePresence>
          {phase === "centered" && (
            <motion.div key="centered" className="flex-1 flex flex-col items-center justify-center px-4"
              initial={{ opacity:0 }} animate={{ opacity:1 }}
              exit={{ opacity:0,y:-24,transition:{duration:0.3,ease:"easeIn"} }}
            >
              <motion.div className="text-center mb-8 select-none"
                initial={{ opacity:0,y:16 }} animate={{ opacity:1,y:0,transition:{duration:0.5} }}
              >
                <h1 style={{ color:"#1a1025",fontSize:"clamp(22px,4vw,32px)",fontWeight:700,letterSpacing:"-0.3px",lineHeight:1.25,marginBottom:10 }}>
                  How can I help you today?
                </h1>
                <p style={{ color:"#7c6a9e",fontSize:15,maxWidth:340,margin:"0 auto",lineHeight:1.6 }}>
                  Ask me anything — I'm ready to assist you.
                </p>
              </motion.div>
              <motion.div className="w-full" style={{ maxWidth:620 }}
                initial={{ opacity:0,y:20 }} animate={{ opacity:1,y:0,transition:{duration:0.5,delay:0.1} }}
              >
                <ChatInputBox value={value} onChange={setValue} onSend={handleSend}
                  onKeyDown={handleKeyDown} canSend={canSend}
                  textareaRef={textareaRef} fileInputRef={fileInputRef} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom phase */}
        {phase === "bottom" && (
          <div className="flex-1 flex flex-col min-h-0">
            <MessageArea messages={messages} onAddToCart={handleAddToCart} onBuyNow={handleBuyNow} onWishlist={handleWishlist} />
            <motion.div className="w-full px-4 pb-5 pt-3 flex justify-center"
              initial={{ opacity:0,y:40 }} animate={{ opacity:1,y:0,transition:{duration:0.45,ease:[0.22,1,0.36,1]} }}
            >
              <div className="w-full" style={{ maxWidth: 720 }}>
                <ChatInputBox value={value} onChange={setValue} onSend={handleSend}
                  onKeyDown={handleKeyDown} canSend={canSend}
                  textareaRef={textareaRef} fileInputRef={fileInputRef} />
                <p className="text-center mt-2 select-none" style={{ color:"#b8aed0",fontSize:11.5 }}>
                  Enter to send · Shift + Enter for new line
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </div>

      {/* Panel popups */}
      <AnimatePresence>
        {activePanel && (
          <PanelPopup key={activePanel} id={activePanel} anchor={anchorPos} onClose={() => setActivePanel(null)} />
        )}
      </AnimatePresence>

      {/* Right sidebar */}
      <AnimatePresence>
        {rightPanel && (
          <RightSidebar
            key={rightPanel}
            id={rightPanel}
            onClose={() => setRightPanel(null)}
            cartItems={cartItems}
            wishlistItems={wishlistItems}
            savedItems={savedItems}
            onRemoveCart={id => setCartItems(prev => prev.filter(i => i.product.id !== id))}
            onRemoveWishlist={id => setWishlistItems(prev => prev.filter(i => i.id !== id))}
            onRemoveSaved={id => setSavedItems(prev => prev.filter(i => i.id !== id))}
            onMoveToCart={p => { handleAddToCart(p); setWishlistItems(prev => prev.filter(i => i.id !== p.id)); }}
            onCheckout={() => { setRightPanel(null); setCheckoutOpen(true); }}
          />
        )}
      </AnimatePresence>

      {/* Checkout panel */}
      <AnimatePresence>
        {checkoutOpen && (
          <CheckoutPanel
            cartItems={cartItems}
            onClose={() => setCheckoutOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────
function Sidebar({ open, onClose, onItemClick }: { open: boolean; onClose: () => void; onItemClick: (label: string, rect: DOMRect) => void }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="absolute inset-0 z-30"
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            transition={{ duration:0.22 }} style={{ background:"transparent" }}
            onClick={onClose} />

          <motion.aside className="relative z-40 flex flex-col h-full"
            initial={{ width:0,opacity:0 }} animate={{ width:68,opacity:1 }} exit={{ width:0,opacity:0 }}
            transition={{ type:"spring",stiffness:320,damping:30 }}
            style={{ background:"linear-gradient(180deg,#4e337f 0%,#402970 60%,#301e56 100%)",borderRight:"none",overflow:"visible",flexShrink:0 }}
          >
            <div style={{ height:64 }} />
            <nav className="flex flex-col items-center gap-1 px-2 flex-1">
              {NAV_TOP.map(({ icon: Icon, label }) => (
                <SidebarItem key={label} icon={<Icon size={20} strokeWidth={1.8} />} label={label} onClick={onItemClick} />
              ))}
            </nav>
            <nav className="flex flex-col items-center gap-1 px-2 pb-4">
              <div style={{ height:1,width:36,background:"rgba(255,255,255,0.15)",margin:"6px 0 8px" }} />
              {NAV_BOTTOM.map(({ icon: Icon, label }) => (
                <SidebarItem key={label} icon={<Icon size={20} strokeWidth={1.8} />} label={label} onClick={onItemClick} />
              ))}
            </nav>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Sidebar item ───────────────────────────────────────────────────────────
function SidebarItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: (label: string, rect: DOMRect) => void }) {
  const [hovered, setHovered] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="relative flex items-center" style={{ width:"100%" }}>
      <motion.button ref={btnRef} type="button" whileTap={{ scale:0.9 }}
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        onClick={() => { if (btnRef.current) onClick?.(label, btnRef.current.getBoundingClientRect()); }}
        className="flex items-center justify-center"
        style={{ width:44, height:44, borderRadius:12, border:"none", cursor:"pointer", background:hovered?"rgba(255,255,255,0.15)":"transparent", color:hovered?"#fff":"rgba(255,255,255,0.6)", transition:"background 0.18s ease,color 0.18s ease" }}
      >
        {icon}
      </motion.button>

      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity:0, x:-8, scale:0.95 }} animate={{ opacity:1, x:0, scale:1 }}
            exit={{ opacity:0, x:-8, scale:0.95 }} transition={{ duration:0.15, ease:"easeOut" }}
            style={{ position:"absolute", left:54, top:"50%", transform:"translateY(-50%)", background:"rgba(26,16,37,0.92)", backdropFilter:"blur(10px)", color:"#fff", fontSize:12, fontWeight:600, padding:"6px 12px", borderRadius:8, whiteSpace:"nowrap", pointerEvents:"none", letterSpacing:"0.015em", fontFamily:"'Nunito',sans-serif", zIndex:999, boxShadow:"0 4px 16px rgba(0,0,0,0.25)" }}
          >
            <span style={{ position:"absolute", left:-5, top:"50%", transform:"translateY(-50%)", width:0, height:0, borderTop:"5px solid transparent", borderBottom:"5px solid transparent", borderRight:"5px solid rgba(26,16,37,0.92)" }} />
            {label}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Panel Popup — anchored floating card ───────────────────────────────────
const POPUP_W = 340;
const POPUP_MAX_H = 480;
const ARROW_SIZE = 8;

function PanelPopup({ id, anchor, onClose }: { id: PanelId; anchor: AnchorPos; onClose: () => void }) {
  const popupRef = useRef<HTMLDivElement>(null);

  // Clamp vertical so it never goes off screen
  const rawTop  = anchor.y - POPUP_MAX_H / 2;
  const clampedTop = Math.max(8, Math.min(rawTop, window.innerHeight - POPUP_MAX_H - 8));
  // Arrow offset relative to popup top
  const arrowOffset = anchor.y - clampedTop - ARROW_SIZE;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) onClose();
    };
    // Delay so the opening click doesn't immediately close it
    const t = setTimeout(() => document.addEventListener("mousedown", handler), 50);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", handler); };
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
        background: "#ffffff",
        borderRadius: 16,
        boxShadow: "0 8px 40px rgba(64,41,112,0.22), 0 2px 8px rgba(64,41,112,0.10)",
        border: "1px solid rgba(64,41,112,0.10)",
        overflow: "hidden",
      }}
    >
      {/* Left arrow */}
      <span style={{
        position: "absolute",
        left: -ARROW_SIZE,
        top: Math.max(16, Math.min(arrowOffset, POPUP_MAX_H - 32)),
        width: 0,
        height: 0,
        borderTop: `${ARROW_SIZE}px solid transparent`,
        borderBottom: `${ARROW_SIZE}px solid transparent`,
        borderRight: `${ARROW_SIZE}px solid #ffffff`,
        filter: "drop-shadow(-2px 0 2px rgba(64,41,112,0.08))",
        pointerEvents: "none",
      }} />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(64,41,112,0.08)", flexShrink: 0, background: "linear-gradient(135deg,rgba(124,77,186,0.06),rgba(64,41,112,0.04))" }}>
        <h3 style={{ color: "#1a1025", fontWeight: 700, fontSize: 14, fontFamily: "'Nunito',sans-serif", letterSpacing: "-0.1px" }}>{id}</h3>
        <motion.button type="button" onClick={onClose} whileTap={{ scale: 0.9 }}
          className="flex items-center justify-center"
          style={{ width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer", background: "rgba(64,41,112,0.07)", color: "#7c6a9e", flexShrink: 0 }}
        >
          <X size={13} strokeWidth={2.5} />
        </motion.button>
      </div>

      {/* Scrollable content */}
      <div style={{ overflowY: "auto", scrollbarWidth: "none", flex: 1 }}>
        {id === "Recent Conversations" && <PanelHistory />}
        {id === "Settings"             && <PanelSettings />}
        {id === "Help & Support"       && <PanelHelp />}
        {id === "Profile"              && <PanelProfile />}
      </div>
    </motion.div>
  );
}

// ── Panel: Recent Conversations ────────────────────────────────────────────
const HISTORY = [
  { title:"How to improve productivity?",          time:"2 mins ago",   tag:"General" },
  { title:"Explain quantum computing",             time:"1 hour ago",   tag:"Science" },
  { title:"Write a cover letter for a designer",  time:"Yesterday",    tag:"Writing" },
  { title:"Best restaurants in Colombo",          time:"2 days ago",   tag:"Travel" },
  { title:"React state management patterns",      time:"3 days ago",   tag:"Code" },
  { title:"Summarise this research paper",        time:"Last week",    tag:"Research" },
];

function PanelHistory() {
  return (
    <div className="px-5 py-4 flex flex-col gap-2">
      {HISTORY.map((h, i) => (
        <motion.div key={i} initial={{ opacity:0,y:10 }} animate={{ opacity:1,y:0 }} transition={{ delay:i*0.04 }}
          className="flex items-center justify-between gap-3 cursor-pointer group"
          style={{ padding:"12px 14px",borderRadius:12,background:"rgba(64,41,112,0.04)",border:"1px solid rgba(64,41,112,0.08)",transition:"background 0.15s" }}
          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background="rgba(64,41,112,0.09)"}
          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background="rgba(64,41,112,0.04)"}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div style={{ width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#7c4dba,#402970)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
              <MessageSquare size={16} color="#fff" strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <p style={{ color:"#1a1025",fontSize:13,fontWeight:600,fontFamily:"'Nunito',sans-serif",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{h.title}</p>
              <p style={{ color:"#9e8dc0",fontSize:11,fontFamily:"'Nunito',sans-serif",marginTop:2 }}>{h.time}</p>
            </div>
          </div>
          <div style={{ flexShrink:0 }}>
            <span style={{ fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:20,background:"rgba(64,41,112,0.1)",color:"#402970",fontFamily:"'Nunito',sans-serif",letterSpacing:"0.03em" }}>{h.tag}</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ── Panel: Settings ────────────────────────────────────────────────────────
function PanelSettings() {
  const [darkMode, setDarkMode]   = useState(false);
  const [notifs, setNotifs]       = useState(true);
  const [privacy, setPrivacy]     = useState(false);
  const [currency, setCurrency]   = useState("USD");

  const rows = [
    { icon:<Moon size={18} strokeWidth={2} />,  label:"Dark Mode",       sub:"Switch to dark theme",           value:darkMode, set:setDarkMode },
    { icon:<Bell size={18} strokeWidth={2} />,  label:"Notifications",   sub:"Get updates and alerts",         value:notifs,   set:setNotifs },
    { icon:<Shield size={18} strokeWidth={2} />,label:"Privacy Mode",    sub:"Hide chat history",              value:privacy,  set:setPrivacy },
  ];

  const links = [
    { icon:<FileText size={16} strokeWidth={2} />, label:"Terms of Service" },
    { icon:<Shield size={16} strokeWidth={2} />,   label:"Privacy Policy" },
    { icon:<HelpCircle size={16} strokeWidth={2} />,label:"About" },
  ];

  return (
    <div className="px-5 py-4 flex flex-col gap-4">
      {/* Toggles */}
      <p style={{ color:"#9e8dc0",fontSize:11,fontWeight:700,letterSpacing:"0.08em",fontFamily:"'Nunito',sans-serif",textTransform:"uppercase" }}>Preferences</p>
      <div className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <motion.div key={i} initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} transition={{ delay:i*0.06 }}
            className="flex items-center justify-between"
            style={{ padding:"14px 16px",borderRadius:14,background:"rgba(64,41,112,0.04)",border:"1px solid rgba(64,41,112,0.08)" }}
          >
            <div className="flex items-center gap-3">
              <div style={{ width:36,height:36,borderRadius:10,background:r.value?"linear-gradient(135deg,#7c4dba,#402970)":"rgba(64,41,112,0.1)",display:"flex",alignItems:"center",justifyContent:"center",transition:"background 0.2s",color:r.value?"#fff":"#7c6a9e" }}>
                {r.icon}
              </div>
              <div>
                <p style={{ color:"#1a1025",fontSize:13,fontWeight:600,fontFamily:"'Nunito',sans-serif" }}>{r.label}</p>
                <p style={{ color:"#9e8dc0",fontSize:11,fontFamily:"'Nunito',sans-serif",marginTop:1 }}>{r.sub}</p>
              </div>
            </div>
            <button type="button" onClick={() => r.set(!r.value)}
              style={{ width:44,height:24,borderRadius:12,border:"none",cursor:"pointer",background:r.value?"#402970":"rgba(64,41,112,0.2)",position:"relative",transition:"background 0.2s",flexShrink:0 }}
            >
              <motion.span animate={{ x:r.value?20:2 }} transition={{ type:"spring",stiffness:400,damping:25 }}
                style={{ position:"absolute",top:3,left:0,width:18,height:18,borderRadius:"50%",background:"#fff",boxShadow:"0 1px 4px rgba(0,0,0,0.2)" }}
              />
            </button>
          </motion.div>
        ))}
      </div>

      <p style={{ color:"#9e8dc0",fontSize:11,fontWeight:700,letterSpacing:"0.08em",fontFamily:"'Nunito',sans-serif",textTransform:"uppercase",marginTop:8 }}>Currency</p>
      <motion.div initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} transition={{ delay:0.18 }}
        style={{ padding:"14px 16px",borderRadius:14,background:"rgba(64,41,112,0.04)",border:"1px solid rgba(64,41,112,0.08)" }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div style={{ width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#7c4dba,#402970)",display:"flex",alignItems:"center",justifyContent:"center" }}>
            <Coins size={18} color="#fff" strokeWidth={2} />
          </div>
          <div>
            <p style={{ color:"#1a1025",fontSize:13,fontWeight:600,fontFamily:"'Nunito',sans-serif" }}>Currency</p>
            <p style={{ color:"#9e8dc0",fontSize:11,fontFamily:"'Nunito',sans-serif",marginTop:1 }}>Select display currency</p>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          {CURRENCIES.map((c) => {
            const CIcon = c.icon;
            const active = currency === c.code;
            return (
              <button key={c.code} type="button" onClick={() => setCurrency(c.code)}
                className="flex items-center gap-2 w-full"
                style={{ padding:"9px 12px",borderRadius:10,border:`1.5px solid ${active?"rgba(64,41,112,0.45)":"rgba(64,41,112,0.1)"}`,background:active?"rgba(64,41,112,0.1)":"transparent",cursor:"pointer",transition:"background 0.15s,border-color 0.15s",textAlign:"left" }}
              >
                <CIcon size={14} strokeWidth={2} color={active?"#402970":"#9e8dc0"} />
                <span style={{ color:active?"#402970":"#3a2a55",fontSize:13,fontWeight:active?700:500,fontFamily:"'Nunito',sans-serif",flex:1 }}>{c.label}</span>
                {active && <span style={{ width:7,height:7,borderRadius:"50%",background:"#402970",flexShrink:0 }} />}
              </button>
            );
          })}
        </div>
      </motion.div>

      <p style={{ color:"#9e8dc0",fontSize:11,fontWeight:700,letterSpacing:"0.08em",fontFamily:"'Nunito',sans-serif",textTransform:"uppercase",marginTop:8 }}>More</p>
      <div className="flex flex-col gap-2">
        {links.map((l, i) => (
          <motion.div key={i} initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} transition={{ delay:0.18+i*0.06 }}
            className="flex items-center justify-between cursor-pointer"
            style={{ padding:"13px 16px",borderRadius:14,background:"rgba(64,41,112,0.04)",border:"1px solid rgba(64,41,112,0.08)",transition:"background 0.15s" }}
            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background="rgba(64,41,112,0.09)"}
            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background="rgba(64,41,112,0.04)"}
          >
            <div className="flex items-center gap-3" style={{ color:"#7c6a9e" }}>
              {l.icon}
              <span style={{ color:"#1a1025",fontSize:13,fontWeight:600,fontFamily:"'Nunito',sans-serif" }}>{l.label}</span>
            </div>
            <ChevronRight size={15} strokeWidth={2} color="#9e8dc0" />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── Panel: Help & Support ──────────────────────────────────────────────────
const FAQS = [
  { q:"How do I start a new chat?",         a:"Click the New Chat icon in the sidebar or press the New Chat button." },
  { q:"Can I upload files to the chat?",    a:"Yes — click the paperclip icon in the chat input bar to attach files." },
  { q:"How do I change the language?",      a:"Use the language selector in the top navbar to switch between English, Tamil, and Sinhala." },
  { q:"Is my chat history saved?",          a:"Recent conversations are listed under the Recent Conversations section in the sidebar." },
];

function PanelHelp() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="px-5 py-4 flex flex-col gap-4">
      {/* Contact cards */}
      <p style={{ color:"#9e8dc0",fontSize:11,fontWeight:700,letterSpacing:"0.08em",fontFamily:"'Nunito',sans-serif",textTransform:"uppercase" }}>Contact Us</p>
      <div className="flex flex-col gap-2">
        {[
          { icon:<Mail size={18} strokeWidth={2} />,  label:"Email Support",  sub:"support@example.com",    color:"#6d3fc7" },
          { icon:<Phone size={18} strokeWidth={2} />, label:"Phone Support",  sub:"+94 77 123 4567",         color:"#3f7fc7" },
          { icon:<MessageSquare size={18} strokeWidth={2} />, label:"Live Chat", sub:"Available 9 AM – 6 PM", color:"#3fc78e" },
        ].map((c, i) => (
          <motion.div key={i} initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} transition={{ delay:i*0.07 }}
            className="flex items-center gap-3 cursor-pointer"
            style={{ padding:"13px 16px",borderRadius:14,background:"rgba(64,41,112,0.04)",border:"1px solid rgba(64,41,112,0.08)",transition:"background 0.15s" }}
            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background="rgba(64,41,112,0.09)"}
            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background="rgba(64,41,112,0.04)"}
          >
            <div style={{ width:38,height:38,borderRadius:11,background:`${c.color}18`,display:"flex",alignItems:"center",justifyContent:"center",color:c.color,flexShrink:0 }}>
              {c.icon}
            </div>
            <div>
              <p style={{ color:"#1a1025",fontSize:13,fontWeight:600,fontFamily:"'Nunito',sans-serif" }}>{c.label}</p>
              <p style={{ color:"#9e8dc0",fontSize:11,fontFamily:"'Nunito',sans-serif",marginTop:1 }}>{c.sub}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* FAQ */}
      <p style={{ color:"#9e8dc0",fontSize:11,fontWeight:700,letterSpacing:"0.08em",fontFamily:"'Nunito',sans-serif",textTransform:"uppercase",marginTop:8 }}>FAQs</p>
      <div className="flex flex-col gap-2">
        {FAQS.map((f, i) => (
          <motion.div key={i} initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} transition={{ delay:0.21+i*0.06 }}
            style={{ borderRadius:14,background:"rgba(64,41,112,0.04)",border:"1px solid rgba(64,41,112,0.08)",overflow:"hidden" }}
          >
            <button type="button" onClick={() => setOpenFaq(openFaq===i?null:i)}
              className="flex items-center justify-between w-full"
              style={{ padding:"13px 16px",background:"transparent",border:"none",cursor:"pointer",textAlign:"left" }}
            >
              <span style={{ color:"#1a1025",fontSize:13,fontWeight:600,fontFamily:"'Nunito',sans-serif",paddingRight:12 }}>{f.q}</span>
              <motion.span animate={{ rotate:openFaq===i?90:0 }} transition={{ duration:0.2 }} style={{ flexShrink:0,color:"#9e8dc0",display:"flex" }}>
                <ChevronRight size={15} strokeWidth={2.5} />
              </motion.span>
            </button>
            <AnimatePresence>
              {openFaq===i && (
                <motion.div initial={{ height:0,opacity:0 }} animate={{ height:"auto",opacity:1 }} exit={{ height:0,opacity:0 }}
                  transition={{ duration:0.22,ease:"easeOut" }} style={{ overflow:"hidden" }}
                >
                  <p style={{ color:"#7c6a9e",fontSize:12,fontFamily:"'Nunito',sans-serif",lineHeight:1.65,padding:"0 16px 14px" }}>{f.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── Panel: Profile ─────────────────────────────────────────────────────────
function PanelProfile() {
  const [name, setName]   = useState("Alex Johnson");
  const [email, setEmail] = useState("alex@example.com");
  const [editing, setEditing] = useState(false);
  const [saved, setSaved]     = useState(false);

  const handleSave = () => {
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="px-5 py-4 flex flex-col gap-4">
      {/* Avatar */}
      <motion.div initial={{ opacity:0,y:10 }} animate={{ opacity:1,y:0 }} className="flex flex-col items-center gap-3 py-4">
        <div className="relative">
          <div style={{ width:80,height:80,borderRadius:24,background:"linear-gradient(135deg,#7c4dba,#402970)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 8px 24px rgba(64,41,112,0.35)" }}>
            <User size={36} color="#fff" strokeWidth={1.6} />
          </div>
          <button type="button" style={{ position:"absolute",bottom:-4,right:-4,width:28,height:28,borderRadius:9999,background:"#402970",border:"2.5px solid #fff",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer" }}>
            <Camera size={12} color="#fff" strokeWidth={2.5} />
          </button>
        </div>
        <div className="text-center">
          <p style={{ color:"#1a1025",fontSize:16,fontWeight:700,fontFamily:"'Nunito',sans-serif" }}>{name}</p>
          <p style={{ color:"#9e8dc0",fontSize:12,fontFamily:"'Nunito',sans-serif",marginTop:2 }}>{email}</p>
        </div>
      </motion.div>

      {/* Fields */}
      <p style={{ color:"#9e8dc0",fontSize:11,fontWeight:700,letterSpacing:"0.08em",fontFamily:"'Nunito',sans-serif",textTransform:"uppercase" }}>Account Details</p>
      <div className="flex flex-col gap-3">
        {[
          { label:"Full Name", value:name, set:setName },
          { label:"Email",     value:email, set:setEmail },
        ].map((f, i) => (
          <motion.div key={i} initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} transition={{ delay:i*0.07 }}>
            <p style={{ color:"#7c6a9e",fontSize:11,fontWeight:700,marginBottom:5,fontFamily:"'Nunito',sans-serif" }}>{f.label}</p>
            <input
              disabled={!editing}
              value={f.value}
              onChange={e => f.set(e.target.value)}
              style={{ width:"100%",padding:"11px 14px",borderRadius:12,border:`1.5px solid ${editing?"rgba(64,41,112,0.45)":"rgba(64,41,112,0.12)"}`,background:editing?"#fff":"rgba(64,41,112,0.04)",color:"#1a1025",fontSize:13,fontWeight:600,fontFamily:"'Nunito',sans-serif",outline:"none",transition:"border 0.15s,background 0.15s",boxSizing:"border-box" }}
            />
          </motion.div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-2">
        {!editing ? (
          <button type="button" onClick={() => setEditing(true)}
            style={{ flex:1,padding:"11px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#7c4dba,#402970)",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito',sans-serif" }}>
            Edit Profile
          </button>
        ) : (
          <>
            <button type="button" onClick={() => setEditing(false)}
              style={{ flex:1,padding:"11px",borderRadius:12,border:"1.5px solid rgba(64,41,112,0.2)",background:"transparent",color:"#7c6a9e",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito',sans-serif" }}>
              Cancel
            </button>
            <button type="button" onClick={handleSave}
              style={{ flex:1,padding:"11px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#7c4dba,#402970)",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito',sans-serif" }}>
              Save Changes
            </button>
          </>
        )}
      </div>

      <AnimatePresence>
        {saved && (
          <motion.div initial={{ opacity:0,y:4 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }}
            className="flex items-center gap-2" style={{ padding:"10px 14px",borderRadius:12,background:"rgba(63,199,142,0.12)",border:"1px solid rgba(63,199,142,0.3)" }}
          >
            <CheckCircle size={15} color="#3fc78e" strokeWidth={2.5} />
            <span style={{ color:"#2a9e6a",fontSize:12,fontWeight:600,fontFamily:"'Nunito',sans-serif" }}>Profile saved successfully</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logout */}
      <motion.button type="button" initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.25 }}
        className="flex items-center justify-center gap-2 mt-2"
        style={{ padding:"11px",borderRadius:12,border:"1.5px solid rgba(212,24,61,0.25)",background:"rgba(212,24,61,0.05)",color:"#d4183d",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito',sans-serif" }}
      >
        <LogOut size={15} strokeWidth={2.5} />
        Sign Out
      </motion.button>
    </div>
  );
}

// ── Toggle Button ──────────────────────────────────────────────────────────
function ToggleButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div className="flex items-center gap-2" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <motion.button type="button" onClick={onClick} whileTap={{ scale:0.9 }}
        transition={{ type:"spring",stiffness:400,damping:20 }}
        className="flex items-center justify-center"
        style={{ width:40,height:40,borderRadius:12,border:"none",cursor:"pointer",background:hovered||open?"linear-gradient(135deg,#7c4dba,#402970)":"rgba(255,255,255,0.7)",boxShadow:hovered||open?"0 4px 16px rgba(64,41,112,0.28)":"0 1px 6px rgba(64,41,112,0.10)",backdropFilter:"blur(8px)",transition:"background 0.2s,box-shadow 0.2s" }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {hovered||open ? (
            <motion.span key="panel" initial={{ opacity:0,scale:0.7,rotate:-15 }} animate={{ opacity:1,scale:1,rotate:0 }} exit={{ opacity:0,scale:0.7,rotate:15 }} transition={{ duration:0.16 }} style={{ display:"flex" }}>
              <PanelLeft size={18} color="#fff" strokeWidth={2} />
            </motion.span>
          ) : (
            <motion.span key="sparkles" initial={{ opacity:0,scale:0.7,rotate:15 }} animate={{ opacity:1,scale:1,rotate:0 }} exit={{ opacity:0,scale:0.7,rotate:-15 }} transition={{ duration:0.16 }} style={{ display:"flex" }}>
              <Sparkles size={18} color="#7c4dba" strokeWidth={2} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
      <AnimatePresence>
        {hovered && (
          <motion.div initial={{ opacity:0,x:-6 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-6 }}
            transition={{ duration:0.15 }}
            style={{ background:"rgba(26,16,37,0.82)",backdropFilter:"blur(8px)",color:"#fff",fontSize:12,fontWeight:500,padding:"5px 10px",borderRadius:8,whiteSpace:"nowrap",pointerEvents:"none",letterSpacing:"0.01em",fontFamily:"'Nunito',sans-serif" }}
          >
            {open?"Close sidebar":"Open sidebar"}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Top Navbar ─────────────────────────────────────────────────────────────
const LANGUAGES = [
  { code:"en", label:"English", short:"ENG" },
  { code:"ta", label:"தமிழ்",  short:"TAM" },
  { code:"si", label:"සිංහල",  short:"SIN" },
];

const CURRENCIES: { code: string; symbol: string; label: string; icon: React.ElementType }[] = [
  { code:"USD", symbol:"$",  label:"USD – US Dollar",        icon: DollarSign },
  { code:"EUR", symbol:"€",  label:"EUR – Euro",             icon: Euro },
  { code:"GBP", symbol:"£",  label:"GBP – British Pound",    icon: PoundSterling },
  { code:"LKR", symbol:"Rs", label:"LKR – Sri Lankan Rupee", icon: Coins },
  { code:"INR", symbol:"₹",  label:"INR – Indian Rupee",     icon: IndianRupee },
];

function TopNavbar({ sidebarOpen, onToggleSidebar, onRightPanel }: { sidebarOpen: boolean; onToggleSidebar: () => void; onRightPanel: (id: RightPanelId) => void }) {
  const [lang, setLang]         = useState("en");
  const [langOpen, setLangOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setLangOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const currentLang = LANGUAGES.find(l => l.code===lang)!;

  return (
    <div className="relative z-10 flex items-center justify-between px-4"
      style={{ height:56,background:"rgba(255,255,255,0.55)",backdropFilter:"blur(14px)",borderBottom:"1px solid rgba(64,41,112,0.10)",flexShrink:0 }}
    >
      <ToggleButton open={sidebarOpen} onClick={onToggleSidebar} />

      <div className="flex items-center gap-1">
        <NavbarIconBtn icon={<Heart size={19} strokeWidth={1.9} />} label="Wishlist" onClick={() => onRightPanel("Wishlist")} />
        <NavbarIconBtn icon={<ShoppingCart size={19} strokeWidth={1.9} />} label="Cart" onClick={() => onRightPanel("Cart")} />
        <NavbarIconBtn icon={<Bookmark size={19} strokeWidth={1.9} />} label="Saved" onClick={() => onRightPanel("Saved")} />
        <div style={{ width:1,height:22,background:"rgba(64,41,112,0.15)",margin:"0 6px" }} />

        <div ref={dropRef} className="relative">
          <button type="button" onClick={() => setLangOpen(o=>!o)}
            className="flex items-center gap-1.5"
            style={{ height:34,padding:"0 10px",borderRadius:9999,border:`1px solid ${langOpen?"rgba(64,41,112,0.45)":"rgba(64,41,112,0.18)"}`,background:langOpen?"rgba(64,41,112,0.08)":"rgba(255,255,255,0.7)",color:"#402970",cursor:"pointer",fontFamily:"'Nunito',sans-serif",fontSize:13,fontWeight:600,transition:"background 0.15s,border-color 0.15s",whiteSpace:"nowrap" }}
          >
            <Globe size={14} strokeWidth={2} />
            <span>{currentLang.short}</span>
            <motion.span animate={{ rotate:langOpen?180:0 }} transition={{ duration:0.2 }} style={{ display:"flex",alignItems:"center" }}>
              <ChevronDown size={13} strokeWidth={2.5} />
            </motion.span>
          </button>

          <AnimatePresence>
            {langOpen && (
              <motion.div initial={{ opacity:0,y:-6,scale:0.96 }} animate={{ opacity:1,y:0,scale:1 }} exit={{ opacity:0,y:-6,scale:0.96 }}
                transition={{ duration:0.15,ease:"easeOut" }}
                style={{ position:"absolute",top:"calc(100% + 6px)",right:0,minWidth:130,background:"rgba(255,255,255,0.96)",backdropFilter:"blur(16px)",borderRadius:12,border:"1px solid rgba(64,41,112,0.14)",boxShadow:"0 8px 28px rgba(64,41,112,0.14)",overflow:"hidden",zIndex:100 }}
              >
                {LANGUAGES.map((l, i) => (
                  <button key={l.code} type="button" onClick={() => { setLang(l.code); setLangOpen(false); }}
                    className="flex items-center w-full gap-2"
                    style={{ padding:"9px 14px",background:lang===l.code?"rgba(64,41,112,0.09)":"transparent",color:lang===l.code?"#402970":"#3a2a55",fontFamily:"'Nunito',sans-serif",fontSize:13,fontWeight:lang===l.code?700:500,cursor:"pointer",borderBottom:i<LANGUAGES.length-1?"1px solid rgba(64,41,112,0.07)":"none",transition:"background 0.12s",textAlign:"left" }}
                    onMouseEnter={e => { if(lang!==l.code)(e.currentTarget as HTMLButtonElement).style.background="rgba(64,41,112,0.05)"; }}
                    onMouseLeave={e => { if(lang!==l.code)(e.currentTarget as HTMLButtonElement).style.background="transparent"; }}
                  >
                    {lang===l.code ? <span style={{ width:6,height:6,borderRadius:"50%",background:"#402970",flexShrink:0 }} /> : <span style={{ width:6 }} />}
                    {l.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}

// ── Navbar icon button ─────────────────────────────────────────────────────
function NavbarIconBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div className="relative flex items-center justify-center">
      <motion.button type="button" whileTap={{ scale:0.88 }} onClick={onClick}
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        className="flex items-center justify-center"
        style={{ width:36,height:36,borderRadius:10,border:"none",cursor:"pointer",background:hovered?"rgba(64,41,112,0.09)":"transparent",color:hovered?"#402970":"#7c6a9e",transition:"background 0.15s,color 0.15s" }}
      >
        {icon}
      </motion.button>
      <AnimatePresence>
        {hovered && (
          <motion.div initial={{ opacity:0,y:4 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:4 }}
            transition={{ duration:0.13 }}
            style={{ position:"absolute",top:"calc(100% + 6px)",left:"50%",transform:"translateX(-50%)",background:"rgba(26,16,37,0.84)",backdropFilter:"blur(8px)",color:"#fff",fontSize:11,fontWeight:500,padding:"4px 9px",borderRadius:7,whiteSpace:"nowrap",pointerEvents:"none",fontFamily:"'Nunito',sans-serif",zIndex:50 }}
          >
            {label}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Chat Input Box ─────────────────────────────────────────────────────────
function ChatInputBox({ value, onChange, onSend, onKeyDown, canSend, textareaRef, fileInputRef }: {
  value: string; onChange: (v: string) => void; onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void; canSend: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>; fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ background:"rgba(255,255,255,0.92)",backdropFilter:"blur(12px)",borderRadius:9999,border:`1.5px solid ${focused?"rgba(64,41,112,0.55)":"rgba(64,41,112,0.15)"}`,boxShadow:"none",transition:"border-color 0.18s" }}>
      <div className="flex items-center gap-2 px-3 py-2">
        <input ref={fileInputRef} type="file" multiple className="hidden" aria-label="Upload file" />
        <IconBtn onClick={() => fileInputRef.current?.click()} title="Attach file"><Paperclip size={18} strokeWidth={2} /></IconBtn>
        <textarea ref={textareaRef} value={value} onChange={e => onChange(e.target.value)} onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          placeholder="Message…" rows={1}
          className="flex-1 bg-transparent resize-none outline-none text-foreground placeholder:text-muted-foreground"
          style={{ lineHeight:1.4,minHeight:28,maxHeight:120,fontFamily:"'Nunito',sans-serif",fontSize:14,paddingTop:2,paddingBottom:2 }}
        />
        <div className="flex items-center gap-1" style={{ flexShrink:0 }}>
          <IconBtn title="Voice message"><Mic size={17} strokeWidth={2} /></IconBtn>
          <motion.button type="button" onClick={onSend} disabled={!canSend}
            whileTap={canSend?{scale:0.9}:{}} transition={{ type:"spring",stiffness:400,damping:20 }}
            className="flex items-center justify-center"
            style={{ width:32,height:32,borderRadius:9999,flexShrink:0,border:"none",cursor:canSend?"pointer":"default",background:canSend?"linear-gradient(135deg,#7c4dba,#402970)":"rgba(64,41,112,0.1)",color:canSend?"#fff":"#b8aed0",transition:"background 0.18s,color 0.18s" }}
          >
            <ArrowUp size={17} strokeWidth={2.5} />
          </motion.button>
        </div>
      </div>
    </div>
  );
}

// ── Icon Button ────────────────────────────────────────────────────────────
function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick?: () => void; title?: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button type="button" onClick={onClick} title={title}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      className="flex items-center justify-center"
      style={{ width:32,height:32,borderRadius:9999,border:"none",cursor:"pointer",background:hovered?"rgba(64,41,112,0.08)":"transparent",color:hovered?"#402970":"#9e8dc0",transition:"background 0.15s,color 0.15s" }}
    >
      {children}
    </button>
  );
}

// ── Message Area ───────────────────────────────────────────────────────────
function MessageArea({ messages, onAddToCart, onBuyNow, onWishlist }: { messages: Message[]; onAddToCart: (p: Product) => void; onBuyNow: (p: Product) => void; onWishlist: (p: Product) => void }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [selectedIds, setSelectedIds] = useState<Record<number, string | null>>({});

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6" style={{ scrollbarWidth:"none" }}>
      <div className="flex flex-col gap-5 mx-auto" style={{ maxWidth: 760 }}>
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div key={i} initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }} transition={{ duration:0.3,ease:"easeOut" }}>
              {/* Bubble */}
              <div className={`flex ${msg.role==="user"?"justify-end":"justify-start"}`}>
                <div style={{ maxWidth:"82%",padding:"11px 16px",borderRadius:msg.role==="user"?"18px 18px 6px 18px":"18px 18px 18px 6px",background:msg.role==="user"?"linear-gradient(135deg,#7c4dba,#402970)":"rgba(255,255,255,0.88)",color:msg.role==="user"?"#fff":"#1a1025",fontSize:14,lineHeight:1.65,fontFamily:"'Nunito',sans-serif",boxShadow:msg.role==="user"?"0 4px 14px rgba(64,41,112,0.28)":"0 2px 10px rgba(64,41,112,0.08)",backdropFilter:msg.role==="ai"?"blur(8px)":undefined,border:msg.role==="ai"?"1px solid rgba(64,41,112,0.1)":"none" }}>
                  {msg.text}
                </div>
              </div>

              {/* Product showcase — inline within chat */}
              {msg.role === "ai" && msg.products && msg.products.length > 0 && (
                <motion.div
                  initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.35, delay:0.1 }}
                  style={{ marginTop: 12 }}
                >
                  <ProductShowcase
                    products={msg.products}
                    selectedId={selectedIds[i] ?? null}
                    onSelect={p => setSelectedIds(prev => ({ ...prev, [i]: p ? p.id : null }))}
                    onAddToCart={onAddToCart}
                    onBuyNow={onBuyNow}
                    onWishlist={onWishlist}
                  />
                </motion.div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ── Right Sidebar ──────────────────────────────────────────────────────────
function RightSidebar({
  id, onClose,
  cartItems, wishlistItems, savedItems,
  onRemoveCart, onRemoveWishlist, onRemoveSaved, onMoveToCart, onCheckout,
}: {
  id: RightPanelId;
  onClose: () => void;
  cartItems: CartItem[];
  wishlistItems: Product[];
  savedItems: Product[];
  onRemoveCart: (id: string) => void;
  onRemoveWishlist: (id: string) => void;
  onRemoveSaved: (id: string) => void;
  onMoveToCart: (p: Product) => void;
  onCheckout: () => void;
}) {
  const Icon = id === "Wishlist" ? Heart : id === "Cart" ? ShoppingCart : Bookmark;

  const cartTotal = cartItems.reduce((sum, i) => sum + i.product.price * i.qty, 0);

  const renderEmpty = () => (
    <div className="flex flex-col items-center justify-center h-full gap-3" style={{ padding: "40px 20px", color: "#b8aed0" }}>
      <Icon size={36} strokeWidth={1.4} />
      <p style={{ fontSize: 13, fontWeight: 600, fontFamily: "'Nunito',sans-serif", textAlign: "center" }}>
        {id === "Cart" ? "Your cart is empty" : id === "Wishlist" ? "No wishlist items yet" : "Nothing saved yet"}
      </p>
      <p style={{ fontSize: 11, fontFamily: "'Nunito',sans-serif", textAlign: "center", maxWidth: 200 }}>
        {id === "Cart" ? "Add products using the Add to Cart button" : id === "Wishlist" ? "Click the Wishlist button on any product" : "Save products to find them later"}
      </p>
    </div>
  );

  return (
    <>
      <motion.div
        className="fixed inset-0 z-40"
        style={{ background:"rgba(26,16,37,0.25)", backdropFilter:"blur(2px)" }}
        initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        transition={{ duration:0.22 }}
        onClick={onClose}
      />
      <motion.aside
        className="fixed top-0 right-0 h-full z-50 flex flex-col"
        style={{ width:320, background:"#fff", boxShadow:"-8px 0 40px rgba(64,41,112,0.18)", borderLeft:"1px solid rgba(64,41,112,0.1)" }}
        initial={{ x:320 }} animate={{ x:0 }} exit={{ x:320 }}
        transition={{ type:"spring", stiffness:320, damping:32 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom:"1px solid rgba(64,41,112,0.09)", background:"linear-gradient(135deg,rgba(124,77,186,0.06),rgba(64,41,112,0.03))", flexShrink:0 }}>
          <div className="flex items-center gap-2">
            <div style={{ width:34,height:34,borderRadius:10,background:"linear-gradient(135deg,#7c4dba,#402970)",display:"flex",alignItems:"center",justifyContent:"center" }}>
              <Icon size={17} color="#fff" strokeWidth={2} />
            </div>
            <h2 style={{ color:"#1a1025",fontWeight:700,fontSize:15,fontFamily:"'Nunito',sans-serif" }}>{id}</h2>
            <span style={{ fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20,background:"rgba(64,41,112,0.1)",color:"#402970",fontFamily:"'Nunito',sans-serif" }}>
              {id === "Cart" ? cartItems.length : id === "Wishlist" ? wishlistItems.length : savedItems.length}
            </span>
          </div>
          <motion.button type="button" onClick={onClose} whileTap={{ scale:0.9 }}
            className="flex items-center justify-center"
            style={{ width:30,height:30,borderRadius:9,border:"none",cursor:"pointer",background:"rgba(64,41,112,0.07)",color:"#7c6a9e" }}
          >
            <X size={14} strokeWidth={2.5} />
          </motion.button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth:"none" }}>
          {id === "Cart" && (
            cartItems.length === 0 ? renderEmpty() :
            <div className="flex flex-col gap-3">
              {cartItems.map((item, i) => (
                <motion.div key={item.product.id} initial={{ opacity:0,x:20 }} animate={{ opacity:1,x:0 }} transition={{ delay:i*0.05 }}
                  className="flex items-center gap-3"
                  style={{ padding:"12px 14px",borderRadius:14,background:"rgba(64,41,112,0.04)",border:"1px solid rgba(64,41,112,0.08)" }}
                >
                  <div style={{ width:42,height:42,borderRadius:12,overflow:"hidden",flexShrink:0,background:"linear-gradient(135deg,#f5f0ff,#ede4ff)" }}>
                    <img src={item.product.images[0]} alt={item.product.name} style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ color:"#1a1025",fontSize:13,fontWeight:600,fontFamily:"'Nunito',sans-serif",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{item.product.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span style={{ color:"#402970",fontSize:12,fontWeight:700,fontFamily:"'Nunito',sans-serif" }}>${item.product.price.toFixed(2)}</span>
                      <span style={{ color:"#9e8dc0",fontSize:11,fontFamily:"'Nunito',sans-serif" }}>×{item.qty}</span>
                      <span style={{ fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:20,background:"rgba(64,41,112,0.08)",color:"#7c6a9e",fontFamily:"'Nunito',sans-serif" }}>{item.product.category}</span>
                    </div>
                  </div>
                  <motion.button type="button" whileTap={{ scale:0.88 }} onClick={() => onRemoveCart(item.product.id)}
                    className="flex items-center justify-center"
                    style={{ width:28,height:28,borderRadius:8,border:"none",cursor:"pointer",background:"rgba(212,24,61,0.07)",color:"#d4183d",flexShrink:0 }}
                  >
                    <X size={12} strokeWidth={2.5} />
                  </motion.button>
                </motion.div>
              ))}
            </div>
          )}

          {id === "Wishlist" && (
            wishlistItems.length === 0 ? renderEmpty() :
            <div className="flex flex-col gap-3">
              {wishlistItems.map((product, i) => (
                <motion.div key={product.id} initial={{ opacity:0,x:20 }} animate={{ opacity:1,x:0 }} transition={{ delay:i*0.05 }}
                  className="flex items-center gap-3"
                  style={{ padding:"12px 14px",borderRadius:14,background:"rgba(64,41,112,0.04)",border:"1px solid rgba(64,41,112,0.08)" }}
                >
                  <div style={{ width:42,height:42,borderRadius:12,overflow:"hidden",flexShrink:0,background:"linear-gradient(135deg,#f5f0ff,#ede4ff)" }}>
                    <img src={product.images[0]} alt={product.name} style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ color:"#1a1025",fontSize:13,fontWeight:600,fontFamily:"'Nunito',sans-serif",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{product.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span style={{ color:"#402970",fontSize:12,fontWeight:700,fontFamily:"'Nunito',sans-serif" }}>${product.price.toFixed(2)}</span>
                      <span style={{ fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:20,background:"rgba(64,41,112,0.08)",color:"#7c6a9e",fontFamily:"'Nunito',sans-serif" }}>{product.category}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <motion.button type="button" whileTap={{ scale:0.88 }} onClick={() => onMoveToCart(product)}
                      style={{ padding:"4px 8px",borderRadius:7,border:"none",cursor:"pointer",background:"linear-gradient(135deg,#7c4dba,#402970)",color:"#fff",fontSize:10,fontWeight:700,fontFamily:"'Nunito',sans-serif" }}
                    >
                      Add to Cart
                    </motion.button>
                    <motion.button type="button" whileTap={{ scale:0.88 }} onClick={() => onRemoveWishlist(product.id)}
                      className="flex items-center justify-center"
                      style={{ width:"100%",padding:"4px",borderRadius:7,border:"none",cursor:"pointer",background:"rgba(212,24,61,0.07)",color:"#d4183d" }}
                    >
                      <X size={11} strokeWidth={2.5} />
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {id === "Saved" && (
            savedItems.length === 0 ? renderEmpty() :
            <div className="flex flex-col gap-3">
              {savedItems.map((product, i) => (
                <motion.div key={product.id} initial={{ opacity:0,x:20 }} animate={{ opacity:1,x:0 }} transition={{ delay:i*0.05 }}
                  className="flex items-center gap-3"
                  style={{ padding:"12px 14px",borderRadius:14,background:"rgba(64,41,112,0.04)",border:"1px solid rgba(64,41,112,0.08)" }}
                >
                  <div style={{ width:42,height:42,borderRadius:12,overflow:"hidden",flexShrink:0,background:"linear-gradient(135deg,#f5f0ff,#ede4ff)" }}>
                    <img src={product.images[0]} alt={product.name} style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ color:"#1a1025",fontSize:13,fontWeight:600,fontFamily:"'Nunito',sans-serif",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{product.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span style={{ color:"#402970",fontSize:12,fontWeight:700,fontFamily:"'Nunito',sans-serif" }}>${product.price.toFixed(2)}</span>
                      <span style={{ fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:20,background:"rgba(64,41,112,0.08)",color:"#7c6a9e",fontFamily:"'Nunito',sans-serif" }}>{product.category}</span>
                    </div>
                  </div>
                  <motion.button type="button" whileTap={{ scale:0.88 }} onClick={() => onRemoveSaved(product.id)}
                    className="flex items-center justify-center"
                    style={{ width:28,height:28,borderRadius:8,border:"none",cursor:"pointer",background:"rgba(212,24,61,0.07)",color:"#d4183d",flexShrink:0 }}
                  >
                    <X size={12} strokeWidth={2.5} />
                  </motion.button>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 pb-5 pt-3" style={{ borderTop:"1px solid rgba(64,41,112,0.09)", flexShrink:0 }}>
          {id === "Cart" && cartItems.length > 0 && (
            <div className="flex items-center justify-between mb-3">
              <span style={{ color:"#7c6a9e",fontSize:13,fontWeight:600,fontFamily:"'Nunito',sans-serif" }}>Total</span>
              <span style={{ color:"#1a1025",fontSize:16,fontWeight:700,fontFamily:"'Nunito',sans-serif" }}>${cartTotal.toFixed(2)}</span>
            </div>
          )}
          <button type="button"
            onClick={id === "Cart" && cartItems.length > 0 ? onCheckout : undefined}
            style={{ width:"100%",padding:"12px",borderRadius:14,border:"none",background: id === "Cart" && cartItems.length > 0 ? "linear-gradient(135deg,#7c4dba,#402970)" : id === "Cart" ? "rgba(64,41,112,0.15)" : "linear-gradient(135deg,#7c4dba,#402970)",color: id === "Cart" && cartItems.length === 0 ? "#b8aed0" : "#fff",fontSize:13,fontWeight:700,cursor: id === "Cart" && cartItems.length === 0 ? "default" : "pointer",fontFamily:"'Nunito',sans-serif" }}
          >
            {id === "Cart" ? "Checkout" : id === "Wishlist" ? "Move All to Cart" : "View All Saved"}
          </button>
        </div>
      </motion.aside>
    </>
  );
}

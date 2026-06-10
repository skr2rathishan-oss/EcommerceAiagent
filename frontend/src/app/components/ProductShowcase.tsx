import { useState } from "react";
import { motion, AnimatePresence, LayoutGroup } from "motion/react";
import {
  Star, ShoppingCart, Zap, Heart, Truck, Package,
  Shield, CheckCircle, Maximize2, X, ChevronLeft, ChevronRight,
} from "lucide-react";
import type { Product } from "./products";

interface Props {
  products: Product[];
  selectedId: string | null;
  onSelect: (p: Product | null) => void;
  onAddToCart: (p: Product) => void;
  onBuyNow: (p: Product, variants?: Record<string, string>) => void;
  onWishlist: (p: Product) => void;
}

const IMG_H = 190; // fixed image height in the banner

/* ── Small card ── */
function MiniCard({
  product, onClick,
}: { product: Product; onClick: () => void }) {
  const [imgErr, setImgErr] = useState(false);
  return (
    <motion.div
      layout
      whileHover={{ y: -2 }}
      onClick={onClick}
      style={{
        borderRadius: 12,
        background: "#fff",
        border: "1.5px solid rgba(64,41,112,0.1)",
        overflow: "hidden",
        cursor: "pointer",
        boxShadow: "0 2px 8px rgba(64,41,112,0.07)",
        userSelect: "none",
      }}
    >
      {/* image — shared element */}
      <motion.div
        layoutId={`product-img-${product.id}`}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        style={{ width: "100%", aspectRatio: "4/3", background: "linear-gradient(135deg,#f5f0ff,#ede4ff)", overflow: "hidden", flexShrink: 0 }}
      >
        {!imgErr
          ? <img src={product.images[0]} alt={product.name} onError={() => setImgErr(true)}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Package size={20} color="rgba(124,77,186,0.25)" />
            </div>
        }
      </motion.div>

      <div style={{ padding: "7px 9px 9px" }}>
        <p style={{ color: "#9e8dc0", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "'Nunito',sans-serif", marginBottom: 2 }}>{product.brand}</p>
        <p style={{ color: "#1a1025", fontSize: 11, fontWeight: 700, fontFamily: "'Nunito',sans-serif", lineHeight: 1.25, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>{product.name}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 3 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={8} strokeWidth={0} fill={i < Math.floor(product.rating) ? "#f59e0b" : "rgba(0,0,0,0.1)"} />
          ))}
          <span style={{ color: "#f59e0b", fontSize: 9, fontWeight: 700, fontFamily: "'Nunito',sans-serif" }}>{product.rating}</span>
        </div>
        <p style={{ color: "#1a1025", fontSize: 12, fontWeight: 800, fontFamily: "'Nunito',sans-serif", marginTop: 4 }}>${product.price.toFixed(2)}</p>
      </div>
    </motion.div>
  );
}

/* ── Selected product banner — 3 columns ── */
function SelectedBanner({
  product, onAddToCart, onBuyNow, onWishlist,
}: { product: Product; onAddToCart: (p: Product) => void; onBuyNow: (p: Product, variants?: Record<string, string>) => void; onWishlist: (p: Product) => void }) {
  const [imgErr, setImgErr]       = useState(false);
  const [imgIdx, setImgIdx]       = useState(0);
  const [lightbox, setLightbox]   = useState(false);
  const [added, setAdded]         = useState(false);
  const [variants, setVariants] = useState<Record<string, string>>(
    () => Object.fromEntries(product.variants.map(v => [v.type, v.options[0]]))
  );

  const discount = product.originalPrice
    ? Math.round((1 - product.price / product.originalPrice) * 100) : null;

  const doAdd = () => { onAddToCart(product); setAdded(true); setTimeout(() => setAdded(false), 2000); };

  return (
    <>
    <motion.div
      layout
      style={{
        display: "flex",
        background: "#fff",
        borderRadius: 14,
        border: "1.5px solid rgba(124,77,186,0.2)",
        boxShadow: "0 4px 20px rgba(64,41,112,0.1)",
        overflow: "hidden",
      }}
    >
      {/* ── COL 1: image (shared element, stretches to card height) ── */}
      <motion.div
        layoutId={`product-img-${product.id}`}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        style={{
          width: 190,
          minHeight: IMG_H,
          alignSelf: "stretch",
          flexShrink: 0,
          position: "relative",
          background: "linear-gradient(135deg,#f5f0ff,#ede4ff)",
          overflow: "hidden",
        }}
      >
        {!imgErr
          ? <img
              src={product.images[imgIdx]}
              alt={product.name}
              onError={() => setImgErr(true)}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Package size={40} color="rgba(124,77,186,0.2)" />
            </div>
        }
        {discount && (
          <span style={{ position: "absolute", top: 8, left: 8, background: "linear-gradient(135deg,#7c4dba,#402970)", color: "#fff", fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 20, fontFamily: "'Nunito',sans-serif", zIndex: 1 }}>
            -{discount}%
          </span>
        )}
        {/* expand icon — top-right corner */}
        <button
          type="button"
          onClick={() => setLightbox(true)}
          style={{
            position: "absolute", top: 8, right: 8, zIndex: 2,
            width: 26, height: 26, borderRadius: 7, border: "none", cursor: "pointer",
            background: "rgba(255,255,255,0.88)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 8px rgba(64,41,112,0.18)",
            transition: "background 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,1)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.88)")}
        >
          <Maximize2 size={13} color="#402970" strokeWidth={2.2} />
        </button>
        {product.images.length > 1 && (
          <div style={{ position: "absolute", bottom: 8, width: "100%", display: "flex", justifyContent: "center", gap: 4, zIndex: 1 }}>
            {product.images.map((_, i) => (
              <button key={i} type="button" onClick={() => setImgIdx(i)}
                style={{ width: i === imgIdx ? 14 : 5, height: 5, borderRadius: 3, border: "none", padding: 0, cursor: "pointer", background: i === imgIdx ? "#7c4dba" : "rgba(255,255,255,0.7)", transition: "all 0.2s" }} />
            ))}
          </div>
        )}
      </motion.div>

      {/* ── COL 2: product details ── */}
      <motion.div
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.28, delay: 0.15, ease: "easeOut" }}
        style={{ flex: 1, padding: "13px 16px", display: "flex", flexDirection: "column", gap: 6, minWidth: 0, borderLeft: "1px solid rgba(124,77,186,0.08)", overflow: "hidden" }}
      >
        <div>
          <p style={{ color: "#9e8dc0", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "'Nunito',sans-serif", marginBottom: 2 }}>
            {product.brand} · {product.category}
          </p>
          <p style={{ color: "#1a1025", fontSize: 14, fontWeight: 800, fontFamily: "'Nunito',sans-serif", lineHeight: 1.3 }}>{product.name}</p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={10} strokeWidth={0} fill={i < Math.floor(product.rating) ? "#f59e0b" : "rgba(0,0,0,0.12)"} />
          ))}
          <span style={{ color: "#f59e0b", fontSize: 10, fontWeight: 700, fontFamily: "'Nunito',sans-serif" }}>{product.rating}</span>
          <span style={{ color: "#b8aed0", fontSize: 10, fontFamily: "'Nunito',sans-serif" }}>({product.reviewCount.toLocaleString()})</span>
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
          <span style={{ color: "#1a1025", fontSize: 17, fontWeight: 800, fontFamily: "'Nunito',sans-serif" }}>${product.price.toFixed(2)}</span>
          {product.originalPrice && (
            <span style={{ color: "#b8aed0", fontSize: 11, textDecoration: "line-through", fontFamily: "'Nunito',sans-serif" }}>${product.originalPrice.toFixed(2)}</span>
          )}
          {discount && (
            <span style={{ color: "#3fc78e", fontSize: 10, fontWeight: 700, fontFamily: "'Nunito',sans-serif" }}>Save ${(product.originalPrice! - product.price).toFixed(2)}</span>
          )}
        </div>

        <p style={{ color: "#7c6a9e", fontSize: 11, fontFamily: "'Nunito',sans-serif", lineHeight: 1.45, margin: 0 }}>{product.shortDesc}</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {product.variants.map(v => (
            <div key={v.type} style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 5 }}>
              <span style={{ color: "#9e8dc0", fontSize: 9, fontWeight: 700, textTransform: "uppercase", fontFamily: "'Nunito',sans-serif", flexShrink: 0 }}>{v.type}:</span>
              {v.options.map(opt => (
                <button key={opt} type="button" onClick={() => setVariants(sv => ({ ...sv, [v.type]: opt }))}
                  style={{ padding: "2px 8px", borderRadius: 20, border: `1.5px solid ${variants[v.type] === opt ? "rgba(124,77,186,0.6)" : "rgba(64,41,112,0.14)"}`, background: variants[v.type] === opt ? "rgba(124,77,186,0.1)" : "transparent", color: variants[v.type] === opt ? "#402970" : "#9e8dc0", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "'Nunito',sans-serif", transition: "all 0.15s" }}>
                  {opt}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: "auto" }}>
          {[
            { icon: <Truck size={9} color="#3fc78e" strokeWidth={2} />, text: "Free delivery", bg: "rgba(63,199,142,0.08)", border: "rgba(63,199,142,0.2)", color: "#2a9e6a" },
            { icon: <Shield size={9} color="#7c4dba" strokeWidth={2} />, text: "1-yr warranty", bg: "rgba(64,41,112,0.04)", border: "rgba(64,41,112,0.1)", color: "#402970" },
            { icon: <Package size={9} color={product.stock < 15 ? "#ef7832" : "#7c4dba"} strokeWidth={2} />, text: product.stock < 15 ? `Only ${product.stock} left` : "In stock", bg: product.stock < 15 ? "rgba(239,120,50,0.07)" : "rgba(64,41,112,0.04)", border: product.stock < 15 ? "rgba(239,120,50,0.2)" : "rgba(64,41,112,0.08)", color: product.stock < 15 ? "#c45f10" : "#402970" },
          ].map((pill, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "3px 7px", borderRadius: 7, background: pill.bg, border: `1px solid ${pill.border}` }}>
              {pill.icon}
              <span style={{ color: pill.color, fontSize: 9, fontWeight: 600, fontFamily: "'Nunito',sans-serif" }}>{pill.text}</span>
            </span>
          ))}
        </div>
      </motion.div>

      {/* ── COL 3: actions, vertically centered ── */}
      <motion.div
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.28, delay: 0.22, ease: "easeOut" }}
        style={{
          width: 148,
          flexShrink: 0,
          borderLeft: "1px solid rgba(124,77,186,0.08)",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          justifyContent: "center",
          gap: 8,
          padding: "14px 12px",
        }}
      >
        <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={() => onBuyNow(product, variants)}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#7c4dba,#402970)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Nunito',sans-serif" }}>
          <Zap size={13} strokeWidth={2.5} />
          Buy Now
        </motion.button>

        <AnimatePresence mode="wait">
          {added ? (
            <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "10px", borderRadius: 10, background: "rgba(63,199,142,0.12)", border: "1px solid rgba(63,199,142,0.3)" }}>
              <CheckCircle size={12} color="#3fc78e" strokeWidth={2.5} />
              <span style={{ color: "#2a9e6a", fontSize: 12, fontWeight: 700, fontFamily: "'Nunito',sans-serif" }}>Added!</span>
            </motion.div>
          ) : (
            <motion.button key="cart" type="button" whileTap={{ scale: 0.97 }} onClick={doAdd}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px", borderRadius: 10, border: "1.5px solid rgba(64,41,112,0.22)", background: "transparent", color: "#402970", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Nunito',sans-serif" }}>
              <ShoppingCart size={13} strokeWidth={2.5} />
              Add to Cart
            </motion.button>
          )}
        </AnimatePresence>

        <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={() => onWishlist(product)}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "8px", borderRadius: 10, border: "1.5px solid rgba(64,41,112,0.15)", background: "transparent", cursor: "pointer", fontFamily: "'Nunito',sans-serif" }}>
          <Heart size={13} strokeWidth={2} color="#9e8dc0" fill="none" />
          <span style={{ color: "#9e8dc0", fontSize: 11, fontWeight: 700 }}>Wishlist</span>
        </motion.button>
      </motion.div>
    </motion.div>

    {/* ── Left-side image lightbox ── */}
    <AnimatePresence>
      {lightbox && (
        <>
          {/* backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={() => setLightbox(false)}
            style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(10,6,20,0.72)", backdropFilter: "blur(4px)" }}
          />

          {/* left panel */}
          <motion.div
            initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            style={{
              position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 201,
              width: 420, background: "#0f0a1e",
              display: "flex", flexDirection: "column",
              boxShadow: "8px 0 40px rgba(0,0,0,0.5)",
            }}
          >
            {/* header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
              <div>
                <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'Nunito',sans-serif" }}>{product.brand}</p>
                <p style={{ color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "'Nunito',sans-serif", marginTop: 1 }}>{product.name}</p>
              </div>
              <button type="button" onClick={() => setLightbox(false)}
                style={{ width: 32, height: 32, borderRadius: 9, border: "none", cursor: "pointer", background: "rgba(255,255,255,0.1)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <X size={15} strokeWidth={2.2} />
              </button>
            </div>

            {/* main image */}
            <div style={{ flex: 1, position: "relative", overflow: "hidden", background: "linear-gradient(135deg,#1a0f2e,#0f0a1e)" }}>
              <AnimatePresence mode="wait">
                <motion.img
                  key={imgIdx}
                  src={product.images[imgIdx]}
                  alt={product.name}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                />
              </AnimatePresence>

              {/* prev / next arrows */}
              {product.images.length > 1 && (
                <>
                  <button type="button"
                    onClick={() => setImgIdx(i => (i - 1 + product.images.length) % product.images.length)}
                    style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 38, height: 38, borderRadius: "50%", border: "none", cursor: "pointer", background: "rgba(255,255,255,0.12)", backdropFilter: "blur(6px)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.22)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
                  >
                    <ChevronLeft size={20} strokeWidth={2} />
                  </button>
                  <button type="button"
                    onClick={() => setImgIdx(i => (i + 1) % product.images.length)}
                    style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", width: 38, height: 38, borderRadius: "50%", border: "none", cursor: "pointer", background: "rgba(255,255,255,0.12)", backdropFilter: "blur(6px)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.22)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
                  >
                    <ChevronRight size={20} strokeWidth={2} />
                  </button>
                </>
              )}
            </div>

            {/* thumbnail strip */}
            {product.images.length > 1 && (
              <div style={{ flexShrink: 0, padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none" }}>
                {product.images.map((src, i) => (
                  <button key={i} type="button" onClick={() => setImgIdx(i)}
                    style={{ width: 54, height: 54, flexShrink: 0, borderRadius: 8, overflow: "hidden", border: `2px solid ${i === imgIdx ? "#7c4dba" : "transparent"}`, padding: 0, cursor: "pointer", transition: "border-color 0.2s", background: "rgba(255,255,255,0.05)" }}>
                    <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  </button>
                ))}
              </div>
            )}

            {/* image counter */}
            <div style={{ padding: "8px 20px 16px", flexShrink: 0, textAlign: "center" }}>
              <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, fontFamily: "'Nunito',sans-serif" }}>
                {imgIdx + 1} / {product.images.length}
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </>
  );
}

/* ── Main export ── */
export function ProductShowcase({ products, selectedId, onSelect, onAddToCart, onBuyNow, onWishlist }: Props) {
  const selected = products.find(p => p.id === selectedId) ?? null;
  const others   = products.filter(p => p.id !== selectedId);

  const handleSelect = (p: Product) => onSelect(p);

  return (
    <LayoutGroup>
      <AnimatePresence mode="popLayout">
        {!selected ? (
          /* ── No selection: plain grid ── */
          <motion.div
            key="grid"
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))", gap: 10 }}
          >
            {products.map(p => (
              <MiniCard key={p.id} product={p} onClick={() => handleSelect(p)} />
            ))}
          </motion.div>
        ) : (
          /* ── Product selected: banner above, others grid below ── */
          <motion.div
            key="selected"
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            <SelectedBanner product={selected} onAddToCart={onAddToCart} onBuyNow={onBuyNow} onWishlist={onWishlist} />

            {others.length > 0 && (
              <motion.div
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.18, ease: "easeOut" }}
                style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))", gap: 10 }}
              >
                {others.map(p => (
                  <MiniCard key={p.id} product={p} onClick={() => handleSelect(p)} />
                ))}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </LayoutGroup>
  );
}

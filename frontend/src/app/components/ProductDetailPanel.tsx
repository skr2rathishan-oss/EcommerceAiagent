import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X, Star, ShoppingCart, Zap, Heart, Truck, Package,
  ChevronLeft, ChevronRight, Shield, RotateCcw, CheckCircle,
} from "lucide-react";
import type { Product } from "./products";

interface Props {
  product: Product;
  onClose: () => void;
  onAddToCart: (p: Product) => void;
}

export function ProductDetailPanel({ product, onClose, onAddToCart }: Props) {
  const [imgIndex, setImgIndex] = useState(0);
  const [imgError, setImgError] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const [added, setAdded] = useState(false);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>(() =>
    Object.fromEntries(product.variants.map(v => [v.type, v.options[0]]))
  );

  const discount = product.originalPrice
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : null;

  const handleAddToCart = () => {
    onAddToCart(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  // Reset image when product changes
  const prevImg = () => setImgIndex(i => (i - 1 + product.images.length) % product.images.length);
  const nextImg = () => setImgIndex(i => (i + 1) % product.images.length);

  return (
    <motion.div
      key={product.id}
      initial={{ x: -420, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -420, opacity: 0 }}
      transition={{ type: "spring", stiffness: 280, damping: 30 }}
      style={{
        width: 400,
        minWidth: 400,
        height: "100%",
        background: "#fff",
        borderRight: "1px solid rgba(64,41,112,0.1)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        flexShrink: 0,
        boxShadow: "4px 0 32px rgba(64,41,112,0.1)",
      }}
    >
      {/* Header */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(64,41,112,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, background: "linear-gradient(135deg,rgba(124,77,186,0.05),rgba(64,41,112,0.03))" }}>
        <div>
          <p style={{ color: "#9e8dc0", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", fontFamily: "'Nunito',sans-serif", textTransform: "uppercase" }}>Product Details</p>
          <p style={{ color: "#1a1025", fontSize: 13, fontWeight: 700, fontFamily: "'Nunito',sans-serif", marginTop: 1, maxWidth: 280, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{product.name}</p>
        </div>
        <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={onClose}
          style={{ width: 32, height: 32, borderRadius: 10, border: "none", background: "rgba(64,41,112,0.08)", color: "#7c6a9e", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
        >
          <X size={15} strokeWidth={2.5} />
        </motion.button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>

        {/* Image gallery */}
        <div style={{ position: "relative", width: "100%", paddingTop: "62%", background: "linear-gradient(135deg,#f5f0ff,#ede4ff)", overflow: "hidden", flexShrink: 0 }}>
          <AnimatePresence mode="wait">
            {!imgError ? (
              <motion.img
                key={product.images[imgIndex]}
                src={product.images[imgIndex]}
                alt={product.name}
                onError={() => setImgError(true)}
                initial={{ opacity: 0, scale: 1.04 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.25 }}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Package size={48} color="rgba(124,77,186,0.25)" />
              </div>
            )}
          </AnimatePresence>

          {/* Gallery nav */}
          {product.images.length > 1 && (
            <>
              <button type="button" onClick={prevImg} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 30, height: 30, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.88)", backdropFilter: "blur(6px)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}>
                <ChevronLeft size={15} strokeWidth={2.5} color="#402970" />
              </button>
              <button type="button" onClick={nextImg} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", width: 30, height: 30, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.88)", backdropFilter: "blur(6px)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}>
                <ChevronRight size={15} strokeWidth={2.5} color="#402970" />
              </button>
              <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 5 }}>
                {product.images.map((_, i) => (
                  <button key={i} type="button" onClick={() => setImgIndex(i)}
                    style={{ width: i === imgIndex ? 16 : 6, height: 6, borderRadius: 3, border: "none", background: i === imgIndex ? "#7c4dba" : "rgba(255,255,255,0.7)", cursor: "pointer", transition: "all 0.2s", padding: 0 }}
                  />
                ))}
              </div>
            </>
          )}

          {discount && (
            <span style={{ position: "absolute", top: 12, left: 12, background: "linear-gradient(135deg,#7c4dba,#402970)", color: "#fff", fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 20, fontFamily: "'Nunito',sans-serif" }}>
              -{discount}% OFF
            </span>
          )}
        </div>

        {/* Details body */}
        <div style={{ padding: "18px 18px 24px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Brand + title */}
          <div>
            <p style={{ color: "#9e8dc0", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", fontFamily: "'Nunito',sans-serif", textTransform: "uppercase", marginBottom: 4 }}>{product.brand}</p>
            <h2 style={{ color: "#1a1025", fontSize: 17, fontWeight: 800, fontFamily: "'Nunito',sans-serif", lineHeight: 1.3, margin: 0 }}>{product.name}</h2>
          </div>

          {/* Rating */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={13} strokeWidth={0} fill={i < Math.floor(product.rating) ? "#f59e0b" : "rgba(0,0,0,0.12)"} />
              ))}
            </div>
            <span style={{ color: "#f59e0b", fontSize: 13, fontWeight: 700, fontFamily: "'Nunito',sans-serif" }}>{product.rating}</span>
            <span style={{ color: "#b8aed0", fontSize: 12, fontFamily: "'Nunito',sans-serif" }}>({product.reviewCount.toLocaleString()} reviews)</span>
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-3">
            <span style={{ color: "#1a1025", fontSize: 24, fontWeight: 800, fontFamily: "'Nunito',sans-serif" }}>${product.price.toFixed(2)}</span>
            {product.originalPrice && (
              <span style={{ color: "#b8aed0", fontSize: 14, fontFamily: "'Nunito',sans-serif", textDecoration: "line-through" }}>${product.originalPrice.toFixed(2)}</span>
            )}
            {discount && (
              <span style={{ color: "#3fc78e", fontSize: 12, fontWeight: 700, fontFamily: "'Nunito',sans-serif" }}>Save ${(product.originalPrice! - product.price).toFixed(2)}</span>
            )}
          </div>

          {/* Description */}
          <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(64,41,112,0.04)", border: "1px solid rgba(64,41,112,0.08)" }}>
            <p style={{ color: "#3a2a55", fontSize: 12.5, fontFamily: "'Nunito',sans-serif", lineHeight: 1.7, margin: 0 }}>{product.description}</p>
          </div>

          {/* Variants */}
          {product.variants.map(v => (
            <div key={v.type}>
              <p style={{ color: "#7c6a9e", fontSize: 11, fontWeight: 700, fontFamily: "'Nunito',sans-serif", marginBottom: 8, letterSpacing: "0.04em", textTransform: "uppercase" }}>{v.type}</p>
              <div className="flex flex-wrap gap-2">
                {v.options.map(opt => (
                  <button key={opt} type="button" onClick={() => setSelectedVariants(sv => ({ ...sv, [v.type]: opt }))}
                    style={{ padding: "6px 14px", borderRadius: 9999, border: `1.5px solid ${selectedVariants[v.type] === opt ? "rgba(124,77,186,0.6)" : "rgba(64,41,112,0.18)"}`, background: selectedVariants[v.type] === opt ? "rgba(124,77,186,0.1)" : "transparent", color: selectedVariants[v.type] === opt ? "#402970" : "#7c6a9e", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Nunito',sans-serif", transition: "all 0.15s" }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Specs */}
          <div>
            <p style={{ color: "#9e8dc0", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", fontFamily: "'Nunito',sans-serif", textTransform: "uppercase", marginBottom: 10 }}>Specifications</p>
            <div style={{ borderRadius: 12, border: "1px solid rgba(64,41,112,0.08)", overflow: "hidden" }}>
              {product.specs.map((s, i) => (
                <div key={i} className="flex items-center justify-between" style={{ padding: "10px 14px", background: i % 2 === 0 ? "rgba(64,41,112,0.03)" : "#fff", borderBottom: i < product.specs.length - 1 ? "1px solid rgba(64,41,112,0.06)" : "none" }}>
                  <span style={{ color: "#9e8dc0", fontSize: 12, fontFamily: "'Nunito',sans-serif" }}>{s.label}</span>
                  <span style={{ color: "#1a1025", fontSize: 12, fontWeight: 700, fontFamily: "'Nunito',sans-serif" }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Delivery + stock */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="flex items-center gap-3" style={{ padding: "11px 14px", borderRadius: 12, background: "rgba(63,199,142,0.07)", border: "1px solid rgba(63,199,142,0.2)" }}>
              <Truck size={16} color="#3fc78e" strokeWidth={2} />
              <span style={{ color: "#2a9e6a", fontSize: 12, fontWeight: 600, fontFamily: "'Nunito',sans-serif" }}>{product.delivery}</span>
            </div>
            <div className="flex items-center gap-3" style={{ padding: "11px 14px", borderRadius: 12, background: product.stock < 15 ? "rgba(239,120,50,0.07)" : "rgba(64,41,112,0.04)", border: `1px solid ${product.stock < 15 ? "rgba(239,120,50,0.2)" : "rgba(64,41,112,0.08)"}` }}>
              <Package size={16} color={product.stock < 15 ? "#ef7832" : "#7c4dba"} strokeWidth={2} />
              <span style={{ color: product.stock < 15 ? "#c45f10" : "#402970", fontSize: 12, fontWeight: 600, fontFamily: "'Nunito',sans-serif" }}>
                {product.stock < 15 ? `Only ${product.stock} left in stock — order soon!` : `${product.stock} in stock`}
              </span>
            </div>
            <div className="flex items-center gap-3" style={{ padding: "11px 14px", borderRadius: 12, background: "rgba(64,41,112,0.04)", border: "1px solid rgba(64,41,112,0.08)" }}>
              <Shield size={16} color="#7c4dba" strokeWidth={2} />
              <span style={{ color: "#402970", fontSize: 12, fontWeight: 600, fontFamily: "'Nunito',sans-serif" }}>1-year warranty · 30-day returns</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky footer actions */}
      <div style={{ padding: "14px 16px", borderTop: "1px solid rgba(64,41,112,0.09)", background: "#fff", flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        <AnimatePresence mode="wait">
          {added ? (
            <motion.div key="added" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-center justify-center gap-2"
              style={{ padding: "12px", borderRadius: 12, background: "rgba(63,199,142,0.12)", border: "1px solid rgba(63,199,142,0.3)" }}
            >
              <CheckCircle size={15} color="#3fc78e" strokeWidth={2.5} />
              <span style={{ color: "#2a9e6a", fontSize: 13, fontWeight: 700, fontFamily: "'Nunito',sans-serif" }}>Added to cart!</span>
            </motion.div>
          ) : (
            <motion.button key="cart" type="button" whileTap={{ scale: 0.97 }} onClick={handleAddToCart}
              className="flex items-center justify-center gap-2"
              style={{ width: "100%", padding: "12px", borderRadius: 12, border: "1.5px solid rgba(64,41,112,0.3)", background: "transparent", color: "#402970", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Nunito',sans-serif" }}
            >
              <ShoppingCart size={16} strokeWidth={2.5} />
              Add to Cart
            </motion.button>
          )}
        </AnimatePresence>

        <div className="flex gap-2">
          <motion.button type="button" whileTap={{ scale: 0.97 }}
            className="flex items-center justify-center gap-2 flex-1"
            style={{ padding: "12px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#7c4dba,#402970)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Nunito',sans-serif" }}
          >
            <Zap size={15} strokeWidth={2.5} />
            Buy Now
          </motion.button>
          <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={() => setWishlisted(w => !w)}
            style={{ width: 46, borderRadius: 12, border: `1.5px solid ${wishlisted ? "rgba(232,57,90,0.4)" : "rgba(64,41,112,0.2)"}`, background: wishlisted ? "rgba(232,57,90,0.08)" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
          >
            <Heart size={17} strokeWidth={2} color={wishlisted ? "#e8395a" : "#9e8dc0"} fill={wishlisted ? "#e8395a" : "none"} />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

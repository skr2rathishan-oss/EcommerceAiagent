import { useState } from "react";
import { motion } from "motion/react";
import { Star, ShoppingCart, Eye, Heart, CheckCircle } from "lucide-react";
import type { Product } from "./products";
import { formatUIPrice } from "../services/mapping";
import { useApp } from "../contexts/AppContext";

interface Props {
  product: Product;
  onViewDetails: (p: Product) => void;
  onAddToCart: (p: Product) => void;
  isSelected: boolean;
}

export function ProductCard({ product, onViewDetails, onAddToCart, isSelected }: Props) {
  const [imgError, setImgError] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const { shoppingMission } = useApp();
  
  if (!product) return null;

  const isGiftPlannerActive = !!shoppingMission;
  const isSelectedInMission = shoppingMission?.missionItems?.some((item: any) => item.selectedProduct?.id === product.id);
  const finalIsSelected = isSelected || isSelectedInMission;

  const discount = (product.originalPrice && product.price)
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : null;

  const isInStock = typeof product.stock === "boolean"
    ? product.stock
    : (typeof product.stock === "number" ? product.stock > 0 : true);

  const imageUrl = product.images?.[0] || "";

  return (
    <motion.div
      layout
      animate={{ scale: finalIsSelected ? 1.07 : 1, zIndex: finalIsSelected ? 10 : 1 }}
      whileHover={{ y: finalIsSelected ? 0 : -2 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      onClick={() => onViewDetails(product)}
      style={{
        borderRadius: 12,
        background: finalIsSelected
          ? "linear-gradient(135deg,rgba(124,77,186,0.1),rgba(64,41,112,0.07))"
          : "#fff",
        border: `1.5px solid ${finalIsSelected ? "rgba(124,77,186,0.65)" : "rgba(64,41,112,0.1)"}`,
        overflow: "hidden",
        cursor: "pointer",
        boxShadow: finalIsSelected
          ? "0 0 0 3px rgba(124,77,186,0.2), 0 8px 28px rgba(64,41,112,0.22)"
          : "0 2px 8px rgba(64,41,112,0.07)",
        transition: "border-color 0.2s, box-shadow 0.2s, background 0.2s",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* Image */}
      <div style={{ position: "relative", width: "100%", paddingTop: "55%", background: "linear-gradient(135deg,#f5f0ff,#ede4ff)", overflow: "hidden", flexShrink: 0 }}>
        {imageUrl && !imgError ? (
          <img
            src={imageUrl}
            alt={product.name || "Product"}
            onError={() => setImgError(true)}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShoppingCart size={22} color="rgba(124,77,186,0.3)" />
          </div>
        )}
        {discount && (
          <span style={{ position: "absolute", top: 7, left: 7, background: "linear-gradient(135deg,#7c4dba,#402970)", color: "#fff", fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 20, fontFamily: "'Nunito',sans-serif", letterSpacing: "0.04em" }}>
            -{discount}%
          </span>
        )}
        <button
          type="button"
          onClick={e => { e.stopPropagation(); setWishlisted(w => !w); }}
          style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.9)", backdropFilter: "blur(6px)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 6px rgba(0,0,0,0.1)" }}
        >
          <Heart size={11} strokeWidth={2} color={wishlisted ? "#e8395a" : "#9e8dc0"} fill={wishlisted ? "#e8395a" : "none"} />
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: "9px 11px 11px", display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        {product.brand && (
          <p style={{ color: "#9e8dc0", fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", fontFamily: "'Nunito',sans-serif", textTransform: "uppercase" }}>{product.brand}</p>
        )}
        <p style={{ color: "#1a1025", fontSize: 12, fontWeight: 700, fontFamily: "'Nunito',sans-serif", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{product.name || ""}</p>

        {/* Rating */}
        {!product.isMcp && !isGiftPlannerActive && (
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={9} strokeWidth={0} fill={i < Math.floor(product.rating || 0) ? "#f59e0b" : "rgba(0,0,0,0.12)"} />
            ))}
            <span style={{ color: "#f59e0b", fontSize: 10, fontWeight: 700, fontFamily: "'Nunito',sans-serif", marginLeft: 1 }}>{product.rating || 0}</span>
            <span style={{ color: "#b8aed0", fontSize: 9, fontFamily: "'Nunito',sans-serif" }}>({(product.reviewCount || 0).toLocaleString()})</span>
          </div>
        )}

        {/* Price */}
        <div className="flex items-baseline gap-1.5">
          <span style={{ color: "#1a1025", fontSize: 13, fontWeight: 800, fontFamily: "'Nunito',sans-serif" }}>
            {formatUIPrice(product.price || 0, product.currency)}
          </span>
          {product.originalPrice && (
            <span style={{ color: "#b8aed0", fontSize: 10, fontFamily: "'Nunito',sans-serif", textDecoration: "line-through" }}>
              {formatUIPrice(product.originalPrice, product.currency)}
            </span>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-1.5" style={{ marginTop: 4 }}>
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={e => { e.stopPropagation(); onViewDetails(product); }}
            className="flex items-center justify-center gap-1 flex-1"
            style={{ padding: "6px 0", borderRadius: 8, border: `1.5px solid ${finalIsSelected ? "rgba(124,77,186,0.5)" : "rgba(64,41,112,0.2)"}`, background: finalIsSelected ? "rgba(124,77,186,0.1)" : "transparent", color: "#402970", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "'Nunito',sans-serif", transition: "all 0.15s" }}
          >
            <Eye size={10} strokeWidth={2.5} />
            Details
          </motion.button>
          {isGiftPlannerActive ? (
            <motion.button
              type="button"
              whileTap={isInStock ? { scale: 0.95 } : {}}
              onClick={e => { e.stopPropagation(); if (isInStock) onAddToCart(product); }}
              disabled={!isInStock}
              className="flex items-center justify-center gap-1 flex-1"
              style={{ padding: "6px 0", borderRadius: 8, border: "none", background: isSelectedInMission ? "linear-gradient(135deg,#10b981,#059669)" : isInStock ? "linear-gradient(135deg,#7c4dba,#402970)" : "rgba(64,41,112,0.15)", color: isInStock ? "#fff" : "#b8aed0", fontSize: 10, fontWeight: 700, cursor: isInStock ? "pointer" : "not-allowed", fontFamily: "'Nunito',sans-serif" }}
            >
              {isSelectedInMission ? (
                <>
                  <CheckCircle size={10} strokeWidth={2.5} />
                  Selected
                </>
              ) : "Select"}
            </motion.button>
          ) : (
            <motion.button
              type="button"
              whileTap={isInStock ? { scale: 0.95 } : {}}
              onClick={e => { e.stopPropagation(); if (isInStock) onAddToCart(product); }}
              disabled={!isInStock}
              className="flex items-center justify-center gap-1 flex-1"
              style={{ padding: "6px 0", borderRadius: 8, border: "none", background: isInStock ? "linear-gradient(135deg,#7c4dba,#402970)" : "rgba(64,41,112,0.15)", color: isInStock ? "#fff" : "#b8aed0", fontSize: 10, fontWeight: 700, cursor: isInStock ? "pointer" : "not-allowed", fontFamily: "'Nunito',sans-serif" }}
            >
              <ShoppingCart size={10} strokeWidth={2.5} />
              {isInStock ? "Add" : "Out of stock"}
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

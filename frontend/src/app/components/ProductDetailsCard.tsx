// ── ProductDetailsCard.tsx ────────────────────────────────────────────────────
// Renders formatted product details returned by productDetailsFormatter.
// Uses react-markdown for clean rendering (honours existing AIMessageRenderer
// styles) and shows variation pills, features, and CTA buttons.
//
// Displayed in the chat message area when type === "product_details".

import { useState } from "react";
import { motion } from "motion/react";
import ReactMarkdown from "react-markdown";
import {
  ShoppingCart, Zap, Heart, X, Package,
} from "lucide-react";
import type { Product } from "./products";
import { formatUIPrice } from "../services/mapping";

interface Props {
  content: string;          // markdown formatted string from productDetailsFormatter
  product: Product;
  onAddToCart: (p: Product) => void;
  onBuyNow: (p: Product, variants?: Record<string, string>) => void;
  onWishlist: (p: Product) => void;
  onClose?: () => void;
}

export function ProductDetailsCard({
  content,
  product,
  onAddToCart,
  onBuyNow,
  onWishlist,
  onClose,
}: Props) {
  const [addedToCart, setAddedToCart] = useState(false);
  const [imgErr, setImgErr] = useState(false);

  const handleAddToCart = () => {
    onAddToCart(product);
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2200);
  };

  const imageUrl = product.images?.[0] || "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      style={{
        background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(12px)",
        borderRadius: 18,
        border: "1.5px solid rgba(124,77,186,0.18)",
        boxShadow: "0 6px 28px rgba(64,41,112,0.12)",
        overflow: "hidden",
        fontFamily: "'Nunito', sans-serif",
      }}
    >
      {/* ── Gradient header strip ── */}
      <div style={{
        background: "linear-gradient(135deg, #7c4dba 0%, #402970 100%)",
        padding: "14px 18px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        position: "relative",
      }}>
        {/* Product thumbnail */}
        <div style={{
          width: 52, height: 52, borderRadius: 12, overflow: "hidden",
          flexShrink: 0, background: "rgba(255,255,255,0.15)",
          border: "2px solid rgba(255,255,255,0.25)",
        }}>
          {imageUrl && !imgErr ? (
            <img
              src={imageUrl}
              alt={product.name}
              onError={() => setImgErr(true)}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Package size={22} color="rgba(255,255,255,0.6)" />
            </div>
          )}
        </div>

        {/* Name + price */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
            🎁 Product Details
          </p>
          <p style={{ color: "#fff", fontSize: 14, fontWeight: 800, margin: "3px 0 0", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {product.name}
          </p>
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 700, margin: "3px 0 0" }}>
            {formatUIPrice(product.price, product.currency)}
          </p>
        </div>

        {/* Close button */}
        {onClose && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer",
              background: "rgba(255,255,255,0.15)", color: "#fff", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <X size={13} strokeWidth={2.5} />
          </motion.button>
        )}
      </div>

      {/* ── Formatted markdown content ── */}
      <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid rgba(64,41,112,0.08)" }}>
        <div className="product-details-markdown">
          <style dangerouslySetInnerHTML={{ __html: `
            .product-details-markdown h2 {
              font-size: 1.1rem;
              font-weight: 800;
              color: #1a1025;
              margin: 0 0 10px 0;
              font-family: 'Nunito', sans-serif;
            }
            .product-details-markdown h3 {
              font-size: 1.05rem;
              font-weight: 700;
              color: #1a1025;
              margin: 12px 0 4px;
              font-family: 'Nunito', sans-serif;
            }
            .product-details-markdown p {
              margin: 0 0 8px 0;
              line-height: 1.65;
              color: #3d2d5c;
              font-size: 13px;
              font-family: 'Nunito', sans-serif;
            }
            .product-details-markdown strong {
              font-weight: 800;
              color: #402970;
            }
            .product-details-markdown ul,
            .product-details-markdown ol {
              margin: 4px 0 8px 0;
              padding-left: 18px;
              font-family: 'Nunito', sans-serif;
            }
            .product-details-markdown li {
              margin-bottom: 3px;
              color: #3d2d5c;
              font-size: 13px;
              line-height: 1.5;
            }
            .product-details-markdown hr {
              border: none;
              border-top: 1px solid rgba(64,41,112,0.1);
              margin: 10px 0;
            }
            .product-details-markdown > :first-child { margin-top: 0 !important; }
            .product-details-markdown > :last-child  { margin-bottom: 0 !important; }
          `}} />
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </div>

      {/* ── CTA Buttons ── */}
      <div style={{
        padding: "12px 18px 14px",
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
      }}>
        <motion.button
          type="button"
          whileTap={product.stock > 0 ? { scale: 0.96 } : {}}
          onClick={() => { if (product.stock > 0) onBuyNow(product); }}
          disabled={product.stock === 0}
          style={{
            flex: 1,
            minWidth: 100,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "9px 14px", borderRadius: 10, border: "none",
            background: product.stock > 0
              ? "linear-gradient(135deg,#7c4dba,#402970)"
              : "rgba(64,41,112,0.12)",
            color: product.stock > 0 ? "#fff" : "#b8aed0",
            fontSize: 12, fontWeight: 700, cursor: product.stock > 0 ? "pointer" : "not-allowed",
            fontFamily: "'Nunito', sans-serif",
          }}
        >
          <Zap size={13} strokeWidth={2.5} />
          Buy Now
        </motion.button>

        <motion.button
          type="button"
          whileTap={product.stock > 0 ? { scale: 0.96 } : {}}
          onClick={() => { if (product.stock > 0) handleAddToCart(); }}
          disabled={product.stock === 0}
          style={{
            flex: 1,
            minWidth: 100,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "9px 14px", borderRadius: 10,
            border: `1.5px solid ${product.stock > 0 ? "rgba(64,41,112,0.22)" : "rgba(64,41,112,0.1)"}`,
            background: addedToCart ? "rgba(63,199,142,0.1)" : "transparent",
            color: addedToCart ? "#2a9e6a" : (product.stock > 0 ? "#402970" : "#b8aed0"),
            fontSize: 12, fontWeight: 700, cursor: product.stock > 0 ? "pointer" : "not-allowed",
            fontFamily: "'Nunito', sans-serif",
            transition: "all 0.2s",
          }}
        >
          <ShoppingCart size={13} strokeWidth={2.5} />
          {addedToCart ? "Added!" : "Add to Cart"}
        </motion.button>

        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={() => onWishlist(product)}
          style={{
            width: 38, height: 38, borderRadius: 10, border: "1.5px solid rgba(64,41,112,0.15)",
            background: "transparent", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Heart size={15} strokeWidth={2} color="#9e8dc0" />
        </motion.button>
      </div>
    </motion.div>
  );
}

// ── ProductDetailsCard.tsx ────────────────────────────────────────────────────
// Renders formatted product details returned by productDetailsFormatter.
// Uses react-markdown for clean rendering and shows a redesigned layout:
// Left side displays the large product image and thumbnails (if any).
// Right side displays the brand, category, title, ratings, price, full description (markdown), stock pills, and CTA buttons.

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import {
  ShoppingCart, Zap, Heart, X, Package, Star, Shield, Truck,
  Maximize2, ChevronLeft, ChevronRight, ZoomIn, MapPin,
} from "lucide-react";
import type { Product } from "./products";
import { formatUIPrice } from "../services/mapping";
import { useIsMobile } from "./ui/use-mobile";
import { useApp } from "../contexts/AppContext";

interface Props {
  content: string;          // markdown formatted string from productDetailsFormatter
  product: Product;
  onAddToCart: (p: Product) => void;
  onBuyNow: (p: Product, variants?: Record<string, string>) => void;
  onWishlist: (p: Product) => void;
  onClose?: () => void;
}

const getBadgeEmoji = (type?: string): string => {
  if (!type) return "🏆";
  const t = type.toLowerCase();
  if (t.includes("best")) return "🏆";
  if (t.includes("budget")) return "💰";
  if (t.includes("premium")) return "💎";
  if (t.includes("popular")) return "⭐";
  if (t.includes("alternative")) return "🔄";
  return "🎁";
};

export function ProductDetailsCard({
  content,
  product,
  onAddToCart,
  onBuyNow,
  onWishlist,
  onClose,
}: Props) {
  const isMobile = useIsMobile();
  const { setActiveDetailsProduct } = useApp();
  const [addedToCart, setAddedToCart] = useState(false);
  const [imgErr, setImgErr] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  useEffect(() => {
    setActiveDetailsProduct(product);
    return () => {
      setActiveDetailsProduct(prev => prev?.id === product.id ? null : prev);
    };
  }, [product, setActiveDetailsProduct]);

  useEffect(() => {
    setImgIdx(0);
  }, [product?.id]);

  const handleAddToCart = () => {
    onAddToCart(product);
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2200);
  };

  const discount = (product?.price && product?.originalPrice)
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : null;

  const imageUrl = product.images?.[imgIdx] || product.images?.[0] || "";

  return (
    <>
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
          display: "flex",
          flexDirection: "row",
          width: "100%",
          height: isMobile ? "350px" : "400px",
        }}
      >
        {/* ── LEFT COLUMN: Image Gallery & Badges ── */}
        <div style={{
          width: isMobile ? "220px" : "330px",
          flexShrink: 0,
          background: "linear-gradient(135deg, #f8f6fc 0%, #ede6fa 100%)",
          display: "flex",
          flexDirection: "column",
          borderRight: "1.5px solid rgba(124,77,186,0.12)",
          borderBottom: "none",
        }}>
          {/* Main image container */}
          <div style={{
            position: "relative",
            width: "100%",
            height: isMobile ? "180px" : "250px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            background: "#fff",
          }}>
            {imageUrl && !imgErr ? (
              <motion.img
                key={imgIdx}
                src={imageUrl}
                alt={product.name}
                onError={() => setImgErr(true)}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25 }}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", width: "100%" }}>
                <Package size={44} color="rgba(124,77,186,0.25)" />
              </div>
            )}

            {/* Navigation Arrows inside the image */}
            {product.images && product.images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setImgIdx(i => (i - 1 + product.images.length) % product.images.length);
                  }}
                  style={{
                    position: "absolute",
                    left: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    border: "none",
                    background: "rgba(255, 255, 255, 0.75)",
                    backdropFilter: "blur(4px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    boxShadow: "0 2px 5px rgba(0,0,0,0.15)",
                    zIndex: 3,
                    transition: "background 0.2s, transform 0.15s",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.95)";
                    e.currentTarget.style.transform = "translateY(-50%) scale(1.1)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.75)";
                    e.currentTarget.style.transform = "translateY(-50%) scale(1)";
                  }}
                >
                  <ChevronLeft size={15} color="#402970" strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setImgIdx(i => (i + 1) % product.images.length);
                  }}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    border: "none",
                    background: "rgba(255, 255, 255, 0.75)",
                    backdropFilter: "blur(4px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    boxShadow: "0 2px 5px rgba(0,0,0,0.15)",
                    zIndex: 3,
                    transition: "background 0.2s, transform 0.15s",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.95)";
                    e.currentTarget.style.transform = "translateY(-50%) scale(1.1)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.75)";
                    e.currentTarget.style.transform = "translateY(-50%) scale(1)";
                  }}
                >
                  <ChevronRight size={15} color="#402970" strokeWidth={2.5} />
                </button>
              </>
            )}

            {/* Zoom icon in right-bottom corner */}
            {imageUrl && !imgErr && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightbox(true);
                }}
                style={{
                  position: "absolute",
                  bottom: 8,
                  right: 8,
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  border: "none",
                  background: "rgba(255, 255, 255, 0.8)",
                  backdropFilter: "blur(4px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.12)",
                  zIndex: 3,
                  transition: "background 0.2s, transform 0.15s",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.95)";
                  e.currentTarget.style.transform = "scale(1.1)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.8)";
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                <ZoomIn size={14} color="#402970" strokeWidth={2.5} />
              </button>
            )}

            {/* Badges overlay on image */}
            {discount && (
              <span style={{
                position: "absolute", top: 12, left: 12,
                background: "linear-gradient(135deg, #7c4dba, #402970)",
                color: "#fff", fontSize: 9, fontWeight: 800,
                padding: "2px 7px", borderRadius: 20, zIndex: 2
              }}>
                -{discount}%
              </span>
            )}
            {product.recommendationType && (
              <div style={{
                position: "absolute",
                top: discount ? 38 : 12,
                left: 12,
                background: "rgba(255, 255, 255, 0.95)",
                backdropFilter: "blur(4px)",
                padding: "2px 6px",
                borderRadius: 6,
                fontSize: 8,
                fontWeight: 800,
                color: "#402970",
                boxShadow: "0 2px 6px rgba(64,41,112,0.15)",
                zIndex: 2,
                display: "flex",
                alignItems: "center",
                gap: 2
              }}>
                {getBadgeEmoji(product.recommendationType)} {product.recommendationType}
              </div>
            )}
          </div>

          {/* Product basic details (Name, Rating, Price) under main image */}
          <div style={{
            padding: "8px 12px 2px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 2,
          }}>
            <h3 style={{
              color: "#1a1025",
              fontSize: isMobile ? 12.5 : 14.5,
              fontWeight: 800,
              margin: "0 0 2px 0",
              lineHeight: 1.3,
              fontFamily: "'Nunito', sans-serif",
            }}>
              {product.name || "Product Details"}
            </h3>

            {!product.isMcp && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 2 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 1 }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={isMobile ? 10 : 11}
                      strokeWidth={0}
                      fill={i < Math.floor(product.rating || 0) ? "#f59e0b" : "rgba(0,0,0,0.12)"}
                    />
                  ))}
                </div>
                <span style={{ color: "#f59e0b", fontSize: isMobile ? 9.5 : 10.5, fontWeight: 700 }}>
                  {product.rating || 0}
                </span>
                <span style={{ color: "#b8aed0", fontSize: isMobile ? 9.5 : 10.5 }}>
                  ({(product.reviewCount || 0).toLocaleString()})
                </span>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", flexWrap: "wrap", gap: 6 }}>
              <span style={{ color: "#1a1025", fontSize: isMobile ? 13.5 : 15, fontWeight: 800 }}>
                {formatUIPrice(product.price || 0, product.currency)}
              </span>
              {product.originalPrice && (
                <span style={{ color: "#b8aed0", fontSize: isMobile ? 10 : 11.5, textDecoration: "line-through" }}>
                  {formatUIPrice(product.originalPrice || 0, product.currency)}
                </span>
              )}
              {discount && product.originalPrice && (
                <span style={{ color: "#3fc78e", fontSize: isMobile ? 9 : 10, fontWeight: 700 }}>
                  Save {formatUIPrice((product.originalPrice || 0) - (product.price || 0), product.currency)}
                </span>
              )}
            </div>
          </div>

          {/* Thumbnail strip with increased size */}
          {product.images && product.images.length > 1 && (
            <div style={{
              display: "flex",
              justifyContent: "center",
              gap: 6,
              padding: "8px 12px",
              overflowX: "auto",
              scrollbarWidth: "none",
              borderTop: "1px solid rgba(124,77,186,0.08)",
              background: "rgba(124,77,186,0.02)",
            }}>
              {product.images.map((src, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setImgIdx(i)}
                  style={{
                    width: 48, height: 48, flexShrink: 0, borderRadius: 6, overflow: "hidden",
                    border: `2px solid ${i === imgIdx ? "#7c4dba" : "transparent"}`,
                    padding: 0, cursor: "pointer", transition: "border-color 0.2s",
                    background: "rgba(255,255,255,0.8)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </button>
              ))}
            </div>
          )}

          {/* Delivery / stock / warranty badges */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "10px 12px 12px",
            borderTop: "1px solid rgba(124,77,186,0.08)",
            background: "rgba(124,77,186,0.01)",
            marginTop: 4,
            width: "100%",
          }}>
            {/* Row 1: Stock & Delivery */}
            <div style={{
              display: "flex",
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: 6,
              width: "100%",
              marginBottom: 6,
            }}>
              {/* Stock */}
              {(() => {
                const isBool = typeof product.stock === "boolean";
                const isInStock = isBool ? product.stock : (product.stock || 0) > 0;
                const stockNum = typeof product.stock === "number" ? product.stock : 0;
                const isLowStock = !isBool && stockNum > 0 && stockNum < 15;

                let stockText = "In stock";
                if (!isInStock) {
                  stockText = "Out of stock";
                } else if (isLowStock) {
                  stockText = `Only ${stockNum} left`;
                } else if (stockNum > 0) {
                  stockText = `In stock (${stockNum} available)`;
                }

                return (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 5, padding: "4.5px 10px", borderRadius: 7,
                    background: !isInStock ? "rgba(212,24,61,0.06)" : isLowStock ? "rgba(239,120,50,0.06)" : "rgba(64,41,112,0.03)",
                    border: `1px solid ${!isInStock ? "rgba(212,24,61,0.15)" : isLowStock ? "rgba(239,120,50,0.15)" : "rgba(64,41,112,0.06)"}`,
                  }}>
                    <Package size={12} color={!isInStock ? "#d4183d" : isLowStock ? "#ef7832" : "#7c4dba"} strokeWidth={2.5} />
                    <span style={{
                      color: !isInStock ? "#d4183d" : isLowStock ? "#c45f10" : "#402970",
                      fontSize: 11, fontWeight: 700
                    }}>
                      {stockText}
                    </span>
                  </span>
                );
              })()}

              {/* Delivery */}
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 5, padding: "4.5px 10px", borderRadius: 7,
                background: "rgba(63,199,142,0.07)", border: "1px solid rgba(63,199,142,0.15)",
              }}>
                <Truck size={12} color="#3fc78e" strokeWidth={2.5} />
                <span style={{ color: "#2a9e6a", fontSize: 11, fontWeight: 700 }}>
                  {product.delivery || "Standard shipping"}
                </span>
              </span>
            </div>

            {/* Row 2: Warranty & Location */}
            <div style={{
              display: "flex",
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: 6,
              width: "100%",
            }}>
              {/* Warranty */}
              {!product.isMcp && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 5, padding: "4.5px 10px", borderRadius: 7,
                  background: "rgba(64,41,112,0.03)", border: "1px solid rgba(64,41,112,0.08)"
                }}>
                  <Shield size={12} color="#7c4dba" strokeWidth={2.5} />
                  <span style={{ color: "#402970", fontSize: 11, fontWeight: 700 }}>
                    1-yr warranty
                  </span>
                </span>
              )}

              {/* Detailed Shipping Info */}
              {(() => {
                const shipFromText = product.shippingInfo || (product.isMcp ? "Ship from LK" : null);
                if (!shipFromText) return null;
                return (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 5, padding: "4.5px 10px", borderRadius: 7,
                    background: "rgba(64,41,112,0.03)", border: "1px solid rgba(64,41,112,0.08)"
                  }}>
                    <MapPin size={12} color="#7c4dba" strokeWidth={2.5} />
                    <span style={{ color: "#402970", fontSize: 11, fontWeight: 700 }}>
                      {shipFromText}
                    </span>
                  </span>
                );
              })()}
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: Details & Description ── */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: isMobile ? "10px 12px" : "14px 18px",
          minWidth: 0,
        }}>
          {/* Category/Brand + Close Button */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ cursor: "default" }}>
              <p style={{ color: "#9e8dc0", fontSize: isMobile ? 8.5 : 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
                {product.brand || "Brand"} · {product.category || "General"}
              </p>
            </div>
            {onClose && (
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                style={{
                  width: 24, height: 24, borderRadius: 6, border: "none", cursor: "pointer",
                  background: "rgba(64,41,112,0.06)", color: "#7c4dba",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <X size={12} strokeWidth={2.5} />
              </motion.button>
            )}
          </div>

          {/* Divider */}
          <div style={{ height: "1px", background: "rgba(64,41,112,0.08)", width: "100%", marginTop: 6, marginBottom: 10 }} />

          {/* Full Markdown Description (Scrollable) */}
          <div
            className="product-details-desc-scroll"
            style={{
              flex: 1,
              overflowY: "auto",
              marginBottom: 12,
              paddingRight: 6,
              minHeight: 0,
            }}
          >
            <div className="product-details-markdown">
              <style dangerouslySetInnerHTML={{
                __html: `
              .product-details-desc-scroll::-webkit-scrollbar {
                width: 6px;
              }
              .product-details-desc-scroll::-webkit-scrollbar-track {
                background: transparent;
              }
              .product-details-desc-scroll::-webkit-scrollbar-thumb {
                background: rgba(124,77,186,0.15);
                border-radius: 3px;
              }
              .product-details-desc-scroll::-webkit-scrollbar-thumb:hover {
                background: rgba(124,77,186,0.3);
              }
              .product-details-markdown h2 {
                font-size: ${isMobile ? "0.9rem" : "1rem"};
                font-weight: 800;
                color: #1a1025;
                margin: 0 0 ${isMobile ? "4px" : "8px"} 0;
                font-family: 'Nunito', sans-serif;
              }
              .product-details-markdown h3 {
                font-size: ${isMobile ? "0.85rem" : "0.95rem"};
                font-weight: 700;
                color: #1a1025;
                margin: ${isMobile ? "6px" : "10px"} 0 4px;
                font-family: 'Nunito', sans-serif;
              }
              .product-details-markdown p {
                margin: 0 0 ${isMobile ? "4px" : "6px"} 0;
                line-height: ${isMobile ? "1.4" : "1.55"};
                color: #3d2d5c;
                font-size: ${isMobile ? "11px" : "12.5px"};
                font-family: 'Nunito', sans-serif;
              }
              .product-details-markdown strong {
                font-weight: 800;
                color: #402970;
              }
              .product-details-markdown ul,
              .product-details-markdown ol {
                margin: ${isMobile ? "2px" : "4px"} 0 ${isMobile ? "4px" : "6px"} 0;
                padding-left: ${isMobile ? "12px" : "16px"};
                font-family: 'Nunito', sans-serif;
              }
              .product-details-markdown li {
                margin-bottom: ${isMobile ? "2px" : "3px"};
                color: #3d2d5c;
                font-size: ${isMobile ? "11px" : "12.5px"};
                line-height: ${isMobile ? "1.3" : "1.45"};
              }
              .product-details-markdown hr {
                border: none;
                border-top: 1px solid rgba(64,41,112,0.1);
                margin: ${isMobile ? "5px" : "8px"} 0;
              }
              .product-details-markdown > :first-child { margin-top: 0 !important; }
              .product-details-markdown > :last-child  { margin-bottom: 0 !important; }
            `}} />
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          </div>

        </div>
      </motion.div>

      {/* ── Zoom Lightbox Modal ── */}
      <AnimatePresence>
        {lightbox && (
          <>
            {/* backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setLightbox(false)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 1000,
                background: "rgba(10,6,20,0.85)",
                backdropFilter: "blur(6px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            />

            {/* Content overlay container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              style={{
                position: "fixed",
                inset: "40px",
                zIndex: 1001,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              {/* Image box */}
              <div style={{
                position: "relative",
                maxWidth: "100%",
                maxHeight: "100%",
                pointerEvents: "auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
              }}>
                <img
                  src={imageUrl}
                  alt={product.name}
                  style={{
                    maxWidth: "85vw",
                    maxHeight: "80vh",
                    objectFit: "contain",
                    borderRadius: 12,
                    boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
                    border: "2px solid rgba(255,255,255,0.1)",
                    background: "#fff",
                  }}
                />

                {/* Lightbox navigation arrows */}
                {product.images && product.images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setImgIdx(i => (i - 1 + product.images.length) % product.images.length);
                      }}
                      style={{
                        position: "absolute",
                        left: isMobile ? 12 : -50,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        border: "none",
                        background: "rgba(255, 255, 255, 0.15)",
                        backdropFilter: "blur(4px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        color: "#fff",
                        transition: "background 0.2s, transform 0.15s",
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = "rgba(255, 255, 255, 0.35)";
                        e.currentTarget.style.transform = "translateY(-50%) scale(1.08)";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
                        e.currentTarget.style.transform = "translateY(-50%) scale(1)";
                      }}
                    >
                      <ChevronLeft size={24} strokeWidth={2.5} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setImgIdx(i => (i + 1) % product.images.length);
                      }}
                      style={{
                        position: "absolute",
                        right: isMobile ? 12 : -50,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        border: "none",
                        background: "rgba(255, 255, 255, 0.15)",
                        backdropFilter: "blur(4px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        color: "#fff",
                        transition: "background 0.2s, transform 0.15s",
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = "rgba(255, 255, 255, 0.35)";
                        e.currentTarget.style.transform = "translateY(-50%) scale(1.08)";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
                        e.currentTarget.style.transform = "translateY(-50%) scale(1)";
                      }}
                    >
                      <ChevronRight size={24} strokeWidth={2.5} />
                    </button>
                  </>
                )}
              </div>

              {/* Close button top right of screen */}
              <button
                type="button"
                onClick={() => setLightbox(false)}
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  border: "none",
                  background: "rgba(255,255,255,0.15)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  pointerEvents: "auto",
                  transition: "background 0.2s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.3)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
              >
                <X size={18} strokeWidth={2.5} />
              </button>

              {/* Image counter at bottom */}
              <div style={{ marginTop: 16, color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 700 }}>
                {imgIdx + 1} / {(product.images || []).length}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

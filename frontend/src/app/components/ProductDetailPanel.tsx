import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X, ShoppingCart, Zap, Heart, Truck, Package,
  ChevronLeft, ChevronRight, Shield, CheckCircle, ExternalLink,
  Loader2, AlertTriangle
} from "lucide-react";
import type { Product } from "./products";
import { fetchProductDetails, type ProductDetail } from "../services/productServices";
import { mapProductDetailToUI } from "../services/mapping";

interface Props {
  productId: string;
  onClose: () => void;
  onAddToCart: (p: Product) => void;
  onBuyNow: (p: Product, variants?: Record<string, string>) => void;
  onWishlist: (p: Product) => void;
}

const renderFormattedDescription = (text: string) => {
  if (!text) return null;

  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  
  let overviewLines: string[] = [];
  let featureLines: string[] = [];
  let additionalLines: string[] = [];
  
  let currentSection: "overview" | "features" | "additional" = "overview";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase();

    // Section triggers
    if (
      lowerLine.startsWith("includes") || 
      lowerLine.startsWith("features") || 
      lowerLine.includes("key features") ||
      (currentSection === "overview" && line.length < 60 && !line.endsWith(".") && !line.endsWith("!"))
    ) {
      if (currentSection === "overview") {
        currentSection = "features";
      }
    }

    if (
      lowerLine.startsWith("additional") || 
      lowerLine.startsWith("warranty") || 
      lowerLine.startsWith("note:") ||
      lowerLine.startsWith("colors may vary") ||
      lowerLine.includes("specifications") ||
      lowerLine.includes("warranty details")
    ) {
      currentSection = "additional";
    }

    // Process line
    if (currentSection === "overview") {
      overviewLines.push(line);
    } else if (currentSection === "features") {
      if (!line.endsWith(":") && !lowerLine.startsWith("includes") && !lowerLine.startsWith("features")) {
        featureLines.push(line);
      }
    } else if (currentSection === "additional") {
      if (!line.endsWith(":") && !lowerLine.startsWith("additional details") && !lowerLine.startsWith("additional information")) {
        additionalLines.push(line);
      }
    }
  }

  // Fallback
  if (featureLines.length === 0 && overviewLines.length > 1) {
    featureLines = overviewLines.slice(1);
    overviewLines = [overviewLines[0]];
  }

  const isBulletItem = (t: string) => {
    const clean = t.trim();
    return clean.startsWith("-") || 
           clean.startsWith("*") || 
           clean.startsWith("•") || 
           clean.startsWith("o") || 
           (clean.length < 80 && !clean.endsWith("."));
  };

  const renderSectionItems = (sectionItems: string[]) => {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {sectionItems.map((item, idx) => {
          const hasBulletMarker = item.startsWith("-") || item.startsWith("*") || item.startsWith("•") || item.startsWith("o");
          const cleanItem = hasBulletMarker ? item.replace(/^[-*•o]\s*/, "") : item;
          
          if (isBulletItem(item)) {
            return (
              <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "6px", paddingLeft: "4px" }}>
                <span style={{ color: "#7c4dba", fontSize: "14px", lineHeight: "1.2", userSelect: "none" }}>•</span>
                <span style={{ color: "#3a2a55", fontSize: "12.5px", lineHeight: "1.55", fontFamily: "'Nunito',sans-serif" }}>
                  {cleanItem}
                </span>
              </div>
            );
          }

          return (
            <p key={idx} style={{ color: "#3a2a55", fontSize: "12.5px", fontFamily: "'Nunito',sans-serif", lineHeight: "1.65", margin: "4px 0 0 0" }}>
              {item}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Product Overview */}
      {overviewLines.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <h3 style={{ color: "#402970", fontSize: "13.5px", fontWeight: 800, margin: 0, fontFamily: "'Nunito',sans-serif", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Product Overview
          </h3>
          <p style={{ color: "#3a2a55", fontSize: "12.5px", lineHeight: "1.65", margin: 0, fontFamily: "'Nunito',sans-serif" }}>
            {overviewLines.join(" ")}
          </p>
        </div>
      )}

      {/* Features */}
      {featureLines.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <h3 style={{ color: "#402970", fontSize: "13.5px", fontWeight: 800, margin: 0, fontFamily: "'Nunito',sans-serif", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Features
          </h3>
          {renderSectionItems(featureLines)}
        </div>
      )}

      {/* Additional Information */}
      {additionalLines.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <h3 style={{ color: "#402970", fontSize: "13.5px", fontWeight: 800, margin: 0, fontFamily: "'Nunito',sans-serif", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Additional Information
          </h3>
          {renderSectionItems(additionalLines)}
        </div>
      )}
    </div>
  );
};

export function ProductDetailPanel({ productId, onClose, onAddToCart, onBuyNow, onWishlist }: Props) {
  const [productDetail, setProductDetail] = useState<ProductDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [imgIndex, setImgIndex] = useState(0);
  const [imgError, setImgError] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    setProductDetail(null);
    setImgIndex(0);
    setImgError(false);

    fetchProductDetails(productId)
      .then(data => {
        if (active) {
          setProductDetail(data);
          setIsLoading(false);
        }
      })
      .catch(err => {
        if (active) {
          setError(err.message || "Failed to load product details");
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [productId]);

  const handleAddToCart = () => {
    if (!productDetail) return;
    const product = mapProductDetailToUI(productDetail);
    onAddToCart(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleWishlist = () => {
    if (!productDetail) return;
    const product = mapProductDetailToUI(productDetail);
    onWishlist(product);
    setWishlisted(w => !w);
  };

  const prevImg = () => {
    if (!productDetail) return;
    setImgIndex(i => (i - 1 + productDetail.images.length) % productDetail.images.length);
  };

  const nextImg = () => {
    if (!productDetail) return;
    setImgIndex(i => (i + 1) % productDetail.images.length);
  };

  const formattedPrice = productDetail
    ? productDetail.currency === "LKR"
      ? `Rs. ${productDetail.price.toLocaleString()}`
      : `${productDetail.currency === "USD" ? "$" : productDetail.currency} ${productDetail.price.toFixed(2)}`
    : "";

  return (
    <motion.div
      key={productId}
      initial={{ opacity: 0, x: -18 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -18 }}
      transition={{ duration: 0.22 }}
      style={{
        display: "flex",
        width: 380,
        maxWidth: "100%",
        height: "100%",
        flexShrink: 0,
      }}
    >
      <motion.div
        initial={{ x: -18, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -18, opacity: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 30 }}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          background: "#fff",
          border: "1px solid rgba(64,41,112,0.1)",
          borderRadius: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 8px 30px rgba(64,41,112,0.12)",
        }}
      >
      {/* Header */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(64,41,112,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, background: "linear-gradient(135deg,rgba(124,77,186,0.05),rgba(64,41,112,0.03))" }}>
        <div>
          <p style={{ color: "#9e8dc0", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", fontFamily: "'Nunito',sans-serif", textTransform: "uppercase" }}>Product Details</p>
          <p style={{ color: "#1a1025", fontSize: 13, fontWeight: 700, fontFamily: "'Nunito',sans-serif", marginTop: 1, maxWidth: 280, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {isLoading ? "Loading..." : productDetail?.name || "Product Info"}
          </p>
        </div>
        <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={onClose}
          style={{ width: 32, height: 32, borderRadius: 10, border: "none", background: "rgba(64,41,112,0.08)", color: "#7c6a9e", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
        >
          <X size={15} strokeWidth={2.5} />
        </motion.button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", display: "flex", flexDirection: "column" }}>

        {/* Loading state */}
        {isLoading && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 18, gap: 16 }}>
            {/* Skeleton image */}
            <div style={{ width: "100%", paddingTop: "62%", borderRadius: 12, background: "rgba(64,41,112,0.06)", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)", animation: "pulse 1.5s infinite" }} />
            </div>
            {/* Skeleton brand */}
            <div style={{ width: 80, height: 12, borderRadius: 4, background: "rgba(64,41,112,0.06)" }} />
            {/* Skeleton title */}
            <div style={{ width: "90%", height: 20, borderRadius: 4, background: "rgba(64,41,112,0.06)" }} />
            {/* Skeleton price */}
            <div style={{ width: 120, height: 24, borderRadius: 4, background: "rgba(64,41,112,0.06)" }} />
            {/* Skeleton description */}
            <div style={{ width: "100%", height: 80, borderRadius: 12, background: "rgba(64,41,112,0.06)" }} />
            {/* Spinner */}
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginTop: 20 }}>
              <Loader2 className="animate-spin" size={24} color="#7c4dba" />
              <span style={{ marginLeft: 8, color: "#7c6a9e", fontSize: 13, fontWeight: 600 }}>Loading details...</span>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", gap: 12 }}>
            <AlertTriangle size={40} color="#ef7832" />
            <h3 style={{ color: "#1a1025", fontSize: 15, fontWeight: 700, margin: 0 }}>Failed to Load Details</h3>
            <p style={{ color: "#7c6a9e", fontSize: 13, margin: 0, lineHeight: 1.5 }}>
              {error || "We couldn't retrieve the details for this product. Please check your connection and try again."}
            </p>
            <button
              type="button"
              onClick={() => {
                setIsLoading(true);
                setError(null);
                fetchProductDetails(productId)
                  .then(data => {
                    setProductDetail(data);
                    setIsLoading(false);
                  })
                  .catch(err => {
                    setError(err.message || "Failed to load product details");
                    setIsLoading(false);
                  });
              }}
              style={{ marginTop: 12, padding: "8px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#7c4dba,#402970)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Product Details Content */}
        {productDetail && !isLoading && !error && (
          <>
            {/* Image gallery */}
            <div style={{ position: "relative", width: "100%", paddingTop: "62%", background: "linear-gradient(135deg,#f5f0ff,#ede4ff)", overflow: "hidden", flexShrink: 0 }}>
              <AnimatePresence mode="wait">
                {!imgError ? (
                  <motion.img
                    key={productDetail.images[imgIndex]}
                    src={productDetail.images[imgIndex]}
                    alt={productDetail.name}
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
              {productDetail.images.length > 1 && (
                <>
                  <button type="button" onClick={prevImg} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 30, height: 30, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.88)", backdropFilter: "blur(6px)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}>
                    <ChevronLeft size={15} strokeWidth={2.5} color="#402970" />
                  </button>
                  <button type="button" onClick={nextImg} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", width: 30, height: 30, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.88)", backdropFilter: "blur(6px)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}>
                    <ChevronRight size={15} strokeWidth={2.5} color="#402970" />
                  </button>
                  <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 5 }}>
                    {productDetail.images.map((_, i) => (
                      <button key={i} type="button" onClick={() => setImgIndex(i)}
                        style={{ width: i === imgIndex ? 16 : 6, height: 6, borderRadius: 3, border: "none", background: i === imgIndex ? "#7c4dba" : "rgba(255,255,255,0.7)", cursor: "pointer", transition: "all 0.2s", padding: 0 }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Details body */}
            <div style={{ padding: "18px 18px 24px", display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Brand + title */}
              <div>
                <p style={{ color: "#9e8dc0", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", fontFamily: "'Nunito',sans-serif", textTransform: "uppercase", marginBottom: 4 }}>
                  {productDetail.name.split(" ")[0] || "Kapruka"}
                </p>
                <h2 style={{ color: "#1a1025", fontSize: 17, fontWeight: 800, fontFamily: "'Nunito',sans-serif", lineHeight: 1.3, margin: 0 }}>
                  {productDetail.name}
                </h2>
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-3">
                <span style={{ color: "#1a1025", fontSize: 24, fontWeight: 800, fontFamily: "'Nunito',sans-serif" }}>
                  {formattedPrice}
                </span>
              </div>

              {/* Description */}
              <div style={{ padding: "14px 16px", borderRadius: 12, background: "#f0ebfa", border: "1px solid rgba(64,41,112,0.15)" }}>
                {renderFormattedDescription(productDetail.description)}
              </div>

              {/* Delivery + stock */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="flex items-center gap-3" style={{ padding: "11px 14px", borderRadius: 12, background: "rgba(63,199,142,0.07)", border: "1px solid rgba(63,199,142,0.2)" }}>
                  <Truck size={16} color="#3fc78e" strokeWidth={2} />
                  <span style={{ color: "#2a9e6a", fontSize: 12, fontWeight: 600, fontFamily: "'Nunito',sans-serif" }}>
                    {productDetail.shippingInfo}
                  </span>
                </div>
                <div className="flex items-center gap-3" style={{ padding: "11px 14px", borderRadius: 12, background: productDetail.stock ? "rgba(64,41,112,0.04)" : "rgba(212,24,61,0.07)", border: `1px solid ${productDetail.stock ? "rgba(64,41,112,0.08)" : "rgba(212,24,61,0.2)"}` }}>
                  <Package size={16} color={productDetail.stock ? "#7c4dba" : "#d4183d"} strokeWidth={2} />
                  <span style={{ color: productDetail.stock ? "#402970" : "#d4183d", fontSize: 12, fontWeight: 600, fontFamily: "'Nunito',sans-serif" }}>
                    {productDetail.stock ? "In Stock" : "Out of Stock"}
                  </span>
                </div>
                <div className="flex items-center gap-3" style={{ padding: "11px 14px", borderRadius: 12, background: "rgba(64,41,112,0.04)", border: "1px solid rgba(64,41,112,0.08)" }}>
                  <Shield size={16} color="#7c4dba" strokeWidth={2} />
                  <span style={{ color: "#402970", fontSize: 12, fontWeight: 600, fontFamily: "'Nunito',sans-serif" }}>
                    100% Genuine product secured via Kapruka
                  </span>
                </div>
              </div>

              {/* Product URL */}
              {productDetail.url && (
                <a
                  href={productDetail.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5"
                  style={{
                    marginTop: 8,
                    padding: "10px 12px",
                    borderRadius: 12,
                    background: "rgba(64,41,112,0.04)",
                    border: "1.5px dashed rgba(64,41,112,0.2)",
                    color: "#7c4dba",
                    fontSize: 12,
                    fontWeight: 700,
                    textDecoration: "none",
                    textAlign: "center",
                    transition: "all 0.15s"
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = "rgba(64,41,112,0.08)";
                    e.currentTarget.style.borderColor = "rgba(64,41,112,0.3)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "rgba(64,41,112,0.04)";
                    e.currentTarget.style.borderColor = "rgba(64,41,112,0.2)";
                  }}
                >
                  <ExternalLink size={13} />
                  View Product on Kapruka
                </a>
              )}
            </div>
          </>
        )}
      </div>

      {/* Sticky footer actions */}
      {productDetail && !isLoading && !error && (
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
              <motion.button key="cart" type="button" whileTap={productDetail.stock ? { scale: 0.97 } : {}} onClick={handleAddToCart}
                disabled={!productDetail.stock}
                className="flex items-center justify-center gap-2"
                style={{ width: "100%", padding: "12px", borderRadius: 12, border: "1.5px solid rgba(64,41,112,0.3)", background: "transparent", color: productDetail.stock ? "#402970" : "#b8aed0", fontSize: 13, fontWeight: 700, cursor: productDetail.stock ? "pointer" : "not-allowed", fontFamily: "'Nunito',sans-serif" }}
              >
                <ShoppingCart size={16} strokeWidth={2.5} />
                Add to Cart
              </motion.button>
            )}
          </AnimatePresence>

          <div className="flex gap-2">
            <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={handleWishlist}
              className="flex items-center justify-center gap-2 flex-1"
              style={{ padding: "12px", borderRadius: 12, border: `1.5px solid ${wishlisted ? "rgba(232,57,90,0.4)" : "rgba(64,41,112,0.2)"}`, background: wishlisted ? "rgba(232,57,90,0.08)" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Nunito',sans-serif" }}
            >
              <Heart size={17} strokeWidth={2} color={wishlisted ? "#e8395a" : "#9e8dc0"} fill={wishlisted ? "#e8395a" : "none"} />
              <span style={{ color: wishlisted ? "#e8395a" : "#9e8dc0", fontSize: 13, fontWeight: 700 }}>Wishlist</span>
            </motion.button>
          </div>
        </div>
      )}
      </motion.div>
    </motion.div>
  );
}

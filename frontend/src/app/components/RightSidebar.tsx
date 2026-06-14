import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Heart, ShoppingCart, Bookmark } from "lucide-react";
import { useApp, type RightPanelId } from "../contexts/AppContext";
import { type Product } from "./products";
import { formatUIPrice } from "../services/mapping";

interface RightSidebarProps {
  onClose: () => void;
  onRemoveCart: (id: string) => void;
  onRemoveWishlist: (id: string) => void;
  onRemoveSaved: (id: string) => void;
  onMoveToCart: (p: Product) => void;
  onCheckout: () => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  onClose,
  onRemoveCart,
  onRemoveWishlist,
  onRemoveSaved,
  onMoveToCart,
  onCheckout,
}) => {
  const { rightPanel, cartItems, wishlistItems, savedItems, handleAddToCart } = useApp();
  const Icon = rightPanel === "Wishlist" ? Heart : rightPanel === "Cart" ? ShoppingCart : Bookmark;
  const cartTotal = cartItems.reduce((sum, i) => sum + i.product.price * i.qty, 0);

  const renderEmpty = () => (
    <div className="flex flex-col items-center justify-center h-full gap-3" style={{ padding: "40px 20px", color: "#b8aed0" }}>
      <Icon size={36} strokeWidth={1.4} />
      <p style={{ fontSize: 13, fontWeight: 600, fontFamily: "'Nunito',sans-serif", textAlign: "center" }}>
        {rightPanel === "Cart" ? "Your cart is empty" : rightPanel === "Wishlist" ? "No wishlist items yet" : "Nothing saved yet"}
      </p>
      <p style={{ fontSize: 11, fontFamily: "'Nunito',sans-serif", textAlign: "center", maxWidth: 200 }}>
        {rightPanel === "Cart" ? "Add products using the Add to Cart button" : rightPanel === "Wishlist" ? "Click the Wishlist button on any product" : "Save products to find them later"}
      </p>
    </div>
  );

  return (
    <>
      <motion.div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(26,16,37,0.25)", backdropFilter: "blur(2px)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22 }}
        onClick={onClose}
      />
      <motion.aside
        className="fixed top-0 right-0 h-full z-50 flex flex-col"
        style={{ width: 320, background: "#fff", boxShadow: "-8px 0 40px rgba(64,41,112,0.18)", borderLeft: "1px solid rgba(64,41,112,0.1)" }}
        initial={{ x: 320 }}
        animate={{ x: 0 }}
        exit={{ x: 320 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{
            borderBottom: "1px solid rgba(64,41,112,0.09)",
            background: "linear-gradient(135deg,rgba(124,77,186,0.06),rgba(64,41,112,0.03))",
            flexShrink: 0,
          }}
        >
          <div className="flex items-center gap-2">
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#7c4dba,#402970)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon size={17} color="#fff" strokeWidth={2} />
            </div>
            <h2 style={{ color: "#1a1025", fontWeight: 700, fontSize: 15, fontFamily: "'Nunito',sans-serif" }}>{rightPanel}</h2>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "rgba(64,41,112,0.1)", color: "#402970", fontFamily: "'Nunito',sans-serif" }}>
              {rightPanel === "Cart" ? cartItems.length : rightPanel === "Wishlist" ? wishlistItems.length : savedItems.length}
            </span>
          </div>
          <motion.button
            type="button"
            onClick={onClose}
            whileTap={{ scale: 0.9 }}
            className="flex items-center justify-center"
            style={{ width: 30, height: 30, borderRadius: 9, border: "none", cursor: "pointer", background: "rgba(64,41,112,0.07)", color: "#7c6a9e" }}
          >
            <X size={14} strokeWidth={2.5} />
          </motion.button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
          {rightPanel === "Cart" && (
            cartItems.length === 0 ? renderEmpty() :
              <div className="flex flex-col gap-3">
                {cartItems.map((item, i) => (
                  <motion.div
                    key={item.product.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-3"
                    style={{ padding: "12px 14px", borderRadius: 14, background: "rgba(64,41,112,0.04)", border: "1px solid rgba(64,41,112,0.08)" }}
                  >
                    <div style={{ width: 42, height: 42, borderRadius: 12, overflow: "hidden", flexShrink: 0, background: "linear-gradient(135deg,#f5f0ff,#ede4ff)" }}>
                      <img src={item.product.images[0]} alt={item.product.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p style={{ color: "#1a1025", fontSize: 13, fontWeight: 600, fontFamily: "'Nunito',sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.product.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span style={{ color: "#402970", fontSize: 12, fontWeight: 700, fontFamily: "'Nunito',sans-serif" }}>{formatUIPrice(item.product.price, item.product.currency)}</span>
                        <span style={{ color: "#9e8dc0", fontSize: 11, fontFamily: "'Nunito',sans-serif" }}>×{item.qty}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: "rgba(64,41,112,0.08)", color: "#7c6a9e", fontFamily: "'Nunito',sans-serif" }}>{item.product.category}</span>
                      </div>
                    </div>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.88 }}
                      onClick={() => onRemoveCart(item.product.id)}
                      className="flex items-center justify-center"
                      style={{ width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer", background: "rgba(212,24,61,0.07)", color: "#d4183d", flexShrink: 0 }}
                    >
                      <X size={12} strokeWidth={2.5} />
                    </motion.button>
                  </motion.div>
                ))}
              </div>
          )}

          {rightPanel === "Wishlist" && (
            wishlistItems.length === 0 ? renderEmpty() :
              <div className="flex flex-col gap-3">
                {wishlistItems.map((product, i) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-3"
                    style={{ padding: "12px 14px", borderRadius: 14, background: "rgba(64,41,112,0.04)", border: "1px solid rgba(64,41,112,0.08)" }}
                  >
                    <div style={{ width: 42, height: 42, borderRadius: 12, overflow: "hidden", flexShrink: 0, background: "linear-gradient(135deg,#f5f0ff,#ede4ff)" }}>
                      <img src={product.images[0]} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p style={{ color: "#1a1025", fontSize: 13, fontWeight: 600, fontFamily: "'Nunito',sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{product.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span style={{ color: "#402970", fontSize: 12, fontWeight: 700, fontFamily: "'Nunito',sans-serif" }}>{formatUIPrice(product.price, product.currency)}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: "rgba(64,41,112,0.08)", color: "#7c6a9e", fontFamily: "'Nunito',sans-serif" }}>{product.category}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.88 }}
                        onClick={() => onMoveToCart(product)}
                        style={{ padding: "4px 8px", borderRadius: 7, border: "none", cursor: "pointer", background: "linear-gradient(135deg,#7c4dba,#402970)", color: "#fff", fontSize: 10, fontWeight: 700, fontFamily: "'Nunito',sans-serif" }}
                      >
                        Add to Cart
                      </motion.button>
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.88 }}
                        onClick={() => onRemoveWishlist(product.id)}
                        className="flex items-center justify-center"
                        style={{ width: "100%", padding: "4px", borderRadius: 7, border: "none", cursor: "pointer", background: "rgba(212,24,61,0.07)", color: "#d4183d" }}
                      >
                        <X size={11} strokeWidth={2.5} />
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </div>
          )}

          {rightPanel === "Saved" && (
            savedItems.length === 0 ? renderEmpty() :
              <div className="flex flex-col gap-3">
                {savedItems.map((product, i) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-3"
                    style={{ padding: "12px 14px", borderRadius: 14, background: "rgba(64,41,112,0.04)", border: "1px solid rgba(64,41,112,0.08)" }}
                  >
                    <div style={{ width: 42, height: 42, borderRadius: 12, overflow: "hidden", flexShrink: 0, background: "linear-gradient(135deg,#f5f0ff,#ede4ff)" }}>
                      <img src={product.images[0]} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p style={{ color: "#1a1025", fontSize: 13, fontWeight: 600, fontFamily: "'Nunito',sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{product.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span style={{ color: "#402970", fontSize: 12, fontWeight: 700, fontFamily: "'Nunito',sans-serif" }}>{formatUIPrice(product.price, product.currency)}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: "rgba(64,41,112,0.08)", color: "#7c6a9e", fontFamily: "'Nunito',sans-serif" }}>{product.category}</span>
                      </div>
                    </div>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.88 }}
                      onClick={() => onRemoveSaved(product.id)}
                      className="flex items-center justify-center"
                      style={{ width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer", background: "rgba(212,24,61,0.07)", color: "#d4183d", flexShrink: 0 }}
                    >
                      <X size={12} strokeWidth={2.5} />
                    </motion.button>
                  </motion.div>
                ))}
              </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 pb-5 pt-3" style={{ borderTop: "1px solid rgba(64,41,112,0.09)", flexShrink: 0 }}>
          {rightPanel === "Cart" && cartItems.length > 0 && (
            <div className="flex items-center justify-between mb-3">
              <span style={{ color: "#7c6a9e", fontSize: 13, fontWeight: 600, fontFamily: "'Nunito',sans-serif" }}>Total</span>
              <span style={{ color: "#1a1025", fontSize: 16, fontWeight: 700, fontFamily: "'Nunito',sans-serif" }}>{formatUIPrice(cartTotal, cartItems[0]?.product.currency)}</span>
            </div>
          )}
          <button
            type="button"
            onClick={rightPanel === "Cart" && cartItems.length > 0 ? onCheckout : undefined}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: 14,
              border: "none",
              background: rightPanel === "Cart" && cartItems.length > 0 ? "linear-gradient(135deg,#7c4dba,#402970)" : rightPanel === "Cart" ? "rgba(64,41,112,0.15)" : "linear-gradient(135deg,#7c4dba,#402970)",
              color: rightPanel === "Cart" && cartItems.length === 0 ? "#b8aed0" : "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: rightPanel === "Cart" && cartItems.length === 0 ? "default" : "pointer",
              fontFamily: "'Nunito',sans-serif",
            }}
          >
            {rightPanel === "Cart" ? "Checkout" : rightPanel === "Wishlist" ? "Move All to Cart" : "View All Saved"}
          </button>
        </div>
      </motion.aside>
    </>
  );
};

import React, { useState } from "react";
import { motion } from "motion/react";
import { Trash2, ShoppingCart, ArrowLeft, Heart, Sparkles, AlertCircle, Plus, Minus, Tag, Check, X, Bell, BellOff } from "lucide-react";
import { useWishlist } from "../contexts/WishlistContext";
import { useCart } from "../contexts/CartContext";
import { type Product, PRODUCTS } from "./products";
import { formatUIPrice } from "../services/mapping";

interface WishlistScreenProps {
  onContinueShopping: () => void;
}

export const WishlistScreen: React.FC<WishlistScreenProps> = ({ onContinueShopping }) => {
  const {
    wishlistItems,
    removeFromWishlist,
    moveToCart,
    toggleAlerts,
    shareWishlist,
  } = useWishlist();

  const { addToCart } = useCart();
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  // Recommendations: exclude items already in wishlist or just take a curated list
  const recProducts = PRODUCTS.slice(2, 7);

  const totalItemsCount = wishlistItems.length;
  const selectedItemsCount = Object.keys(selectedIds).filter(id => selectedIds[id] && wishlistItems.some(item => item.productId === id)).length;
  const allSelected = totalItemsCount > 0 && wishlistItems.every(item => selectedIds[item.productId]);

  const handleSelectAll = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    if (checked) {
      wishlistItems.forEach(item => {
        next[item.productId] = true;
      });
    }
    setSelectedIds(next);
  };

  const handleSelectItem = (productId: string, checked: boolean) => {
    setSelectedIds(prev => ({
      ...prev,
      [productId]: checked,
    }));
  };

  const handleMoveSelectedToCart = () => {
    const activeSelectedIds = Object.keys(selectedIds).filter(id => selectedIds[id] && wishlistItems.some(item => item.productId === id));
    activeSelectedIds.forEach(id => {
      const item = wishlistItems.find(w => w.productId === id);
      if (item) {
        moveToCart(item.product);
        removeFromWishlist(id);
      }
    });
    // Reset selections
    setSelectedIds({});
  };

  const handleDeleteSelected = () => {
    const activeSelectedIds = Object.keys(selectedIds).filter(id => selectedIds[id] && wishlistItems.some(item => item.productId === id));
    activeSelectedIds.forEach(id => {
      removeFromWishlist(id);
    });
    // Reset selections
    setSelectedIds({});
  };

  return (
    <div className="flex-1 w-full overflow-y-auto px-6 py-6" style={{ background: "rgba(250, 248, 254, 0.4)", fontFamily: "'Nunito', sans-serif" }}>
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={onContinueShopping}
              style={{ width: 36, height: 36, borderRadius: 10, border: "1.5px solid rgba(64,41,112,0.12)", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#402970" }}
            >
              <ArrowLeft size={16} strokeWidth={2.5} />
            </motion.button>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1a1025", margin: 0 }}>Your Wishlist</h1>
              <p style={{ fontSize: 13, color: "#7c6a9e", margin: "2px 0 0 0" }}>Keep track of your favorite products and move them to cart anytime.</p>
            </div>
          </div>

          {totalItemsCount > 0 && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                const text = shareWishlist();
                navigator.clipboard.writeText(text);
                alert("Wishlist link copied to clipboard!");
              }}
              style={{ padding: "8px 16px", borderRadius: 10, border: "1.5px solid rgba(124,77,186,0.2)", background: "#fff", color: "#7c4dba", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              Share Wishlist
            </motion.button>
          )}
        </div>

        {totalItemsCount === 0 ? (
          /* Empty Wishlist View */
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 px-4 bg-white rounded-3xl"
            style={{ border: "1px solid rgba(64,41,112,0.08)", boxShadow: "0 10px 30px rgba(64,41,112,0.04)" }}
          >
            <div style={{ width: 80, height: 80, borderRadius: 24, background: "rgba(212,24,61,0.06)", display: "flex", alignItems: "center", justifyContent: "center", color: "#d4183d", marginBottom: 20 }}>
              <Heart size={36} fill="#d4183d" strokeWidth={1.5} />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1025", margin: 0 }}>Your wishlist is empty</h2>
            <p style={{ fontSize: 13, color: "#7c6a9e", marginTop: 6, marginBottom: 24, textAlign: "center", maxWidth: 300 }}>
              Save items you love here to keep track of their stock status, price drops, and reviews.
            </p>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onContinueShopping}
              style={{ padding: "12px 24px", borderRadius: 14, border: "none", background: "linear-gradient(135deg,#7c4dba,#402970)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              Continue Shopping
            </motion.button>
          </motion.div>
        ) : (
          /* Main Wishlist Content */
          <div className="flex flex-col gap-6">
            
            {/* Items List Wrapper */}
            <div className="bg-white rounded-2xl flex flex-col" style={{ border: "1px solid rgba(64,41,112,0.08)", boxShadow: "0 10px 30px rgba(64,41,112,0.04)", overflow: "hidden" }}>
              
              {/* Bulk Selector Header */}
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(64,41,112,0.06)" }}>
                <label className="flex items-center gap-3 cursor-pointer text-sm font-bold text-[#1a1025]">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    style={{ width: 17, height: 17, cursor: "pointer", accentColor: "#7c4dba", borderRadius: 4 }}
                  />
                  Select All ({totalItemsCount})
                </label>
                
                {selectedItemsCount > 0 && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleMoveSelectedToCart}
                      style={{ border: "none", background: "transparent", color: "#7c4dba", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                    >
                      Add Selected to Cart
                    </button>
                    <div style={{ width: 1, height: 12, background: "rgba(64,41,112,0.15)" }} />
                    <button
                      onClick={handleDeleteSelected}
                      style={{ border: "none", background: "transparent", color: "#d4183d", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                    >
                      Delete Selected
                    </button>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div className="flex flex-col">
                {wishlistItems.map((item, idx) => {
                  const isSelected = !!selectedIds[item.productId];
                  const isInStock = (item.product.stock ?? 0) > 0;
                  
                  return (
                    <motion.div
                      key={item.productId}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5"
                      style={{ borderBottom: idx < wishlistItems.length - 1 ? "1px solid rgba(64,41,112,0.06)" : "none" }}
                    >
                      {/* Selector checkbox & Product Info */}
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleSelectItem(item.productId, e.target.checked)}
                          style={{ width: 17, height: 17, cursor: "pointer", accentColor: "#7c4dba" }}
                        />
                        <div style={{ width: 72, height: 72, borderRadius: 12, overflow: "hidden", background: "linear-gradient(135deg,#f5f0ff,#ede4ff)", flexShrink: 0 }}>
                          <img src={item.product.images[0]} alt={item.product.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                        <div className="min-w-0">
                          <span style={{ fontSize: 10, fontWeight: 800, color: "#7c6a9e", textTransform: "uppercase", letterSpacing: "0.04em" }}>{item.product.brand}</span>
                          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1a1025", margin: "2px 0 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.product.name}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#7c6a9e", padding: "2px 8px", borderRadius: 20, background: "rgba(64,41,112,0.06)" }}>
                              {item.product.category}
                            </span>
                            <span style={{ fontSize: 10.5, fontWeight: 700, color: isInStock ? "#2a9e6a" : "#d4183d" }}>
                              {isInStock ? `In Stock (${item.product.stock} left)` : "Out of Stock"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Price, Notification settings, and Actions */}
                      <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto">
                        
                        {/* Price */}
                        <div style={{ minWidth: 100, textAlign: "right" }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: "#402970" }}>
                            {formatUIPrice(item.product.price, item.product.currency)}
                          </span>
                          {item.product.originalPrice && (
                            <p style={{ margin: "2px 0 0 0", fontSize: 11, color: "#9e8dc0", textDecoration: "line-through" }}>
                              {formatUIPrice(item.product.originalPrice, item.product.currency)}
                            </p>
                          )}
                        </div>

                        {/* Price Alerts Toggles */}
                        <div className="flex items-center gap-1.5" style={{ background: "rgba(64,41,112,0.03)", padding: "4px 8px", borderRadius: 10, border: "1px solid rgba(64,41,112,0.06)" }}>
                          <button
                            onClick={() => toggleAlerts(item.productId, "priceDrop")}
                            title={item.notifyOnPriceDrop ? "Disable Price Drop Alert" : "Enable Price Drop Alert"}
                            style={{
                              border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                              color: item.notifyOnPriceDrop ? "#7c4dba" : "#9e8dc0", padding: "4px", borderRadius: 6
                            }}
                          >
                            {item.notifyOnPriceDrop ? <Bell size={13} strokeWidth={2.5} /> : <BellOff size={13} strokeWidth={2} />}
                            <span style={{ fontSize: 10, fontWeight: 700 }}>Price Alert</span>
                          </button>
                        </div>

                        {/* Add to Cart button */}
                        <motion.button
                          whileTap={isInStock ? { scale: 0.95 } : {}}
                          disabled={!isInStock}
                          onClick={() => {
                            moveToCart(item.product);
                            removeFromWishlist(item.productId);
                          }}
                          style={{
                            padding: "8px 16px", borderRadius: 10, border: "none",
                            background: isInStock ? "linear-gradient(135deg,#7c4dba,#402970)" : "rgba(64,41,112,0.1)",
                            color: isInStock ? "#fff" : "#b8aed0", fontSize: 12, fontWeight: 700, cursor: isInStock ? "pointer" : "not-allowed"
                          }}
                        >
                          Add to Cart
                        </motion.button>

                        {/* Delete icon */}
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => removeFromWishlist(item.productId)}
                          title="Remove item"
                          style={{
                            width: 30, height: 30, borderRadius: 8, border: "none", cursor: "pointer",
                            background: "rgba(212,24,61,0.06)", color: "#d4183d",
                            display: "flex", alignItems: "center", justifyContent: "center"
                          }}
                        >
                          <Trash2 size={13} strokeWidth={2.5} />
                        </motion.button>

                      </div>
                    </motion.div>
                  );
                })}
              </div>

            </div>

          </div>
        )}

        {/* You May Also Like Section */}
        <div className="w-full select-none mt-6">
          <div className="flex items-center justify-between mb-4">
            <span style={{ fontSize: "16px", fontWeight: 800, color: "#1a1025", fontFamily: "'Nunito', sans-serif" }}>
              You may also like
            </span>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar" style={{ scrollbarWidth: "none" }}>
            {recProducts.map((prod) => (
              <div
                key={prod.id}
                style={{
                  width: 180,
                  flexShrink: 0,
                  background: "#fff",
                  border: "1.5px solid rgba(124, 77, 186, 0.12)",
                  borderRadius: 14,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ width: "100%", aspectRatio: "1.3/1", overflow: "hidden" }}>
                  <img src={prod.images[0]} alt={prod.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <div style={{ padding: "10px", display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
                  <span style={{ color: "#7c6a9e", fontSize: 9, fontWeight: 800, textTransform: "uppercase" }}>{prod.brand}</span>
                  <h4 style={{ fontSize: 12, fontWeight: 700, color: "#1a1025", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{prod.name}</h4>
                  <div className="flex justify-between items-center mt-auto pt-2">
                    <span style={{ color: "#7c4dba", fontSize: 12, fontWeight: 800 }}>Rs. {prod.price.toLocaleString()}</span>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => {
                        addToCart(prod, 1);
                      }}
                      style={{
                        padding: "3px 8px", borderRadius: 6, border: "none",
                        background: "rgba(124,77,186,0.08)", color: "#7c4dba",
                        fontSize: 10, fontWeight: 800, cursor: "pointer"
                      }}
                    >
                      Add
                    </motion.button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Back Button Footer */}
        <div className="flex justify-start border-t border-[rgba(64,41,112,0.06)] pt-4">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={onContinueShopping}
            className="flex items-center gap-2"
            style={{ padding: "10px 16px", borderRadius: 12, border: "1.5px solid rgba(64,41,112,0.15)", background: "transparent", color: "#402970", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            <ArrowLeft size={14} strokeWidth={2.5} />
            Continue Shopping
          </motion.button>
        </div>

      </div>
    </div>
  );
};

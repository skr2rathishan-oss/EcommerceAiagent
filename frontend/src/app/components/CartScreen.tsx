import React, { useState } from "react";
import { motion } from "motion/react";
import { Trash2, Heart, ArrowLeft, ShieldCheck, Truck, RefreshCw, ChevronLeft, ChevronRight, Plus, Minus, Tag, Check, X } from "lucide-react";
import { useCart } from "../contexts/CartContext";
import { useWishlist } from "../contexts/WishlistContext";
import { type Product, PRODUCTS } from "./products";
import { formatUIPrice } from "../services/mapping";

interface CartScreenProps {
  onContinueShopping: () => void;
  onCheckout: () => void;
}

export const CartScreen: React.FC<CartScreenProps> = ({ onContinueShopping, onCheckout }) => {
  const {
    cartItems,
    promoCode,
    discountAmount,
    subtotal,
    deliveryFee,
    grandTotal,
    removeFromCart,
    updateQuantity,
    selectItem,
    selectAll,
    applyPromoCode,
    removePromoCode,
    startCheckout,
  } = useCart();

  const { addToWishlist, wishlistItems, removeFromWishlist } = useWishlist();
  const [promoInput, setPromoInput] = useState("");
  const [promoError, setPromoError] = useState("");
  const [promoSuccess, setPromoSuccess] = useState(false);

  // Recommendations: exclude items already in cart or just take a curated list
  const recProducts = PRODUCTS.slice(0, 5);

  const totalItemsCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const selectedItemsCount = cartItems.filter(item => item.selected).reduce((sum, item) => sum + item.quantity, 0);
  const allSelected = cartItems.length > 0 && cartItems.every(item => item.selected);

  // Free delivery threshold: Rs. 8,000
  const freeDeliveryThreshold = 8000;
  const deliveryProgress = Math.min(100, (subtotal / freeDeliveryThreshold) * 100);
  const remainingForFreeDelivery = Math.max(0, freeDeliveryThreshold - subtotal);

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoInput.trim()) return;
    setPromoError("");
    setPromoSuccess(false);

    const success = applyPromoCode(promoInput);
    if (success) {
      setPromoSuccess(true);
      setPromoInput("");
    } else {
      setPromoError("Invalid promo code. Try SAVE10 or VELORA500.");
    }
  };

  const handleToggleWishlist = (product: Product) => {
    const isWishlisted = wishlistItems.some(item => item.productId === product.id);
    if (isWishlisted) {
      removeFromWishlist(product.id);
    } else {
      addToWishlist(product);
    }
  };

  const handleProceedCheckout = () => {
    startCheckout();
    onCheckout();
  };

  return (
    <div className="flex-1 w-full overflow-y-auto px-6 py-6" style={{ background: "rgba(250, 248, 254, 0.4)", fontFamily: "'Nunito', sans-serif" }}>
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        
        {/* Header */}
        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={onContinueShopping}
            style={{ width: 36, height: 36, borderRadius: 10, border: "1.5px solid rgba(64,41,112,0.12)", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#402970" }}
          >
            <ArrowLeft size={16} strokeWidth={2.5} />
          </motion.button>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1a1025", margin: 0 }}>Your Cart</h1>
            <p style={{ fontSize: 13, color: "#7c6a9e", margin: "2px 0 0 0" }}>Review your items and proceed to checkout.</p>
          </div>
        </div>

        {cartItems.length === 0 ? (
          /* Empty Cart View */
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 px-4 bg-white rounded-3xl"
            style={{ border: "1px solid rgba(64,41,112,0.08)", boxShadow: "0 10px 30px rgba(64,41,112,0.04)" }}
          >
            <div style={{ width: 80, height: 80, borderRadius: 24, background: "rgba(124,77,186,0.08)", display: "flex", alignItems: "center", justifyContent: "center", color: "#7c4dba", marginBottom: 20 }}>
              <Trash2 size={36} strokeWidth={1.5} />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1025", margin: 0 }}>Your cart is empty</h2>
            <p style={{ fontSize: 13, color: "#7c6a9e", marginTop: 6, marginBottom: 24, textAlign: "center", maxWidth: 300 }}>
              Looks like you haven't added anything to your cart yet. Let's find some great products!
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
          /* Main Cart Content split */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* Left Column: Cart items & Delivery Banner */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              
              {/* Delivery Progress Banner */}
              <div className="bg-white p-5 rounded-2xl flex flex-col gap-3" style={{ border: "1px solid rgba(64,41,112,0.08)", boxShadow: "0 10px 30px rgba(64,41,112,0.04)" }}>
                <div className="flex justify-between items-center text-sm font-semibold">
                  <span style={{ color: remainingForFreeDelivery > 0 ? "#7c4dba" : "#2a9e6a", display: "flex", alignItems: "center", gap: 6 }}>
                    <Truck size={16} />
                    {remainingForFreeDelivery > 0 ? (
                      <>You're Rs. <span style={{ fontWeight: 800 }}>{remainingForFreeDelivery.toLocaleString()}</span> away from <span style={{ color: "#2a9e6a", fontWeight: 800 }}>FREE delivery!</span></>
                    ) : (
                      <span style={{ color: "#2a9e6a", fontWeight: 800 }}>Congratulations! You've qualified for FREE delivery!</span>
                    )}
                  </span>
                  <span style={{ color: "#402970", fontWeight: 700 }}>
                    Rs. {subtotal.toLocaleString()} / Rs. 8,000
                  </span>
                </div>
                {/* Progress bar container */}
                <div style={{ height: 6, width: "100%", background: "rgba(64,41,112,0.06)", borderRadius: 10, overflow: "hidden" }}>
                  <motion.div
                    animate={{ width: `${deliveryProgress}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    style={{ height: "100%", background: remainingForFreeDelivery > 0 ? "linear-gradient(90deg,#7c4dba,#a78bfa)" : "linear-gradient(90deg,#2a9e6a,#3fc78e)", borderRadius: 10 }}
                  />
                </div>
              </div>

              {/* Items List Wrapper */}
              <div className="bg-white rounded-2xl flex flex-col" style={{ border: "1px solid rgba(64,41,112,0.08)", boxShadow: "0 10px 30px rgba(64,41,112,0.04)", overflow: "hidden" }}>
                
                {/* Bulk Selector Header */}
                <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(64,41,112,0.06)" }}>
                  <label className="flex items-center gap-3 cursor-pointer text-sm font-bold text-[#1a1025]">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(e) => selectAll(e.target.checked)}
                      style={{ width: 17, height: 17, cursor: "pointer", accentColor: "#7c4dba", borderRadius: 4 }}
                    />
                    Select All ({cartItems.length})
                  </label>
                  {selectedItemsCount > 0 && (
                    <button
                      onClick={() => {
                        const selectedIds = cartItems.filter(item => item.selected).map(item => item.productId);
                        selectedIds.forEach(id => removeFromCart(id));
                      }}
                      style={{ border: "none", background: "transparent", color: "#d4183d", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                    >
                      Delete Selected
                    </button>
                  )}
                </div>

                {/* Items List */}
                <div className="flex flex-col">
                  {cartItems.map((item, idx) => {
                    const isWishlisted = wishlistItems.some(w => w.productId === item.productId);
                    return (
                      <motion.div
                        key={item.productId}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5"
                        style={{ borderBottom: idx < cartItems.length - 1 ? "1px solid rgba(64,41,112,0.06)" : "none" }}
                      >
                        {/* Selector checkbox & Product Info */}
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={(e) => selectItem(item.productId, e.target.checked)}
                            style={{ width: 17, height: 17, cursor: "pointer", accentColor: "#7c4dba" }}
                          />
                          <div style={{ width: 72, height: 72, borderRadius: 12, overflow: "hidden", background: "linear-gradient(135deg,#f5f0ff,#ede4ff)", flexShrink: 0 }}>
                            <img src={item.image} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          </div>
                          <div className="min-w-0">
                            <span style={{ fontSize: 10, fontWeight: 800, color: "#7c6a9e", textTransform: "uppercase", letterSpacing: "0.04em" }}>{item.brand}</span>
                            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1a1025", margin: "2px 0 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {item.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span style={{ fontSize: 11, fontWeight: 700, color: "#7c6a9e", padding: "2px 8px", borderRadius: 20, background: "rgba(64,41,112,0.06)" }}>
                                {item.product.category}
                              </span>
                              {item.product.stock <= 5 && (
                                <span style={{ fontSize: 10, fontWeight: 700, color: "#d4183d" }}>
                                  Only {item.product.stock} left in stock!
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Quantity Controls, Actions, Price */}
                        <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto">
                          
                          {/* Quantity selector */}
                          <div className="flex items-center" style={{ border: "1.5px solid rgba(64,41,112,0.12)", borderRadius: 10, background: "rgba(64,41,112,0.02)", overflow: "hidden" }}>
                            <button
                              onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                              disabled={item.quantity <= 1}
                              style={{ border: "none", background: "transparent", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: item.quantity <= 1 ? "default" : "pointer", color: item.quantity <= 1 ? "#9e8dc0" : "#402970" }}
                            >
                              <Minus size={11} strokeWidth={3} />
                            </button>
                            <span style={{ minWidth: 20, textAlign: "center", fontSize: 12.5, fontWeight: 700, color: "#1a1025" }}>
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                              disabled={item.quantity >= (item.product.stock ?? 100)}
                              style={{ border: "none", background: "transparent", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: item.quantity >= (item.product.stock ?? 100) ? "default" : "pointer", color: item.quantity >= (item.product.stock ?? 100) ? "#9e8dc0" : "#402970" }}
                            >
                              <Plus size={11} strokeWidth={3} />
                            </button>
                          </div>

                          {/* Price */}
                          <div style={{ minWidth: 80, textAlign: "right" }}>
                            <span style={{ fontSize: 15, fontWeight: 800, color: "#402970" }}>
                              {formatUIPrice(item.price * item.quantity, item.product.currency)}
                            </span>
                            {item.quantity > 1 && (
                              <p style={{ margin: "2px 0 0 0", fontSize: 10.5, color: "#9e8dc0" }}>
                                {formatUIPrice(item.price, item.product.currency)} each
                              </p>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            <motion.button
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleToggleWishlist(item.product)}
                              title={isWishlisted ? "Remove from Wishlist" : "Save to Wishlist"}
                              style={{
                                width: 30, height: 30, borderRadius: 8, border: "none", cursor: "pointer",
                                background: isWishlisted ? "rgba(212,24,61,0.06)" : "rgba(64,41,112,0.05)",
                                color: isWishlisted ? "#d4183d" : "#7c6a9e",
                                display: "flex", alignItems: "center", justifyContent: "center"
                              }}
                            >
                              <Heart size={14} fill={isWishlisted ? "#d4183d" : "none"} strokeWidth={2.5} />
                            </motion.button>
                            <motion.button
                              whileTap={{ scale: 0.9 }}
                              onClick={() => removeFromCart(item.productId)}
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

                        </div>
                      </motion.div>
                    );
                  })}
                </div>

              </div>

            </div>

            {/* Right Column: Order Summary & Promo Codes */}
            <div className="flex flex-col gap-6">
              
              {/* Summary Card */}
              <div className="bg-white p-5 rounded-2xl flex flex-col gap-4" style={{ border: "1px solid rgba(64,41,112,0.08)", boxShadow: "0 10px 30px rgba(64,41,112,0.04)" }}>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: "#1a1025", margin: 0, borderBottom: "1px solid rgba(64,41,112,0.06)", paddingBottom: 10 }}>Order Summary</h2>
                
                {/* Breakdowns */}
                <div className="flex flex-col gap-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span style={{ color: "#7c6a9e" }}>Subtotal ({selectedItemsCount} item{selectedItemsCount !== 1 && "s"})</span>
                    <span style={{ color: "#1a1025", fontWeight: 700 }}>{formatUIPrice(subtotal, cartItems[0]?.product.currency)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span style={{ color: "#7c6a9e" }}>Delivery Fee</span>
                    <span style={{ color: deliveryFee === 0 ? "#2a9e6a" : "#1a1025", fontWeight: 700 }}>
                      {deliveryFee === 0 ? "Free" : formatUIPrice(deliveryFee, cartItems[0]?.product.currency)}
                    </span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between items-center text-[#2a9e6a] font-semibold">
                      <span className="flex items-center gap-1">
                        <Tag size={13} />
                        Discount {promoCode && `(${promoCode})`}
                      </span>
                      <span>-{formatUIPrice(discountAmount, cartItems[0]?.product.currency)}</span>
                    </div>
                  )}
                  
                  <div style={{ height: 1, background: "rgba(64,41,112,0.08)", margin: "4px 0" }} />
                  
                  <div className="flex justify-between items-center text-base font-extrabold">
                    <span style={{ color: "#1a1025" }}>Total</span>
                    <span style={{ color: "#7c4dba", fontSize: 19 }}>{formatUIPrice(grandTotal, cartItems[0]?.product.currency)}</span>
                  </div>
                </div>

                {/* Promo Code Form */}
                <div style={{ marginTop: 6 }}>
                  {promoCode ? (
                    <div className="flex items-center justify-between p-2.5 rounded-xl text-sm font-semibold" style={{ background: "rgba(63,199,142,0.07)", border: "1.5px dashed rgba(63,199,142,0.4)", color: "#2a9e6a" }}>
                      <span className="flex items-center gap-1.5">
                        <Tag size={14} />
                        Code <span style={{ fontWeight: 800 }}>{promoCode}</span> applied!
                      </span>
                      <button onClick={removePromoCode} style={{ border: "none", background: "transparent", color: "#d4183d", cursor: "pointer", display: "flex" }}>
                        <X size={15} strokeWidth={2.5} />
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleApplyPromo} className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={promoInput}
                          onChange={(e) => setPromoInput(e.target.value)}
                          placeholder="Promo code"
                          style={{
                            width: "100%", padding: "10px 12px", borderRadius: 12, border: "1.5px solid rgba(64,41,112,0.15)",
                            background: "rgba(64,41,112,0.02)", color: "#1a1025", fontSize: 12.5, outline: "none", boxSizing: "border-box"
                          }}
                        />
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        type="submit"
                        style={{ padding: "0 16px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#7c4dba,#402970)", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
                      >
                        Apply
                      </motion.button>
                    </form>
                  )}
                  {promoError && <p style={{ color: "#d4183d", fontSize: 11, margin: "6px 0 0 2px", fontWeight: 600 }}>{promoError}</p>}
                  {promoSuccess && <p style={{ color: "#2a9e6a", fontSize: 11, margin: "6px 0 0 2px", fontWeight: 600 }}>Promo code applied successfully! 🎉</p>}
                </div>

                {/* Checkout button */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleProceedCheckout}
                  disabled={selectedItemsCount === 0}
                  className="flex items-center justify-center gap-2 w-full mt-2"
                  style={{
                    padding: "13px", borderRadius: 14, border: "none",
                    background: selectedItemsCount === 0 ? "rgba(64,41,112,0.15)" : "linear-gradient(135deg,#7c4dba,#402970)",
                    color: selectedItemsCount === 0 ? "#b8aed0" : "#fff",
                    fontSize: 14, fontWeight: 700, cursor: selectedItemsCount === 0 ? "not-allowed" : "pointer",
                    boxShadow: selectedItemsCount === 0 ? "none" : "0 4px 16px rgba(64,41,112,0.3)"
                  }}
                >
                  Proceed to Checkout
                </motion.button>

                {/* Safe assurance labels */}
                <div className="flex flex-col gap-2.5 mt-2.5 border-t border-[rgba(64,41,112,0.06)] pt-4 text-xs font-semibold text-[#7c6a9e]">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={16} color="#3fc78e" />
                    <span>Secure Checkout · Your details are protected</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Truck size={16} color="#7c4dba" />
                    <span>Fast Delivery · Dispatched next working day</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <RefreshCw size={14} color="#7c4dba" />
                    <span>Easy Returns · 7-day hassle-free refund window</span>
                  </div>
                </div>

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
                      onClick={() => addToCart(prod, 1)}
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

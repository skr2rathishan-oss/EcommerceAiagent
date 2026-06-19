import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { type Product } from "../components/products";
import { trackEvent } from "../services/analytics";

export interface CartItem {
  productId: string;
  name: string;
  image: string;
  brand: string;
  price: number;
  quantity: number;
  qty: number; // Backward compatibility
  selected: boolean;
  addedAt: string;
  product: Product;
}

export interface CheckoutPayload {
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
}

interface CartContextType {
  cartItems: CartItem[];
  promoCode: string | null;
  discountAmount: number;
  subtotal: number;
  deliveryFee: number;
  grandTotal: number;
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  selectItem: (productId: string, selected: boolean) => void;
  selectAll: (selected: boolean) => void;
  clearCart: () => void;
  applyPromoCode: (code: string) => boolean;
  removePromoCode: () => void;
  getCheckoutPayload: () => CheckoutPayload;
  startCheckout: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem("velora_cart");
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.map((item: any) => ({
          ...item,
          qty: item.qty ?? item.quantity ?? 1,
          quantity: item.quantity ?? item.qty ?? 1,
        }));
      }
      return [];
    } catch (err) {
      console.error("Failed to load velora_cart from localStorage", err);
      return [];
    }
  });

  const [promoCode, setPromoCode] = useState<string | null>(() => {
    return localStorage.getItem("velora_promo_code") || null;
  });

  // Automatically sync to LocalStorage
  useEffect(() => {
    localStorage.setItem("velora_cart", JSON.stringify(cartItems));
  }, [cartItems]);

  useEffect(() => {
    if (promoCode) {
      localStorage.setItem("velora_promo_code", promoCode);
    } else {
      localStorage.removeItem("velora_promo_code");
    }
  }, [promoCode]);

  // Computed Values
  const subtotal = useMemo(() => {
    return cartItems
      .filter(item => item.selected)
      .reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cartItems]);

  const discountAmount = useMemo(() => {
    if (!promoCode) return 0;
    const codeUpper = promoCode.toUpperCase();
    if (codeUpper === "SAVE10") {
      return Math.round(subtotal * 0.1);
    }
    if (codeUpper === "VELORA500") {
      return subtotal >= 500 ? 500 : subtotal;
    }
    return 0;
  }, [promoCode, subtotal]);

  const deliveryFee = useMemo(() => {
    if (subtotal === 0 || subtotal >= 8000) return 0;
    return 300; // Flat fee Rs. 300
  }, [subtotal]);

  const grandTotal = useMemo(() => {
    return Math.max(0, subtotal + deliveryFee - discountAmount);
  }, [subtotal, deliveryFee, discountAmount]);

  const addToCart = (product: Product, quantity = 1) => {
    // Bounds check
    const stockLimit = product.stock ?? 100;
    const finalQty = Math.max(1, Math.min(quantity, stockLimit));

    setCartItems(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        const newQty = Math.min(existing.quantity + finalQty, stockLimit);
        return prev.map(item =>
          item.productId === product.id
            ? { ...item, quantity: newQty, qty: newQty }
            : item
        );
      } else {
        const newItem: CartItem = {
          productId: product.id,
          name: product.name,
          image: product.images[0] || "",
          brand: product.brand,
          price: product.price,
          quantity: finalQty,
          qty: finalQty,
          selected: true,
          addedAt: new Date().toISOString(),
          product,
        };
        return [...prev, newItem];
      }
    });

    // Logging & Tracking
    console.log(`[CART] Product Added\nProduct ID: ${product.id}\nName: ${product.name}\nQuantity: ${finalQty}\nPrice: Rs.${product.price}\nTotal: Rs.${product.price * finalQty}`);
    
    trackEvent("PRODUCT_ADDED_TO_CART", {
      productId: product.id,
      name: product.name,
      quantity: finalQty,
      price: product.price,
    });
  };

  const removeFromCart = (productId: string) => {
    const itemToRemove = cartItems.find(item => item.productId === productId);
    setCartItems(prev => prev.filter(item => item.productId !== productId));

    if (itemToRemove) {
      console.log(`[CART] Product Removed\nProduct ID: ${productId}\nName: ${itemToRemove.name}`);
      trackEvent("PRODUCT_REMOVED_FROM_CART", {
        productId,
        name: itemToRemove.name,
      });
    }
  };

  const updateQuantity = (productId: string, quantity: number) => {
    setCartItems(prev =>
      prev.map(item => {
        if (item.productId === productId) {
          const stockLimit = item.product.stock ?? 100;
          const finalQty = Math.max(1, Math.min(quantity, stockLimit));
          return { ...item, quantity: finalQty, qty: finalQty };
        }
        return item;
      })
    );
  };

  const selectItem = (productId: string, selected: boolean) => {
    setCartItems(prev =>
      prev.map(item =>
        item.productId === productId ? { ...item, selected } : item
      )
    );
  };

  const selectAll = (selected: boolean) => {
    setCartItems(prev => prev.map(item => ({ ...item, selected })));
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const applyPromoCode = (code: string): boolean => {
    const codeUpper = code.trim().toUpperCase();
    if (codeUpper === "SAVE10" || codeUpper === "VELORA500") {
      setPromoCode(codeUpper);
      return true;
    }
    return false;
  };

  const removePromoCode = () => {
    setPromoCode(null);
  };

  const getCheckoutPayload = (): CheckoutPayload => {
    const selectedItems = cartItems.filter(item => item.selected);
    return {
      items: selectedItems,
      subtotal,
      deliveryFee,
      discount: discountAmount,
      total: grandTotal,
    };
  };

  const startCheckout = () => {
    console.log(`[CHECKOUT] Started\nSubtotal: Rs.${subtotal}\nItems Count: ${cartItems.filter(item => item.selected).length}\nTotal: Rs.${grandTotal}`);
    trackEvent("CHECKOUT_STARTED", {
      subtotal,
      deliveryFee,
      discount: discountAmount,
      total: grandTotal,
      itemCount: cartItems.filter(item => item.selected).length,
    });
  };

  return (
    <CartContext.Provider
      value={{
        cartItems,
        promoCode,
        discountAmount,
        subtotal,
        deliveryFee,
        grandTotal,
        addToCart,
        removeFromCart,
        updateQuantity,
        selectItem,
        selectAll,
        clearCart,
        applyPromoCode,
        removePromoCode,
        getCheckoutPayload,
        startCheckout,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
};

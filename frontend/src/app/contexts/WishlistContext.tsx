import React, { createContext, useContext, useState, useEffect } from "react";
import { type Product } from "../components/products";
import { useCart } from "./CartContext";
import { trackEvent } from "../services/analytics";

export interface WishlistItem {
  productId: string;
  addedAt: string;
  notifyOnPriceDrop: boolean;
  notifyOnRestock: boolean;
  product: Product;
}

interface WishlistContextType {
  wishlistItems: WishlistItem[];
  addToWishlist: (product: Product) => void;
  removeFromWishlist: (productId: string) => void;
  moveToCart: (product: Product) => void;
  toggleAlerts: (productId: string, alertType: "priceDrop" | "restock") => void;
  shareWishlist: () => string;
  trackPriceDrop: (productId: string, newPrice: number) => void;
  trackRestock: (productId: string, newStock: number) => void;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { addToCart } = useCart();
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>(() => {
    try {
      const stored = localStorage.getItem("velora_wishlist");
      return stored ? JSON.parse(stored) : [];
    } catch (err) {
      console.error("Failed to load velora_wishlist from localStorage", err);
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("velora_wishlist", JSON.stringify(wishlistItems));
  }, [wishlistItems]);

  const addToWishlist = (product: Product) => {
    setWishlistItems(prev => {
      const exists = prev.find(item => item.productId === product.id);
      if (exists) return prev;

      const newItem: WishlistItem = {
        productId: product.id,
        addedAt: new Date().toISOString(),
        notifyOnPriceDrop: true,
        notifyOnRestock: true,
        product,
      };

      console.log(`[WISHLIST] Product Saved\nProduct ID: ${product.id}\nName: ${product.name}\nPrice: Rs.${product.price}`);
      
      trackEvent("PRODUCT_WISHLISTED", {
        productId: product.id,
        name: product.name,
      });

      return [...prev, newItem];
    });
  };

  const removeFromWishlist = (productId: string) => {
    setWishlistItems(prev => prev.filter(item => item.productId !== productId));
  };

  const moveToCart = (product: Product) => {
    // Moves product to Cart, remains in wishlist unless user deletes it.
    addToCart(product, 1);
  };

  const toggleAlerts = (productId: string, alertType: "priceDrop" | "restock") => {
    setWishlistItems(prev =>
      prev.map(item => {
        if (item.productId === productId) {
          return {
            ...item,
            notifyOnPriceDrop: alertType === "priceDrop" ? !item.notifyOnPriceDrop : item.notifyOnPriceDrop,
            notifyOnRestock: alertType === "restock" ? !item.notifyOnRestock : item.notifyOnRestock,
          };
        }
        return item;
      })
    );
  };

  const shareWishlist = (): string => {
    if (wishlistItems.length === 0) return "My wishlist is currently empty.";
    const itemsList = wishlistItems
      .map((item, idx) => `${idx + 1}. ${item.product.name} (Rs.${item.product.price})`)
      .join("\n");
    return `Check out my Wishlist on Velora AI:\n\n${itemsList}`;
  };

  // Simulates tracking a price drop
  const trackPriceDrop = (productId: string, newPrice: number) => {
    setWishlistItems(prev =>
      prev.map(item => {
        if (item.productId === productId && item.notifyOnPriceDrop) {
          const oldPrice = item.product.price;
          if (newPrice < oldPrice) {
            console.log(`[ALERT] Price Drop! ${item.product.name} dropped from Rs.${oldPrice} to Rs.${newPrice}`);
            return {
              ...item,
              product: { ...item.product, price: newPrice, originalPrice: oldPrice },
            };
          }
        }
        return item;
      })
    );
  };

  // Simulates tracking restock
  const trackRestock = (productId: string, newStock: number) => {
    setWishlistItems(prev =>
      prev.map(item => {
        if (item.productId === productId && item.notifyOnRestock) {
          const oldStock = item.product.stock;
          if (oldStock === 0 && newStock > 0) {
            console.log(`[ALERT] Back in stock! ${item.product.name} is restocked with ${newStock} items.`);
            return {
              ...item,
              product: { ...item.product, stock: newStock },
            };
          }
        }
        return item;
      })
    );
  };

  return (
    <WishlistContext.Provider
      value={{
        wishlistItems,
        addToWishlist,
        removeFromWishlist,
        moveToCart,
        toggleAlerts,
        shareWishlist,
        trackPriceDrop,
        trackRestock,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) throw new Error("useWishlist must be used within WishlistProvider");
  return context;
};

import React, { createContext, useContext, useState, useEffect } from "react";
import { type Product } from "../components/products";
import { trackEvent } from "../services/analytics";

export interface RecentlyViewedItem {
  productId: string;
  viewedAt: string;
  product: Product;
}

interface RecentlyViewedContextType {
  recentlyViewed: RecentlyViewedItem[];
  trackView: (product: Product) => void;
  clearRecentlyViewed: () => void;
}

const RecentlyViewedContext = createContext<RecentlyViewedContextType | undefined>(undefined);

export const RecentlyViewedProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedItem[]>(() => {
    try {
      const stored = localStorage.getItem("velora_recently_viewed");
      return stored ? JSON.parse(stored) : [];
    } catch (err) {
      console.error("Failed to load velora_recently_viewed from localStorage", err);
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("velora_recently_viewed", JSON.stringify(recentlyViewed));
  }, [recentlyViewed]);

  const trackView = (product: Product) => {
    if (!product || !product.id) return;
    
    setRecentlyViewed(prev => {
      // Filter out existing version of this product if it exists
      const filtered = prev.filter(item => item.productId !== product.id);
      
      const newItem: RecentlyViewedItem = {
        productId: product.id,
        viewedAt: new Date().toISOString(),
        product,
      };

      // Add to front of array
      const updated = [newItem, ...filtered];

      // Keep only up to 50 items
      if (updated.length > 50) {
        updated.pop();
      }

      console.log(`[VIEW] Product Viewed\nProduct ID: ${product.id}\nName: ${product.name}`);
      
      trackEvent("PRODUCT_VIEWED", {
        productId: product.id,
        name: product.name,
      });

      return updated;
    });
  };

  const clearRecentlyViewed = () => {
    setRecentlyViewed([]);
  };

  return (
    <RecentlyViewedContext.Provider
      value={{
        recentlyViewed,
        trackView,
        clearRecentlyViewed,
      }}
    >
      {children}
    </RecentlyViewedContext.Provider>
  );
};

export const useRecentlyViewed = () => {
  const context = useContext(RecentlyViewedContext);
  if (!context) throw new Error("useRecentlyViewed must be used within RecentlyViewedProvider");
  return context;
};

import React, { createContext, useContext, useState, useEffect } from "react";
import { type Product } from "../components/products";
import { useCart } from "./CartContext";
import { trackEvent } from "../services/analytics";

export interface SavedProductItem {
  productId: string;
  savedAt: string;
  source: "search" | "recommendation" | "wishlist" | "product_page";
  product: Product;
}

interface SavedProductsContextType {
  savedProducts: SavedProductItem[];
  saveProduct: (product: Product, source: SavedProductItem["source"]) => void;
  removeProduct: (productId: string) => void;
  moveToCart: (product: Product) => void;
  bulkDelete: (productIds: string[]) => void;
}

const SavedProductsContext = createContext<SavedProductsContextType | undefined>(undefined);

export const SavedProductsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { addToCart } = useCart();
  const [savedProducts, setSavedProducts] = useState<SavedProductItem[]>(() => {
    try {
      const stored = localStorage.getItem("velora_saved");
      return stored ? JSON.parse(stored) : [];
    } catch (err) {
      console.error("Failed to load velora_saved from localStorage", err);
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("velora_saved", JSON.stringify(savedProducts));
  }, [savedProducts]);

  const saveProduct = (product: Product, source: SavedProductItem["source"]) => {
    setSavedProducts(prev => {
      const exists = prev.find(item => item.productId === product.id);
      if (exists) return prev;

      const newItem: SavedProductItem = {
        productId: product.id,
        savedAt: new Date().toISOString(),
        source,
        product,
      };

      console.log(`[SAVED] Bookmark Added\nProduct ID: ${product.id}\nName: ${product.name}\nSource: ${source}`);
      
      trackEvent("PRODUCT_SAVED", {
        productId: product.id,
        name: product.name,
        source,
      });

      return [...prev, newItem];
    });
  };

  const removeProduct = (productId: string) => {
    setSavedProducts(prev => prev.filter(item => item.productId !== productId));
  };

  const moveToCart = (product: Product) => {
    addToCart(product, 1);
    removeProduct(product.id);
  };

  const bulkDelete = (productIds: string[]) => {
    setSavedProducts(prev => prev.filter(item => !productIds.includes(item.productId)));
  };

  return (
    <SavedProductsContext.Provider
      value={{
        savedProducts,
        saveProduct,
        removeProduct,
        moveToCart,
        bulkDelete,
      }}
    >
      {children}
    </SavedProductsContext.Provider>
  );
};

export const useSavedProducts = () => {
  const context = useContext(SavedProductsContext);
  if (!context) throw new Error("useSavedProducts must be used within SavedProductsProvider");
  return context;
};

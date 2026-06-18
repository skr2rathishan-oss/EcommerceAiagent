import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Product } from "../components/products";

interface ComparisonContextType {
  comparedProducts: Product[];
  comparedProductIds: string[];
  addToComparison: (product: Product) => void;
  removeFromComparison: (productId: string) => void;
  clearComparison: () => void;
  isInComparison: (productId: string) => boolean;
}

const ComparisonContext = createContext<ComparisonContextType | undefined>(undefined);

export const useComparison = () => {
  const context = useContext(ComparisonContext);
  if (!context) {
    throw new Error("useComparison must be used within ComparisonProvider");
  }
  return context;
};

export const ComparisonProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [comparedProducts, setComparedProducts] = useState<Product[]>(() => {
    try {
      const stored = localStorage.getItem("compared_products");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const comparedProductIds = comparedProducts.map(p => p.id);

  const addToComparison = useCallback((product: Product) => {
    setComparedProducts(prev => {
      // Avoid duplicates and limit to 5 products for comparison
      if (prev.some(p => p.id === product.id) || prev.length >= 5) {
        return prev;
      }
      const updated = [...prev, product];
      localStorage.setItem("compared_products", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeFromComparison = useCallback((productId: string) => {
    setComparedProducts(prev => {
      const updated = prev.filter(p => p.id !== productId);
      localStorage.setItem("compared_products", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearComparison = useCallback(() => {
    setComparedProducts([]);
    localStorage.removeItem("compared_products");
  }, []);

  const isInComparison = useCallback(
    (productId: string) => comparedProductIds.includes(productId),
    [comparedProductIds]
  );

  return (
    <ComparisonContext.Provider
      value={{
        comparedProducts,
        comparedProductIds,
        addToComparison,
        removeFromComparison,
        clearComparison,
        isInComparison,
      }}
    >
      {children}
    </ComparisonContext.Provider>
  );
};

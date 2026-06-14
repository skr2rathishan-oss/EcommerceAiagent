import React, { createContext, useContext, useState, useEffect } from "react";
import { type Product } from "../components/products";
import { type DeliveryInfo, type SellerInfo } from "../components/InteractiveOrderSummary";
import { type OrderConfirmationDetails } from "../components/OrderConfirmationCard";
import { type OrderTrackingDetails } from "../types/orderTracking";
import { type LogItem } from "../components/AgentActivityBar";

export type Phase = "centered" | "bottom";
export type PanelId = "Recent Conversations" | "Settings" | "Help & Support" | "Profile" | null;
export type RightPanelId = "Wishlist" | "Cart" | "Saved" | null;

export interface AnchorPos {
  x: number;
  y: number;
}

export interface GuidedWorkflowState {
  type: "find_products" | "find_gift" | "track_order";
  step: number;
  answers: Record<string, any>;
  isCompleted: boolean;
  loading: boolean;
  error: string | null;
  currentQuestion?: string;
}

export interface Message {
  role: "user" | "ai";
  text: string;
  type?: "text" | "order_confirmation" | "order_tracking" | "order_tracking_error" | "product_details" | "guided_workflow";
  products?: Product[];
  orderSummary?: {
    product: Product;
    variants?: Record<string, string>;
    deliveryInfo: DeliveryInfo;
    sellerInfo: SellerInfo;
    status: "pending" | "placed";
  };
  order?: OrderConfirmationDetails;
  tracking?: OrderTrackingDetails;
  orderNumber?: string;
  productDetails?: { content: string; product: Product };
  workflow?: GuidedWorkflowState;
}

export interface CartItem {
  product: Product;
  qty: number;
}

export interface ActivityState {
  currentStep: string;
  currentMessage: string;
  logs: LogItem[];
  error?: boolean;
}

export interface PendingProductActions {
  product: Product;
  actions: { id: string; label: string; emoji: string }[];
}

export interface AppContextType {
  phase: Phase;
  setPhase: (phase: Phase) => void;
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activePanel: PanelId;
  setActivePanel: (panel: PanelId) => void;
  anchorPos: AnchorPos;
  setAnchorPos: (pos: AnchorPos) => void;
  rightPanel: RightPanelId;
  setRightPanel: (panel: RightPanelId) => void;
  value: string;
  setValue: (value: string) => void;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  cartItems: CartItem[];
  setCartItems: React.Dispatch<React.SetStateAction<CartItem[]>>;
  wishlistItems: Product[];
  setWishlistItems: React.Dispatch<React.SetStateAction<Product[]>>;
  savedItems: Product[];
  setSavedItems: React.Dispatch<React.SetStateAction<Product[]>>;
  orderedItems: OrderConfirmationDetails[];
  setOrderedItems: React.Dispatch<React.SetStateAction<OrderConfirmationDetails[]>>;
  shoppingContext: { lastSearchResults: Product[]; selectedProduct: Product | null };
  setShoppingContext: React.Dispatch<React.SetStateAction<{ lastSearchResults: Product[]; selectedProduct: Product | null }>>;
  selectedIds: Record<number, string | null>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Record<number, string | null>>>;
  activity: ActivityState | null;
  setActivity: React.Dispatch<React.SetStateAction<ActivityState | null>>;
  activityExpanded: boolean;
  setActivityExpanded: (expanded: boolean) => void;
  pendingProductActions: PendingProductActions | null;
  setPendingProductActions: (actions: PendingProductActions | null) => void;
  checkoutOpen: boolean;
  setCheckoutOpen: (open: boolean) => void;
  pendingConfirmProduct: Product | null;
  setPendingConfirmProduct: (p: Product | null) => void;
  pendingConfirmVariants: Record<string, string> | undefined;
  setPendingConfirmVariants: (variants: Record<string, string> | undefined) => void;
  isTyping: boolean;
  setIsTyping: (typing: boolean) => void;
  pendingAddressChoice: boolean;
  setPendingAddressChoice: (choice: boolean) => void;
  waitingForAddressInput: boolean;
  setWaitingForAddressInput: (wait: boolean) => void;
  selectedDetailProductId: string | null;
  setSelectedDetailProductId: (id: string | null) => void;
  isEnteringCustomDetails: boolean;
  setIsEnteringCustomDetails: (entering: boolean) => void;
  customName: string;
  setCustomName: (name: string) => void;
  customPhone: string;
  setCustomPhone: (phone: string) => void;
  customEmail: string;
  setCustomEmail: (email: string) => void;
  newStreet1: string;
  setNewStreet1: (street: string) => void;
  newStreet2: string;
  setNewStreet2: (street: string) => void;
  newCity: string;
  setNewCity: (city: string) => void;
  addressError: string;
  setAddressError: (err: string) => void;
  checkingAddress: boolean;
  setCheckingAddress: (checking: boolean) => void;

  // Shared Action Handlers
  handleAddToCart: (p: Product) => void;
  handleWishlist: (p: Product) => void;
  saveOrderToHistory: (order: OrderConfirmationDetails) => void;
  resetPendingPurchaseState: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [phase, setPhase] = useState<Phase>("centered");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<PanelId>(null);
  const [anchorPos, setAnchorPos] = useState<AnchorPos>({ x: 0, y: 0 });
  const [rightPanel, setRightPanel] = useState<RightPanelId>(null);
  const [value, setValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [wishlistItems, setWishlistItems] = useState<Product[]>([]);
  const [savedItems, setSavedItems] = useState<Product[]>([]);
  const [orderedItems, setOrderedItems] = useState<OrderConfirmationDetails[]>(() => {
    try {
      const stored = localStorage.getItem("ordered_items");
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error("Failed to parse ordered_items from localStorage", e);
      return [];
    }
  });

  const [shoppingContext, setShoppingContext] = useState<{
    lastSearchResults: Product[];
    selectedProduct: Product | null;
  }>({ lastSearchResults: [], selectedProduct: null });

  const [selectedIds, setSelectedIds] = useState<Record<number, string | null>>({});
  const [activity, setActivity] = useState<ActivityState | null>(null);
  const [activityExpanded, setActivityExpanded] = useState(false);
  const [pendingProductActions, setPendingProductActions] = useState<PendingProductActions | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [pendingConfirmProduct, setPendingConfirmProduct] = useState<Product | null>(null);
  const [pendingConfirmVariants, setPendingConfirmVariants] = useState<Record<string, string> | undefined>(undefined);
  const [isTyping, setIsTyping] = useState(false);
  const [pendingAddressChoice, setPendingAddressChoice] = useState(false);
  const [waitingForAddressInput, setWaitingForAddressInput] = useState(false);
  const [selectedDetailProductId, setSelectedDetailProductId] = useState<string | null>(null);
  const [isEnteringCustomDetails, setIsEnteringCustomDetails] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customPhone, setCustomPhone] = useState("");
  const [customEmail, setCustomEmail] = useState("");
  const [newStreet1, setNewStreet1] = useState("");
  const [newStreet2, setNewStreet2] = useState("");
  const [newCity, setNewCity] = useState("");
  const [addressError, setAddressError] = useState("");
  const [checkingAddress, setCheckingAddress] = useState(false);

  // Common operations
  const handleAddToCart = (p: Product) => {
    setCartItems(prev => {
      const exists = prev.find(i => i.product.id === p.id);
      if (exists) return prev.map(i => i.product.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { product: p, qty: 1 }];
    });
    setRightPanel("Cart");

    // Track "add_to_cart" interaction
    const getSessionId = () => sessionStorage.getItem("velora_session_id") || "default";
    fetch("/api/products/interaction", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-id": getSessionId(),
      },
      body: JSON.stringify({
        productId: p.id,
        productName: p.name,
        category: p.category,
        action: "add_to_cart"
      })
    }).catch(err => console.error("Failed to track add_to_cart:", err));
  };

  const handleWishlist = (p: Product) => {
    setWishlistItems(prev =>
      prev.find(i => i.id === p.id) ? prev.filter(i => i.id !== p.id) : [...prev, p]
    );
    setRightPanel("Wishlist");
  };

  const saveOrderToHistory = (order: OrderConfirmationDetails) => {
    setOrderedItems(prev => {
      if (prev.some(item => item.orderNumber === order.orderNumber)) return prev;
      const updated = [order, ...prev];
      localStorage.setItem("ordered_items", JSON.stringify(updated));
      return updated;
    });
  };

  const resetPendingPurchaseState = () => {
    setPendingConfirmProduct(null);
    setPendingConfirmVariants(undefined);
    setPendingAddressChoice(false);
    setWaitingForAddressInput(false);
    setIsEnteringCustomDetails(false);
    setCustomName("");
    setCustomPhone("");
    setCustomEmail("");
    setNewStreet1("");
    setNewStreet2("");
    setNewCity("");
    setAddressError("");
    setCheckingAddress(false);
  };

  return (
    <AppContext.Provider
      value={{
        phase, setPhase,
        sidebarOpen, setSidebarOpen,
        activePanel, setActivePanel,
        anchorPos, setAnchorPos,
        rightPanel, setRightPanel,
        value, setValue,
        messages, setMessages,
        cartItems, setCartItems,
        wishlistItems, setWishlistItems,
        savedItems, setSavedItems,
        orderedItems, setOrderedItems,
        shoppingContext, setShoppingContext,
        selectedIds, setSelectedIds,
        activity, setActivity,
        activityExpanded, setActivityExpanded,
        pendingProductActions, setPendingProductActions,
        checkoutOpen, setCheckoutOpen,
        pendingConfirmProduct, setPendingConfirmProduct,
        pendingConfirmVariants, setPendingConfirmVariants,
        isTyping, setIsTyping,
        pendingAddressChoice, setPendingAddressChoice,
        waitingForAddressInput, setWaitingForAddressInput,
        selectedDetailProductId, setSelectedDetailProductId,
        isEnteringCustomDetails, setIsEnteringCustomDetails,
        customName, setCustomName,
        customPhone, setCustomPhone,
        customEmail, setCustomEmail,
        newStreet1, setNewStreet1,
        newStreet2, setNewStreet2,
        newCity, setNewCity,
        addressError, setAddressError,
        checkingAddress, setCheckingAddress,

        handleAddToCart,
        handleWishlist,
        saveOrderToHistory,
        resetPendingPurchaseState
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};

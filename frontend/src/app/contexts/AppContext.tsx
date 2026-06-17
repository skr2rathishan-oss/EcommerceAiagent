import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { type Product } from "../components/products";
import { type DeliveryInfo, type SellerInfo } from "../components/InteractiveOrderSummary";
import { type OrderConfirmationDetails } from "../components/OrderConfirmationCard";
import { type OrderTrackingDetails } from "../types/orderTracking";
import { type LogItem } from "../components/AgentActivityBar";
import { CartProvider, useCart, type CartItem } from "./CartContext";
import { WishlistProvider, useWishlist } from "./WishlistContext";
import { RecentlyViewedProvider, useRecentlyViewed } from "./RecentlyViewedContext";

export type Phase = "centered" | "bottom";
export type PanelId = "Recent Conversations" | "Settings" | "Help & Support" | "Profile" | null;
export type RightPanelId = null;

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

export type { CartItem };

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
  displayedCounts: Record<number, number>;
  setDisplayedCounts: React.Dispatch<React.SetStateAction<Record<number, number>>>;
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
  activeScreen: "chat" | "cart" | "wishlist";
  setActiveScreen: (screen: "chat" | "cart" | "wishlist") => void;
  activeSmartPanel: "recommendation" | "delivery" | "track_order" | "checkout" | "delivery_recovery" | "nearby_address" | "alternative_date" | null;
  setActiveSmartPanel: (panel: "recommendation" | "delivery" | "track_order" | "checkout" | "delivery_recovery" | "nearby_address" | "alternative_date" | null) => void;
  nearbyCitiesSuggested: string[];
  setNearbyCitiesSuggested: React.Dispatch<React.SetStateAction<string[]>>;
  lastCheckedDelivery: { city: string; deliveryDate: string; productId: string } | null;
  setLastCheckedDelivery: React.Dispatch<React.SetStateAction<{ city: string; deliveryDate: string; productId: string } | null>>;

  // Shared Action Handlers
  handleAddToCart: (p: Product) => void;
  handleWishlist: (p: Product) => void;
  saveOrderToHistory: (order: OrderConfirmationDetails) => void;
  resetPendingPurchaseState: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const AppInnerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [phase, setPhase] = useState<Phase>("centered");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<PanelId>(null);
  const [anchorPos, setAnchorPos] = useState<AnchorPos>({ x: 0, y: 0 });
  const [rightPanel, setRightPanel] = useState<RightPanelId>(null);
  const [value, setValue] = useState("");
  const [activeScreen, setActiveScreen] = useState<"chat" | "cart" | "wishlist">("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeSmartPanel, setActiveSmartPanel] = useState<"recommendation" | "delivery" | "track_order" | "checkout" | "delivery_recovery" | "nearby_address" | "alternative_date" | null>(null);
  const [nearbyCitiesSuggested, setNearbyCitiesSuggested] = useState<string[]>([]);
  const [lastCheckedDelivery, setLastCheckedDelivery] = useState<{ city: string; deliveryDate: string; productId: string } | null>(null);

  // Consume new independent contexts
  const { cartItems, addToCart } = useCart();
  const { wishlistItems, addToWishlist, removeFromWishlist } = useWishlist();

  // Bridge state lists
  const wishlistItemsProducts = useMemo(() => wishlistItems.map(item => item.product), [wishlistItems]);

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
  const [displayedCounts, setDisplayedCounts] = useState<Record<number, number>>({});
  const [activity, setActivity] = useState<ActivityState | null>(null);
  const [activityExpanded, setActivityExpanded] = useState(false);
  const [pendingProductActions, setPendingProductActions] = useState<PendingProductActions | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [pendingConfirmProduct, setPendingConfirmProduct] = useState<Product | null>(null);
  const [pendingConfirmVariants, setPendingConfirmVariants] = useState<Record<string, string> | undefined>(undefined);
  const [isTyping, setIsTyping] = useState(false);
  const [pendingAddressChoice, setPendingAddressChoice] = useState(false);
  const [waitingForAddressInput, setWaitingForAddressInput] = useState(false);
  const [isEnteringCustomDetails, setIsEnteringCustomDetails] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customPhone, setCustomPhone] = useState("");
  const [customEmail, setCustomEmail] = useState("");
  const [newStreet1, setNewStreet1] = useState("");
  const [newStreet2, setNewStreet2] = useState("");
  const [newCity, setNewCity] = useState("");
  const [addressError, setAddressError] = useState("");
  const [checkingAddress, setCheckingAddress] = useState(false);

  // Bridged operations
  const handleAddToCart = (p: Product) => {
    addToCart(p, 1);
    setActiveScreen("cart");
  };

  const handleWishlist = (p: Product) => {
    const isWishlisted = wishlistItems.some(item => item.productId === p.id);
    if (isWishlisted) {
      removeFromWishlist(p.id);
    } else {
      addToWishlist(p);
    }
    setActiveScreen("wishlist");
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
        cartItems, setCartItems: () => {}, // NO-OP since managed by CartContext
        wishlistItems: wishlistItemsProducts, setWishlistItems: () => {}, // NO-OP since managed by WishlistContext
        savedItems: [], setSavedItems: () => {},
        orderedItems, setOrderedItems,
        shoppingContext, setShoppingContext,
        selectedIds, setSelectedIds,
        displayedCounts, setDisplayedCounts,
        activity, setActivity,
        activityExpanded, setActivityExpanded,
        pendingProductActions, setPendingProductActions,
        checkoutOpen, setCheckoutOpen,
        pendingConfirmProduct, setPendingConfirmProduct,
        pendingConfirmVariants, setPendingConfirmVariants,
        isTyping, setIsTyping,
        pendingAddressChoice, setPendingAddressChoice,
        waitingForAddressInput, setWaitingForAddressInput,
        isEnteringCustomDetails, setIsEnteringCustomDetails,
        customName, setCustomName,
        customPhone, setCustomPhone,
        customEmail, setCustomEmail,
        newStreet1, setNewStreet1,
        newStreet2, setNewStreet2,
        newCity, setNewCity,
        addressError, setAddressError,
        checkingAddress, setCheckingAddress,
        activeScreen, setActiveScreen,
        activeSmartPanel, setActiveSmartPanel,
        nearbyCitiesSuggested, setNearbyCitiesSuggested,
        lastCheckedDelivery, setLastCheckedDelivery,

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

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <CartProvider>
      <WishlistProvider>
        <RecentlyViewedProvider>
          <AppInnerProvider>
            {children}
          </AppInnerProvider>
        </RecentlyViewedProvider>
      </WishlistProvider>
    </CartProvider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};

/**
 * useProductActions — handles product card select, action popup dispatch,
 * and product details requests.
 */
import { useApp } from "../contexts/AppContext";
import { selectProduct, fetchProductDetails } from "../services/chatServices";
import { type Product } from "../components/products";
import { useRecentlyViewed } from "../contexts/RecentlyViewedContext";

export const useProductActions = () => {
  const {
    phase, setPhase,
    setMessages,
    setIsTyping,
    setActivity,
    setShoppingContext,
    setSelectedIds,
    setPendingProductActions,
    setPendingConfirmProduct,
    setPendingAddressChoice,
    handleAddToCart,
    handleWishlist,
    activeDetailsProduct,
    setActiveDetailsProduct,
  } = useApp();

  const { trackView } = useRecentlyViewed();

  /** Called when a product card is clicked */
  const handleProductSelect = async (product: Product) => {
    setShoppingContext(prev => ({ ...prev, selectedProduct: product }));

    // Dismiss details of another product if open
    if (activeDetailsProduct && activeDetailsProduct.id !== product.id) {
      setActiveDetailsProduct(null);
      setMessages(prev => prev.map(m =>
        m.type === "product_details" && m.productDetails?.product.id === activeDetailsProduct.id
          ? { ...m, isDetailsClosed: true }
          : m
      ));
    }

    setPendingProductActions({
      product,
      actions: [
        { id: "view_details", label: "Details", emoji: "👀" },
        { id: "check_delivery", label: "Delivery", emoji: "🚚" },
        { id: "add_to_cart", label: "Add Cart", emoji: "🛒" },
        { id: "save_for_later", label: "Wishlist", emoji: "❤️" },
        { id: "compare", label: "Compare", emoji: "⚖️" },
      ],
    });

    try {
      await selectProduct({
        id: product.id,
        name: product.name,
        price: product.price,
        currency: product.currency,
        images: product.images,
        inStock: product.stock > 0,
      });
    } catch {
      console.warn("[ProductSelect] Backend session save failed (non-critical)");
    }
  };

  /** Fetches and displays full product details */
  const handleRequestProductDetails = async (productId: string, productName?: string) => {
    if (phase === "centered") setPhase("bottom");
    setIsTyping(true);
    setActivity({
      currentStep: "UNDERSTANDING",
      currentMessage: "Fetching product details...",
      logs: [
        { id: "UNDERSTANDING", title: "Retrieving details", status: "active", details: [`Product ID: ${productId}`] },
        { id: "READY", title: "Formatting display", status: "pending", details: [] }
      ]
    });
    try {
      const data = await fetchProductDetails(productId) as {
        type: string; content: string; product: Product;
      };
      if (data?.type === "product_details") {
        const productObj = data.product || { id: productId, name: productName || "Product", price: 0 } as Product;
        trackView(productObj);
        setMessages(prev => [...prev, {
          role: "ai",
          text: `Here are the full details for **${productName || productObj.name || "the product"}**:`,
          type: "product_details",
          productDetails: { content: data.content || "", product: productObj },
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: "ai",
          text: `⚠️ I couldn't load details for **${productName || "this product"}** right now. Please try again.`,
        }]);
      }

    } catch (err) {
      console.error("Failed to load details:", err);
      setMessages(prev => [...prev, {
        role: "ai",
        text: "⚠️ I couldn't load the full product details right now. Please try again.",
      }]);
    } finally {
      setIsTyping(false);
      setActivity(null);
    }
  };

  /** Dispatches action popup button clicks */
  const handleProductAction = async (actionId: string, product: Product) => {
    setPendingProductActions(null);
    setSelectedIds({});
    setShoppingContext(prev => ({ ...prev, selectedProduct: null }));

    if (actionId === "view_details") {
      handleRequestProductDetails(product.id, product.name);
    } else if (actionId === "add_to_cart") {
      handleAddToCart(product);
    } else if (actionId === "save_for_later") {
      handleWishlist(product);
    } else if (actionId === "check_delivery") {
      setPendingConfirmProduct(product);
      setPendingAddressChoice(true);
      if (phase === "centered") setPhase("bottom");
    } else if (actionId === "compare") {
      if (phase === "centered") setPhase("bottom");
      setMessages(prev => [...prev, {
        role: "ai",
        text: `🔜 **Compare feature coming soon!**\n\nI'll be able to compare **${product.name}** with similar products side-by-side. For now, you can browse the other products in the search results above.`,
      }]);
    }
  };

  return { handleProductSelect, handleProductAction, handleRequestProductDetails };
};

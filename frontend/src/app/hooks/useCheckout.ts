import { useApp } from "../contexts/AppContext";
import { type Product } from "../components/products";
import { type DeliveryInfo, getDefaultSeller } from "../components/InteractiveOrderSummary";
import { type OrderConfirmationDetails } from "../components/OrderConfirmationCard";
import { checkDelivery } from "../services/productServices";
import { useCart } from "../contexts/CartContext";

export const useCheckout = () => {
  const { clearCart } = useCart();
  const {
    cartItems,
    setMessages,
    setCheckoutOpen,
    orderedItems,
    setOrderedItems,
    pendingConfirmProduct,
    setPendingConfirmProduct,
    pendingConfirmVariants,
    setPendingConfirmVariants,
    setPendingAddressChoice,
    setWaitingForAddressInput,
    setIsEnteringCustomDetails,
    customName,
    setCustomName,
    customPhone,
    setCustomPhone,
    customEmail,
    setCustomEmail,
    newStreet1,
    setNewStreet1,
    newStreet2,
    setNewStreet2,
    newCity,
    setNewCity,
    addressError,
    setAddressError,
    checkingAddress,
    setCheckingAddress,
    phase,
    setPhase,
    saveOrderToHistory,
    resetPendingPurchaseState,
  } = useApp();

  const getSessionId = () => sessionStorage.getItem("velora_session_id") || "default";

  const generateOrderConfirmation = (
    deliveryInfo: DeliveryInfo,
    items: Array<{ product: Product; qty: number }>
  ): OrderConfirmationDetails => {
    const now = new Date();
    const formatDate = (date: Date) => {
      const day = String(date.getDate()).padStart(2, "0");
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      return `${day} ${month} ${year}`;
    };

    const deliveryDate = new Date();
    deliveryDate.setDate(now.getDate() + 2);

    const referenceNumber = `KAP-${now.getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const orderNumber = `VIMP${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    const subtotal = items.reduce((sum, item) => sum + item.product.price * item.qty, 0);
    const deliveryCharge = 0;
    const discount = 0;
    const total = subtotal + deliveryCharge - discount;

    return {
      referenceNumber,
      orderNumber,
      orderDate: formatDate(now),
      estimatedDelivery: formatDate(deliveryDate),
      paymentStatus: "Paid",
      recipient: {
        name: deliveryInfo.fullName,
        phone: deliveryInfo.phone,
        email: deliveryInfo.email,
        address: deliveryInfo.address,
      },
      items: items.map(item => ({
        id: item.product.id,
        name: item.product.name,
        image: item.product.images[0],
        qty: item.qty,
        price: item.product.price,
        currency: item.product.currency,
      })),
      summary: {
        subtotal,
        deliveryCharge,
        discount,
        total,
      }
    };
  };

  const handleBuyNow = (p: Product, variants?: Record<string, string>) => {
    setPendingConfirmProduct(p);
    setPendingConfirmVariants(variants);
  };

  const handlePlaceInlineOrder = (messageIndex: number, updatedDelivery: DeliveryInfo) => {
    setMessages(prev => prev.map((msg, idx) => {
      if (idx === messageIndex && msg.orderSummary) {
        return {
          ...msg,
          orderSummary: {
            ...msg.orderSummary,
            deliveryInfo: updatedDelivery,
            status: "placed"
          }
        };
      }
      return msg;
    }));

    const targetProduct = pendingConfirmProduct || (cartItems.length > 0 ? cartItems[0].product : null);
    const inlineProduct = targetProduct || { id: "unknown", name: "Product", category: "General", price: 0, brand: "Kapruka" } as Product;
    const inlineItems = [{ product: inlineProduct, qty: 1 }];
    
    const orderDetails = generateOrderConfirmation(updatedDelivery, inlineItems);
    saveOrderToHistory(orderDetails);

    fetch("/api/products/interaction", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-id": getSessionId(),
      },
      body: JSON.stringify({
        productId: inlineProduct.id,
        productName: inlineProduct.name,
        category: inlineProduct.category,
        action: "purchase"
      })
    }).catch(err => console.error("Failed to track purchase:", err));

    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        {
          role: "ai",
          type: "order_confirmation",
          text: "✅ Order Successfully Placed",
          order: orderDetails
        }
      ]);
    }, 600);
  };

  const handleCartCheckoutComplete = (info: DeliveryInfo) => {
    const orderDetails = generateOrderConfirmation(info, cartItems);
    saveOrderToHistory(orderDetails);

    // Track purchase for each item in cart
    cartItems.forEach(item => {
      fetch("/api/products/interaction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": getSessionId(),
        },
        body: JSON.stringify({
          productId: item.product.id,
          productName: item.product.name,
          category: item.product.category,
          action: "purchase"
        })
      }).catch(err => console.error("Failed to track purchase:", err));
    });

    setMessages(prev => [
      ...prev,
      {
        role: "ai",
        type: "order_confirmation",
        text: "✅ Order Successfully Placed",
        order: orderDetails
      }
    ]);
    clearCart();
    setCheckoutOpen(false);
  };

  const handleVerifyCustomDetails = async () => {
    if (!customName.trim() || !customPhone.trim() || !customEmail.trim() || !newStreet1.trim() || !newCity.trim()) {
      setAddressError("All marked (*) fields are required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customEmail.trim())) {
      setAddressError("Please enter a valid email address");
      return;
    }
    setCheckingAddress(true);
    setAddressError("");

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    try {
      const res = await checkDelivery({
        city: newCity.trim(),
        deliveryDate: tomorrowStr,
        productId: pendingConfirmProduct ? pendingConfirmProduct.id : "",
      });

      if (res.available) {
        const formattedAddress = [newStreet1.trim(), newStreet2.trim(), res.city].filter(Boolean).join(", ");
        const customDelivery = {
          fullName: customName.trim(),
          phone: customPhone.trim(),
          email: customEmail.trim(),
          address: formattedAddress,
        };
        const seller = getDefaultSeller(pendingConfirmProduct!.brand);
        setMessages((prev) => [
          ...prev,
          {
            role: "ai",
            text: `✅ Delivery is available for your address in **${res.city}** (Delivery Charge: Rs. ${res.deliveryCharge}). Here is your updated Order Summary:`,
            orderSummary: {
              product: pendingConfirmProduct!,
              variants: pendingConfirmVariants,
              deliveryInfo: customDelivery,
              sellerInfo: seller,
              status: "pending",
            },
          },
        ]);

        // Save custom details to local storage
        localStorage.setItem("delivery_name", customName.trim());
        localStorage.setItem("delivery_phone", customPhone.trim());
        localStorage.setItem("delivery_email", customEmail.trim());
        localStorage.setItem("delivery_street1", newStreet1.trim());
        localStorage.setItem("delivery_street2", newStreet2.trim());
        localStorage.setItem("delivery_city", res.city);

        resetPendingPurchaseState();
      } else {
        setAddressError(res.warning || "Unsupported delivery city");
      }
    } catch (err: any) {
      setAddressError(err.message || "Failed to check delivery availability");
    } finally {
      setCheckingAddress(false);
    }
  };

  const handleUseDefaultAddress = () => {
    const savedName = localStorage.getItem("delivery_name") || "Alex Johnson";
    const savedPhone = localStorage.getItem("delivery_phone") || "+94 77 123 4567";
    const savedEmail = localStorage.getItem("delivery_email") || "alex@example.com";
    const savedStreet1 = localStorage.getItem("delivery_street1") || "";
    const savedStreet2 = localStorage.getItem("delivery_street2") || "";
    const savedCity = localStorage.getItem("delivery_city") || "Colombo 03";
    const savedAddress = [savedStreet1, savedStreet2, savedCity].filter(Boolean).join(", ") || "123 Galle Road, Colombo 03, Sri Lanka";

    const defaultDelivery = {
      fullName: savedName,
      phone: savedPhone,
      email: savedEmail,
      address: savedAddress
    };
    const seller = getDefaultSeller(pendingConfirmProduct!.brand);
    setMessages(prev => [
      ...prev,
      {
        role: "ai",
        text: "Here is your Order Summary. You can edit the delivery details directly if needed, then click 'Place Order' to finish.",
        orderSummary: {
          product: pendingConfirmProduct!,
          variants: pendingConfirmVariants,
          deliveryInfo: defaultDelivery,
          sellerInfo: seller,
          status: "pending"
        }
      }
    ]);
    resetPendingPurchaseState();
  };

  return {
    handleBuyNow,
    handlePlaceInlineOrder,
    handleCartCheckoutComplete,
    handleVerifyCustomDetails,
    handleUseDefaultAddress,
    generateOrderConfirmation,
  };
};

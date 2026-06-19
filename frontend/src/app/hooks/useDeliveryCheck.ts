/**
 * useDeliveryCheck — handles the address-input flow triggered when
 * `waitingForAddressInput` is true (user types a delivery address in the chat).
 */
import { useApp } from "../contexts/AppContext";
import { checkDelivery } from "../services/productServices";
import { getDefaultSeller } from "../components/InteractiveOrderSummary";

const CITIES_LIST = [
  "Colombo 01", "Colombo 02", "Colombo 03", "Colombo 04", "Colombo 05",
  "Colombo 06", "Colombo 07", "Colombo 08", "Colombo 09", "Colombo 10",
  "Colombo 11", "Colombo 12", "Colombo 13", "Colombo 14", "Colombo 15",
  "Jaffna", "Galle", "Kandy", "Negombo", "Anuradhapura", "Gampaha",
  "Kurunegala", "Batticaloa", "Trincomalee", "Matara", "Ratnapura",
  "Badulla", "Kalutara", "Moratuwa", "Dehiwala", "Mount Lavinia"
];

function detectCity(text: string): string {
  const lower = text.toLowerCase();
  for (const city of CITIES_LIST) {
    if (lower.includes(city.toLowerCase())) return city;
  }
  const parts = text.split(",");
  if (parts.length > 0) return parts[parts.length - 1].trim();
  return "Colombo 03";
}

export const useDeliveryCheck = () => {
  const {
    setMessages,
    setIsTyping,
    setActivity,
    setActiveSmartPanel,
    setWaitingForAddressInput,
    setLastCheckedDelivery,
    setPendingConfirmProduct,
    setPendingConfirmVariants,
    pendingConfirmProduct,
    pendingConfirmVariants,
  } = useApp();

  /**
   * Runs when user submits a free-text address while `waitingForAddressInput` is true.
   * Returns true if the address flow was handled, false otherwise.
   */
  const handleAddressInput = async (trimmed: string): Promise<boolean> => {
    setIsTyping(true);
    setActivity({
      currentStep: "UNDERSTANDING",
      currentMessage: "Checking delivery availability...",
      logs: [
        { id: "UNDERSTANDING", title: "Validating address", status: "active", details: [`Address: ${trimmed}`] },
        { id: "READY", title: "Checking carrier service", status: "pending", details: [] }
      ]
    });

    const detectedCity = detectCity(trimmed);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    try {
      const res = await checkDelivery({
        city: detectedCity,
        deliveryDate: tomorrowStr,
        productId: pendingConfirmProduct ? pendingConfirmProduct.id : ""
      });

      if (res.available) {
        setWaitingForAddressInput(false);
        const seller = getDefaultSeller(pendingConfirmProduct!.brand);
        const deliveryInfo = {
          fullName: "Alex Johnson",
          phone: "+94 77 123 4567",
          email: "alex@example.com",
          address: trimmed
        };
        setMessages(prev => [
          ...prev,
          {
            role: "ai",
            text: `✅ Great! Delivery is available for your address in **${res.city}** (Delivery Charge: Rs. ${res.deliveryCharge}). Here is your updated Order Summary:`,
            orderSummary: {
              product: pendingConfirmProduct!,
              variants: pendingConfirmVariants,
              deliveryInfo,
              sellerInfo: seller,
              status: "pending"
            }
          }
        ]);
        setPendingConfirmProduct(null);
        setPendingConfirmVariants(undefined);
      } else {
        setLastCheckedDelivery({
          city: res.city || detectedCity,
          deliveryDate: tomorrowStr,
          productId: pendingConfirmProduct ? pendingConfirmProduct.id : ""
        });
        setMessages(prev => [
          ...prev,
          {
            role: "ai",
            text: `Unfortunately this item can't be delivered to **${res.city || detectedCity}** on your selected date.\n\nI can help find another delivery location, another date, or a similar product that can be delivered.\n\nWhich option would you like to try?`
          }
        ]);
        setActiveSmartPanel("delivery_recovery");
      }
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          role: "ai",
          text: `⚠️ Unable to verify delivery: ${err.message || "Failed to call check service"}. Please try typing the address again.`
        }
      ]);
    } finally {
      setActivity(null);
      setIsTyping(false);
    }

    return true;
  };

  return { handleAddressInput };
};

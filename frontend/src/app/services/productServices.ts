export interface ProductDetail {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  images: string[];
  stock: boolean;
  shippingInfo: string;
  url: string;
}

export interface DeliveryRequest {
  city: string;
  deliveryDate: string;
  productId: string;
}

export interface DeliveryResponse {
  available: boolean;
  city: string;
  deliveryDate: string;
  deliveryCharge: number;
  warning: string | null;
}

export const fetchProductDetails = async (productId: string): Promise<ProductDetail> => {
  const sessionId = sessionStorage.getItem("velora_session_id") || "default";
  const response = await fetch(`/api/products/${productId}`, {
    headers: {
      "x-session-id": sessionId
    }
  });
  if (!response.ok) {
    throw new Error("Failed to fetch product details");
  }
  return response.json();
};

export const checkDelivery = async (req: DeliveryRequest): Promise<DeliveryResponse> => {
  const sessionId = sessionStorage.getItem("velora_session_id") || "default";
  const response = await fetch("/api/delivery/check", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-session-id": sessionId,
    },
    body: JSON.stringify(req),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to check delivery availability");
  }
  return response.json();
};

export interface BackendRecommendationProduct {
  id: string;
  name: string;
  price: number;
  currency: string;
  image: string;
  url: string;
  inStock: boolean;
  description: string;
  brand: string;
  category: string;
}

export const fetchRecommendations = async (): Promise<BackendRecommendationProduct[]> => {
  const response = await fetch("/api/products/recommendations");
  if (!response.ok) {
    throw new Error("Failed to fetch recommendations");
  }
  const data = await response.json();
  return data.products || [];
};


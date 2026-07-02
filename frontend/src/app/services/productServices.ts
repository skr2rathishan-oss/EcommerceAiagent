import { apiJson, apiFetch } from "./api";

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
  const response = await apiFetch(`/api/products/${productId}`, {
    headers: {
      "x-session-id": sessionId
    }
  });
  return response.json();
};

export const checkDelivery = async (req: DeliveryRequest): Promise<DeliveryResponse> => {
  const sessionId = sessionStorage.getItem("velora_session_id") || "default";
  const response = await apiFetch("/api/delivery/check", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-session-id": sessionId,
    },
    body: JSON.stringify(req),
  });
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
  const data = await apiJson("/api/products/recommendations");
  return data.products || [];
};

export const fetchCategoryProducts = async (query: string, category: string): Promise<BackendRecommendationProduct[]> => {
  const sessionId = sessionStorage.getItem("velora_session_id") || "default";
  const response = await apiFetch("/api/products/recommendations/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-session-id": sessionId,
    },
    body: JSON.stringify({ query, category, budget: 0 }),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch category products");
  }

  return response.json();
};


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

export const fetchProductDetails = async (productId: string): Promise<ProductDetail> => {
  const response = await fetch(`/api/products/${productId}`);
  if (!response.ok) {
    throw new Error("Failed to fetch product details");
  }
  return response.json();
};

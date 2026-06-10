import type { Product as BackendProduct } from "../types/product";
import type { Product as UIProduct } from "../components/products";
import type { ProductDetail } from "./productServices";

export const mapBackendProductToUI = (bp: BackendProduct): UIProduct => {
  // Infer brand from the first word of the name, fallback to "Kapruka"
  const brandName = bp.name.split(" ")[0] || "Kapruka";
  
  return {
    id: bp.id,
    name: bp.name,
    brand: brandName,
    price: bp.price,
    rating: 4.6,
    reviewCount: 124,
    shortDesc: `Imported item from Kapruka. Priced in ${bp.currency}.`,
    description: `Buy ${bp.name} from our store. Fast delivery and reliable quality.`,
    images: [bp.image || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800"],
    specs: [{ label: "Origin", value: "Imported" }],
    variants: [{ type: "Type", options: ["Standard"] }],
    delivery: "Free delivery in 2–3 business days",
    stock: bp.inStock ? 10 : 0,
    category: "General"
  };
};

export const mapProductDetailToUI = (pd: ProductDetail): UIProduct => {
  const brandName = pd.name.split(" ")[0] || "Kapruka";

  return {
    id: pd.id,
    name: pd.name,
    brand: brandName,
    price: pd.price,
    rating: 4.6,
    reviewCount: 124,
    shortDesc: pd.description.substring(0, 100) + (pd.description.length > 100 ? "..." : ""),
    description: pd.description,
    images: pd.images.length > 0 ? pd.images : ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800"],
    specs: [{ label: "Origin", value: "Imported" }],
    variants: [{ type: "Type", options: ["Standard"] }],
    delivery: pd.shippingInfo,
    stock: pd.stock ? 10 : 0,
    category: "General"
  };
};

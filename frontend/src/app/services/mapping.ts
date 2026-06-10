import type { Product as BackendProduct } from "../types/product";
import type { Product as UIProduct } from "../components/products";

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

export interface ProductVariant { type: string; options: string[] }
export interface ProductSpec { label: string; value: string }

export interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviewCount: number;
  shortDesc: string;
  description: string;
  images: string[];
  specs: ProductSpec[];
  variants: ProductVariant[];
  delivery: string;
  stock: number;
  category: string;
  isMcp?: boolean;
  currency?: string;
  explanation?: string[];
  score?: number;
  recommendationType?: string;
  recommendationReason?: string;
}

export const PRODUCTS: Product[] = [
  {
    id: "p1",
    name: "SoundFlow Pro X",
    brand: "SoundFlow",
    price: 89.99,
    originalPrice: 129.99,
    rating: 4.7,
    reviewCount: 2341,
    shortDesc: "Premium wireless headphones with 40hr battery & ANC.",
    description: "Experience audio like never before with the SoundFlow Pro X. Featuring advanced Active Noise Cancellation, 40-hour battery life, and Hi-Res audio certification, these headphones deliver studio-quality sound in any environment. The ergonomic over-ear design ensures comfort during extended listening sessions.",
    images: [
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800&q=80",
      "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800&q=80",
    ],
    specs: [
      { label: "Driver Size", value: "40mm" },
      { label: "Frequency", value: "20Hz – 20kHz" },
      { label: "Battery Life", value: "40 hours" },
      { label: "Charging", value: "USB-C, 15min = 3hr" },
      { label: "Connectivity", value: "Bluetooth 5.3" },
      { label: "Weight", value: "250g" },
    ],
    variants: [
      { type: "Color", options: ["Midnight Black", "Pearl White", "Sage Green"] },
    ],
    delivery: "Free delivery in 2–3 business days",
    stock: 42,
    category: "Electronics",
  },
  {
    id: "p2",
    name: "Vega S2 Smart Watch",
    brand: "Vega",
    price: 199.00,
    originalPrice: 249.00,
    rating: 4.5,
    reviewCount: 1128,
    shortDesc: "Advanced health tracking with AMOLED display & GPS.",
    description: "The Vega S2 redefines what a smartwatch can do. With a stunning 1.4\" AMOLED display, built-in GPS, ECG monitoring, SpO2 sensor, and 7-day battery life, it's the perfect companion for an active lifestyle. Compatible with iOS and Android.",
    images: [
      "https://images.unsplash.com/photo-1631863552122-3072cf599a46?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800&q=80",
      "https://images.unsplash.com/photo-1542541864-4abf21a55761?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800&q=80",
    ],
    specs: [
      { label: "Display", value: "1.4\" AMOLED" },
      { label: "Battery Life", value: "7 days" },
      { label: "Water Resistance", value: "5ATM" },
      { label: "GPS", value: "Built-in" },
      { label: "Sensors", value: "HR, SpO2, ECG" },
      { label: "Compatibility", value: "iOS & Android" },
    ],
    variants: [
      { type: "Case Size", options: ["42mm", "46mm"] },
      { type: "Band", options: ["Silicone", "Leather", "Metal"] },
    ],
    delivery: "Free delivery in 1–2 business days",
    stock: 18,
    category: "Wearables",
  },
  {
    id: "p3",
    name: "AirStep Runner 2.0",
    brand: "AirStep",
    price: 119.00,
    originalPrice: 159.00,
    rating: 4.6,
    reviewCount: 873,
    shortDesc: "Lightweight running shoes with responsive foam sole.",
    description: "The AirStep Runner 2.0 is engineered for performance and comfort. Built with a breathable mesh upper and energy-returning foam midsole, these shoes provide the perfect blend of cushioning and speed. Ideal for road running, gym workouts, and everyday wear.",
    images: [
      "https://images.unsplash.com/photo-1560769629-975ec94e6a86?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800&q=80",
      "https://images.unsplash.com/photo-1608231387042-66d1773070a5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800&q=80",
    ],
    specs: [
      { label: "Upper", value: "Breathable mesh" },
      { label: "Midsole", value: "CloudFoam Plus" },
      { label: "Outsole", value: "Rubber" },
      { label: "Drop", value: "8mm" },
      { label: "Weight", value: "265g (size 9)" },
      { label: "Use", value: "Road running" },
    ],
    variants: [
      { type: "Size", options: ["7", "8", "9", "10", "11", "12"] },
      { type: "Color", options: ["White/Orange", "Black/Red", "Navy/White"] },
    ],
    delivery: "Free delivery in 3–5 business days",
    stock: 56,
    category: "Footwear",
  },
  {
    id: "p4",
    name: "ProBook Ultra 14",
    brand: "ProBook",
    price: 1099.00,
    originalPrice: 1299.00,
    rating: 4.8,
    reviewCount: 412,
    shortDesc: "Ultra-thin laptop with M-class chip & 18hr battery.",
    description: "The ProBook Ultra 14 packs desktop-class performance into a 14mm slim chassis. Powered by the latest M-class processor, 16GB unified memory, and a 2K IPS display with 100% sRGB coverage, it's built for professionals who demand the best. Whisper-quiet, all-day battery life.",
    images: [
      "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800&q=80",
      "https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800&q=80",
    ],
    specs: [
      { label: "Processor", value: "M-class 10-core" },
      { label: "Memory", value: "16GB Unified" },
      { label: "Storage", value: "512GB NVMe SSD" },
      { label: "Display", value: "14\" 2K IPS 90Hz" },
      { label: "Battery", value: "18 hours" },
      { label: "Weight", value: "1.24 kg" },
    ],
    variants: [
      { type: "Storage", options: ["256GB", "512GB", "1TB"] },
      { type: "Color", options: ["Space Grey", "Silver"] },
    ],
    delivery: "Free delivery in 2–4 business days",
    stock: 9,
    category: "Computers",
  },
  {
    id: "p5",
    name: "ClearSound Buds Pro",
    brand: "ClearSound",
    price: 49.99,
    originalPrice: 79.99,
    rating: 4.4,
    reviewCount: 3210,
    shortDesc: "True wireless earbuds with 32hr total playback.",
    description: "ClearSound Buds Pro deliver immersive stereo sound in a compact form factor. With IPX5 water resistance, 8hr bud battery plus 24hr from the case, and seamless device switching, they're perfect for commuters, gym-goers, and remote workers alike.",
    images: [
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800&q=80",
      "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800&q=80",
    ],
    specs: [
      { label: "Driver", value: "11mm dynamic" },
      { label: "Battery (buds)", value: "8 hours" },
      { label: "Battery (case)", value: "+24 hours" },
      { label: "Water Resistance", value: "IPX5" },
      { label: "Connectivity", value: "Bluetooth 5.2" },
      { label: "Codec", value: "AAC, SBC" },
    ],
    variants: [
      { type: "Color", options: ["Obsidian", "Cream", "Lilac"] },
    ],
    delivery: "Free delivery in 1–2 business days",
    stock: 120,
    category: "Electronics",
  },
  {
    id: "p6",
    name: "Flux 3 Mechanical Keyboard",
    brand: "Flux",
    price: 129.99,
    originalPrice: 169.99,
    rating: 4.9,
    reviewCount: 654,
    shortDesc: "TKL mechanical keyboard with hot-swap switches & RGB.",
    description: "The Flux 3 is a tenkeyless mechanical keyboard built for typists and gamers. Hot-swappable switch sockets let you tune the feel without soldering. Full per-key RGB, PBT double-shot keycaps, and a gasket-mounted plate deliver a premium tactile and auditory experience.",
    images: [
      "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800&q=80",
      "https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800&q=80",
    ],
    specs: [
      { label: "Layout", value: "TKL (87-key)" },
      { label: "Switch Mount", value: "Hot-swappable" },
      { label: "Keycaps", value: "PBT Double-shot" },
      { label: "Backlighting", value: "Per-key RGB" },
      { label: "Connection", value: "USB-C / Wireless" },
      { label: "Anti-ghosting", value: "Full NKRO" },
    ],
    variants: [
      { type: "Switch", options: ["Red (Linear)", "Brown (Tactile)", "Blue (Clicky)"] },
      { type: "Color", options: ["Black", "White"] },
    ],
    delivery: "Free delivery in 3–5 business days",
    stock: 33,
    category: "Accessories",
  },
];

export type ProductTag = "performance" | "lifestyle" | "accessories";

export type Product = {
  id: string;
  slug: string;
  name: string;
  price: number;
  currency: "USD";
  description: string;
  tags: ProductTag[];
  dropSlug: string;
  images: string[]; // can be empty for now
  stripeCheckoutUrl?: string | null;
  featured?: boolean;
};

export const products: Product[] = [
  {
    id: "p-tee-standard",
    slug: "spring26-tee-standard",
    name: "Spring26 Tee — Standard",
    price: 30,
    currency: "USD",
    description: "Clean, dependable, and built for repeat wear.",
    tags: ["lifestyle"],
    dropSlug: "spring26",
    images: [],
    stripeCheckoutUrl: null,
    featured: true,
  },
  {
    id: "p-tee-performance",
    slug: "spring26-tee-performance",
    name: "Spring26 Tee — Performance",
    price: 35,
    currency: "USD",
    description: "Lightweight feel with a disciplined, minimal finish.",
    tags: ["performance"],
    dropSlug: "spring26",
    images: [],
    stripeCheckoutUrl: null,
    featured: true,
  },
  {
    id: "p-hoodie",
    slug: "spring26-hoodie",
    name: "Spring26 Hoodie",
    price: 45,
    currency: "USD",
    description: "Soft structure. Quiet warmth. Travel-to-training staple.",
    tags: ["lifestyle"],
    dropSlug: "spring26",
    images: [],
    stripeCheckoutUrl: null,
    featured: true,
  },
  {
    id: "p-sweats",
    slug: "spring26-sweatpants",
    name: "Spring26 Sweatpants",
    price: 45,
    currency: "USD",
    description: "Relaxed, clean lines. Designed for movement and rest.",
    tags: ["lifestyle"],
    dropSlug: "spring26",
    images: [],
    stripeCheckoutUrl: null,
    featured: false,
  },
];

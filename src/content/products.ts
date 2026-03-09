export type ProductTag = "Performance" | "Lifestyle" | "Accessories";

export type Product = {
  id: string;
  slug: string;
  name: string;
  price: number | null;
  currency: "USD";
  description: string;
  fit: string;
  tags: ProductTag[];
  dropSlug: string;
  images: string[];
  stripeCheckoutUrl?: string | null;
  featured?: boolean;
};

export const products: Product[] = [
  {
    id: "p-midnight-sigil",
    slug: "midnight-sigil",
    name: "Midnight Sigil",
    price: null,
    currency: "USD",
    description:
      "You won't see it until you're supposed to. Dark-wash heavyweight tee with dark-on-dark print across the back that only reveals itself when the light hits. Oversized fit, sits off the shoulder. Built for the guys who don't need to announce themselves.",
    fit: "Oversized",
    tags: ["Lifestyle"],
    dropSlug: "drop-001",
    images: ["/img/shop/dark1_front.PNG", "/img/shop/dark1_back.PNG"],
    stripeCheckoutUrl: null,
    featured: true,
  },
  {
    id: "p-void-pull",
    slug: "void-pull",
    name: "Void Pull",
    price: null,
    currency: "USD",
    description:
      "You'll feel it before you see it. Light-body performance tee in washed bone. Full spiral across the back that hits different when you're walking away from the court.",
    fit: "Standard",
    tags: ["Performance"],
    dropSlug: "drop-001",
    images: ["/img/shop/light1_front.PNG", "/img/shop/light1_back.PNG"],
    stripeCheckoutUrl: null,
    featured: true,
  },
];

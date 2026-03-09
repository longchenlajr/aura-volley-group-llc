import { drops } from "@/content/drops";
import { products } from "@/content/products";
import { players } from "@/content/players";

export function getDropBySlug(slug: string) {
  return drops.find((d) => d.slug === slug) ?? null;
}

export function getProductBySlug(slug: string) {
  return products.find((p) => p.slug === slug) ?? null;
}

export function getProductsByDropSlug(dropSlug: string) {
  return products.filter((p) => p.dropSlug === dropSlug);
}

export function getPlayerBySlug(slug: string) {
  return players.find((p) => p.slug === slug) ?? null;
}
// ✅ drop page should show only items listed in drops.ts
export function getProductsForDrop(dropSlug: string) {
  const drop = drops.find((d) => d.slug === dropSlug);
  if (!drop) return [];

  const set = new Set(drop.featuredProductSlugs);
  return products.filter((p) => set.has(p.slug));
}

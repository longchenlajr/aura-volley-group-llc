import Link from "next/link";
import { Product } from "@/content/products";
import { formatPriceUSD } from "@/lib/format";
import PlaceholderImage from "./PlaceholderImage";

export default function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={`/store/${product.slug}`} className="group block">
      <div className="rounded-2xl bg-white/0 transition">
        <PlaceholderImage title={product.name} subtitle={product.dropSlug} />
        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-white/85 group-hover:text-white/95 transition">
              {product.name}
            </div>
            <div className="mt-1 text-xs tracking-[0.18em] uppercase text-white/45">
              {product.tags.join(" • ")}
            </div>
          </div>
          <div className="text-sm text-white/70">
            {formatPriceUSD(product.price)}
          </div>
        </div>
      </div>
    </Link>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Product } from "@/content/products";
import { formatPriceUSD } from "@/lib/format";
import PlaceholderImage from "./PlaceholderImage";

export default function FeaturedCarousel({
  products,
}: {
  products: Product[];
}) {
  const featured = useMemo(() => {
    const f = products.filter((p) => p.featured);
    return f.length ? f : products;
  }, [products]);

  const [idx, setIdx] = useState(0);
  const current = featured[idx];

  return (
    <section className="rounded-[34px] bg-white/[0.02] ring-1 ring-white/10 overflow-hidden aura-ring">
      <div className="p-7 sm:p-10">
        <div className="flex items-end justify-between gap-10">
          <div className="max-w-xl">
            <div className="kicker">Featured</div>
            <div className="h2 mt-3">{current.name}</div>
            <div className="mt-4 text-sm text-white/60">
              {formatPriceUSD(current.price)}{" "}
              <span className="text-white/35">•</span> {current.dropSlug}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {featured.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setIdx(i)}
                aria-label={`Show ${p.name}`}
                className={[
                  "h-2.5 w-2.5 rounded-full transition",
                  i === idx ? "aura-dot" : "bg-white/15 hover:bg-white/25",
                ].join(" ")}
              />
            ))}
          </div>
        </div>

        <div className="mt-8">
          <PlaceholderImage title={current.name} subtitle="Spring26" />
        </div>

        <div className="mt-8 flex items-center justify-between gap-8">
          <p className="body max-w-2xl">{current.description}</p>

          <Link
            href={`/store/${current.slug}`}
            className="inline-flex items-center justify-center rounded-full px-7 py-3 text-xs tracking-[0.32em] uppercase
                       bg-[rgba(160,120,255,0.14)] text-white/90 ring-1 ring-[rgba(160,120,255,0.25)]
                       hover:bg-[rgba(160,120,255,0.18)] transition"
          >
            View
          </Link>
        </div>
      </div>
    </section>
  );
}

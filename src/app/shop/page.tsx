"use client";

import Image from "next/image";
import Link from "next/link";
import Container from "@/components/Container";
import ScrollReveal from "@/components/ScrollReveal";
import { products } from "@/content/products";
import { formatPriceUSD } from "@/lib/format";
import { useState } from "react";

const FILTERS = ["all", "lifestyle", "performance"] as const;

export default function ShopPage() {
  const [filter, setFilter] = useState<string>("all");

  const filtered =
    filter === "all"
      ? products
      : products.filter((p) => p.tags.includes(filter as any));

  return (
    <main>
      <div className="page-header">
        <Container>
          <ScrollReveal>
            <span className="kicker kicker-bright">Drop 001</span>
            <h1 className="page-title mt-3">The Shop</h1>
            <p className="page-sub mt-3">
              Two pieces. Checkout links activate when inventory drops.
            </p>
            <div className="section-rule mt-8" />

            <div className="flex items-center gap-3 mt-6 flex-wrap">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  className={`chip ${filter === f ? "active" : ""}`}
                  onClick={() => setFilter(f)}
                >
                  {f === "all" && <span className="dot" />}
                  {f}
                </button>
              ))}
              <span className="kicker ml-auto">
                {filtered.length} piece{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>
          </ScrollReveal>
        </Container>
      </div>

      <section className="pb-20">
        <Container>
          <div className="product-grid">
            {filtered.map((p, i) => (
              <ScrollReveal key={p.id} delay={i * 80}>
                <Link href={`/shop/${p.slug}`} className="card block">
                  <div className="card-media" style={{ aspectRatio: "4/3" }}>
                    {p.images.length > 0 ? (
                      <Image
                        src={p.images[1] ?? p.images[0]}
                        alt={p.name}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 50vw"
                        style={{ objectFit: "cover" }}
                      />
                    ) : (
                      <span className="kicker">Coming Soon</span>
                    )}
                  </div>
                  <div className="mt-4">
                    <div className="card-title">{p.name}</div>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="card-sub">{p.fit} · {p.tags.join(" / ")}</span>
                      {p.price != null && (
                        <>
                          <span className="dot" />
                          <span className="price">{formatPriceUSD(p.price)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <span className="kicker">View</span>
                    <span className="kicker">&rarr;</span>
                  </div>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </Container>
      </section>
    </main>
  );
}

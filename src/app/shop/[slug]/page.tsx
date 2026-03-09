import Image from "next/image";
import Link from "next/link";
import Container from "@/components/Container";
import { getProductBySlug } from "@/lib/content";
import { formatPriceUSD } from "@/lib/format";
import { notFound } from "next/navigation";
import { products } from "@/content/products";

export function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) return notFound();

  const canBuy = Boolean(product.stripeCheckoutUrl);

  return (
    <main>
      <section className="page-header pb-20">
        <Container>
          <span className="kicker kicker-bright">Drop 001</span>
          <h1 className="page-title mt-3">{product.name}</h1>
          <p className="page-sub mt-2">{product.fit} fit · {product.tags.join(" / ")}</p>

          <div className="section-rule mt-8" />

          <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Product images */}
            <div className="flex flex-col gap-4">
              {product.images.length > 0 ? (
                product.images.map((src, i) => (
                  <div
                    key={i}
                    className="card-media product-detail-image"
                  >
                    <Image
                      src={src}
                      alt={`${product.name} — ${i === 0 ? "front" : "back"}`}
                      fill
                      sizes="(max-width: 1024px) 92vw, 50vw"
                      style={{ objectFit: "cover" }}
                      priority={i === 0}
                    />
                  </div>
                ))
              ) : (
                <div className="card-media product-detail-image">
                  <span className="kicker">Image Coming Soon</span>
                </div>
              )}
            </div>

            {/* Details panel */}
            <div className="product-detail-panel">
              <div className="flex items-end justify-between gap-6">
                <div>
                  <span className="kicker">Price</span>
                  <div className="price mt-2">
                    {product.price != null ? formatPriceUSD(product.price) : "TBD"}
                  </div>
                </div>
                <Link href={`/drops/${product.dropSlug}`} className="kicker" style={{ color: "var(--ink-2)" }}>
                  View drop &rarr;
                </Link>
              </div>

              <div className="section-rule mt-6" />

              <div className="mt-6">
                <span className="kicker">Fit</span>
                <p className="card-sub mt-2">{product.fit}</p>
              </div>

              <div className="mt-6">
                <span className="kicker">Description</span>
                <p className="card-sub mt-2">{product.description}</p>
              </div>

              <div className="mt-6">
                <span className="kicker">Tags</span>
                <div className="flex gap-2 mt-2">
                  {product.tags.map((t) => (
                    <span key={t} className="chip">{t}</span>
                  ))}
                </div>
              </div>

              <div className="mt-8">
                {canBuy ? (
                  <a
                    href={product.stripeCheckoutUrl!}
                    className="btn btn-primary"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Checkout &rarr;
                  </a>
                ) : (
                  <div className="chip">
                    <span className="dot" />
                    Checkout opens soon
                  </div>
                )}
              </div>
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}

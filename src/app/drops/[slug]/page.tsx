import Image from "next/image";
import Link from "next/link";
import Container from "@/components/Container";
import ScrollReveal from "@/components/ScrollReveal";
import { getDropBySlug, getProductsForDrop } from "@/lib/content";
import { drops } from "@/content/drops";
import { formatPriceUSD } from "@/lib/format";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return drops.map((drop) => ({ slug: drop.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const drop = getDropBySlug(slug);
  return { title: drop?.name ?? "Drop" };
}

export default async function DropPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const drop = getDropBySlug(slug);
  if (!drop) return notFound();

  const dropProducts = getProductsForDrop(drop.slug);

  return (
    <main>
      <div className="page-header">
        <Container>
          <ScrollReveal>
            <span className="kicker kicker-bright">Drop</span>
            <h1 className="page-title mt-3">{drop.name}</h1>
            <p className="page-sub mt-2">{drop.subtitle}</p>
            <div className="section-rule mt-8" />
          </ScrollReveal>
        </Container>
      </div>

      <section className="pb-20">
        <Container>
          <ScrollReveal>
            <div className="card" style={{ cursor: "default" }}>
              <span className="kicker">Story</span>
              <p className="card-sub mt-3" style={{ maxWidth: "48rem" }}>
                {drop.story}
              </p>
            </div>
          </ScrollReveal>

          <div className="product-grid mt-10">
            {dropProducts.map((p, i) => (
              <ScrollReveal key={p.id} delay={i * 80}>
                <Link href={`/drops/${drop.slug}/${p.slug}`} className="card block">
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
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </Container>
      </section>
    </main>
  );
}

import Container from "@/components/Container";
import PageHeader from "@/components/PageHeader";
import PlaceholderImage from "@/components/PlaceholderImage";
import { getProductBySlug } from "@/lib/content";
import { formatPriceUSD } from "@/lib/format";
import { notFound } from "next/navigation";
import { products } from "@/content/products";

export function generateStaticParams() {
  return products.map((product) => ({
    slug: product.slug,
  }));
}

export default function ProductPage({ params }: { params: { slug: string } }) {
  const product = getProductBySlug(params.slug);
  if (!product) return notFound();

  const canBuy = Boolean(product.stripeCheckoutUrl);

  return (
    <main>
      <PageHeader title={product.name} subtitle={product.dropSlug} />
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div>
            <PlaceholderImage title={product.name} subtitle="Spring26" />
          </div>

          <div className="rounded-3xl bg-white/[0.03] ring-1 ring-white/10 p-8">
            <div className="text-sm text-white/70">
              {formatPriceUSD(product.price)}
            </div>
            <p className="mt-4 text-sm leading-7 text-white/55">
              {product.description}
            </p>

            <div className="mt-6 text-xs tracking-[0.22em] uppercase text-white/45">
              Tags
            </div>
            <div className="mt-2 text-sm text-white/60">
              {product.tags.join(" • ")}
            </div>

            <div className="inline-flex items-center gap-3 rounded-full px-6 py-3 bg-white/[0.03] ring-1 ring-white/10">
              <div className="h-2 w-2 rounded-full bg-[rgba(160,120,255,0.55)]" />
              <div className="text-xs tracking-[0.22em] uppercase text-white/60">
                Checkout opens soon
              </div>
            </div>
          </div>
        </div>
      </Container>
    </main>
  );
}

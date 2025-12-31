import PageHeader from "@/components/PageHeader";
import Container from "@/components/Container";
import FeaturedCarousel from "@/components/FeaturedCarousel";
import ProductCard from "@/components/ProductCard";
import { products } from "@/content/products";

export default function StorePage() {
  return (
    <main>
      <PageHeader
        title="Store"
        subtitle="Spring26 — four pieces. Checkout links will be added when ready."
      />

      <Container>
        <FeaturedCarousel products={products} />

        <div className="mt-10 flex items-center justify-between">
          <div className="kicker">Spring26 • 4 pieces</div>
          <div className="kicker text-white/35">Stripe: Coming soon</div>
        </div>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </Container>
    </main>
  );
}

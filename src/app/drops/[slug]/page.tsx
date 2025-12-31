import Container from "@/components/Container";
import PageHeader from "@/components/PageHeader";
import ProductCard from "@/components/ProductCard";
import { getDropBySlug, getProductsByDropSlug } from "@/lib/content";
import { drops } from "@/content/drops";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return drops.map((drop) => ({ slug: drop.slug }));
}

export default async function DropPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const drop = getDropBySlug(slug);
  if (!drop) return notFound();

  const dropProducts = getProductsByDropSlug(drop.slug);

  return (
    <main>
      <PageHeader title={drop.name} subtitle={drop.subtitle} />
      <Container>
        <div className="rounded-3xl bg-white/[0.03] ring-1 ring-white/10 p-8">
          <p className="text-sm leading-7 text-white/60 max-w-3xl">
            {drop.story}
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
          {dropProducts.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </Container>
    </main>
  );
}

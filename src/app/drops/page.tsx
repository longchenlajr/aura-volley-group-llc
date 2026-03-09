import Link from "next/link";
import Container from "@/components/Container";
import ScrollReveal from "@/components/ScrollReveal";
import { drops } from "@/content/drops";

export default function DropsPage() {
  return (
    <main>
      <div className="page-header">
        <Container>
          <ScrollReveal>
            <span className="kicker kicker-bright">Collections</span>
            <h1 className="page-title mt-3">Drops</h1>
            <p className="page-sub mt-3">
              Seasonal collections built like architecture: measured, minimal,
              repeatable.
            </p>
            <div className="section-rule mt-8" />
          </ScrollReveal>
        </Container>
      </div>

      <section className="pb-20">
        <Container>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {drops.map((d, i) => (
              <ScrollReveal key={d.id} delay={i * 100}>
                <Link href={`/drops/${d.slug}`} className="card block">
                  <span className="kicker">Drop</span>
                  <div className="card-title mt-3">{d.name}</div>
                  <p className="card-sub mt-2">{d.subtitle}</p>
                  <div className="section-rule mt-6" />
                  <div className="kicker mt-4 block">&rarr; View Collection</div>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </Container>
      </section>
    </main>
  );
}

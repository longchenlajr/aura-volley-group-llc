import PageHeader from "@/components/PageHeader";
import Container from "@/components/Container";
import Link from "next/link";
import { drops } from "@/content/drops";

export default function DropsPage() {
  return (
    <main>
      <PageHeader
        title="Drops"
        subtitle="Collections built like architecture: measured, minimal, and repeatable."
      />
      <Container>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {drops.map((d) => (
            <Link
              key={d.id}
              href={`/drops/${d.slug}`}
              className="rounded-3xl bg-white/[0.03] ring-1 ring-white/10 p-8 hover:bg-white/[0.05] transition block"
            >
              <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-12">
                <Link href={`/drops/${d.slug}`} className="group">
                  <div className="meta">Drop</div>
                  <div className="h2 mt-3">{d.name}</div>
                  <p className="body mt-3">{d.subtitle}</p>

                  <div className="mt-6 h-px w-12 bg-white/15 group-hover:bg-violet-400/50 transition" />
                </Link>
              </div>
              <div className="mt-2 text-sm text-white/55">{d.subtitle}</div>
              <div className="mt-6 h-px w-14 bg-white/10" />
            </Link>
          ))}
        </div>
      </Container>
    </main>
  );
}

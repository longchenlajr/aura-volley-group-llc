import Image from "next/image";
import Link from "next/link";
import Container from "@/components/Container";
import ScrollReveal from "@/components/ScrollReveal";
import { players } from "@/content/players";

export default function TeamPage() {
  return (
    <main>
      <div className="page-header">
        <Container>
          <ScrollReveal>
            <span className="kicker kicker-bright">A-Town Aura</span>
            <h1 className="page-title mt-3">The Roster</h1>
            <p className="page-sub mt-3">
              Corporate tanks by day, clip farmers by night.
            </p>
            <div className="section-rule mt-8" />
          </ScrollReveal>
        </Container>
      </div>

      <section className="pb-20">
        <Container>
          {/* Table header — desktop only */}
          <div className="roster-table-head">
            <div className="roster-col-photo" />
            <div className="roster-col">Name</div>
            <div className="roster-col">Height</div>
            <div className="roster-col">Position</div>
            <div className="roster-col">College</div>
            <div className="roster-col-end" />
          </div>
          {/* Rows */}
          <div className="flex flex-col">
            {players.map((p, i) => {
              const college =
                p.college && p.gradYear && p.gradYear !== 1
                  ? `${p.college} '${String(p.gradYear).slice(-2)}`
                  : p.college || "—";

              return (
                <ScrollReveal key={p.id} delay={i * 40}>
                  <Link href={`/atownaura/${p.slug}`} className="roster-row">
                    {/* Headshot */}
                    <div className="roster-row-photo">
                      <Image
                        src={`/img/players/${p.slug}.png`}
                        alt={p.name}
                        fill
                        sizes="56px"
                        style={{ objectFit: "cover" }}
                      />
                    </div>

                    {/* Name + number (always visible) */}
                    <div className="roster-row-name">
                      <span>{p.name}</span>
                      {p.jerseyNumber && (
                        <span className="roster-row-number">
                          #{p.jerseyNumber}
                        </span>
                      )}
                    </div>

                    {/* Desktop columns */}
                    <div className="roster-col roster-desktop">
                      {p.height || "—"}
                    </div>
                    <div className="roster-col roster-desktop">
                      {p.position}
                    </div>
                    <div className="roster-col roster-desktop">{college}</div>

                    {/* Mobile meta (stacks under name) */}
                    <div className="roster-row-mobile-meta roster-mobile">
                      {p.position}
                      {p.height ? ` · ${p.height}` : ""}
                    </div>

                    {/* Arrow */}
                    <div className="roster-col-end">
                      <span className="roster-arrow">&rarr;</span>
                    </div>
                  </Link>
                </ScrollReveal>
              );
            })}
          </div>
        </Container>
      </section>
    </main>
  );
}

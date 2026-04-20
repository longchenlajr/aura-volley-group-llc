import Link from "next/link";
import Container from "@/components/Container";
import ScrollReveal from "@/components/ScrollReveal";

export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <main>
      <div className="page-header">
        <Container>
          <ScrollReveal>
            <span className="kicker kicker-bright">Aura Volley Group LLC</span>
            <h1 className="page-title mt-3">About</h1>
            <p className="page-sub mt-3">
              The guys behind the team and the brand.
            </p>
            <div className="section-rule mt-8" />
          </ScrollReveal>
        </Container>
      </div>

      {/* Mission */}
      <section className="pb-16">
        <Container>
          <ScrollReveal>
            <span className="kicker">Mission</span>
            <div className="max-w-3xl">
              <p
                className="mt-4 text-lg leading-relaxed"
                style={{ color: "var(--ink-2)" }}
              >
                We didn't find each other. We grew up together. High school
                rivals, college teammates, weekend warriors who never stopped
                competing. For years it was the same cycle — group chat goes
                off, set up a few nets, we figure it out. A-Town Aura is what
                happens when you stop figuring it out and start building
                something real.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={100}>
            <div className="section-rule mt-10" />
          </ScrollReveal>

          {/* What We Do */}
          <ScrollReveal delay={150}>
            <span className="kicker mt-10 block">What We Do</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div className="card" style={{ cursor: "default" }}>
                <span className="kicker kicker-bright">Competition</span>
                <div className="card-title mt-3">A-Town Aura</div>
                <p className="card-sub mt-2">
                  High-level mens volleyball team based in the Lehigh Valley,
                  PA. Practicing weekly in preparation for local and regional
                  tournaments. Player-coached and driven to continue raising the
                  bar.
                </p>
              </div>
              <div className="card" style={{ cursor: "default" }}>
                <span className="kicker kicker-bright">Apparel</span>
                <div className="card-title mt-3">Aura Wear</div>
                <p className="card-sub mt-2">
                  Seasonal collections of volleyball-inspired streetwear. Subtle
                  branding, quality materials, and designs so fire you'll
                  finally be able to bang 10ft line.
                </p>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={200}>
            <div className="section-rule mt-10" />
          </ScrollReveal>

          {/* Facilities */}
          <ScrollReveal delay={250}>
            <span className="kicker mt-10 block">Facilities</span>
            <div className="mt-6 card" style={{ cursor: "default" }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <span className="kicker">Home Court</span>
                  <div className="card-title mt-2">
                    Executive Education Academy Charter School
                  </div>
                  <p className="card-sub mt-2">555 Union Boulevard</p>
                  <p className="card-sub mt-2">Allentown, PA, 18109</p>
                </div>
                <div>
                  <span className="kicker">Region</span>
                  <div className="card-title mt-2">Lehigh Valley, PA</div>
                  <p className="card-sub mt-2">
                    Allentown, Bethlehem, Easton corridor. Central to the
                    Northeast volleyball scene with access to tournaments across
                    PA, NJ, NY, and MD.
                  </p>
                </div>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={300}>
            <div className="section-rule mt-10" />
          </ScrollReveal>

          {/* Contact */}
          <ScrollReveal delay={350}>
            <span className="kicker mt-10 block">Contact</span>
            <div className="max-w-3xl">
              <p className="mt-4 card-sub">
                For inquiries, partnerships, or collaboration — reach out at{" "}
                <a
                  href="mailto:auravolleygroup@gmail.com"
                  style={{ color: "var(--accent-solid)" }}
                >
                  auravolleygroup@gmail.com
                </a>
                .
              </p>
              <p className="mt-3 card-sub">
                Interested in joining us on the court?{" "}
                <Link
                  href="/atownaura/membership"
                  style={{ color: "var(--accent-solid)" }}
                >
                  Join A-Town Aura &rarr;
                </Link>
              </p>
            </div>
          </ScrollReveal>
        </Container>
      </section>
    </main>
  );
}

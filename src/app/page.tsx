import Image from "next/image";
import Link from "next/link";
import Container from "@/components/Container";
import ScrollReveal from "@/components/ScrollReveal";
import { drops } from "@/content/drops";
import { products } from "@/content/products";
import { players } from "@/content/players";
import { events, getEventStatus } from "@/content/events";
import { formatPriceUSD } from "@/lib/format";

export default function Home() {
  const drop = drops[0];
  const featured = products.filter((p) => p.featured);
  const allPlayers = players;
  const upcomingEvents = events
    .filter((e) => getEventStatus(e) === "upcoming")
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);

  return (
    <main>
      {/* ── HERO ── */}
      <section className="hero">
        <div className="relative mb-8">
          <Image
            src="/img/logo1.png"
            alt="Aura Volley Group"
            width={180}
            height={120}
            priority
          />
        </div>

        <h1 className="hero-headline">Calm sideline. Loud game.</h1>

        <p className="hero-sub mt-5">
          A-Town Aura plays with edge and carries itself with composure.
          High-level men's volleyball backed by a brand that moves the same way.
        </p>

        <div className="hero-actions mt-10">
          <Link href={`/drops/${drop.slug}`} className="btn btn-primary">
            Shop {drop.name}
          </Link>
          <Link href="/atownaura" className="btn">
            Meet the Team
          </Link>
        </div>
      </section>

      {/* ── FEATURED DROP ── */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <Container>
          <ScrollReveal>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <span className="kicker kicker-bright">Latest Drop</span>
                <h2 className="page-title mt-3">{drop.name}</h2>
                <p className="page-sub mt-2">{drop.subtitle}</p>
              </div>
              <Link href={`/drops/${drop.slug}`} className="btn">
                View Collection
              </Link>
            </div>

            <div className="section-rule mt-8" />
          </ScrollReveal>

          <div className="product-grid mt-10">
            {featured.map((p, i) => (
              <ScrollReveal key={p.id} delay={i * 80}>
                <Link href={`/drops/${p.dropSlug}/${p.slug}`} className="card block">
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
                      <span className="card-sub">
                        {p.fit} · {p.tags.join(" / ")}
                      </span>
                      {p.price != null && (
                        <>
                          <span className="dot" />
                          <span className="price">
                            {formatPriceUSD(p.price)}
                          </span>
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

      {/* ── TEAM PREVIEW ── */}
      <section className="section">
        <Container>
          <ScrollReveal>
            <span className="kicker kicker-bright">A-Town Aura</span>
            <div className="flex items-end justify-between flex-wrap gap-4 mt-3">
              <div>
                <h2 className="page-title">The Roster</h2>
                <p className="page-sub mt-2">
                  Corporate tanks by day, clip farmers by night.
                </p>
              </div>
              <Link href="/atownaura" className="btn">
                Full Roster
              </Link>
            </div>
            <div className="section-rule mt-8" />
          </ScrollReveal>

          <div className="roster-marquee mt-10">
            <div className="roster-marquee-track">
              {[...allPlayers, ...allPlayers].map((p, i) => (
                <Link
                  key={`${p.id}-${i}`}
                  href={`/atownaura/${p.slug}`}
                  className="team-preview-card"
                >
                  <div className="team-preview-photo">
                    <Image
                      src={`/img/players/${p.slug}.png`}
                      alt={p.name}
                      fill
                      sizes="200px"
                      style={{ objectFit: "cover" }}
                    />
                  </div>
                  <div className="mt-3">
                    <div className="team-preview-name">{p.name}</div>
                    <div className="team-preview-meta mt-1">
                      {p.position}
                      {p.jerseyNumber ? ` · #${p.jerseyNumber}` : ""}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* ── UPCOMING EVENTS ── */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <Container>
          <ScrollReveal>
            <span className="kicker kicker-bright">Season</span>
            <div className="flex items-end justify-between flex-wrap gap-4 mt-3">
              <h2 className="page-title">Upcoming Events</h2>
              <Link href="/schedule" className="btn">
                Full Schedule
              </Link>
            </div>
            <div className="section-rule mt-8" />
          </ScrollReveal>

          <div className="mt-10 flex flex-col gap-4">
            {upcomingEvents.map((evt, i) => {
              const d = new Date(evt.date + "T00:00:00");
              const month = d.toLocaleString("en-US", { month: "short" });
              const day = d.getDate();

              return (
                <ScrollReveal key={evt.id} delay={i * 80}>
                  <div className="event-card">
                    <div className="event-date-block">
                      <div className="event-date-month">{month}</div>
                      <div className="event-date-day">{day}</div>
                    </div>
                    <div>
                      <div className="card-title">{evt.name}</div>
                      <div className="card-sub mt-1">{evt.location}</div>
                    </div>
                    <div className="event-badge upcoming">
                      <span className="dot" />
                      Upcoming
                    </div>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </Container>
      </section>
    </main>
  );
}

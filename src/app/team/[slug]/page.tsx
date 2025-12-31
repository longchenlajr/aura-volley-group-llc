import Container from "@/components/Container";
import Image from "next/image";
import Link from "next/link";
import { getPlayerBySlug } from "@/lib/content";
import { players } from "@/content/players";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return players.map((player) => ({ slug: player.slug }));
}

export default async function PlayerProfile({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const player = getPlayerBySlug(slug);
  if (!player) return notFound();

  return (
    <main className="light-page">
      <section className="pt-16 pb-14">
        <Container>
          {/* top nav back */}
          <div className="flex items-center justify-between">
            <Link href="/team" className="light-kicker">
              ← Back to Team
            </Link>
            <div className="light-kicker">Profile</div>
          </div>

          <div className="mt-10 player-shell">
            {/* left: photo */}
            <div className="player-photo">
              <div
                style={{ position: "relative", width: "100%", height: "100%" }}
              >
                <Image
                  src={`/img/players/${player.slug}.png`}
                  alt={player.name}
                  fill
                  sizes="(max-width: 1024px) 92vw, 420px"
                  style={{ objectFit: "cover" }}
                  priority
                />
              </div>
            </div>

            {/* right: content */}
            <div className="player-panel">
              <div className="light-kicker">{player.role ?? "Player"}</div>
              <h1 className="player-title mt-4">{player.name}</h1>

              <div className="mt-6 light-rule" />

              <p className="light-sub mt-6">
                {player.bio ?? "Aura Volley Group."}
              </p>

              <div className="mt-10">
                <div className="light-kicker">Social</div>
                <div
                  className="mt-3"
                  style={{
                    fontFamily: '"EastmanGrotesque", system-ui, sans-serif',
                  }}
                >
                  {player.socials?.instagram ? (
                    <span className="light-muted">
                      @{player.socials.instagram}
                    </span>
                  ) : (
                    <span className="light-muted">Coming soon.</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-14 light-rule" />
          <div className="pt-8 pb-10 text-center">
            <div className="landing-footer">
              © {new Date().getFullYear()} Aura Volley Group LLC
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}

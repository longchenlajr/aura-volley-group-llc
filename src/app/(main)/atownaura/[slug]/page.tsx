import Container from "@/components/Container";
import Image from "next/image";
import { getPlayerBySlug } from "@/lib/content";
import { players } from "@/content/players";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return players.map((player) => ({ slug: player.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const player = getPlayerBySlug(slug);
  return { title: player?.name ?? "Player" };
}

function Stat({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  if (!value || value === "" || value === 1) return null;
  return (
    <div>
      <div className="kicker">{label}</div>
      <div className="player-stat-value">{value}</div>
    </div>
  );
}

function BulletList({
  title,
  items,
}: {
  title: string;
  items?: string[];
}) {
  const list = (items ?? []).filter(Boolean);
  if (!list.length) return null;
  return (
    <div className="player-block">
      <div className="kicker">{title}</div>
      <ul className="player-list mt-3">
        {list.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

function Social({
  label,
  handle,
  href,
}: {
  label: string;
  handle?: string;
  href?: string;
}) {
  if (!handle) return null;
  return (
    <a className="player-social" href={href} target="_blank" rel="noreferrer">
      <span className="player-social-label">{label}</span>
      <span className="player-social-handle">@{handle}</span>
    </a>
  );
}

export default async function PlayerProfile({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const player = getPlayerBySlug(slug);
  if (!player) return notFound();

  const headshotSrc = player.headshot || `/img/players/${player.slug}.png`;

  const instagramHref = player.socials?.instagram
    ? `https://instagram.com/${player.socials.instagram}`
    : undefined;
  const tiktokHref = player.socials?.tiktok
    ? `https://www.tiktok.com/@${player.socials.tiktok}`
    : undefined;

  const hasHistory =
    (player.teamsPlayed ?? []).filter(Boolean).length > 0 ||
    (player.teamsCoached ?? []).filter(Boolean).length > 0 ||
    (player.careerHighlights ?? []).length > 0;

  return (
    <main>
      <section className="page-header pb-0">
        <Container>
          <div className="player-shell">
            {/* Photo */}
            <div className="player-photo">
              <div style={{ position: "relative", width: "100%", height: "100%" }}>
                <Image
                  src={headshotSrc}
                  alt={player.name}
                  fill
                  sizes="(max-width: 1024px) 92vw, 420px"
                  style={{ objectFit: "cover" }}
                  priority
                />
              </div>
            </div>

            {/* Panel */}
            <div className="player-panel">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="kicker">
                  {player.position}
                  {player.jerseyNumber && player.jerseyNumber !== 1 && (
                    <span style={{ color: "var(--muted-2)" }}>
                      {" "}· #{player.jerseyNumber}
                    </span>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Social
                    label="Instagram"
                    handle={player.socials?.instagram}
                    href={instagramHref}
                  />
                  <Social
                    label="TikTok"
                    handle={player.socials?.tiktok}
                    href={tiktokHref}
                  />
                </div>
              </div>

              <h1 className="player-title mt-4">{player.name}</h1>
              {player.nickname && (
                <div className="player-nickname mt-1">"{player.nickname}"</div>
              )}

              <div className="section-rule mt-6" />

              <div className="player-stats mt-6">
                <Stat label="Height" value={player.height} />
                <Stat
                  label="College"
                  value={
                    player.college && player.gradYear && player.gradYear !== 1
                      ? `${player.college} · ${player.gradYear}`
                      : player.college || undefined
                  }
                />
                <Stat label="Profession" value={player.profession} />
                <Stat label="Favorite Movie" value={player.favoriteMovie} />
                <Stat label="Favorite Court Shoes" value={player.favoriteShoe} />
              </div>
            </div>
          </div>

          {/* History sections */}
          {hasHistory && (
            <div className="player-grid mt-8 pb-20">
              <BulletList title="Player History" items={player.teamsPlayed} />
              <BulletList title="Coaching History" items={player.teamsCoached} />
              {(player.careerHighlights ?? []).length > 0 && (
                <div className="player-grid-span">
                  <BulletList
                    title="Career Highlights"
                    items={player.careerHighlights}
                  />
                </div>
              )}
            </div>
          )}
        </Container>
      </section>
    </main>
  );
}

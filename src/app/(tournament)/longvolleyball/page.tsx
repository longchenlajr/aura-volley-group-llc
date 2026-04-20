import { getUpcomingTournaments } from "@/lib/tournaments";
import Link from "next/link";
import { ArrowRight } from "../ornaments";
import { DecorativeAsset } from "../DecorativeAsset";
import { TournamentPicker } from "../TournamentPicker";

export const dynamic = "force-dynamic";
export const metadata = { title: { absolute: "Home | Long Volleyball" } };

export default function TournamentsPage() {
  const tournaments = getUpcomingTournaments();

  return (
    <>
      {/* ====== HERO — layered decorative composition ====== */}
      <section className="lv-hero">
        {/* Decorative layer (z-index: 0) */}
        <DecorativeAsset
          src="dragon-head.png"
          className="lv-decor lv-decor-dragon"
          width={420}
          height={420}
          priority
        />
        <DecorativeAsset
          src="cloud-1.png"
          className="lv-decor lv-decor-cloud1"
          width={200}
          height={120}
        />
        <DecorativeAsset
          src="cloud-2.png"
          className="lv-decor lv-decor-cloud2"
          width={280}
          height={160}
        />
        <DecorativeAsset
          src="blossom-branch.png"
          className="lv-decor lv-decor-blossom-branch"
          width={180}
          height={200}
        />
        <DecorativeAsset
          src="corner-flourish.png"
          className="lv-decor lv-decor-corner lv-decor-corner-bl"
          width={80}
          height={80}
        />
        <DecorativeAsset
          src="corner-flourish.png"
          className="lv-decor lv-decor-corner lv-decor-corner-br"
          width={80}
          height={80}
        />

        {/* Mobile dragon — block, not absolute */}
        <DecorativeAsset
          src="dragon-head.png"
          className="lv-hero-mobile-dragon"
          width={240}
          height={240}
          priority
        />

        {/* Text content (z-index: 1) */}
        <div className="lv-container lv-hero-content">
          <p className="lv-label lv-hero-label">
            2026 Summer Tournament Series
          </p>
          <h1 className="lv-display lv-hero-heading">
            The Long&rsquo;s Grass Volleyball
          </h1>
          <p className="lv-hero-sub">
            Doubles and triples grass tournaments in Allentown, PA. Cash prizes
            to Gold & Silver bracket winners and runners-up.
          </p>
          <Link
            href="/longvolleyball/register"
            className="lv-btn lv-btn-primary"
          >
            Register for a tournament
            <ArrowRight
              className="lv-btn-arrow"
              style={{ width: 16, height: 16 }}
            />
          </Link>
          <div className="lv-hero-divider" />
        </div>
      </section>

      {/* ====== TOURNAMENT PICKER ====== */}
      <section className="lv-section" id="tournaments">
        <div className="lv-container">
          {/* Divider image */}
          <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            <DecorativeAsset
              src="divider.png"
              className="lv-divider-img"
              width={280}
              height={24}
            />
          </div>

          {/* Heading with cloud behind */}
          <div className="lv-heading-wrap">
            <h2 className="lv-h1 lv-section-heading">Tournament Dates</h2>
            <br></br>
            <DecorativeAsset
              src="cloud-3.png"
              className="lv-heading-cloud"
              width={100}
              height={60}
            />
          </div>

          <TournamentPicker tournaments={tournaments} />
        </div>
      </section>

      {/* ====== ABOUT — warmer parchment band ====== */}
      <div className="lv-about-band">
        {/* Background decorations */}
        <DecorativeAsset
          src="dragon-coil.png"
          className="lv-about-dragon-coil"
          width={320}
          height={400}
        />
        <DecorativeAsset
          src="cloud-2.png"
          className="lv-about-cloud"
          width={180}
          height={100}
        />

        <section className="lv-section">
          <div
            className="lv-container"
            style={{ position: "relative", zIndex: 1 }}
          >
            <h2 className="lv-about-heading">Our family tradition</h2>
            <div className="lv-about">
              <div>
                <p className="lv-about-text">
                  For years, the Long family has been bringing the Lehigh Valley
                  volleyball community together through fun, competitive events.
                  What started with Chenla and Dalin's love for the game is now
                  a shared tradition with their six children — Chenla Jr, Thor,
                  Kalliyana, Calvin, Heng, and Lakana. Real competition, real
                  cash prizes, open to anyone who wants to play.
                </p>
              </div>
              <div className="lv-facts">
                <div className="lv-fact">
                  <div className="lv-fact-content">
                    <span className="lv-fact-label">Location</span>
                    <span className="lv-fact-value">
                      515 South Ott Street, Allentown, PA 18104
                    </span>
                  </div>
                </div>
                <div className="lv-fact">
                  <div className="lv-fact-content">
                    <span className="lv-fact-label">Formats</span>
                    <span className="lv-fact-value">Doubles and triples</span>
                  </div>
                </div>
                <div className="lv-fact">
                  <div className="lv-fact-content">
                    <span className="lv-fact-label">Entry fee</span>
                    <span className="lv-fact-value">
                      $25 per player ($50 doubles, $75 triples)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

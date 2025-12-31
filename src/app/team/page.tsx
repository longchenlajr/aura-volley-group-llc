import RunwayCarousel from "@/components/RunwayCarousel";
import { players } from "@/content/players";

export default function TeamPage() {
  return (
    <main className="team-page">
      <section className="team-layout">
        <header className="team-container team-header">
          <div className="light-kicker">Team</div>
          <h1 className="light-h1 mt-6">A-Town Aura</h1>
          <p className="light-sub mt-5">
            The lineup. Corporate tanks by day, clip farmers by night.
          </p>
        </header>

        <div className="team-container team-mid">
          <RunwayCarousel players={players as any} />
        </div>
      </section>
    </main>
  );
}

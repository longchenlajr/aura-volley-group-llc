import { SectionDivider } from "../../ornaments";

export default function RulesPage() {
  return (
    <div className="lv-rules-page">
      <div className="lv-container">
        {/* Header */}
        <div className="lv-live-header">
          <p className="lv-label" style={{ color: "var(--lv-red)", marginBottom: "0.5rem" }}>
            Rules
          </p>
          <h1
            className="lv-h1"
            style={{
              fontSize: "clamp(2.5rem, 8vw, 4.5rem)",
              fontWeight: 900,
              letterSpacing: "-0.025em",
              lineHeight: 1.05,
            }}
          >
            Tournament Guidelines
          </h1>
          <p
            style={{
              fontFamily: "var(--lv-font-body)",
              fontSize: "0.6rem",
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              color: "var(--lv-gold)",
              opacity: 0.8,
              marginTop: "0.875rem",
            }}
          >
            The law of the court.
          </p>
          <div style={{ marginTop: "1.5rem" }}>
            <SectionDivider
              className="lv-section-divider"
              style={{ color: "var(--lv-gold)", opacity: 0.5 }}
            />
          </div>
        </div>

        {/* ── GENERAL ── */}
        <div className="lv-rules-section">
          <h2 className="lv-rules-heading">General</h2>
          <ul className="lv-rules-list">
            <li>
              This is a family-friendly environment. No swearing, and be
              respectful of all players, spectators, and neighbors.
            </li>
            <li>
              Registration starts at <strong>9:00 AM</strong>. Games begin at{" "}
              <strong>10:00 AM</strong> or earlier if all teams are accounted
              for.
            </li>
            <li>
              Entry fee is <strong>$25 per player</strong>. Cash is preferred,
              but other payment methods will be available.
            </li>
            <li>
              All participants must sign a waiver before the start of their
              first match.
            </li>
            <li>
              Drinks and snacks will be sold throughout the day, with pizza
              available during lunch.
            </li>
          </ul>
        </div>

        {/* ── GAMEPLAY ── */}
        <div className="lv-rules-section">
          <h2 className="lv-rules-heading">Gameplay</h2>
          <ul className="lv-rules-list">
            <li>
              Each team has <strong>3 touches</strong> to return the ball over
              the net.
            </li>
            <li>
              Players may assume any position on the court at any time, but{" "}
              <strong>serving order must remain consistent</strong> for the
              entire set. If a team is caught serving out of order, they forfeit
              possession of the serve.
            </li>
          </ul>

          {/* Hand contact rules */}
          <h3 className="lv-rules-subheading">Open-hand contact</h3>
          <div className="lv-rules-callout">
            <div className="lv-rules-callout-section">
              <span className="lv-rules-callout-label">
                1st contact (receive)
              </span>
              <p>
                Open hand is <strong>not allowed</strong> unless receiving a
                hard-driven ball with no arc in the trajectory. Open hand
                recieving a serve is <strong>never</strong> allowed.
              </p>
            </div>
            <div className="lv-rules-callout-section">
              <span className="lv-rules-callout-label">2nd contact (set)</span>
              <p>
                Open hand <strong>is allowed</strong> unless the set is called a
                double by the work team, or the ball crosses the net without a
                teammate contacting it first.
              </p>
            </div>
            <div className="lv-rules-callout-section">
              <span className="lv-rules-callout-label">
                3rd contact (attack)
              </span>
              <p>
                Setting over the net is <strong>never</strong> allowed. Tips
                are <strong>never</strong> allowed.
              </p>
            </div>
          </div>

          {/* Grass vs Beach */}
          <h3 className="lv-rules-subheading">Scoring &amp; block rules</h3>
          <div className="lv-rules-variants">
            <div className="lv-rules-variant-card">
              <span className="lv-rules-variant-badge lv-rules-variant-badge--grass">
                Grass
              </span>
              <ul className="lv-rules-list">
                <li>
                  <strong>Side-out scoring</strong> &mdash; only the serving
                  team can score a point.
                </li>
                <li>
                  A block touch <strong>does not</strong> count toward a
                  team&rsquo;s 3 touches.
                </li>
              </ul>
            </div>
            <div className="lv-rules-variant-card">
              <span className="lv-rules-variant-badge lv-rules-variant-badge--beach">
                Beach
              </span>
              <ul className="lv-rules-list">
                <li>
                  <strong>Rally scoring</strong> &mdash; a point is awarded at
                  the end of every rally.
                </li>
                <li>
                  A block touch <strong>counts as</strong> the team&rsquo;s
                  first touch.
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* ── WORK TEAMS ── */}
        <div className="lv-rules-section">
          <h2 className="lv-rules-heading">Work teams</h2>
          <ul className="lv-rules-list">
            <li>
              Every team has assigned matches in pool play they must work. The
              penalty for missing or being late to a work assignment is at the
              discretion of the tournament directors and may include a penalty
              toward your next match.
            </li>
            <li>
              Scores must be recorded <strong>live during the match</strong>,
              not after the game concludes. Score keeping links can be found in
              your pool schedule at <strong>longvolleyball.com/live</strong>.
              These links are only accessible by the team scheduled to work.
            </li>
            <li>
              Work teams are responsible for ensuring games are operating timely
              and in compliance with all rules on this page.
            </li>
            <li>
              All conflicts are to be resolved at the{" "}
              <strong>full discretion of the work team</strong>. If a resolution
              cannot be reached, find a tournament director.
            </li>
          </ul>
        </div>

        {/* ── POOL PLAY ── */}
        <div className="lv-rules-section">
          <h2 className="lv-rules-heading">Pool play format</h2>
          <p className="lv-rules-intro">
            Match length and scoring depend on pool size. All sets use{" "}
            <strong>win-by-2</strong> rules until the cap, at which point{" "}
            <strong>win-by-1</strong> takes effect.
          </p>
          <div className="lv-rules-table-wrap">
            <table className="lv-rules-table">
              <thead>
                <tr>
                  <th>Pool size</th>
                  <th>Match</th>
                  <th>Cap</th>
                  <th>Switch sides</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>3 teams</td>
                  <td>2 sets to 15</td>
                  <td>17</td>
                  <td>Every 5 pts</td>
                </tr>
                <tr>
                  <td>4 teams</td>
                  <td>2 sets to 15</td>
                  <td>17</td>
                  <td>Every 5 pts</td>
                </tr>
                <tr>
                  <td>5 teams</td>
                  <td>2 sets to 11</td>
                  <td>13</td>
                  <td>Every 4 pts</td>
                </tr>
                <tr>
                  <td>6 teams</td>
                  <td>1 set to 15</td>
                  <td>17</td>
                  <td>Every 5 pts</td>
                </tr>
                <tr>
                  <td>7 teams</td>
                  <td>1 set to 11</td>
                  <td>13</td>
                  <td>Every 4 pts</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── PLAYOFFS ── */}
        <div className="lv-rules-section">
          <h2 className="lv-rules-heading">Playoffs</h2>
          <ul className="lv-rules-list">
            <li>
              Playoff matches are <strong>1 set to 15 or 11</strong>, depending
              on time and bracket size. <strong>No score cap</strong> &mdash;
              win by 2 until it&rsquo;s over.
            </li>
            <li>
              After the first round, the{" "}
              <strong>loser of a match works the next match</strong> on that
              court. If no further matches remain on that court, they are free
              to leave.
            </li>
            <li>
              When two matches from the same side of the bracket are played on
              one court, the loser of the <strong>second match</strong> works
              the following match.
            </li>
            <li>
              Play and work assignments will be updated as games complete on the
              online bracket.
            </li>
            <li>
              Prizes are awarded to the <strong>winner and runner-up</strong> of
              both the Gold and Silver brackets.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

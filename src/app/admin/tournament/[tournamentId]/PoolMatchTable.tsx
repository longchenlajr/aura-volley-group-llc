"use client";

import type { MatchData } from "./types";

interface PoolMatchTableProps {
  matches: MatchData[];
  withdrawnTeamIds: Set<string>;
  onOverrideScore: (matchId: string) => void;
  onCopyScoreLink: (token: string) => void;
  onSwapMatchOrder: (matchId: string, direction: "up" | "down") => void;
}

export function PoolMatchTable({
  matches,
  withdrawnTeamIds,
  onOverrideScore,
  onCopyScoreLink,
  onSwapMatchOrder,
}: PoolMatchTableProps) {
  const sorted = [...matches].sort((a, b) => a.match.match_order - b.match.match_order);

  function teamDisplay(name: string, id: string, seed: number) {
    const isWithdrawn = withdrawnTeamIds.has(id);
    return (
      <>
        {name} <span style={{ color: "var(--lv-ink-muted)", fontSize: "0.7rem" }}>(#{seed})</span>
        {isWithdrawn && <span className="withdrawn-tag"> (withdrawn)</span>}
      </>
    );
  }

  function isForfeit(m: MatchData) {
    return m.sets.some((s) => (s as { is_forfeit?: boolean }).is_forfeit);
  }

  function statusTag(m: MatchData) {
    if (m.match.status === "in_progress") {
      return <span className="lv-match-tag lv-match-tag--live">Live</span>;
    }
    if (m.match.status === "complete") {
      if (isForfeit(m)) {
        return <span className="lv-match-tag lv-match-tag--forfeit">Forfeit</span>;
      }
      return <span className="lv-match-tag lv-match-tag--final">Final</span>;
    }
    return <span className="lv-match-tag lv-match-tag--scheduled">Scheduled</span>;
  }

  function scoreDisplay(m: MatchData) {
    if (m.sets.length === 0) return <span style={{ color: "var(--lv-ink-muted)" }}>&mdash;</span>;

    const setScores = [...m.sets]
      .sort((a, b) => a.set_number - b.set_number)
      .map((s) => `${s.team_a_score}-${s.team_b_score}`)
      .join(", ");

    // Point differential
    const totalA = m.sets.reduce((sum, s) => sum + s.team_a_score, 0);
    const totalB = m.sets.reduce((sum, s) => sum + s.team_b_score, 0);
    const diff = totalA - totalB;
    const diffStr = diff >= 0 ? `+${diff}` : `${diff}`;

    return (
      <span className="lv-match-score">
        {setScores}
        {m.sets.length > 1 && (
          <span style={{ fontSize: "0.7rem", color: "var(--lv-ink-muted)", fontWeight: 500, marginLeft: 4 }}>
            &middot; {diffStr}
          </span>
        )}
      </span>
    );
  }

  return (
    <div className="lv-match-list">
      {sorted.map((m, idx) => {
        const rowClass = [
          "lv-match-row",
          m.match.status === "in_progress" ? "lv-match-row--live" : "",
          m.match.status === "complete" ? "lv-match-row--complete" : "",
        ].filter(Boolean).join(" ");

        return (
          <div key={m.match.id} className={rowClass}>
            <span className="lv-match-num">{m.match.match_order}</span>
            <span className="lv-match-teams">
              {teamDisplay(m.team_a.team_name, m.team_a.id, m.team_a.seed_in_pool)}
              {" vs "}
              {teamDisplay(m.team_b.team_name, m.team_b.id, m.team_b.seed_in_pool)}
            </span>
            {m.work_team && (
              <span className="lv-match-work">
                Work: {m.work_team.team_name}
                {withdrawnTeamIds.has(m.work_team.id) && (
                  <span className="withdrawn-tag"> (withdrawn)</span>
                )}
              </span>
            )}
            {scoreDisplay(m)}
            {statusTag(m)}
            <div className="lv-match-actions">
              {/* Override score */}
              <button
                className="lv-admin-action-btn"
                title="Override score"
                onClick={() => onOverrideScore(m.match.id)}
                aria-label="Override score"
              >
                <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13.5 3.5l3 3L7 16H4v-3L13.5 3.5z" />
                </svg>
              </button>
              {/* Copy score link */}
              {m.token && (
                <button
                  className="lv-admin-action-btn"
                  title="Copy score link"
                  onClick={() => onCopyScoreLink(m.token!)}
                  aria-label="Copy score link"
                >
                  <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="8" y="8" width="10" height="10" rx="2" /><path d="M4 12H3a1 1 0 01-1-1V3a1 1 0 011-1h8a1 1 0 011 1v1" />
                  </svg>
                </button>
              )}
              {/* Swap up */}
              <button
                className="lv-admin-action-btn"
                onClick={() => onSwapMatchOrder(m.match.id, "up")}
                disabled={idx === 0}
                aria-label="Move up"
                style={idx === 0 ? { opacity: 0.25 } : undefined}
              >
                <svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M10 4v12M10 4l4 4M10 4l-4 4" />
                </svg>
              </button>
              {/* Swap down */}
              <button
                className="lv-admin-action-btn"
                onClick={() => onSwapMatchOrder(m.match.id, "down")}
                disabled={idx === sorted.length - 1}
                aria-label="Move down"
                style={idx === sorted.length - 1 ? { opacity: 0.25 } : undefined}
              >
                <svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M10 16V4M10 16l4-4M10 16l-4-4" />
                </svg>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

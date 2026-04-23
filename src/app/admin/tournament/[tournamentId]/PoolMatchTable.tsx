"use client";

import type { MatchData } from "./types";

interface PoolMatchTableProps {
  matches: MatchData[];
  withdrawnTeamIds: Set<string>;
  overallSeeds: Map<string, number>;
  onOverrideScore: (matchId: string) => void;
  onResetScores: (matchId: string) => void;
  onCopyScoreLink: (token: string) => void;
  onSwapMatchOrder: (matchId: string, direction: "up" | "down") => void;
}

function computeOutcome(m: MatchData): { label: string; type: "win" | "split" | "pending" } {
  if (m.match.status !== "complete" || m.sets.length === 0) return { label: "", type: "pending" };

  const setsWonA = m.sets.filter((s) => s.team_a_score > s.team_b_score).length;
  const setsWonB = m.sets.filter((s) => s.team_b_score > s.team_a_score).length;

  const totalA = m.sets.reduce((sum, s) => sum + s.team_a_score, 0);
  const totalB = m.sets.reduce((sum, s) => sum + s.team_b_score, 0);
  const diff = Math.abs(totalA - totalB);

  if (m.sets.length >= 2 && setsWonA === setsWonB) {
    const winner = totalA > totalB ? m.team_a.team_name : m.team_b.team_name;
    return { label: `SPLIT · ${winner} win +${diff}`, type: "split" };
  }

  const winner = totalA > totalB ? m.team_a.team_name : m.team_b.team_name;
  return { label: `${winner} win +${diff}`, type: "win" };
}

export function PoolMatchTable({
  matches,
  withdrawnTeamIds,
  overallSeeds,
  onOverrideScore,
  onResetScores,
  onCopyScoreLink,
  onSwapMatchOrder,
}: PoolMatchTableProps) {
  // If a match is live, it goes first. Otherwise next upcoming goes first.
  // Then completed (most recent first), then remaining scheduled.
  const sorted = (() => {
    const live = matches.filter((m) => m.match.status === "in_progress").sort((a, b) => a.match.match_order - b.match.match_order);
    const scheduled = matches.filter((m) => m.match.status === "scheduled").sort((a, b) => a.match.match_order - b.match.match_order);
    const complete = matches.filter((m) => m.match.status === "complete").sort((a, b) => b.match.match_order - a.match.match_order);
    const top = live.length > 0 ? live : scheduled.slice(0, 1);
    const restScheduled = live.length > 0 ? scheduled : scheduled.slice(1);
    return [...top, ...complete, ...restScheduled];
  })();

  function teamDisplay(name: string, id: string) {
    const isWithdrawn = withdrawnTeamIds.has(id);
    const seed = overallSeeds.get(id);
    return (
      <>
        {seed != null && <span className="lv-match-seed">({seed})</span>}
        {" "}{name}
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
    if (m.sets.length === 0) return null;

    const setScores = [...m.sets]
      .sort((a, b) => a.set_number - b.set_number)
      .map((s) => `${s.team_a_score}-${s.team_b_score}`)
      .join(", ");

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

  function actionButtons(m: MatchData, idx: number) {
    return (
      <div className="lv-match-actions">
        <button className="lv-admin-action-btn" title="Override score" onClick={() => onOverrideScore(m.match.id)} aria-label="Override score">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13.5 3.5l3 3L7 16H4v-3L13.5 3.5z" /></svg>
        </button>
        {m.sets.length > 0 && (
          <button className="lv-admin-action-btn lv-admin-action-btn-danger" title="Erase scores" onClick={() => onResetScores(m.match.id)} aria-label="Erase scores">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 5H6.5l-4 5 4 5H18V5z" /><path d="M12 9l-3 3m0-3l3 3" /></svg>
          </button>
        )}
        {m.token && (
          <button className="lv-admin-action-btn" title="Copy score link" onClick={() => onCopyScoreLink(m.token!)} aria-label="Copy score link">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="8" width="10" height="10" rx="2" /><path d="M4 12H3a1 1 0 01-1-1V3a1 1 0 011-1h8a1 1 0 011 1v1" /></svg>
          </button>
        )}
        <button className="lv-admin-action-btn" onClick={() => onSwapMatchOrder(m.match.id, "up")} disabled={idx === 0} aria-label="Move up" style={idx === 0 ? { opacity: 0.25 } : undefined}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 4v12M10 4l4 4M10 4l-4 4" /></svg>
        </button>
        <button className="lv-admin-action-btn" onClick={() => onSwapMatchOrder(m.match.id, "down")} disabled={idx === sorted.length - 1} aria-label="Move down" style={idx === sorted.length - 1 ? { opacity: 0.25 } : undefined}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 16V4M10 16l4-4M10 16l-4-4" /></svg>
        </button>
      </div>
    );
  }

  return (
    <div className="lv-match-list">
      {sorted.map((m, idx) => {
        const outcome = computeOutcome(m);
        return (
          <div
            key={m.match.id}
            className={[
              "lv-match-row",
              m.match.status === "in_progress" ? "lv-match-row--live" : "",
              m.match.status === "complete" ? "lv-match-row--complete" : "",
            ].filter(Boolean).join(" ")}
          >
            {/* Desktop layout */}
            <div className="lv-match-desktop">
              <span className="lv-match-num">{m.match.match_order}</span>
              <span className="lv-match-teams">
                {teamDisplay(m.team_a.team_name, m.team_a.id)}
                {" vs "}
                {teamDisplay(m.team_b.team_name, m.team_b.id)}
              </span>
              {m.work_team && (
                <span className="lv-match-work">
                  Work: {m.work_team.team_name}
                  {withdrawnTeamIds.has(m.work_team.id) && <span className="withdrawn-tag"> (withdrawn)</span>}
                </span>
              )}
              {scoreDisplay(m) ?? <span className="lv-match-score" style={{ color: "var(--lv-ink-muted)" }}>&mdash;</span>}
              {statusTag(m)}
              {actionButtons(m, idx)}
            </div>

            {/* Mobile card — matches live match card layout */}
            <div className="lv-match-card-mobile">
              <div className="lv-match-card-top">
                <span className="lv-match-card-num">Match {m.match.match_order}</span>
                {m.match.status === "in_progress" && <span className="lv-status-tag lv-status-tag--live" style={{ fontSize: "8px" }}>Live</span>}
                {m.match.status === "complete" && <span className="lv-match-card-final">Final</span>}
                {m.match.status === "scheduled" && <span className="lv-match-card-scheduled">Upcoming</span>}
              </div>

              <div className="lv-match-card-teams">
                <span className="lv-match-card-team">{teamDisplay(m.team_a.team_name, m.team_a.id)}</span>
                <span className="lv-match-card-vs">vs</span>
                <span className="lv-match-card-team">{teamDisplay(m.team_b.team_name, m.team_b.id)}</span>
              </div>

              {m.sets.length > 0 && (
                <div className="lv-match-card-scores">
                  {[...m.sets]
                    .sort((a, b) => a.set_number - b.set_number)
                    .map((s, i) => (
                      <span key={i} className="lv-match-card-set">
                        {m.sets.length > 1 && <span className="lv-match-card-set-label">S{s.set_number}</span>}
                        {s.team_a_score}&ndash;{s.team_b_score}
                      </span>
                    ))}
                </div>
              )}

              {outcome.type !== "pending" && (
                <div className={`lv-match-card-outcome lv-match-card-outcome--${outcome.type}`}>
                  {outcome.label}
                </div>
              )}

              {m.work_team && (
                <div className="lv-match-card-work">
                  Scorekeeper: {m.work_team.team_name}
                  {withdrawnTeamIds.has(m.work_team.id) && <span className="withdrawn-tag"> (withdrawn)</span>}
                </div>
              )}

              <div className="lv-match-card-admin-actions">
                {actionButtons(m, idx)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

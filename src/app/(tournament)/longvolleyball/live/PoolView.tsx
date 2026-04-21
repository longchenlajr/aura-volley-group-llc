"use client";

import { useState } from "react";
import type { PoolStandings } from "@/lib/standings";
import { ScoreLinkModal } from "./ScoreLinkModal";

interface MatchDisplay {
  match_id: string;
  match_order: number;
  court_number: number;
  status: string;
  team_a: string;
  team_b: string;
  work_team: string | null;
  sets: Array<{ set_number: number; team_a_score: number; team_b_score: number }>;
}

interface TeamSeed {
  team_name: string;
  seed: number;
  record: string;
}

interface Props {
  pool: PoolStandings;
  matches: MatchDisplay[];
  totalMatches: number;
  completeMatches: number;
  teamSeeds: Map<string, TeamSeed>;
}

function computeOutcome(m: MatchDisplay): { label: string; type: "win" | "split" | "pending" } {
  if (m.status !== "complete" || m.sets.length === 0) return { label: "", type: "pending" };

  const setsWonA = m.sets.filter((s) => s.team_a_score > s.team_b_score).length;
  const setsWonB = m.sets.filter((s) => s.team_b_score > s.team_a_score).length;

  const totalA = m.sets.reduce((sum, s) => sum + s.team_a_score, 0);
  const totalB = m.sets.reduce((sum, s) => sum + s.team_b_score, 0);
  const diff = Math.abs(totalA - totalB);

  if (m.sets.length >= 2 && setsWonA === setsWonB) {
    // Split sets — cumulative decides
    const winner = totalA > totalB ? m.team_a : m.team_b;
    return { label: `SPLIT · ${winner} win +${diff}`, type: "split" };
  }

  // Clear winner
  const winner = totalA > totalB ? m.team_a : m.team_b;
  return { label: `${winner} win +${diff}`, type: "win" };
}

export function PoolView({ pool, matches, totalMatches, completeMatches, teamSeeds }: Props) {
  const [scoreLinkMatch, setScoreLinkMatch] = useState<{ matchId: string; workTeamName: string } | null>(null);

  // Reverse order: most recent (highest match_order complete first), then in-progress, then scheduled
  const sorted = [...matches].sort((a, b) => {
    const statusOrder = (s: string) => s === "complete" ? 0 : s === "in_progress" ? 1 : 2;
    const sa = statusOrder(a.status);
    const sb = statusOrder(b.status);
    if (sa !== sb) return sa - sb;
    // Within same status: complete → highest match_order first; others → lowest first
    if (a.status === "complete") return b.match_order - a.match_order;
    return a.match_order - b.match_order;
  });

  return (
    <div>
      {/* Pool header */}
      <div className="lv-pool-view-header">
        <h2 className="lv-pool-view-title">Pool {pool.pool_label} · Court {pool.court_number}</h2>
        <p className="lv-pool-view-meta">
          {pool.standings.length} teams · {completeMatches} of {totalMatches} matches complete
        </p>
      </div>

      {/* Standings */}
      <div className="lv-pool-view-standings">
        <table className="lv-overview-table">
<thead>
            <tr>
              <th>Rank</th>
              <th>Team</th>
              <th>W-L</th>
              <th>Sets</th>
              <th>+/-</th>
            </tr>
          </thead>
          <tbody>
            {pool.standings.map((t, i) => (
              <tr key={t.team_id} className={i === 0 ? "lv-overview-row-first" : ""}>
                <td className="lv-overview-rank">{i + 1}</td>
                <td className="lv-overview-name">({teamSeeds.get(t.team_id)?.seed ?? t.seed_in_pool}) {t.team_name}</td>
                <td>{t.matches_won}-{t.matches_lost}</td>
                <td>{t.sets_won}-{t.sets_lost}</td>
                <td className={t.point_differential >= 0 ? "lv-overview-diff-pos" : "lv-overview-diff-neg"}>
                  {t.point_differential >= 0 ? "+" : ""}{t.point_differential}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Match Feed */}
      <div className="lv-pool-view-matches">
        <h3 className="lv-live-section-title">Matches</h3>
        {sorted.map((m) => {
          const outcome = computeOutcome(m);
          return (
            <div key={m.match_id} className={`lv-match-card ${m.status === "in_progress" ? "lv-match-card--live" : ""} ${m.status === "complete" ? "lv-match-card--complete" : ""}`}>
              <div className="lv-match-card-top">
                <span className="lv-match-card-num">Match {m.match_order}</span>
                {m.status === "in_progress" && <span className="lv-status-tag lv-status-tag--live" style={{ fontSize: "8px" }}>Live</span>}
                {m.status === "complete" && <span className="lv-match-card-final">Final</span>}
                {m.status === "scheduled" && <span className="lv-match-card-scheduled">Upcoming</span>}
              </div>

              <div className="lv-match-card-teams">
                <span className="lv-match-card-team">{m.team_a}</span>
                <span className="lv-match-card-vs">vs</span>
                <span className="lv-match-card-team">{m.team_b}</span>
              </div>

              {/* Set scores */}
              {m.sets.length > 0 && (
                <div className="lv-match-card-scores">
                  {m.sets
                    .sort((a, b) => a.set_number - b.set_number)
                    .map((s, i) => (
                      <span key={i} className="lv-match-card-set">
                        {m.sets.length > 1 && <span className="lv-match-card-set-label">S{s.set_number}</span>}
                        {s.team_a_score}–{s.team_b_score}
                      </span>
                    ))}
                </div>
              )}

              {/* Outcome */}
              {outcome.type !== "pending" && (
                <div className={`lv-match-card-outcome lv-match-card-outcome--${outcome.type}`}>
                  {outcome.label}
                </div>
              )}

              {/* Scorekeeper */}
              {m.work_team && (
                <div className="lv-match-card-work">Scorekeeper: {m.work_team}</div>
              )}

              {m.status === "scheduled" && (
                <div className="lv-match-card-pending">Not yet played</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Score link verification modal */}
      {scoreLinkMatch && (
        <ScoreLinkModal
          matchId={scoreLinkMatch.matchId}
          workTeamName={scoreLinkMatch.workTeamName}
          onClose={() => setScoreLinkMatch(null)}
        />
      )}
    </div>
  );
}

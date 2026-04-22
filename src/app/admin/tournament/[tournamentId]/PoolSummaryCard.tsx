"use client";

import { useMemo } from "react";
import { computePoolStandings } from "@/lib/standings";
import { getMatchFormat } from "@/lib/score-format";
import { PoolMatchTable } from "./PoolMatchTable";
import type { MatchData, PoolWithTeams } from "./types";

interface PoolSummaryCardProps {
  pool: PoolWithTeams;
  matches: MatchData[];
  expanded: boolean;
  onToggle: () => void;
  withdrawnTeamIds: Set<string>;
  onSwapTeam: (teamId: string, teamName: string) => void;
  onOverrideScore: (matchId: string) => void;
  onCopyScoreLink: (token: string) => void;
  onSwapMatchOrder: (matchId: string, direction: "up" | "down") => void;
}

export function PoolSummaryCard({
  pool,
  matches,
  expanded,
  onToggle,
  withdrawnTeamIds,
  onSwapTeam,
  onOverrideScore,
  onCopyScoreLink,
  onSwapMatchOrder,
}: PoolSummaryCardProps) {
  const format = useMemo(() => getMatchFormat(pool.teams.length), [pool.teams.length]);

  const standings = useMemo(() => {
    const poolTeams = pool.teams
      .filter((t) => !withdrawnTeamIds.has(t.team_id))
      .map((t) => ({
        team_id: t.team_id,
        team_name: t.team_name,
        seed_in_pool: t.seed_in_pool,
      }));
    const matchInputs = matches
      .filter((m) => m.match.status === "complete")
      .map((m) => ({
        id: m.match.id,
        team_a_id: m.team_a.id,
        team_b_id: m.team_b.id,
        sets: m.sets.map((s) => ({ team_a_score: s.team_a_score, team_b_score: s.team_b_score })),
        status: m.match.status,
      }));
    return computePoolStandings(poolTeams, matchInputs, format);
  }, [pool.teams, matches, format, withdrawnTeamIds]);

  const completeCount = matches.filter((m) => m.match.status === "complete").length;
  const totalCount = matches.length;
  const progressPct = totalCount > 0 ? (completeCount / totalCount) * 100 : 0;

  const top2 = standings.slice(0, 2);

  return (
    <div className={`lv-pool-card ${expanded ? "expanded" : ""}`}>
      <button className="lv-pool-card-header" onClick={onToggle}>
        <div className="lv-pool-card-left">
          <div className="lv-pool-card-title">
            Pool {pool.pool.pool_label} &middot; Court {pool.pool.court_number}
          </div>
          <div className="lv-pool-card-progress-text">
            {completeCount} of {totalCount} matches complete
          </div>
          <div className="lv-pool-card-progress-bar">
            <div className="lv-pool-card-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          {!expanded && top2.length > 0 && (
            <div className="lv-pool-card-standings-preview">
              {top2.map((t, i) => (
                <div key={t.team_id} className="lv-pool-card-standing-line">
                  <strong>#{i + 1} {t.team_name}</strong> ({t.matches_won}-{t.matches_lost})
                  {" "}&middot; Sets {t.sets_won}-{t.sets_lost}
                  {" "}&middot; {t.point_differential >= 0 ? "+" : ""}{t.point_differential}
                </div>
              ))}
            </div>
          )}
        </div>
        <svg
          className={`lv-pool-card-chevron ${expanded ? "open" : ""}`}
          width="14" height="14" viewBox="0 0 20 20"
          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 8l4 4 4-4" />
        </svg>
      </button>

      {expanded && (
        <div className="lv-pool-card-body">
          {/* Full standings table */}
          <table className="lv-standings-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Seed</th>
                <th>Team</th>
                <th>W-L</th>
                <th>Sets</th>
                <th>Pt Diff</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {standings.map((t, i) => {
                const poolTeam = pool.teams.find((pt) => pt.team_id === t.team_id);
                const rowClass = i === 0 ? "lv-standings-row-1" : i === 1 ? "lv-standings-row-2" : "";
                return (
                  <tr key={t.team_id} className={rowClass}>
                    <td style={{ fontWeight: 700 }}>{i + 1}</td>
                    <td>#{poolTeam?.overall_seed ?? t.seed_in_pool}</td>
                    <td className="lv-standings-team-name">{t.team_name}</td>
                    <td>{t.matches_won}-{t.matches_lost}</td>
                    <td>{t.sets_won}-{t.sets_lost}</td>
                    <td style={{ color: t.point_differential >= 0 ? "var(--lv-green)" : "var(--lv-error)" }}>
                      {t.point_differential >= 0 ? "+" : ""}{t.point_differential}
                    </td>
                    <td>
                      <button
                        className="lv-standings-swap-btn"
                        onClick={(e) => { e.stopPropagation(); onSwapTeam(t.team_id, t.team_name); }}
                        aria-label={`Swap ${t.team_name}`}
                      >
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 7h12m0 0l-3-3m3 3l-3 3M16 13H4m0 0l3-3m-3 3l3 3" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Match table */}
          <PoolMatchTable
            matches={matches}
            withdrawnTeamIds={withdrawnTeamIds}
            onOverrideScore={onOverrideScore}
            onCopyScoreLink={onCopyScoreLink}
            onSwapMatchOrder={onSwapMatchOrder}
          />
        </div>
      )}
    </div>
  );
}

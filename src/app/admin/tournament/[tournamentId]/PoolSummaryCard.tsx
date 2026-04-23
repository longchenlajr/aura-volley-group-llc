"use client";

import { useMemo, useState } from "react";
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
  onResetScores: (matchId: string) => void;
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
  onResetScores,
  onCopyScoreLink,
  onSwapMatchOrder,
}: PoolSummaryCardProps) {
  const format = useMemo(() => getMatchFormat(pool.teams.length), [pool.teams.length]);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

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
                  <strong>#{i + 1} {t.team_name}</strong> Sets {t.sets_won}-{t.sets_lost}
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
          {/* Standings table — matches live page style */}
          <table className="lv-overview-table lv-admin-standings">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Team</th>
                <th>Set W-L</th>
                <th>+/-</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((t, i) => {
                const poolTeam = pool.teams.find((pt) => pt.team_id === t.team_id);
                const overallSeed = poolTeam?.overall_seed ?? t.seed_in_pool;
                const isExpanded = expandedTeam === t.team_id;
                return (
                  <StandingsRow
                    key={t.team_id}
                    rank={i + 1}
                    seed={overallSeed}
                    standing={t}
                    isFirst={i === 0}
                    isExpanded={isExpanded}
                    onToggle={() => setExpandedTeam(isExpanded ? null : t.team_id)}
                    onSwap={() => onSwapTeam(t.team_id, t.team_name)}
                  />
                );
              })}
            </tbody>
          </table>

          {/* Match table */}
          <PoolMatchTable
            matches={matches}
            withdrawnTeamIds={withdrawnTeamIds}
            overallSeeds={new Map(pool.teams.map((t) => [t.team_id, t.overall_seed]))}
            onOverrideScore={onOverrideScore}
            onResetScores={onResetScores}
            onCopyScoreLink={onCopyScoreLink}
            onSwapMatchOrder={onSwapMatchOrder}
          />
        </div>
      )}
    </div>
  );
}

function StandingsRow({
  rank,
  seed,
  standing: t,
  isFirst,
  isExpanded,
  onToggle,
  onSwap,
}: {
  rank: number;
  seed: number;
  standing: { team_id: string; team_name: string; sets_won: number; sets_lost: number; point_differential: number };
  isFirst: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onSwap: () => void;
}) {
  return (
    <>
      <tr
        className={`${isFirst ? "lv-overview-row-first" : ""} lv-admin-standings-row`}
        onClick={onToggle}
        style={{ cursor: "pointer" }}
      >
        <td className="lv-overview-rank">{rank}</td>
        <td className="lv-overview-name">({seed}) {t.team_name}</td>
        <td>{t.sets_won}-{t.sets_lost}</td>
        <td className={t.point_differential >= 0 ? "lv-overview-diff-pos" : "lv-overview-diff-neg"}>
          {t.point_differential >= 0 ? "+" : ""}{t.point_differential}
        </td>
      </tr>
      {isExpanded && (
        <tr className="lv-admin-standings-expand-row">
          <td colSpan={4}>
            <button
              className="lv-admin-swap-inline-btn"
              onClick={(e) => { e.stopPropagation(); onSwap(); }}
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7h12m0 0l-3-3m3 3l-3 3M16 13H4m0 0l3-3m-3 3l3 3" />
              </svg>
              Swap {t.team_name}
            </button>
          </td>
        </tr>
      )}
    </>
  );
}

"use client";

import React, { useState } from "react";
import type { PoolStandings } from "@/lib/standings";
import { ScoreLinkModal } from "./ScoreLinkModal";
import { SubmitScoresButton } from "./SubmitScoresButton";

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

type RosterMap = Record<string, Array<{ name: string; is_captain: boolean }>>;

interface Props {
  pool: PoolStandings;
  matches: MatchDisplay[];
  totalMatches: number;
  completeMatches: number;
  teamSeeds: Map<string, TeamSeed>;
  rosters?: RosterMap;
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

export function PoolView({ pool, matches, totalMatches, completeMatches, teamSeeds, rosters = {} }: Props) {
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [scoreLinkMatch, setScoreLinkMatch] = useState<{
    matchId: string;
    matchType: "pool" | "bracket";
    workTeamName: string;
  } | null>(null);

  // If a match is live, it goes first. Otherwise next upcoming goes first.
  // Then completed (most recent first), then remaining scheduled.
  const sorted = (() => {
    const live = matches.filter((m) => m.status === "in_progress").sort((a, b) => a.match_order - b.match_order);
    const scheduled = matches.filter((m) => m.status === "scheduled").sort((a, b) => a.match_order - b.match_order);
    const complete = matches.filter((m) => m.status === "complete").sort((a, b) => b.match_order - a.match_order);
    const top = live.length > 0 ? live : scheduled.slice(0, 1);
    const restScheduled = live.length > 0 ? scheduled : scheduled.slice(1);
    return [...top, ...complete, ...restScheduled];
  })();

  function handleOpenModal(matchId: string, matchType: "pool" | "bracket", workTeamName: string) {
    setScoreLinkMatch({ matchId, matchType, workTeamName });
  }

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
              <th>Set W-L</th>
              <th>Set %</th>
              <th>+/-</th>
              <th>Pt %</th>
            </tr>
          </thead>
          <tbody>
            {pool.standings.map((t, i) => {
              const isExpanded = expandedTeam === t.team_id;
              const players = rosters[t.team_id];
              const totalSets = t.sets_won + t.sets_lost;
              const setWinPct = totalSets > 0 ? (t.sets_won / totalSets) * 100 : 0;
              const totalPoints = t.points_for + t.points_against;
              const pointPct = totalPoints > 0 ? (t.points_for / totalPoints) * 100 : 0;
              return (
                <React.Fragment key={t.team_id}>
                  <tr
                    className={`${i === 0 ? "lv-overview-row-first" : ""} lv-overview-row-click ${t.withdrawn ? "lv-overview-row-withdrawn" : ""}`}
                    onClick={() => setExpandedTeam(isExpanded ? null : t.team_id)}
                  >
                    <td className="lv-overview-rank">{i + 1}</td>
                    <td className="lv-overview-name">{t.team_name}</td>
                    <td>{t.sets_won}-{t.sets_lost}</td>
                    <td>{totalSets > 0 ? `${setWinPct.toFixed(0)}%` : "—"}</td>
                    <td className={t.point_differential >= 0 ? "lv-overview-diff-pos" : "lv-overview-diff-neg"}>
                      {t.point_differential >= 0 ? "+" : ""}{t.point_differential}
                    </td>
                    <td>{totalPoints > 0 ? `${pointPct.toFixed(0)}%` : "—"}</td>
                  </tr>
                  {isExpanded && players && (
                    <tr className="lv-overview-expand-row">
                      <td colSpan={6}>
                        <div className="lv-overview-players">
                          {players.map((p, idx) => (
                            <div key={idx} className="lv-overview-player">{p.name}</div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
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

              {/* Scorekeeper + submit button */}
              {m.work_team && (
                <div className="lv-match-card-work">Scorekeeper: {m.work_team}</div>
              )}

              <SubmitScoresButton
                matchId={m.match_id}
                matchType="pool"
                workTeamName={m.work_team ?? ""}
                status={m.status}
                hasWorkTeam={!!m.work_team}
                onOpenModal={handleOpenModal}
              />

            </div>
          );
        })}
      </div>

      {/* Score link verification modal */}
      {scoreLinkMatch && (
        <ScoreLinkModal
          matchId={scoreLinkMatch.matchId}
          matchType={scoreLinkMatch.matchType}
          workTeamName={scoreLinkMatch.workTeamName}
          onClose={() => setScoreLinkMatch(null)}
        />
      )}
    </div>
  );
}

"use client";

import React, { useMemo, useState } from "react";
import type { PoolStandings } from "@/lib/standings";

interface BracketMatch {
  match_id: string;
  round_number: number;
  match_position: number;
  court_number: number;
  match_order: number;
  status: string;
  team_a: string;
  team_b: string;
  team_a_id: string | null;
  team_b_id: string | null;
  score_a: number | null;
  score_b: number | null;
  work_team: string | null;
}

interface BracketData {
  bracket_type: string;
  points_per_set: number;
  slots: Array<{
    round_number: number;
    slot_position: number;
    team_name: string | null;
    team_id: string | null;
    is_bye: boolean;
  }>;
  matches: BracketMatch[];
}

interface TeamRecord {
  team_name: string;
  seed: number;
  record: string;
}

interface StandingsData {
  pools: PoolStandings[];
}

type RosterMap = Record<string, Array<{ name: string; is_captain: boolean }>>;

interface Props {
  bracketData: BracketData[];
  standingsData: StandingsData | null;
  teamRecords: Map<string, TeamRecord>;
  rosters?: RosterMap;
}

/**
 * Compute finish position from elimination round.
 * Winner = 1, Runner-up = 2, Lost in semis = 3, Lost in quarters = 5, etc.
 * For a bracket of size N, losing in round R (of totalRounds) gives finish:
 *   finish = 2^(totalRounds - R) + 1
 * except winner = 1 and runner-up = 2.
 */
function computeBracketFinishes(
  bracket: BracketData,
): Map<string, { finish: number; teamName: string; record: string }> {
  const results = new Map<string, { finish: number; teamName: string; record: string }>();
  const totalRounds = Math.max(...bracket.matches.map((m) => m.round_number), 0);
  if (totalRounds === 0) return results;

  // Find the final match
  const finalMatch = bracket.matches.find(
    (m) => m.round_number === totalRounds && m.status === "complete",
  );

  if (finalMatch && finalMatch.score_a != null && finalMatch.score_b != null) {
    const aWon = finalMatch.score_a > finalMatch.score_b;
    const winnerId = aWon ? finalMatch.team_a_id : finalMatch.team_b_id;
    const winnerName = aWon ? finalMatch.team_a : finalMatch.team_b;
    const loserId = aWon ? finalMatch.team_b_id : finalMatch.team_a_id;
    const loserName = aWon ? finalMatch.team_b : finalMatch.team_a;

    if (winnerId) results.set(winnerId, { finish: 1, teamName: winnerName, record: "" });
    if (loserId) results.set(loserId, { finish: 2, teamName: loserName, record: "" });
  }

  // Process earlier rounds — losers get finish based on round lost
  for (let r = 1; r < totalRounds; r++) {
    const roundMatches = bracket.matches.filter(
      (m) => m.round_number === r && m.status === "complete",
    );
    // Finish for losing in round r: teams that lose here could have finished
    // at best in position (number of teams remaining after this round + 1)
    // = 2^(totalRounds - r) + 1
    const finish = Math.pow(2, totalRounds - r) + 1;

    for (const m of roundMatches) {
      if (m.score_a == null || m.score_b == null) continue;
      const aWon = m.score_a > m.score_b;
      const loserId = aWon ? m.team_b_id : m.team_a_id;
      const loserName = aWon ? m.team_b : m.team_a;
      if (loserId && !results.has(loserId)) {
        results.set(loserId, { finish, teamName: loserName, record: "" });
      }
    }
  }

  // Handle byes — teams that got a bye and then lost in the next round
  // are already captured above. Teams with byes that never played
  // (shouldn't happen in a complete bracket) are not included.

  return results;
}

export function ResultsView({ bracketData, standingsData, teamRecords, rosters = {} }: Props) {
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const goldBracket = bracketData.find((b) => b.bracket_type === "gold");
  const silverBracket = bracketData.find((b) => b.bracket_type === "silver");

  // Get champion and runner-up for each bracket
  const bracketResults = useMemo(() => {
    const result: Array<{
      type: "gold" | "silver";
      champion: string | null;
      runnerUp: string | null;
    }> = [];

    for (const b of bracketData) {
      const totalRounds = Math.max(...b.matches.map((m) => m.round_number), 0);
      const finalMatch = b.matches.find(
        (m) => m.round_number === totalRounds && m.status === "complete",
      );
      let champion: string | null = null;
      let runnerUp: string | null = null;
      if (finalMatch && finalMatch.score_a != null && finalMatch.score_b != null) {
        const aWon = finalMatch.score_a > finalMatch.score_b;
        champion = aWon ? finalMatch.team_a : finalMatch.team_b;
        runnerUp = aWon ? finalMatch.team_b : finalMatch.team_a;
      }
      result.push({
        type: b.bracket_type as "gold" | "silver",
        champion,
        runnerUp,
      });
    }
    return result;
  }, [bracketData]);

  // Build final standings table
  const standings = useMemo(() => {
    const rows: Array<{
      finish: number;
      teamId: string;
      teamName: string;
      record: string;
      bracket: "gold" | "silver" | null;
    }> = [];

    // Compute gold bracket finishes
    const goldFinishes = goldBracket ? computeBracketFinishes(goldBracket) : new Map();

    // Compute silver bracket finishes
    const silverFinishes = silverBracket ? computeBracketFinishes(silverBracket) : new Map();

    // Figure out where silver starts: the highest seed that went into silver
    // = number of teams in gold bracket + 1
    const goldTeamCount = goldBracket
      ? new Set(
          goldBracket.slots
            .filter((s) => s.round_number === 1 && s.team_id && !s.is_bye)
            .map((s) => s.team_id),
        ).size
      : 0;
    // Silver bracket offset: silver winner finishes at goldTeamCount + 1
    const silverOffset = goldTeamCount;

    // Add gold bracket teams
    for (const [teamId, data] of goldFinishes) {
      const rec = teamRecords.get(teamId);
      // Compute final W-L: pool record + bracket wins/losses
      const baseRecord = rec?.record ?? "0-0";
      const bracketWL = computeBracketWL(teamId, goldBracket!);
      const finalRecord = addRecords(baseRecord, bracketWL);
      rows.push({
        finish: data.finish,
        teamId,
        teamName: data.teamName,
        record: finalRecord,
        bracket: "gold",
      });
    }

    // Add silver bracket teams
    for (const [teamId, data] of silverFinishes) {
      const rec = teamRecords.get(teamId);
      const baseRecord = rec?.record ?? "0-0";
      const bracketWL = computeBracketWL(teamId, silverBracket!);
      const finalRecord = addRecords(baseRecord, bracketWL);
      rows.push({
        finish: data.finish + silverOffset,
        teamId,
        teamName: data.teamName,
        record: finalRecord,
        bracket: "silver",
      });
    }

    // Sort by finish position
    rows.sort((a, b) => a.finish - b.finish);

    return rows;
  }, [goldBracket, silverBracket, teamRecords]);

  return (
    <div>
      {/* Champion banners */}
      {bracketResults.map((b) =>
        b.champion ? (
          <div
            key={b.type}
            className={`lv-bracket-champion-card lv-bracket-champion-card--${b.type}`}
          >
            <div className="lv-champion-label">
              {b.type === "gold" ? "Gold" : "Silver"} Bracket Champion
            </div>
            <div className="lv-champion-name">{b.champion}</div>
            {b.runnerUp && (
              <>
                <div className="lv-champion-divider" />
                <div className="lv-runnerup-label">Runner-up</div>
                <div className="lv-runnerup-name">{b.runnerUp}</div>
              </>
            )}
          </div>
        ) : null,
      )}

      {/* Final standings table */}
      <div className="lv-pool-view-header">
        <h2 className="lv-pool-view-title">Final Standings</h2>
        <p className="lv-pool-view-meta">{standings.length} teams</p>
      </div>

      <div className="lv-pool-view-standings">
        <table className="lv-overview-table">
          <thead>
            <tr>
              <th>Finish</th>
              <th>Team</th>
              <th>W-L</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row, i) => {
              const isExpanded = expandedTeam === row.teamId;
              const players = rosters[row.teamId];
              return (
                <React.Fragment key={`${row.teamId}-${i}`}>
                  <tr
                    className={`${row.finish === 1 ? "lv-overview-row-first" : ""} lv-overview-row-click`}
                    onClick={() => setExpandedTeam(isExpanded ? null : row.teamId)}
                  >
                    <td className="lv-overview-rank">{row.finish}</td>
                    <td className="lv-overview-name">{row.teamName}</td>
                    <td>{row.record}</td>
                  </tr>
                  {isExpanded && players && (
                    <tr className="lv-overview-expand-row">
                      <td colSpan={3}>
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
    </div>
  );
}

/** Count bracket wins and losses for a team */
function computeBracketWL(
  teamId: string,
  bracket: BracketData,
): { w: number; l: number } {
  let w = 0;
  let l = 0;
  for (const m of bracket.matches) {
    if (m.status !== "complete" || m.score_a == null || m.score_b == null) continue;
    const aWon = m.score_a > m.score_b;
    if (m.team_a_id === teamId) {
      if (aWon) w++;
      else l++;
    } else if (m.team_b_id === teamId) {
      if (!aWon) w++;
      else l++;
    }
  }
  return { w, l };
}

/** Add pool record + bracket record */
function addRecords(
  poolRecord: string,
  bracketWL: { w: number; l: number },
): string {
  const parts = poolRecord.split("-");
  const poolW = parseInt(parts[0]) || 0;
  const poolL = parseInt(parts[1]) || 0;
  return `${poolW + bracketWL.w}-${poolL + bracketWL.l}`;
}

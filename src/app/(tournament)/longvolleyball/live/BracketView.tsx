"use client";

import { useState } from "react";
import { getRoundLabel } from "@/lib/bracket-generation";
import { ScoreLinkModal } from "./ScoreLinkModal";
import { SubmitScoresButton } from "./SubmitScoresButton";

interface BracketSlot {
  round_number: number;
  slot_position: number;
  team_name: string | null;
  team_id: string | null;
  is_bye: boolean;
}

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

interface TeamRecord {
  team_name: string;
  seed: number;
  record: string;
}

interface Props {
  bracketType: "gold" | "silver";
  pointsPerSet: number;
  slots: BracketSlot[];
  matches: BracketMatch[];
  teamRecords: Map<string, TeamRecord>;
}

function teamLabel(
  name: string | null,
  teamId: string | null,
  records: Map<string, TeamRecord>,
): string {
  if (!name) return "TBD";
  if (!teamId) return name;
  const rec = records.get(teamId);
  if (!rec) return name;
  return `(${rec.seed}) ${name} [${rec.record}]`;
}

export function BracketView({
  bracketType,
  pointsPerSet,
  slots,
  matches,
  teamRecords,
}: Props) {
  const [scoreLinkMatch, setScoreLinkMatch] = useState<{
    matchId: string;
    matchType: "pool" | "bracket";
    workTeamName: string;
  } | null>(null);

  const totalRounds = Math.max(...slots.map((s) => s.round_number), 1);
  const bracketSize = Math.pow(2, totalRounds);

  // Build matchup data per round
  const roundData: Array<{
    round: number;
    matchups: Array<{
      position: number;
      slotA: BracketSlot | undefined;
      slotB: BracketSlot | undefined;
      match: BracketMatch | undefined;
      isBye: boolean;
    }>;
  }> = [];

  for (let r = 1; r <= totalRounds; r++) {
    const roundSlots = slots
      .filter((s) => s.round_number === r)
      .sort((a, b) => a.slot_position - b.slot_position);
    const roundMatches = matches
      .filter((m) => m.round_number === r)
      .sort((a, b) => a.match_position - b.match_position);

    const matchups = [];
    for (let i = 0; i < roundSlots.length; i += 2) {
      const slotA = roundSlots[i];
      const slotB = roundSlots[i + 1];
      const matchPos = Math.floor(i / 2) + 1;
      const match = roundMatches.find((m) => m.match_position === matchPos);
      const isBye = !!(slotA?.is_bye || slotB?.is_bye);
      matchups.push({ position: matchPos, slotA, slotB, match, isBye });
    }
    roundData.push({ round: r, matchups });
  }

  // Grid column template: alternating matchup columns + connector columns
  const cols: string[] = [];
  for (let r = 1; r <= totalRounds; r++) {
    cols.push("minmax(170px, 220px)");
    if (r < totalRounds) cols.push("28px");
  }
  const gridTemplateCols = cols.join(" ");

  function handleOpenModal(matchId: string, matchType: "pool" | "bracket", workTeamName: string) {
    setScoreLinkMatch({ matchId, matchType, workTeamName });
  }

  // Build all grid elements
  const items: React.ReactNode[] = [];

  for (const { round, matchups } of roundData) {
    const matchupCol = (round - 1) * 2 + 1;
    const rowSpan = Math.pow(2, round);
    const isLastRound = round === totalRounds;

    for (let idx = 0; idx < matchups.length; idx++) {
      const mu = matchups[idx];
      const rowStart = idx * rowSpan + 1;

      // Resolve team info from match (preferred) or slots (fallback)
      let teamAName: string;
      let teamBName: string;
      let teamAId: string | null;
      let teamBId: string | null;
      let scoreA: number | null = null;
      let scoreB: number | null = null;
      let status = "pending";
      let court: number | null = null;
      let winner: "a" | "b" | null = null;
      let workTeam: string | null = null;
      let matchId: string | null = null;

      if (mu.match) {
        matchId = mu.match.match_id;
        teamAName = mu.match.team_a;
        teamBName = mu.match.team_b;
        teamAId = mu.match.team_a_id;
        teamBId = mu.match.team_b_id;
        scoreA = mu.match.score_a;
        scoreB = mu.match.score_b;
        status = mu.match.status;
        court = mu.match.court_number;
        workTeam = mu.match.work_team;
        if (status === "complete" && scoreA != null && scoreB != null) {
          winner = scoreA > scoreB ? "a" : "b";
        }
      } else {
        teamAName = mu.slotA?.team_name ?? "";
        teamBName = mu.slotB?.team_name ?? "";
        teamAId = mu.slotA?.team_id ?? null;
        teamBId = mu.slotB?.team_id ?? null;
        if (mu.isBye) status = "bye";
      }

      const isTopBye = !!mu.slotA?.is_bye;
      const isBotBye = !!mu.slotB?.is_bye;

      const cls = [
        "lv-bk-matchup",
        mu.isBye ? "lv-bk-matchup--bye" : "",
        status === "in_progress" ? "lv-bk-matchup--live" : "",
        status === "complete" ? "lv-bk-matchup--done" : "",
        !isLastRound ? "lv-bk-has-exit" : "",
        round > 1 ? "lv-bk-has-entry" : "",
      ]
        .filter(Boolean)
        .join(" ");

      // Matchup box (grid item — caption is absolutely positioned below)
      items.push(
        <div
          key={`m-${round}-${idx}`}
          className={cls}
          style={{
            gridColumn: matchupCol,
            gridRow: `${rowStart} / span ${rowSpan}`,
            alignSelf: "center",
          }}
        >
          <div
            className={`lv-bk-slot ${winner === "a" ? "lv-bk-slot--winner" : ""} ${isTopBye ? "lv-bk-slot--bye" : ""}`}
          >
            <span className="lv-bk-slot-name">
              {isTopBye
                ? "BYE"
                : teamLabel(teamAName || null, teamAId, teamRecords)}
            </span>
            {scoreA != null && (
              <span className="lv-bk-slot-score">{scoreA}</span>
            )}
          </div>
          <div
            className={`lv-bk-slot ${winner === "b" ? "lv-bk-slot--winner" : ""} ${isBotBye ? "lv-bk-slot--bye" : ""}`}
          >
            <span className="lv-bk-slot-name">
              {isBotBye
                ? "BYE"
                : teamLabel(teamBName || null, teamBId, teamRecords)}
            </span>
            {scoreB != null && (
              <span className="lv-bk-slot-score">{scoreB}</span>
            )}
          </div>
          <div className="lv-bk-caption">
            {court != null && <span>Ct {court}</span>}
          </div>
        </div>,
      );

      // Connector: one per pair of matchups feeding the next round
      if (!isLastRound && idx % 2 === 0) {
        items.push(
          <div
            key={`c-${round}-${idx}`}
            className="lv-bk-connector"
            style={{
              gridColumn: matchupCol + 1,
              gridRow: `${rowStart} / span ${rowSpan * 2}`,
            }}
          >
            <div className="lv-bk-conn-spacer" />
            <div className="lv-bk-conn-top" />
            <div className="lv-bk-conn-bot" />
            <div className="lv-bk-conn-spacer" />
          </div>,
        );
      }
    }
  }

  // --- Match feed: same card layout as pool matches ---
  // Build a lookup to generate placeholder names for TBD teams
  // e.g. "W(R1M1)" = winner of Round 1 Match 1, "L(R1M1)" = loser
  function placeholderTeamName(
    teamName: string,
    teamId: string | null,
    roundNum: number,
  ): string {
    if (teamName && teamName !== "TBD") return teamName;
    if (!teamId && roundNum > 1) {
      // Find which prior match feeds this team
      // We can't easily resolve this without slot data, so use generic label
      return "TBD";
    }
    return teamName || "TBD";
  }

  // Build feeder match labels: for each later-round match, find which R(n-1) matches feed it
  // Local match numbering within this bracket (by match_order)
  const localMatchNum = new Map<string, number>();
  [...matches].sort((a, b) => a.match_order - b.match_order).forEach((m, i) => {
    localMatchNum.set(m.match_id, i + 1);
  });

  // Helper: short label for a match like "M1C2"
  function matchTag(m: BracketMatch): string {
    return `M${localMatchNum.get(m.match_id) ?? "?"}C${m.court_number}`;
  }

  // Build placeholder labels for TBD teams and work teams
  const matchFeederLabels = new Map<string, { teamALabel: string; teamBLabel: string; workLabel: string | null }>();
  for (const m of matches) {
    let teamALabel = m.team_a && m.team_a !== "TBD" ? m.team_a : null;
    let teamBLabel = m.team_b && m.team_b !== "TBD" ? m.team_b : null;
    let workLabel: string | null = m.work_team;

    if (!teamALabel || !teamBLabel) {
      const feederPos1 = m.match_position * 2 - 1;
      const feederPos2 = m.match_position * 2;
      const feederA = matches.find((f) => f.round_number === m.round_number - 1 && f.match_position === feederPos1);
      const feederB = matches.find((f) => f.round_number === m.round_number - 1 && f.match_position === feederPos2);

      if (!teamALabel) {
        if (feederA) {
          teamALabel = `W(${matchTag(feederA)})`;
        } else {
          const slot = slots.find((s) => s.round_number === m.round_number && s.slot_position === m.match_position * 2 - 1);
          teamALabel = slot?.team_name ?? "TBD";
        }
      }
      if (!teamBLabel) {
        if (feederB) {
          teamBLabel = `W(${matchTag(feederB)})`;
        } else {
          const slot = slots.find((s) => s.round_number === m.round_number && s.slot_position === m.match_position * 2);
          teamBLabel = slot?.team_name ?? "TBD";
        }
      }

      if (!workLabel && m.round_number > 1) {
        const priorOnCourt = matches.find(
          (f) => f.court_number === m.court_number && f.match_order < m.match_order
            && f.round_number < m.round_number,
        );
        if (priorOnCourt && priorOnCourt.status !== "complete") {
          workLabel = `L(${matchTag(priorOnCourt)})`;
        }
      }
    }

    matchFeederLabels.set(m.match_id, {
      teamALabel: teamALabel ?? "TBD",
      teamBLabel: teamBLabel ?? "TBD",
      workLabel,
    });
  }

  const sortedMatches = (() => {
    const live = matches.filter((m) => m.status === "in_progress").sort((a, b) => a.match_order - b.match_order);
    const scheduled = matches.filter((m) => m.status === "scheduled").sort((a, b) => a.match_order - b.match_order);
    const complete = matches.filter((m) => m.status === "complete").sort((a, b) => b.match_order - a.match_order);
    const top = live.length > 0 ? live : scheduled.slice(0, 1);
    const restScheduled = live.length > 0 ? scheduled : scheduled.slice(1);
    return [...top, ...complete, ...restScheduled];
  })();

  return (
    <div className="lv-bracket">
      <div className="lv-bracket-header">
        <span className={`lv-bracket-type lv-bracket-type--${bracketType}`}>
          {bracketType === "gold" ? "Gold" : "Silver"} Bracket
        </span>
        <span className="lv-bracket-format">1 set to {pointsPerSet}</span>
      </div>

      <div className="lv-bk-scroll">
        <div className="lv-bk-inner">
          {/* Round labels — same grid columns so they align */}
          <div
            className="lv-bk-labels"
            style={{
              display: "grid",
              gridTemplateColumns: gridTemplateCols,
            }}
          >
            {roundData.map(({ round }) => (
              <div
                key={`lbl-${round}`}
                className="lv-bk-round-label"
                style={{ gridColumn: (round - 1) * 2 + 1 }}
              >
                {getRoundLabel(round, totalRounds)}
              </div>
            ))}
          </div>

          {/* Bracket grid */}
          <div
            className="lv-bk-grid"
            style={{
              display: "grid",
              gridTemplateColumns: gridTemplateCols,
              gridTemplateRows: `repeat(${bracketSize}, 48px)`,
            }}
          >
            {items}
          </div>
        </div>
      </div>

      {/* Match feed — same card layout as pool matches */}
      {sortedMatches.length > 0 && (
        <div className="lv-pool-view-matches" style={{ marginTop: "1.5rem" }}>
          <h3 className="lv-live-section-title">Matches</h3>
          {sortedMatches.map((m) => {
            const labels = matchFeederLabels.get(m.match_id);
            const teamADisplay = labels?.teamALabel ?? m.team_a;
            const teamBDisplay = labels?.teamBLabel ?? m.team_b;
            const workDisplay = labels?.workLabel ?? m.work_team;

            const isComplete = m.status === "complete" && m.score_a != null && m.score_b != null;
            let outcomeLabel = "";
            let outcomeType = "";
            if (isComplete) {
              const winner = m.score_a! > m.score_b! ? teamADisplay : teamBDisplay;
              const diff = Math.abs(m.score_a! - m.score_b!);
              outcomeLabel = `${winner} win +${diff}`;
              outcomeType = "win";
            }

            return (
              <div
                key={m.match_id}
                className={`lv-match-card ${m.status === "in_progress" ? "lv-match-card--live" : ""} ${m.status === "complete" ? "lv-match-card--complete" : ""}`}
              >
                <div className="lv-match-card-top">
                  <span className="lv-match-card-num">
                    {getRoundLabel(m.round_number, totalRounds)} &middot; Match {localMatchNum.get(m.match_id) ?? m.match_order} &middot; Ct {m.court_number}
                  </span>
                  {m.status === "in_progress" && <span className="lv-status-tag lv-status-tag--live" style={{ fontSize: "8px" }}>Live</span>}
                  {m.status === "complete" && <span className="lv-match-card-final">Final</span>}
                  {m.status === "scheduled" && <span className="lv-match-card-scheduled">Upcoming</span>}
                </div>

                <div className="lv-match-card-teams">
                  <span className="lv-match-card-team">{teamADisplay}</span>
                  <span className="lv-match-card-vs">vs</span>
                  <span className="lv-match-card-team">{teamBDisplay}</span>
                </div>

                {m.score_a != null && m.score_b != null && (
                  <div className="lv-match-card-scores">
                    <span className="lv-match-card-set">
                      {m.score_a}&ndash;{m.score_b}
                    </span>
                  </div>
                )}

                {outcomeLabel && (
                  <div className={`lv-match-card-outcome lv-match-card-outcome--${outcomeType}`}>
                    {outcomeLabel}
                  </div>
                )}

                {workDisplay && (
                  <div className="lv-match-card-work">Scorekeeper: {workDisplay}</div>
                )}

                <SubmitScoresButton
                  matchId={m.match_id}
                  matchType="bracket"
                  workTeamName={m.work_team ?? ""}
                  status={m.status}
                  hasWorkTeam={!!m.work_team}
                  onOpenModal={handleOpenModal}
                />
              </div>
            );
          })}
        </div>
      )}

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

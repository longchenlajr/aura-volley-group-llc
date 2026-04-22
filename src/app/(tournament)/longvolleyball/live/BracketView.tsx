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
            {workTeam && <span>Work: {workTeam}</span>}
            {matchId && workTeam && (
              <SubmitScoresButton
                matchId={matchId}
                matchType="bracket"
                workTeamName={workTeam}
                status={status}
                hasWorkTeam={true}
                onOpenModal={handleOpenModal}
              />
            )}
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

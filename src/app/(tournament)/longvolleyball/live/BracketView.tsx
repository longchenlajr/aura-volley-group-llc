"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { getRoundLabel } from "@/lib/bracket-generation";
import {
  DESKTOP_LAYOUT,
  MOBILE_LAYOUT,
  getMatchYPosition,
  getColumnXPosition,
  getBracketDimensions,
  getChampionPosition,
  type LayoutConfig,
} from "@/lib/bracket-layout";
import { BracketMatchCard } from "./BracketMatchCard";
import { BracketConnectors } from "./BracketConnectors";
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

// ── Helpers ──

function getSeedLabel(teamId: string | null, records: Map<string, TeamRecord>): string {
  if (!teamId) return "";
  const rec = records.get(teamId);
  return rec ? String(rec.seed) : "";
}

function getTeamDisplay(name: string | null, teamId: string | null, record: string | null): string {
  if (!name) return "TBD";
  if (record) return `${name} [${record}]`;
  return name;
}

/**
 * Compute bracket-aware records: pool record + bracket wins/losses.
 * For each team at each round, the record reflects results through that round.
 * If the match in that round is complete, the result is included.
 * If not, the record shows results through the previous round.
 *
 * Returns: Map<`${teamId}:${roundNumber}`, "W-L">
 */
function computeBracketRecords(
  baseRecords: Map<string, TeamRecord>,
  bracketMatches: BracketMatch[],
  totalRounds: number,
): Map<string, string> {
  // Parse base pool records: team_id → { w, l }
  const running = new Map<string, { w: number; l: number }>();
  for (const [teamId, rec] of baseRecords) {
    const parts = rec.record.split("-");
    running.set(teamId, { w: parseInt(parts[0]) || 0, l: parseInt(parts[1]) || 0 });
  }

  // Result map: "teamId:round" → "W-L"
  const result = new Map<string, string>();

  // Process rounds in order
  for (let r = 1; r <= totalRounds; r++) {
    const roundMatches = bracketMatches
      .filter((m) => m.round_number === r)
      .sort((a, b) => a.match_position - b.match_position);

    // Before this round's matches are applied, snapshot the current state
    // for teams that appear in this round
    for (const m of roundMatches) {
      if (m.team_a_id) {
        const cur = running.get(m.team_a_id) ?? { w: 0, l: 0 };
        // If match is NOT complete, show current record (before this round)
        if (m.status !== "complete" || m.score_a == null || m.score_b == null) {
          result.set(`${m.team_a_id}:${r}`, `${cur.w}-${cur.l}`);
        }
      }
      if (m.team_b_id) {
        const cur = running.get(m.team_b_id) ?? { w: 0, l: 0 };
        if (m.status !== "complete" || m.score_a == null || m.score_b == null) {
          result.set(`${m.team_b_id}:${r}`, `${cur.w}-${cur.l}`);
        }
      }
    }

    // Apply completed match results (skip byes — both teams must exist)
    for (const m of roundMatches) {
      if (m.status === "complete" && m.score_a != null && m.score_b != null
          && m.team_a_id && m.team_b_id) {
        const aWon = m.score_a > m.score_b;
        const winnerId = aWon ? m.team_a_id : m.team_b_id;
        const loserId = aWon ? m.team_b_id : m.team_a_id;

        const winCur = running.get(winnerId) ?? { w: 0, l: 0 };
        winCur.w++;
        running.set(winnerId, winCur);
        result.set(`${winnerId}:${r}`, `${winCur.w}-${winCur.l}`);

        const loseCur = running.get(loserId) ?? { w: 0, l: 0 };
        loseCur.l++;
        running.set(loserId, loseCur);
        result.set(`${loserId}:${r}`, `${loseCur.w}-${loseCur.l}`);
      }
    }
  }

  return result;
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
  } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const layout: LayoutConfig = isMobile ? MOBILE_LAYOUT : DESKTOP_LAYOUT;

  const totalRounds = Math.max(...slots.map((s) => s.round_number), 1);
  const bracketSize = Math.pow(2, totalRounds);
  const firstRoundMatchCount = bracketSize / 2;

  // Champion detection
  const finalsMatch = matches.find((m) => m.round_number === totalRounds);
  const bracketComplete = finalsMatch?.status === "complete" && finalsMatch.score_a != null && finalsMatch.score_b != null;
  let championName: string | null = null;
  let championId: string | null = null;
  let runnerUpName: string | null = null;
  if (bracketComplete && finalsMatch) {
    const aWon = finalsMatch.score_a! > finalsMatch.score_b!;
    championName = aWon ? finalsMatch.team_a : finalsMatch.team_b;
    championId = aWon ? finalsMatch.team_a_id : finalsMatch.team_b_id;
    runnerUpName = aWon ? finalsMatch.team_b : finalsMatch.team_a;
  }

  // Bracket-aware records: pool record + bracket results per round
  const bracketRecords = useMemo(
    () => computeBracketRecords(teamRecords, matches, totalRounds),
    [teamRecords, matches, totalRounds],
  );

  // Helper to get record for a team at a specific round
  function getRecordAtRound(teamId: string | null, round: number): string | null {
    if (!teamId) return null;
    return bracketRecords.get(`${teamId}:${round}`) ?? teamRecords.get(teamId)?.record ?? null;
  }

  // Build round data
  const roundData = useMemo(() => {
    const data: Array<{
      round: number;
      label: string;
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
      data.push({ round: r, label: getRoundLabel(r, totalRounds), matchups });
    }
    return data;
  }, [slots, matches, totalRounds]);

  // Bracket dimensions
  const dims = getBracketDimensions(totalRounds, firstRoundMatchCount, layout);

  // Nudge animation on mount to signal horizontal scrollability
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    let frame: number;
    const start = performance.now();
    const duration = 800;
    const distance = 20;
    function animate(now: number) {
      const t = Math.min((now - start) / duration, 1);
      // Ease out-in: go right then back
      const progress = t < 0.5 ? t * 2 : 2 - t * 2;
      el!.scrollLeft = progress * distance;
      if (t < 1) frame = requestAnimationFrame(animate);
    }
    // Small delay to let layout settle
    const timeout = setTimeout(() => { frame = requestAnimationFrame(animate); }, 200);
    return () => { clearTimeout(timeout); cancelAnimationFrame(frame); };
  }, []);

  // Mobile round tabs
  const [activeTab, setActiveTab] = useState(1);

  function scrollToRound(round: number) {
    const el = scrollRef.current;
    if (!el) return;
    const x = getColumnXPosition(round, layout) - layout.pageMargin;
    el.scrollTo({ left: x, behavior: "smooth" });
    setActiveTab(round);
  }

  // Track active tab from scroll position
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function onScroll() {
      const scrollX = el!.scrollLeft + layout.pageMargin + layout.columnWidth / 2;
      for (let r = totalRounds; r >= 1; r--) {
        if (scrollX >= getColumnXPosition(r, layout)) {
          setActiveTab(r);
          break;
        }
      }
    }
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [totalRounds, layout]);

  function handleOpenModal(matchId: string, matchType: "pool" | "bracket") {
    setScoreLinkMatch({ matchId, matchType });
  }

  // ── Match feed labels ──
  const localMatchNum = useMemo(() => {
    const map = new Map<string, number>();
    [...matches].sort((a, b) => a.match_order - b.match_order).forEach((m, i) => {
      map.set(m.match_id, i + 1);
    });
    return map;
  }, [matches]);

  const matchFeederLabels = useMemo(() => {
    const labels = new Map<string, { teamALabel: string; teamBLabel: string; workLabel: string | null }>();
    function matchTag(m: BracketMatch): string {
      return `M${localMatchNum.get(m.match_id) ?? "?"}C${m.court_number}`;
    }
    for (const m of matches) {
      let teamALabel = m.team_a && m.team_a !== "TBD" ? m.team_a : null;
      let teamBLabel = m.team_b && m.team_b !== "TBD" ? m.team_b : null;
      let workLabel: string | null = m.work_team;

      if (!teamALabel || !teamBLabel) {
        const feederA = matches.find((f) => f.round_number === m.round_number - 1 && f.match_position === m.match_position * 2 - 1);
        const feederB = matches.find((f) => f.round_number === m.round_number - 1 && f.match_position === m.match_position * 2);
        if (!teamALabel) teamALabel = feederA ? `W(${matchTag(feederA)})` : (slots.find((s) => s.round_number === m.round_number && s.slot_position === m.match_position * 2 - 1)?.team_name ?? "TBD");
        if (!teamBLabel) teamBLabel = feederB ? `W(${matchTag(feederB)})` : (slots.find((s) => s.round_number === m.round_number && s.slot_position === m.match_position * 2)?.team_name ?? "TBD");
        if (!workLabel && m.round_number > 1) {
          const prior = matches.find((f) => f.court_number === m.court_number && f.match_order < m.match_order && f.round_number < m.round_number);
          if (prior && prior.status !== "complete") workLabel = `L(${matchTag(prior)})`;
        }
      }
      labels.set(m.match_id, { teamALabel: teamALabel ?? "TBD", teamBLabel: teamBLabel ?? "TBD", workLabel });
    }
    return labels;
  }, [matches, slots, localMatchNum]);

  const sortedMatches = useMemo(() => {
    const live = matches.filter((m) => m.status === "in_progress").sort((a, b) => a.match_order - b.match_order);
    const scheduled = matches.filter((m) => m.status === "scheduled").sort((a, b) => a.match_order - b.match_order);
    const complete = matches.filter((m) => m.status === "complete").sort((a, b) => b.match_order - a.match_order);
    const top = live.length > 0 ? live : scheduled.slice(0, 1);
    const restScheduled = live.length > 0 ? scheduled : scheduled.slice(1);
    return [...top, ...complete, ...restScheduled];
  }, [matches]);

  // ── Render ──
  return (
    <div className={`lv-bracket lv-bracket--${bracketType}`}>
      {/* Champion card */}
      {bracketComplete && championName && (
        <div className={`lv-bracket-champion-card lv-bracket-champion-card--${bracketType}`}>
          <div className="lv-champion-label">
            {bracketType === "gold" ? "Gold" : "Silver"} Bracket Champion
          </div>
          <div className="lv-champion-name">{championName}</div>
          {runnerUpName && (
            <>
              <div className="lv-champion-divider" />
              <div className="lv-runnerup-label">Runner-up</div>
              <div className="lv-runnerup-name">{runnerUpName}</div>
            </>
          )}
        </div>
      )}

      <div className="lv-bracket-header">
        <span className={`lv-bracket-type lv-bracket-type--${bracketType}`}>
          {bracketType === "gold" ? "Gold" : "Silver"} Bracket
        </span>
        <span className="lv-bracket-format">1 set to {pointsPerSet}</span>
      </div>

      {/* Mobile round tabs */}
      <div className="bk-tabs-wrap">
        <div className="bk-tabs">
          {roundData.map(({ round, label }) => (
            <button
              key={round}
              className={`bk-tab ${activeTab === round ? "bk-tab--active" : ""}`}
              onClick={() => scrollToRound(round)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Bracket area — horizontal scroll */}
      <div className="bk-scroll" ref={scrollRef}>
        <div className="bk-area" style={{ width: dims.width, height: dims.height + layout.headerHeight }}>
          {/* Round headers */}
          {roundData.map(({ round, label }) => (
            <div
              key={`hdr-${round}`}
              className="bk-round-header"
              style={{
                left: getColumnXPosition(round, layout),
                width: layout.columnWidth,
              }}
            >
              {bracketType === "gold" && round === 1 && <span className="bk-bracket-star bk-bracket-star--gold" />}
              {bracketType === "silver" && round === 1 && <span className="bk-bracket-star bk-bracket-star--silver" />}
              {label}
            </div>
          ))}

          {/* SVG connectors */}
          <div style={{ position: "absolute", top: layout.headerHeight, left: 0 }}>
            <BracketConnectors
              totalRounds={totalRounds}
              firstRoundMatchCount={firstRoundMatchCount}
              layout={layout}
              width={dims.width}
              height={dims.height}
            />
          </div>

          {/* Match cards */}
          {roundData.map(({ round, matchups }) =>
            matchups.map((mu, idx) => {
              let teamAName = "";
              let teamBName = "";
              let teamAId: string | null = null;
              let teamBId: string | null = null;
              let scoreA: number | null = null;
              let scoreB: number | null = null;
              let status = "pending" as string;
              let winner: "a" | "b" | null = null;

              if (mu.match) {
                teamAName = mu.match.team_a;
                teamBName = mu.match.team_b;
                teamAId = mu.match.team_a_id;
                teamBId = mu.match.team_b_id;
                scoreA = mu.match.score_a;
                scoreB = mu.match.score_b;
                status = mu.match.status;
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

              const isFinal = round === totalRounds;
              const isChampionMatch = isFinal && bracketComplete;

              const x = getColumnXPosition(round, layout);
              const y = getMatchYPosition(round, idx, layout) + layout.headerHeight;

              return (
                <React.Fragment key={`card-${round}-${idx}`}>
                <BracketMatchCard
                  teamA={{
                    seed: getSeedLabel(teamAId, teamRecords),
                    name: getTeamDisplay(teamAName || null, teamAId, getRecordAtRound(teamAId, round)),
                    score: scoreA,
                    isWinner: winner === "a",
                    isLoser: winner === "b",
                    isBye: !!mu.slotA?.is_bye,
                  }}
                  teamB={{
                    seed: getSeedLabel(teamBId, teamRecords),
                    name: getTeamDisplay(teamBName || null, teamBId, getRecordAtRound(teamBId, round)),
                    score: scoreB,
                    isWinner: winner === "b",
                    isLoser: winner === "a",
                    isBye: !!mu.slotB?.is_bye,
                  }}
                  status={status}
                  isChampionMatch={isChampionMatch}
                  bracketType={bracketType}
                  style={{
                    position: "absolute",
                    left: x,
                    top: y,
                    width: layout.columnWidth,
                    height: layout.cardHeight,
                  }}
                />
                {/* Court label below card */}
                {mu.match?.court_number != null && (
                  <div
                    className="bk-court-label"
                    style={{
                      position: "absolute",
                      left: x,
                      top: y + layout.cardHeight + 2,
                    }}
                  >
                    Ct {mu.match.court_number}
                  </div>
                )}
              </React.Fragment>
              );
            }),
          )}

          {/* Champion node — extra card after finals */}
          {(() => {
            const champPos = getChampionPosition(totalRounds, layout);
            const champY = champPos.y + layout.headerHeight;
            const champLabel = bracketType === "gold" ? "Gold Champion" : "Silver Champion";

            return (
              <>
                {/* Champion header */}
                <div
                  className={`bk-champion-header bk-champion-header--${bracketType}`}
                  style={{
                    position: "absolute",
                    left: champPos.x,
                    top: 0,
                    width: layout.columnWidth,
                  }}
                >
                  {champLabel}
                </div>

                {/* Champion card */}
                <div
                  className={`bk-champion-node bk-champion-node--${bracketType}`}
                  style={{
                    position: "absolute",
                    left: champPos.x,
                    top: champY,
                    width: layout.columnWidth,
                    height: layout.cardHeight / 2,
                  }}
                >
                  {bracketComplete && championName ? (
                    <div className="bk-champion-node-team">
                      <span className="bk-seed">{getSeedLabel(championId, teamRecords)}</span>
                      <span className="bk-name">{getTeamDisplay(championName, championId, getRecordAtRound(championId, totalRounds))}</span>
                    </div>
                  ) : (
                    <div className="bk-champion-node-team">
                      <span className="bk-name" style={{ textAlign: "center", color: "var(--lv-ink-muted)" }}>TBD</span>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Match feed — cards below bracket */}
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
              const w = m.score_a! > m.score_b! ? teamADisplay : teamBDisplay;
              const diff = Math.abs(m.score_a! - m.score_b!);
              outcomeLabel = `${w} win +${diff}`;
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
                    <span className="lv-match-card-set">{m.score_a}&ndash;{m.score_b}</span>
                  </div>
                )}
                {outcomeLabel && (
                  <div className={`lv-match-card-outcome lv-match-card-outcome--${outcomeType}`}>{outcomeLabel}</div>
                )}
                {workDisplay && (
                  <div className="lv-match-card-work">Scorekeeper: {workDisplay}</div>
                )}
                <SubmitScoresButton matchId={m.match_id} matchType="bracket" status={m.status} onOpenModal={handleOpenModal} />
              </div>
            );
          })}
        </div>
      )}

      {scoreLinkMatch && (
        <ScoreLinkModal matchId={scoreLinkMatch.matchId} matchType={scoreLinkMatch.matchType} onClose={() => setScoreLinkMatch(null)} />
      )}
    </div>
  );
}

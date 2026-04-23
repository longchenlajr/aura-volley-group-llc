"use client";

import { useMemo } from "react";
import { getRoundLabel } from "@/lib/bracket-generation";

interface BracketMatch {
  id: string;
  round_number: number;
  match_position: number;
  court_number: number;
  match_order: number;
  status: string;
  team_a_name: string | null;
  team_b_name: string | null;
  work_team_name: string | null;
  winner_slot_id: string | null;
  token?: string | null;
  score?: { team_a_score: number; team_b_score: number } | null;
}

interface BracketSummaryCardProps {
  bracket: { id: string; bracket_type: string; points_per_set: number };
  matches: BracketMatch[];
  expanded: boolean;
  onToggle: () => void;
  onOverrideScore: (matchId: string) => void;
  onResetScores: (matchId: string) => void;
  onCopyScoreLink: (token: string) => void;
}

function computeOutcome(m: BracketMatch): { label: string; type: "win" | "pending" } {
  if (m.status !== "complete" || !m.score) return { label: "", type: "pending" };
  const { team_a_score, team_b_score } = m.score;
  const diff = Math.abs(team_a_score - team_b_score);
  const winner = team_a_score > team_b_score ? m.team_a_name : m.team_b_name;
  return { label: `${winner ?? "?"} win +${diff}`, type: "win" };
}

export function BracketSummaryCard({
  bracket,
  matches,
  expanded,
  onToggle,
  onOverrideScore,
  onResetScores,
  onCopyScoreLink,
}: BracketSummaryCardProps) {
  const label = bracket.bracket_type === "gold" ? "Gold" : "Silver";

  const courts = useMemo(() => {
    const nums = [...new Set(matches.map((m) => m.court_number))].sort((a, b) => a - b);
    if (nums.length === 0) return "";
    if (nums.length === 1) return `Court ${nums[0]}`;
    return `Courts ${nums[0]}-${nums[nums.length - 1]}`;
  }, [matches]);

  const completeCount = matches.filter((m) => m.status === "complete").length;
  const totalCount = matches.length;
  const progressPct = totalCount > 0 ? (completeCount / totalCount) * 100 : 0;

  const totalRounds = Math.max(...matches.map((m) => m.round_number), 1);

  // Local match numbering within this bracket
  const localMatchNum = useMemo(() => {
    const map = new Map<string, number>();
    [...matches].sort((a, b) => a.match_order - b.match_order).forEach((m, i) => {
      map.set(m.id, i + 1);
    });
    return map;
  }, [matches]);

  // Build feeder labels for TBD teams
  const matchFeederLabels = useMemo(() => {
    const labels = new Map<string, { teamALabel: string; teamBLabel: string }>();
    function matchTag(m: BracketMatch): string {
      return `M${localMatchNum.get(m.id) ?? "?"}C${m.court_number}`;
    }
    for (const m of matches) {
      let teamALabel = m.team_a_name && m.team_a_name !== "TBD" ? m.team_a_name : null;
      let teamBLabel = m.team_b_name && m.team_b_name !== "TBD" ? m.team_b_name : null;

      if (!teamALabel || !teamBLabel) {
        const feederPos1 = m.match_position * 2 - 1;
        const feederPos2 = m.match_position * 2;
        const feederA = matches.find((f) => f.round_number === m.round_number - 1 && f.match_position === feederPos1);
        const feederB = matches.find((f) => f.round_number === m.round_number - 1 && f.match_position === feederPos2);

        if (!teamALabel) teamALabel = feederA ? `W(${matchTag(feederA)})` : "TBD";
        if (!teamBLabel) teamBLabel = feederB ? `W(${matchTag(feederB)})` : "TBD";
      }

      labels.set(m.id, {
        teamALabel: teamALabel ?? "TBD",
        teamBLabel: teamBLabel ?? "TBD",
      });
    }
    return labels;
  }, [matches, localMatchNum]);

  // Same ordering as live bracket + pool match table
  const sortedMatches = useMemo(() => {
    const live = matches.filter((m) => m.status === "in_progress").sort((a, b) => a.match_order - b.match_order);
    const scheduled = matches.filter((m) => m.status === "scheduled").sort((a, b) => a.match_order - b.match_order);
    const complete = matches.filter((m) => m.status === "complete").sort((a, b) => b.match_order - a.match_order);
    const top = live.length > 0 ? live : scheduled.slice(0, 1);
    const restScheduled = live.length > 0 ? scheduled : scheduled.slice(1);
    return [...top, ...complete, ...restScheduled];
  }, [matches]);

  function statusTag(m: BracketMatch) {
    if (m.status === "in_progress") return <span className="lv-match-tag lv-match-tag--live">Live</span>;
    if (m.status === "complete") return <span className="lv-match-tag lv-match-tag--final">Final</span>;
    return <span className="lv-match-tag lv-match-tag--scheduled">Scheduled</span>;
  }

  function scoreDisplay(m: BracketMatch) {
    if (!m.score) return <span className="lv-match-score" style={{ color: "var(--lv-ink-muted)" }}>&mdash;</span>;
    return <span className="lv-match-score">{m.score.team_a_score}-{m.score.team_b_score}</span>;
  }

  function matchLabel(m: BracketMatch) {
    const roundLabel = getRoundLabel(m.round_number, totalRounds);
    const localNum = localMatchNum.get(m.id) ?? m.match_order;
    return `${roundLabel} · M${localNum} · Ct ${m.court_number}`;
  }

  function actionButtons(m: BracketMatch) {
    return (
      <div className="lv-match-actions">
        <button className="lv-admin-action-btn" title="Override score" onClick={() => onOverrideScore(m.id)} aria-label="Override score">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13.5 3.5l3 3L7 16H4v-3L13.5 3.5z" /></svg>
        </button>
        {m.score && (
          <button className="lv-admin-action-btn lv-admin-action-btn-danger" title="Erase scores" onClick={() => onResetScores(m.id)} aria-label="Erase scores">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 5H6.5l-4 5 4 5H18V5z" /><path d="M12 9l-3 3m0-3l3 3" /></svg>
          </button>
        )}
        {m.token && (
          <button className="lv-admin-action-btn" title="Copy score link" onClick={() => onCopyScoreLink(m.token!)} aria-label="Copy score link">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="8" width="10" height="10" rx="2" /><path d="M4 12H3a1 1 0 01-1-1V3a1 1 0 011-1h8a1 1 0 011 1v1" /></svg>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`lv-pool-card lv-bracket-card--${bracket.bracket_type} ${expanded ? "expanded" : ""}`}>
      <button className="lv-pool-card-header" onClick={onToggle}>
        <div className="lv-pool-card-left">
          <div className="lv-pool-card-title">
            {label} Bracket &middot; {courts}
          </div>
          <div className="lv-pool-card-progress-text">
            {completeCount} of {totalCount} matches complete
          </div>
          <div className="lv-pool-card-progress-bar">
            <div className="lv-pool-card-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
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
          <div className="lv-match-list">
            {sortedMatches.map((m) => {
              const labels = matchFeederLabels.get(m.id);
              const teamADisplay = labels?.teamALabel ?? m.team_a_name ?? "TBD";
              const teamBDisplay = labels?.teamBLabel ?? m.team_b_name ?? "TBD";
              const outcome = computeOutcome(m);

              return (
                <div
                  key={m.id}
                  className={[
                    "lv-match-row",
                    m.status === "in_progress" ? "lv-match-row--live" : "",
                    m.status === "complete" ? "lv-match-row--complete" : "",
                  ].filter(Boolean).join(" ")}
                >
                  {/* Desktop layout */}
                  <div className="lv-match-desktop">
                    <span className="lv-match-num">{matchLabel(m)}</span>
                    <span className="lv-match-teams">
                      {teamADisplay} vs {teamBDisplay}
                    </span>
                    {m.work_team_name && (
                      <span className="lv-match-work">Work: {m.work_team_name}</span>
                    )}
                    {scoreDisplay(m)}
                    {statusTag(m)}
                    {actionButtons(m)}
                  </div>

                  {/* Mobile card */}
                  <div className="lv-match-card-mobile">
                    <div className="lv-match-card-top">
                      <span className="lv-match-card-num">{matchLabel(m)}</span>
                      {m.status === "in_progress" && <span className="lv-status-tag lv-status-tag--live" style={{ fontSize: "8px" }}>Live</span>}
                      {m.status === "complete" && <span className="lv-match-card-final">Final</span>}
                      {m.status === "scheduled" && <span className="lv-match-card-scheduled">Upcoming</span>}
                    </div>

                    <div className="lv-match-card-teams">
                      <span className="lv-match-card-team">{teamADisplay}</span>
                      <span className="lv-match-card-vs">vs</span>
                      <span className="lv-match-card-team">{teamBDisplay}</span>
                    </div>

                    {m.score && (
                      <div className="lv-match-card-scores">
                        <span className="lv-match-card-set">
                          {m.score.team_a_score}&ndash;{m.score.team_b_score}
                        </span>
                      </div>
                    )}

                    {outcome.type !== "pending" && (
                      <div className={`lv-match-card-outcome lv-match-card-outcome--${outcome.type}`}>
                        {outcome.label}
                      </div>
                    )}

                    {m.work_team_name && (
                      <div className="lv-match-card-work">Scorekeeper: {m.work_team_name}</div>
                    )}

                    <div className="lv-match-card-admin-actions">
                      {actionButtons(m)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

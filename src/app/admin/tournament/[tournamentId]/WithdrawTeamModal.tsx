"use client";

import { useState, useEffect } from "react";
import { matchFormatFromPool } from "@/lib/score-format";
import type { Team, MatchData, PoolWithTeams } from "./types";

interface WithdrawTeamModalProps {
  team: Team;
  matches: MatchData[];
  pools: PoolWithTeams[];
  onClose: () => void;
  onWithdraw: () => void;
  onHardDelete: () => void;
  onChangeWorkTeam: (matchId: string, newWorkTeamId: string) => void;
}

export function WithdrawTeamModal({
  team,
  matches,
  pools,
  onClose,
  onWithdraw,
  onHardDelete,
  onChangeWorkTeam,
}: WithdrawTeamModalProps) {
  const [withdrawing, setWithdrawing] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Find scheduled matches involving this team (will become forfeits)
  const affectedMatches = matches.filter(
    (m) =>
      m.match.status === "scheduled" &&
      (m.team_a.id === team.id || m.team_b.id === team.id),
  );

  // Find matches where this team is the work team (but not playing)
  const workTeamMatches = matches.filter(
    (m) =>
      m.match.status === "scheduled" &&
      m.work_team?.id === team.id &&
      m.team_a.id !== team.id &&
      m.team_b.id !== team.id,
  );

  // Figure out pool size for forfeit score display
  function getForfeitDisplay(m: MatchData) {
    const pool = pools.find((p) => p.pool.id === m.pool.id);
    const poolSize = pool?.teams.length ?? 4;
    const poolCols = pool?.pool ?? { sets_per_match: null, points_per_set: null, points_cap: null };
    const format = matchFormatFromPool(poolCols, poolSize);
    const scores = Array.from({ length: format.sets }, () => `${format.pointsPerSet}-0`);
    return scores.join(", ");
  }

  function getOpponentName(m: MatchData) {
    return m.team_a.id === team.id ? m.team_b.team_name : m.team_a.team_name;
  }

  // Get available work team replacements for a match
  function getAvailableWorkTeams(m: MatchData) {
    const pool = pools.find((p) => p.pool.id === m.pool.id);
    if (!pool) return [];
    const playingIds = new Set([m.team_a.id, m.team_b.id, team.id]);
    return pool.teams.filter((t) => !playingIds.has(t.team_id));
  }

  async function handleWithdraw() {
    setWithdrawing(true);
    await onWithdraw();
    setWithdrawing(false);
  }

  async function handleHardDelete() {
    if (!confirm(`Permanently delete ${team.team_name} and ALL their data? This cannot be undone.`)) return;
    onHardDelete();
  }

  return (
    <div className="lv-admin-overlay" onClick={onClose}>
      <div className="lv-admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="lv-admin-modal-header">
          <h2 className="lv-admin-modal-title">Remove team from active tournament?</h2>
          <button className="lv-admin-modal-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M5 5l10 10M15 5L5 15" /></svg>
          </button>
        </div>

        <div style={{ fontSize: "0.85rem", color: "var(--lv-ink)", lineHeight: 1.6 }}>
          <p>
            Removing <strong>{team.team_name}</strong> will replace them with a BYE in their pool.
          </p>
          <p style={{ color: "var(--lv-ink-muted)", marginTop: 6 }}>
            All of {team.team_name}&apos;s completed matches will remain in the record as they were played.
          </p>

          {affectedMatches.length > 0 && (
            <>
              <p style={{ marginTop: 10 }}>
                All of {team.team_name}&apos;s remaining scheduled matches will be auto-recorded as forfeit wins for their opponents:
              </p>
              <ul className="lv-withdraw-affected">
                {affectedMatches.map((m) => (
                  <li key={m.match.id}>
                    Pool {m.pool.pool_label} Match {m.match.match_order}: <strong>{getOpponentName(m)}</strong> wins
                    {" "}<span className="forfeit-score">{getForfeitDisplay(m)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <p style={{ color: "var(--lv-ink-muted)", fontSize: "0.8rem", marginTop: 8 }}>
            You can manually adjust any of these scores later if needed.
          </p>
        </div>

        {/* Work team callout */}
        {workTeamMatches.length > 0 && (
          <div className="lv-withdraw-work-callout">
            <strong>Note:</strong> {team.team_name} is still assigned as work team for {workTeamMatches.length} upcoming match{workTeamMatches.length > 1 ? "es" : ""}. Those matches will proceed normally — you may want to reassign the work team.
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              {workTeamMatches.map((m) => {
                const available = getAvailableWorkTeams(m);
                return (
                  <div key={m.match.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.75rem" }}>
                    <span>Pool {m.pool.pool_label} Match {m.match.match_order}</span>
                    {available.length > 0 && (
                      <select
                        className="lv-withdraw-reassign-btn"
                        style={{ appearance: "auto", padding: "2px 6px" }}
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) onChangeWorkTeam(m.match.id, e.target.value);
                        }}
                      >
                        <option value="" disabled>Reassign...</option>
                        {available.map((t) => (
                          <option key={t.team_id} value={t.team_id}>{t.team_name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="lv-admin-modal-footer">
          <button type="button" className="lv-btn lv-btn-ghost" onClick={onClose} disabled={withdrawing}>
            Cancel
          </button>
          <button
            type="button"
            className="lv-btn lv-btn-destructive"
            style={{ fontWeight: 600 }}
            disabled={withdrawing}
            onClick={handleWithdraw}
          >
            {withdrawing ? "Removing..." : "Remove team and record forfeits"}
          </button>
        </div>

        {/* Advanced: hard delete */}
        {!showAdvanced ? (
          <button className="lv-advanced-toggle" onClick={() => setShowAdvanced(true)}>
            Show advanced
          </button>
        ) : (
          <div style={{ marginTop: "0.75rem", padding: "10px 12px", background: "rgba(197, 48, 48, 0.04)", borderRadius: "var(--lv-radius-sm)", border: "1px solid rgba(197, 48, 48, 0.15)" }}>
            <p style={{ fontSize: "0.75rem", color: "var(--lv-error)", marginBottom: 6 }}>
              Permanently delete all team data including completed match history. This cannot be undone.
            </p>
            <button
              type="button"
              className="lv-btn lv-btn-ghost"
              style={{ color: "var(--lv-error)", fontSize: "0.75rem", padding: "4px 10px" }}
              onClick={handleHardDelete}
            >
              Permanently delete team data
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import type { Team } from "./types";

interface TeamRosterProps {
  teams: Team[];
  poolsExist: boolean;
  onAddTeam: () => void;
  onEditTeam: (team: Team) => void;
  onWithdrawTeam: (team: Team) => void;
  onDeleteTeam: (team: Team) => void;
  onPatchTeam: (id: string, updates: Record<string, unknown>) => void;
  setTeams: React.Dispatch<React.SetStateAction<Team[]>>;
}

function formatRegisteredDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function TeamRoster({
  teams,
  poolsExist,
  onAddTeam,
  onEditTeam,
  onWithdrawTeam,
  onDeleteTeam,
  onPatchTeam,
  setTeams,
}: TeamRosterProps) {
  const [expanded, setExpanded] = useState(!poolsExist);
  const [showWithdrawn, setShowWithdrawn] = useState(false);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());

  const activeTeams = teams.filter((t) => !t.withdrawn_at);
  const withdrawnTeams = teams.filter((t) => !!t.withdrawn_at);
  const checkedInCount = activeTeams.filter((t) => t.checked_in).length;
  const displayTeams = showWithdrawn ? teams : activeTeams;

  function toggleTeamExpand(teamId: string) {
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  }

  return (
    <div className="lv-roster-section">
      {/* Header — always visible */}
      <button className="lv-roster-header" onClick={() => setExpanded(!expanded)}>
        <span className="lv-roster-title">
          Registered teams &middot; {activeTeams.length}
        </span>
        {!expanded && (
          <span className="lv-roster-summary">
            {checkedInCount} checked in
            {withdrawnTeams.length > 0 && ` · ${withdrawnTeams.length} withdrawn`}
          </span>
        )}
        <svg
          className={`lv-admin-expand-icon ${expanded ? "open" : ""}`}
          width="14" height="14" viewBox="0 0 20 20"
          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 8l4 4 4-4" />
        </svg>
      </button>

      {/* Add team button — next to header area */}
      {expanded && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <button className="lv-btn lv-btn-secondary lv-roster-add-btn" onClick={onAddTeam} style={{ fontSize: "0.8rem", padding: "6px 12px" }}>
            Add team
          </button>
        </div>
      )}

      {expanded && (
        <div className="lv-roster-body">
          {/* Desktop table */}
          <div className="lv-roster-table-wrap">
            <table className="lv-roster-table">
              <thead>
                <tr>
                  <th>Team name</th>
                  <th>Captain</th>
                  <th>Players</th>
                  <th>Seed</th>
                  <th>Checked in</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {displayTeams.map((t) => {
                  const captain = t.players.find((p) => p.is_captain);
                  const teammates = t.players.filter((p) => !p.is_captain);
                  const isWithdrawn = !!t.withdrawn_at;
                  const isTeamExpanded = expandedTeams.has(t.id);
                  return (
                    <TeamTableRows
                      key={t.id}
                      team={t}
                      captain={captain}
                      teammates={teammates}
                      isWithdrawn={isWithdrawn}
                      isTeamExpanded={isTeamExpanded}
                      onToggleExpand={() => toggleTeamExpand(t.id)}
                      poolsExist={poolsExist}
                      onEditTeam={onEditTeam}
                      onWithdrawTeam={onWithdrawTeam}
                      onDeleteTeam={onDeleteTeam}
                      onPatchTeam={onPatchTeam}
                      setTeams={setTeams}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lv-roster-cards">
            {displayTeams.map((t) => {
              const captain = t.players.find((p) => p.is_captain);
              const teammates = t.players.filter((p) => !p.is_captain);
              const isWithdrawn = !!t.withdrawn_at;
              const isTeamExpanded = expandedTeams.has(t.id);
              return (
                <div key={t.id} className="lv-roster-card" style={isWithdrawn ? { opacity: 0.5 } : undefined}>
                  <div className="lv-roster-card-top" onClick={() => toggleTeamExpand(t.id)}>
                    <div style={{ flex: 1 }}>
                      <div className="lv-roster-card-name">
                        {t.team_name}
                        {isWithdrawn && <span style={{ fontSize: "0.7rem", color: "var(--lv-ink-muted)", fontWeight: 400, fontStyle: "italic" }}> (withdrawn)</span>}
                      </div>
                      <div className="lv-roster-card-players">
                        <div className="lv-roster-player-line">
                          <span className="lv-roster-player-name">
                            {captain?.name ?? "—"} <span className="lv-roster-captain-badge">Capt</span>
                          </span>
                          {isTeamExpanded && (
                            <span className="lv-roster-player-contact">
                              {captain?.email && <span>{captain.email}</span>}
                              {(captain as any)?.phone && <span>{(captain as any).phone}</span>}
                              {t.contact_phone && <span>{t.contact_phone}</span>}
                            </span>
                          )}
                        </div>
                        {teammates.map((p) => (
                          <div key={p.id} className="lv-roster-player-line">
                            <span className="lv-roster-player-name">{p.name}</span>
                            {isTeamExpanded && (p.email || (p as any).phone) && (
                              <span className="lv-roster-player-contact">
                                {p.email && <span>{p.email}</span>}
                                {(p as any).phone && <span>{(p as any).phone}</span>}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      {isTeamExpanded && (
                        <div className="lv-roster-registered-at">
                          Registered {formatRegisteredDate(t.created_at)}
                        </div>
                      )}
                    </div>
                    <svg
                      className={`lv-admin-expand-icon ${isTeamExpanded ? "open" : ""}`}
                      width="12" height="12" viewBox="0 0 20 20"
                      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      aria-hidden="true"
                      style={{ flexShrink: 0, marginLeft: 8, color: "var(--lv-ink-muted)" }}
                    >
                      <path d="M6 8l4 4 4-4" />
                    </svg>
                  </div>

                  {!isWithdrawn && (
                    <div className="lv-roster-card-row">
                      <div className="lv-admin-card-row">
                        <span className="lv-admin-card-label">Seed</span>
                        <input
                          type="number"
                          className="lv-admin-seed"
                          value={t.seed ?? ""}
                          min={1}
                          onChange={(e) => {
                            const val = e.target.value ? parseInt(e.target.value, 10) : null;
                            setTeams((prev) => prev.map((team) => team.id === t.id ? { ...team, seed: val } : team));
                          }}
                          onBlur={(e) => {
                            const val = e.target.value ? parseInt(e.target.value, 10) : null;
                            onPatchTeam(t.id, { seed: val });
                          }}
                        />
                      </div>
                      <div className="lv-admin-card-row">
                        <span className="lv-admin-card-label">Checked in</span>
                        <button
                          className={`lv-toggle ${t.checked_in ? "on" : ""}`}
                          onClick={() => onPatchTeam(t.id, { checked_in: !t.checked_in })}
                          aria-label={t.checked_in ? "Checked in" : "Not checked in"}
                        />
                      </div>
                    </div>
                  )}
                  {!isWithdrawn && (
                    <div className="lv-roster-card-actions">
                      <button
                        className="lv-admin-action-btn"
                        onClick={() => onEditTeam(t)}
                        aria-label="Edit team"
                      >
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M13.586 3.586a2 2 0 012.828 2.828l-8.793 8.793L4 16l.793-3.621 8.793-8.793z" />
                        </svg>
                      </button>
                      <button
                        className="lv-admin-action-btn lv-admin-action-btn-danger"
                        onClick={() => poolsExist ? onWithdrawTeam(t) : onDeleteTeam(t)}
                        aria-label={poolsExist ? "Withdraw team" : "Remove team"}
                      >
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h14M8 6V4a1 1 0 011-1h2a1 1 0 011 1v2m2 0v10a2 2 0 01-2 2H8a2 2 0 01-2-2V6h12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Withdrawn teams toggle */}
          {withdrawnTeams.length > 0 && (
            <button
              className="lv-withdrawn-toggle"
              onClick={() => setShowWithdrawn(!showWithdrawn)}
            >
              {showWithdrawn
                ? `Hide ${withdrawnTeams.length} withdrawn team${withdrawnTeams.length > 1 ? "s" : ""}`
                : `Show ${withdrawnTeams.length} withdrawn team${withdrawnTeams.length > 1 ? "s" : ""}`
              }
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Desktop table row + expandable detail ── */

function TeamTableRows({
  team: t,
  captain,
  teammates,
  isWithdrawn,
  isTeamExpanded,
  onToggleExpand,
  poolsExist,
  onEditTeam,
  onWithdrawTeam,
  onDeleteTeam,
  onPatchTeam,
  setTeams,
}: {
  team: Team;
  captain: Team["players"][number] | undefined;
  teammates: Team["players"];
  isWithdrawn: boolean;
  isTeamExpanded: boolean;
  onToggleExpand: () => void;
  poolsExist: boolean;
  onEditTeam: (team: Team) => void;
  onWithdrawTeam: (team: Team) => void;
  onDeleteTeam: (team: Team) => void;
  onPatchTeam: (id: string, updates: Record<string, unknown>) => void;
  setTeams: React.Dispatch<React.SetStateAction<Team[]>>;
}) {
  return (
    <>
      <tr
        style={{ ...(isWithdrawn ? { opacity: 0.5 } : undefined), cursor: "pointer" }}
        onClick={onToggleExpand}
        className={isTeamExpanded ? "lv-roster-row-expanded" : ""}
      >
        <td className="lv-admin-team-name">
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg
              className={`lv-admin-expand-icon ${isTeamExpanded ? "open" : ""}`}
              width="12" height="12" viewBox="0 0 20 20"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              aria-hidden="true"
              style={{ flexShrink: 0, color: "var(--lv-ink-muted)" }}
            >
              <path d="M6 8l4 4 4-4" />
            </svg>
            {t.team_name}
            {isWithdrawn && (
              <span style={{ fontWeight: 400, fontSize: "0.7rem", color: "var(--lv-ink-muted)", fontStyle: "italic" }}>
                (withdrawn)
              </span>
            )}
          </div>
        </td>
        <td>
          <div className="lv-roster-player-line">
            <span className="lv-roster-player-name">{captain?.name ?? "—"} <span className="lv-roster-captain-badge">Capt</span></span>
            {isTeamExpanded && (
              <span className="lv-roster-player-contact">
                {captain?.email && <span>{captain.email}</span>}
                {t.contact_phone && <span>{t.contact_phone}</span>}
              </span>
            )}
          </div>
        </td>
        <td>
          {teammates.length > 0 ? (
            <div className="lv-roster-players-cell">
              {teammates.map((p) => (
                <div key={p.id} className="lv-roster-player-line">
                  <span className="lv-roster-player-name">{p.name}</span>
                  {isTeamExpanded && p.email && (
                    <span className="lv-roster-player-contact">
                      <span>{p.email}</span>
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : "—"}
        </td>
        <td onClick={(e) => e.stopPropagation()}>
          {isWithdrawn ? (
            <span style={{ color: "var(--lv-ink-muted)" }}>{t.seed ?? "—"}</span>
          ) : (
            <input
              type="number"
              className="lv-admin-seed"
              value={t.seed ?? ""}
              min={1}
              onChange={(e) => {
                const val = e.target.value ? parseInt(e.target.value, 10) : null;
                setTeams((prev) => prev.map((team) => team.id === t.id ? { ...team, seed: val } : team));
              }}
              onBlur={(e) => {
                const val = e.target.value ? parseInt(e.target.value, 10) : null;
                onPatchTeam(t.id, { seed: val });
              }}
            />
          )}
        </td>
        <td onClick={(e) => e.stopPropagation()}>
          {isWithdrawn ? (
            <span style={{ fontSize: "0.7rem", color: "var(--lv-ink-muted)" }}>—</span>
          ) : (
            <button
              className={`lv-toggle ${t.checked_in ? "on" : ""}`}
              onClick={() => onPatchTeam(t.id, { checked_in: !t.checked_in })}
              aria-label={t.checked_in ? "Checked in" : "Not checked in"}
            />
          )}
        </td>
        <td onClick={(e) => e.stopPropagation()}>
          {!isWithdrawn && (
            <div style={{ display: "flex", gap: 2 }}>
              <button
                className="lv-admin-action-btn"
                onClick={() => onEditTeam(t)}
                aria-label="Edit team"
              >
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13.586 3.586a2 2 0 012.828 2.828l-8.793 8.793L4 16l.793-3.621 8.793-8.793z" />
                </svg>
              </button>
              <button
                className="lv-admin-action-btn lv-admin-action-btn-danger"
                onClick={() => {
                  if (poolsExist) onWithdrawTeam(t);
                  else onDeleteTeam(t);
                }}
                aria-label={poolsExist ? "Withdraw team" : "Remove team"}
              >
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h14M8 6V4a1 1 0 011-1h2a1 1 0 011 1v2m2 0v10a2 2 0 01-2 2H8a2 2 0 01-2-2V6h12" />
                </svg>
              </button>
            </div>
          )}
        </td>
      </tr>

      {/* Expanded registered-at row */}
      {isTeamExpanded && (
        <tr className="lv-roster-detail-row">
          <td colSpan={6}>
            <div className="lv-roster-registered-at">
              Registered {formatRegisteredDate(t.created_at)}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

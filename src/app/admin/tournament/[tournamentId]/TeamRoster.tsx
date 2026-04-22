"use client";

import { useState } from "react";
import type { Team } from "./types";

interface TeamRosterProps {
  teams: Team[];
  poolsExist: boolean;
  onAddTeam: () => void;
  onWithdrawTeam: (team: Team) => void;
  onDeleteTeam: (team: Team) => void;
  onPatchTeam: (id: string, updates: Record<string, unknown>) => void;
  setTeams: React.Dispatch<React.SetStateAction<Team[]>>;
}

export function TeamRoster({
  teams,
  poolsExist,
  onAddTeam,
  onWithdrawTeam,
  onDeleteTeam,
  onPatchTeam,
  setTeams,
}: TeamRosterProps) {
  const [expanded, setExpanded] = useState(!poolsExist);
  const [showWithdrawn, setShowWithdrawn] = useState(false);

  const activeTeams = teams.filter((t) => !t.withdrawn_at);
  const withdrawnTeams = teams.filter((t) => !!t.withdrawn_at);
  const checkedInCount = activeTeams.filter((t) => t.checked_in).length;
  const displayTeams = showWithdrawn ? teams : activeTeams;

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
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Players</th>
                  <th>Seed</th>
                  <th>Checked in</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {displayTeams.map((t) => {
                  const captain = t.players.find((p) => p.is_captain);
                  const isWithdrawn = !!t.withdrawn_at;
                  return (
                    <tr key={t.id} style={isWithdrawn ? { opacity: 0.5 } : undefined}>
                      <td className="lv-admin-team-name">
                        {t.team_name}
                        {isWithdrawn && (
                          <span style={{ fontWeight: 400, fontSize: "0.7rem", color: "var(--lv-ink-muted)", fontStyle: "italic", marginLeft: 6 }}>
                            (withdrawn)
                          </span>
                        )}
                      </td>
                      <td>{captain?.name ?? "—"}</td>
                      <td>{t.contact_email}</td>
                      <td>{t.contact_phone}</td>
                      <td>{t.players.length}</td>
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
                          <button
                            className="lv-admin-action-btn lv-admin-action-btn-danger"
                            onClick={() => {
                              if (poolsExist) {
                                onWithdrawTeam(t);
                              } else {
                                onDeleteTeam(t);
                              }
                            }}
                            aria-label={poolsExist ? "Withdraw team" : "Remove team"}
                          >
                            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h14M8 6V4a1 1 0 011-1h2a1 1 0 011 1v2m2 0v10a2 2 0 01-2 2H8a2 2 0 01-2-2V6h12" />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lv-roster-cards">
            {displayTeams.map((t) => {
              const captain = t.players.find((p) => p.is_captain);
              const isWithdrawn = !!t.withdrawn_at;
              return (
                <div key={t.id} className="lv-roster-card" style={isWithdrawn ? { opacity: 0.5 } : undefined}>
                  <div className="lv-roster-card-name">
                    {t.team_name}
                    {isWithdrawn && <span style={{ fontSize: "0.7rem", color: "var(--lv-ink-muted)", fontWeight: 400, fontStyle: "italic" }}> (withdrawn)</span>}
                  </div>
                  <div className="lv-roster-card-captain">
                    {captain?.name ?? "—"} &middot; {t.contact_email} &middot; {t.contact_phone}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--lv-ink-muted)" }}>
                    {t.players.length} player{t.players.length !== 1 ? "s" : ""}
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
                    <button
                      className="lv-admin-action-btn lv-admin-action-btn-danger lv-roster-card-delete"
                      onClick={() => poolsExist ? onWithdrawTeam(t) : onDeleteTeam(t)}
                      aria-label={poolsExist ? "Withdraw team" : "Remove team"}
                    >
                      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h14M8 6V4a1 1 0 011-1h2a1 1 0 011 1v2m2 0v10a2 2 0 01-2 2H8a2 2 0 01-2-2V6h12" />
                      </svg>
                    </button>
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

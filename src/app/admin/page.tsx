"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { Tournament } from "@/lib/tournaments";
import { DividerOrnament } from "../(tournament)/ornaments";

interface Team {
  id: string;
  tournament_id: string;
  team_name: string;
  contact_email: string;
  contact_phone: string;
  seed: number | null;
  checked_in: boolean;
  created_at: string;
  players: { id: string; name: string; email: string | null; is_captain: boolean }[];
}

export default function AdminDashboard() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [activeTab, setActiveTab] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [poolModal, setPoolModal] = useState(false);
  const [unseededWarning, setUnseededWarning] = useState<string[]>([]);
  const [pools, setPools] = useState<{ court: number; teams: Team[] }[] | null>(null);

  useEffect(() => {
    fetch("/api/register?check=tournaments")
      .then((r) => r.json())
      .then((data) => {
        const sorted = (data.tournaments as Tournament[]).sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        );
        setTournaments(sorted);
        if (sorted.length > 0) setActiveTab(sorted[0].id);
      })
      .catch((err) => console.error("Failed to load tournaments:", err));
  }, []);

  const loadTeams = useCallback(async () => {
    if (!activeTab) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/teams?tournament=${activeTab}`);
      const data = await res.json();
      setTeams(data.teams ?? []);
    } catch (err) {
      console.error("Failed to load teams:", err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { loadTeams(); }, [loadTeams]);

  const active = tournaments.find((t) => t.id === activeTab);

  async function patchTeam(id: string, updates: Record<string, unknown>) {
    // Update local state immediately
    setTeams((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    );
    await fetch(`/api/admin/teams/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
  }

  async function deleteTeam(id: string, name: string) {
    if (!confirm(`Remove "${name}"? This cannot be undone.`)) return;
    await fetch(`/api/admin/teams/${id}`, { method: "DELETE" });
    loadTeams();
  }

  function handleCreatePools() {
    const checkedIn = teams.filter((t) => t.checked_in);
    const unseeded = checkedIn.filter((t) => t.seed == null);

    if (unseeded.length > 0) {
      setUnseededWarning(unseeded.map((t) => `${t.team_name} — needs a seed number`));
      return;
    }

    // Check for duplicate seeds
    const seedMap = new Map<number, string[]>();
    for (const t of checkedIn) {
      const s = t.seed!;
      if (!seedMap.has(s)) seedMap.set(s, []);
      seedMap.get(s)!.push(t.team_name);
    }
    const dupes = Array.from(seedMap.entries())
      .filter(([, names]) => names.length > 1)
      .map(([seed, names]) => `Seed #${seed}: ${names.join(", ")}`);

    if (dupes.length > 0) {
      setUnseededWarning(dupes.map((d) => `Duplicate — ${d}`));
      return;
    }

    setUnseededWarning([]);
    setPoolModal(true);
  }

  function generatePools(netCount: number) {
    const checkedIn = teams
      .filter((t) => t.checked_in && t.seed != null)
      .sort((a, b) => a.seed! - b.seed!);

    const k = netCount;
    const n = checkedIn.length;

    // Initialize pools
    const poolArrays: Team[][] = Array.from({ length: k }, () => []);

    // Serpentine draft
    let direction = 1; // 1 = left-to-right, -1 = right-to-left
    let col = 0;

    for (let i = 0; i < n; i++) {
      poolArrays[col].push(checkedIn[i]);

      // Move to next column
      const nextCol = col + direction;
      if (nextCol >= k || nextCol < 0) {
        // Reverse direction, stay on same column for next row
        direction *= -1;
      } else {
        col = nextCol;
      }
    }

    setPools(
      poolArrays
        .filter((p) => p.length > 0)
        .map((teams, i) => ({ court: i + 1, teams })),
    );
    setPoolModal(false);
  }

  return (
    <div className="lv-admin-page">
      <p className="lv-label lv-admin-page-label">Dashboard</p>
      <h1 className="lv-admin-page-heading">Tournament registrations</h1>

      {/* Date selector — same style as registration page */}
      <div className="lv-field" style={{ marginBottom: "2rem" }}>
        <span className="lv-field-label">Tournament Date</span>
        {active ? (
          <button
            type="button"
            className="lv-date-list-selected"
            onClick={() => setActiveTab("")}
          >
            <span className="lv-date-list-date">
              {new Date(active.date).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            <span className="lv-date-list-format">
              {active.format === "doubles"
                ? "Doubles (2v2)"
                : active.format === "triples"
                  ? "Triples (3v3)"
                  : `${active.format} (${active.teamSize}v${active.teamSize})`}
            </span>
            <span className="lv-date-list-change">Change</span>
          </button>
        ) : (
          <div className="lv-date-list" role="listbox" aria-label="Select tournament date">
            {tournaments.map((t) => {
              const d = new Date(t.date);
              const label = d.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              });
              const formatLabel = t.format === "doubles"
                ? "Doubles (2v2)"
                : t.format === "triples"
                  ? "Triples (3v3)"
                  : `${t.format} (${t.teamSize}v${t.teamSize})`;

              return (
                <button
                  key={t.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  className="lv-date-list-item"
                  onClick={() => setActiveTab(t.id)}
                >
                  <span className="lv-date-list-date">{label}</span>
                  <span className="lv-date-list-format">{formatLabel}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {active && (
        <>
          {/* Info */}
          <div className="lv-admin-info">
            <strong style={{ color: "var(--lv-ink)" }}>{active.name}</strong>
            {" "}&middot; {active.location}
            <span className="lv-admin-pill">
              {teams.length} registered
            </span>
          </div>

          {/* Actions */}
          <div className="lv-admin-actions">
            <button className="lv-btn lv-btn-secondary" onClick={() => setModal(true)}>
              Add team
            </button>
            <button className="lv-btn lv-btn-primary" onClick={handleCreatePools}>
              Create pools
            </button>
          </div>

          {/* Unseeded warning */}
          {unseededWarning.length > 0 && (
            <div className="lv-admin-unseeded-warning">
              <strong>Cannot create pools.</strong> The following checked-in teams need a seed number:
              <ul>
                {unseededWarning.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Pool results */}
          {pools && (
            <div className="lv-admin-pools">
              <div className="lv-admin-pools-header">
                <h3 className="lv-admin-pools-title">Pool Draw</h3>
                <button className="lv-btn lv-btn-ghost" onClick={() => setPools(null)}>
                  Close
                </button>
              </div>
              <div className="lv-admin-pools-grid">
                {pools.map((pool) => (
                  <div key={pool.court} className="lv-admin-pool-card">
                    <div className="lv-admin-pool-court">Court {pool.court}</div>
                    <div className="lv-admin-pool-count">{pool.teams.length} teams</div>
                    <div className="lv-admin-pool-teams">
                      {pool.teams.map((t) => (
                        <div key={t.id} className="lv-admin-pool-team">
                          <span className="lv-admin-pool-seed">#{t.seed}</span>
                          <span className="lv-admin-pool-name">{t.team_name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Table or empty */}
          {loading ? (
            <div className="lv-admin-empty">
              <p className="lv-admin-empty-sub">Loading teams&hellip;</p>
            </div>
          ) : teams.length === 0 ? (
            <div className="lv-admin-empty">
              <DividerOrnament className="lv-admin-empty-ornament" />
              <p className="lv-admin-empty-heading">No teams registered yet</p>
              <p className="lv-admin-empty-sub">
                Share the registration link to start collecting signups.
              </p>
              <div className="lv-admin-link-callout">
                <span className="lv-admin-link-callout-label">Registration link</span>
                <span className="lv-admin-link-callout-url">
                  {typeof window !== "undefined" ? window.location.origin : ""}
                  /longvolleyball/register?tournament={activeTab}
                </span>
                <button
                  className="lv-admin-link-callout-copy"
                  onClick={() => {
                    const url = `${window.location.origin}/longvolleyball/register?tournament=${activeTab}`;
                    navigator.clipboard.writeText(url);
                  }}
                >
                  Copy link
                </button>
              </div>
            </div>
          ) : (
            <>
            {/* === MOBILE CARD LIST === */}
            <div className="lv-admin-cards-mobile">
              {teams.map((t) => {
                const captain = t.players.find((p) => p.is_captain);
                const teammates = t.players.filter((p) => !p.is_captain);
                const isExpanded = expandedTeam === t.id;

                return (
                  <div key={t.id} className={`lv-admin-card ${isExpanded ? "expanded" : ""}`}>
                    {/* Card header — tap to expand */}
                    <button
                      className="lv-admin-card-header"
                      onClick={() => setExpandedTeam(isExpanded ? null : t.id)}
                    >
                      <div className="lv-admin-card-title-row">
                        <span className="lv-admin-card-team-name">{t.team_name}</span>
                        <svg className={`lv-admin-expand-icon ${isExpanded ? "open" : ""}`} width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M6 8l4 4 4-4" />
                        </svg>
                      </div>
                      <span className="lv-admin-card-captain">{captain?.name ?? "—"}</span>
                    </button>

                    {/* Card body — always visible */}
                    <div className="lv-admin-card-body">
                      <div className="lv-admin-card-row">
                        <span className="lv-admin-card-label">Seed</span>
                        <input
                          type="number"
                          className="lv-admin-seed"
                          value={t.seed ?? ""}
                          min={1}
                          onChange={(e) => {
                            const val = e.target.value ? parseInt(e.target.value, 10) : null;
                            setTeams((prev) =>
                              prev.map((team) => team.id === t.id ? { ...team, seed: val } : team),
                            );
                          }}
                          onBlur={(e) => {
                            const val = e.target.value ? parseInt(e.target.value, 10) : null;
                            patchTeam(t.id, { seed: val });
                          }}
                        />
                      </div>
                      <div className="lv-admin-card-row">
                        <span className="lv-admin-card-label">Checked in</span>
                        <button
                          className={`lv-toggle ${t.checked_in ? "on" : ""}`}
                          onClick={() => {
                            patchTeam(t.id, { checked_in: !t.checked_in });
                            setTeams((prev) =>
                              prev.map((team) =>
                                team.id === t.id
                                  ? { ...team, checked_in: !team.checked_in }
                                  : team,
                              ),
                            );
                          }}
                          aria-label={t.checked_in ? "Checked in" : "Not checked in"}
                        />
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="lv-admin-card-details">
                        <div className="lv-admin-card-detail">
                          <span className="lv-admin-card-label">Email</span>
                          <span>{t.contact_email}</span>
                        </div>
                        <div className="lv-admin-card-detail">
                          <span className="lv-admin-card-label">Phone</span>
                          <span>{t.contact_phone}</span>
                        </div>
                        <div className="lv-admin-card-detail">
                          <span className="lv-admin-card-label">Registered</span>
                          <span>{new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                        </div>
                        {teammates.length > 0 && (
                          <div className="lv-admin-card-teammates">
                            <span className="lv-admin-card-label">Teammates</span>
                            {teammates.map((p) => (
                              <div key={p.id} className="lv-admin-teammate">
                                <span className="lv-admin-teammate-name">{p.name}</span>
                                <span className="lv-admin-teammate-email">{p.email ?? "—"}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <button
                          className="lv-admin-card-delete"
                          onClick={() => deleteTeam(t.id, t.team_name)}
                        >
                          Remove team
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* === DESKTOP TABLE === */}
            <div className="lv-admin-table-wrap">
              <table className="lv-admin-table">
                <thead>
                  <tr>
                    <th>Team name</th>
                    <th>Captain</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Players</th>
                    <th>Seed</th>
                    <th>Checked in</th>
                    <th>Registered</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((t) => {
                    const captain = t.players.find((p) => p.is_captain);
                    const teammates = t.players.filter((p) => !p.is_captain);
                    const isExpanded = expandedTeam === t.id;

                    return (
                      <React.Fragment key={t.id}>
                        <tr
                          className={`lv-admin-row-clickable ${isExpanded ? "expanded" : ""}`}
                          onClick={() => setExpandedTeam(isExpanded ? null : t.id)}
                        >
                          <td className="lv-admin-team-name">
                            <svg className={`lv-admin-expand-icon ${isExpanded ? "open" : ""}`} width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M6 8l4 4 4-4" />
                            </svg>
                            {t.team_name}
                          </td>
                          <td>{captain?.name ?? "—"}</td>
                          <td>{t.contact_email}</td>
                          <td>{t.contact_phone}</td>
                          <td>{t.players.length}</td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <input
                              type="number"
                              className="lv-admin-seed"
                              defaultValue={t.seed ?? ""}
                              min={1}
                              onBlur={(e) => {
                                const val = e.target.value ? parseInt(e.target.value, 10) : null;
                                patchTeam(t.id, { seed: val });
                              }}
                            />
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <button
                              className={`lv-toggle ${t.checked_in ? "on" : ""}`}
                              onClick={() => {
                                patchTeam(t.id, { checked_in: !t.checked_in });
                                setTeams((prev) =>
                                  prev.map((team) =>
                                    team.id === t.id
                                      ? { ...team, checked_in: !team.checked_in }
                                      : team,
                                  ),
                                );
                              }}
                              aria-label={t.checked_in ? "Checked in" : "Not checked in"}
                            />
                          </td>
                          <td>
                            {new Date(t.created_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <button
                              className="lv-admin-action-btn lv-admin-action-btn-danger"
                              onClick={() => deleteTeam(t.id, t.team_name)}
                              aria-label="Remove team"
                            >
                              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h14M8 6V4a1 1 0 011-1h2a1 1 0 011 1v2m2 0v10a2 2 0 01-2 2H8a2 2 0 01-2-2V6h12" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                        {isExpanded && teammates.length > 0 && (
                          <tr className="lv-admin-expand-row">
                            <td colSpan={9}>
                              <div className="lv-admin-teammates">
                                {teammates.map((p) => (
                                  <div key={p.id} className="lv-admin-teammate">
                                    <span className="lv-admin-teammate-name">{p.name}</span>
                                    <span className="lv-admin-teammate-email">{p.email ?? "—"}</span>
                                  </div>
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
            </>
          )}
        </>
      )}

      {/* Add team modal */}
      {modal && active && (
        <AddTeamModal
          tournament={active}
          onClose={() => setModal(false)}
          onAdded={() => { setModal(false); loadTeams(); }}
        />
      )}

      {/* Net count modal */}
      {poolModal && (
        <NetCountModal
          checkedInCount={teams.filter((t) => t.checked_in).length}
          onClose={() => setPoolModal(false)}
          onConfirm={generatePools}
        />
      )}
    </div>
  );
}

/* ---- ADD TEAM MODAL ---- */
function AddTeamModal({
  tournament,
  onClose,
  onAdded,
}: {
  tournament: Tournament;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [teamName, setTeamName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [players, setPlayers] = useState(
    Array.from({ length: tournament.teamSize }, () => ({ name: "", email: "" })),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function updatePlayer(idx: number, field: "name" | "email", value: string) {
    setPlayers((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tournamentId: tournament.id,
        teamName,
        contactPhone,
        players,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to add team.");
      setSubmitting(false);
    } else {
      onAdded();
    }
  }

  return (
    <div className="lv-admin-overlay" onClick={onClose}>
      <div className="lv-admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="lv-admin-modal-header">
          <h2 className="lv-admin-modal-title">Add team</h2>
          <button className="lv-admin-modal-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="lv-form">
          <div className="lv-field">
            <label className="lv-field-label">Team name</label>
            <input
              className="lv-input"
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              required
            />
          </div>

          {players.map((p, idx) => {
            const isCaptain = idx === 0;
            return (
              <fieldset key={idx} className="lv-player-group">
                <legend className="lv-player-legend">
                  {isCaptain ? "Captain" : `Player ${idx + 1}`}
                </legend>
                <div className="lv-field">
                  <label className="lv-field-label">Name</label>
                  <input
                    className="lv-input"
                    type="text"
                    value={p.name}
                    onChange={(e) => updatePlayer(idx, "name", e.target.value)}
                    required
                  />
                </div>
                <div className="lv-field">
                  <label className="lv-field-label">
                    Email{isCaptain ? "" : " (optional)"}
                  </label>
                  <input
                    className="lv-input"
                    type="email"
                    value={p.email}
                    onChange={(e) => updatePlayer(idx, "email", e.target.value)}
                    required={isCaptain}
                  />
                </div>
                {isCaptain && (
                  <div className="lv-field">
                    <label className="lv-field-label">Phone</label>
                    <input
                      className="lv-input"
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      required
                    />
                  </div>
                )}
              </fieldset>
            );
          })}

          {error && <p className="lv-error">{error}</p>}

          <div className="lv-admin-modal-footer">
            <button type="button" className="lv-btn lv-btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="lv-btn lv-btn-primary" disabled={submitting}>
              {submitting ? (
                <>
                  <span className="lv-spinner" />
                  Adding&hellip;
                </>
              ) : (
                "Add team"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---- NET COUNT MODAL ---- */
function NetCountModal({
  checkedInCount,
  onClose,
  onConfirm,
}: {
  checkedInCount: number;
  onClose: () => void;
  onConfirm: (nets: number) => void;
}) {
  const [nets, setNets] = useState("");

  const netNum = parseInt(nets, 10);
  const valid = netNum > 0 && netNum <= checkedInCount;

  // Preview pool sizes
  let preview = "";
  if (valid) {
    const base = Math.floor(checkedInCount / netNum);
    const remainder = checkedInCount % netNum;
    if (remainder === 0) {
      preview = `${netNum} pools of ${base}`;
    } else {
      preview = `${remainder} pool${remainder > 1 ? "s" : ""} of ${base + 1}, ${netNum - remainder} pool${netNum - remainder > 1 ? "s" : ""} of ${base}`;
    }
    if (base < 3) {
      preview += " (warning: some pools under 3 teams)";
    }
  }

  return (
    <div className="lv-admin-overlay" onClick={onClose}>
      <div className="lv-admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="lv-admin-modal-header">
          <h2 className="lv-admin-modal-title">Create pools</h2>
          <button className="lv-admin-modal-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>

        <div className="lv-form">
          <p style={{ fontSize: "0.9rem", color: "var(--lv-ink-muted)", marginBottom: "0.5rem" }}>
            <strong style={{ color: "var(--lv-ink)" }}>{checkedInCount} teams</strong> checked in and seeded.
            Serpentine seeding will distribute teams across courts.
          </p>

          <div className="lv-field">
            <label className="lv-field-label" htmlFor="net-count">How many nets?</label>
            <input
              id="net-count"
              className="lv-input"
              type="number"
              min={1}
              max={checkedInCount}
              value={nets}
              onChange={(e) => setNets(e.target.value)}
              placeholder="e.g. 7"
              autoFocus
            />
          </div>

          {valid && (
            <p className="lv-admin-pool-preview">{preview}</p>
          )}

          <div className="lv-admin-modal-footer">
            <button type="button" className="lv-btn lv-btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="lv-btn lv-btn-primary"
              disabled={!valid}
              onClick={() => onConfirm(netNum)}
            >
              Generate pools
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

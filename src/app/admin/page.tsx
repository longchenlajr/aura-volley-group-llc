"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { getTournaments, type Tournament } from "@/lib/tournaments";
import type { PoolWithTeams } from "@/lib/pools";
import { generatePools as runPoolGeneration } from "@/lib/pool-generation";
import { computeTeamStats } from "@/lib/team-stats";
import { computeOverallStandings, getDefaultGoldCutoff, type OverallTeamStanding } from "@/lib/tournament-standings";
import { DividerOrnament } from "../(tournament)/ornaments";

interface MatchData {
  match: { id: string; pool_id: string; court_number: number; match_order: number; status: string };
  team_a: { id: string; team_name: string; seed_in_pool: number };
  team_b: { id: string; team_name: string; seed_in_pool: number };
  work_team: { id: string; team_name: string } | null;
  pool: { id: string; pool_label: string; court_number: number };
  token: string | null;
  sets: Array<{ set_number: number; team_a_score: number; team_b_score: number }>;
}

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
  const [savedPools, setSavedPools] = useState<PoolWithTeams[] | null>(null);
  const [poolsLoading, setPoolsLoading] = useState(false);
  const [swapModal, setSwapModal] = useState<{ teamId: string; teamName: string } | null>(null);
  const [regenerateConfirm, setRegenerateConfirm] = useState(false);
  const [savedMatches, setSavedMatches] = useState<MatchData[] | null>(null);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [workTeamModal, setWorkTeamModal] = useState<{ matchId: string; poolId: string; playingIds: string[] } | null>(null);
  const [playoffSetup, setPlayoffSetup] = useState(false);
  const [bracketsExist, setBracketsExist] = useState(false);
  const [bracketDataAdmin, setBracketDataAdmin] = useState<Array<{
    bracket: { id: string; bracket_type: string; points_per_set: number };
    matches: Array<{ id: string; round_number: number; match_position: number; court_number: number; match_order: number; status: string; team_a_name: string | null; team_b_name: string | null; work_team_name: string | null; winner_slot_id: string | null }>;
  }> | null>(null);

  useEffect(() => {
    const all = getTournaments().sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    setTournaments(all);
    if (all.length > 0) setActiveTab(all[0].id);
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

  const loadPools = useCallback(async () => {
    if (!activeTab) return;
    setPoolsLoading(true);
    try {
      const res = await fetch(`/api/admin/pools?tournament=${activeTab}`);
      const data = await res.json();
      setSavedPools(data.pools?.length > 0 ? data.pools : null);
    } catch {
      setSavedPools(null);
    } finally {
      setPoolsLoading(false);
    }
  }, [activeTab]);

  const loadMatches = useCallback(async () => {
    if (!activeTab) return;
    setMatchesLoading(true);
    try {
      const res = await fetch(`/api/admin/matches?tournament=${activeTab}`);
      const data = await res.json();
      setSavedMatches(data.matches?.length > 0 ? data.matches : null);
    } catch {
      setSavedMatches(null);
    } finally {
      setMatchesLoading(false);
    }
  }, [activeTab]);

  const checkBrackets = useCallback(async () => {
    if (!activeTab) return;
    try {
      const res = await fetch(`/api/admin/brackets?tournament=${activeTab}`);
      const data = await res.json();
      const brackets = data.brackets ?? [];
      setBracketsExist(brackets.length > 0);
      setBracketDataAdmin(brackets.length > 0 ? brackets : null);
    } catch {
      setBracketsExist(false);
      setBracketDataAdmin(null);
    }
  }, [activeTab]);

  useEffect(() => { loadTeams(); loadPools(); loadMatches(); checkBrackets(); }, [loadTeams, loadPools, loadMatches, checkBrackets]);

  const active = tournaments.find((t) => t.id === activeTab);

  // Compute team stats from matches
  const teamStats = useMemo(() => {
    if (!savedMatches || !teams.length) return new Map();
    const teamIds = teams.map((t) => t.id);
    // We need pool size per match — estimate from savedPools
    const poolSizeMap = new Map<string, number>();
    if (savedPools) {
      for (const p of savedPools) poolSizeMap.set(p.pool.id, p.teams.length);
    }
    const matchInputs = savedMatches.map((m) => ({
      team_a_id: m.team_a.id,
      team_b_id: m.team_b.id,
      status: m.match.status,
      sets: m.sets.map((s) => ({ team_a_score: s.team_a_score, team_b_score: s.team_b_score })),
      pool_size: poolSizeMap.get(m.match.pool_id) ?? 4,
    }));
    return computeTeamStats(teamIds, matchInputs);
  }, [savedMatches, teams, savedPools]);

  async function patchTeam(id: string, updates: Record<string, unknown>) {
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
    loadPools(); // team may have been in a pool
  }

  // --- Pool generation flow ---
  function handleCreatePools() {
    const checkedIn = teams.filter((t) => t.checked_in);
    const unseeded = checkedIn.filter((t) => t.seed == null);

    if (unseeded.length > 0) {
      setUnseededWarning(unseeded.map((t) => `${t.team_name} — needs a seed number`));
      return;
    }

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

    // If pools already exist, ask to regenerate
    if (savedPools) {
      setRegenerateConfirm(true);
      return;
    }

    setPoolModal(true);
  }

  async function persistPools(netCount: number) {
    const checkedIn = teams
      .filter((t) => t.checked_in && t.seed != null)
      .map((t) => ({ id: t.id, team_name: t.team_name, seed: t.seed! }));

    const result = runPoolGeneration({ teams: checkedIn, netCount });

    if ("error" in result) {
      setUnseededWarning([result.error]);
      setPoolModal(false);
      return;
    }

    // Save to database
    const res = await fetch("/api/admin/pools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tournament_id: activeTab,
        pools: result.pools,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setUnseededWarning([data.error ?? "Failed to save pools"]);
    }

    setPoolModal(false);
    loadPools();
  }

  async function handleRegenerate(netCount: number) {
    // Delete existing pools first
    await fetch(`/api/admin/pools?tournament=${activeTab}`, { method: "DELETE" });
    setSavedPools(null);
    await persistPools(netCount);
    setRegenerateConfirm(false);
  }

  async function handleSwap(targetTeamId: string) {
    if (!swapModal) return;
    const res = await fetch("/api/admin/pool-teams/swap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team_a_id: swapModal.teamId, team_b_id: targetTeamId }),
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "Swap failed");
    }

    setSwapModal(null);
    loadPools();
  }

  async function generateMatches() {
    const res = await fetch("/api/admin/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tournament_id: activeTab }),
    });
    if (!res.ok) {
      const data = await res.json();
      if (res.status === 409 && confirm("Matches already exist. Delete and regenerate?")) {
        await fetch(`/api/admin/matches?tournament=${activeTab}`, { method: "DELETE" });
        await generateMatches();
        return;
      }
      alert(data.error ?? "Failed to generate matches");
      return;
    }
    loadMatches();
  }

  async function swapMatchOrder(matchId: string, direction: "up" | "down") {
    if (!savedMatches) return;
    const idx = savedMatches.findIndex((m) => m.match.id === matchId);
    if (idx === -1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= savedMatches.length) return;

    // Only swap within same pool
    if (savedMatches[idx].match.pool_id !== savedMatches[swapIdx].match.pool_id) return;

    const orderA = savedMatches[idx].match.match_order;
    const orderB = savedMatches[swapIdx].match.match_order;

    await Promise.all([
      fetch(`/api/admin/matches/${savedMatches[idx].match.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_order: orderB }),
      }),
      fetch(`/api/admin/matches/${savedMatches[swapIdx].match.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_order: orderA }),
      }),
    ]);

    loadMatches();
  }

  async function changeWorkTeam(matchId: string, newWorkTeamId: string) {
    await fetch(`/api/admin/matches/${matchId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ work_team_id: newWorkTeamId }),
    });
    setWorkTeamModal(null);
    loadMatches();
  }

  return (
    <div className="lv-admin-page">
      <p className="lv-label lv-admin-page-label">Dashboard</p>
      <h1 className="lv-admin-page-heading">Tournament registrations</h1>

      {/* Date selector */}
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
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            <span className="lv-date-list-format">
              {active.format === "doubles" ? "Doubles (2v2)" : active.format === "triples" ? "Triples (3v3)" : `${active.format} (${active.teamSize}v${active.teamSize})`}
            </span>
            <span className="lv-date-list-change">Change</span>
          </button>
        ) : (
          <div className="lv-date-list" role="listbox">
            {tournaments.map((t) => {
              const d = new Date(t.date);
              const label = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
              const fmt = t.format === "doubles" ? "Doubles (2v2)" : t.format === "triples" ? "Triples (3v3)" : `${t.format} (${t.teamSize}v${t.teamSize})`;
              return (
                <button key={t.id} type="button" role="option" aria-selected={false} className="lv-date-list-item" onClick={() => setActiveTab(t.id)}>
                  <span className="lv-date-list-date">{label}</span>
                  <span className="lv-date-list-format">{fmt}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {active && (
        <>
          <div className="lv-admin-info">
            <strong style={{ color: "var(--lv-ink)" }}>{active.name}</strong>
            {" "}&middot; {active.location}
            <span className="lv-admin-pill">{teams.length} registered</span>
          </div>

          {/* Actions */}
          <div className="lv-admin-actions">
            <button className="lv-btn lv-btn-secondary" onClick={() => setModal(true)}>
              Add team
            </button>
            <button className="lv-btn lv-btn-primary" onClick={handleCreatePools}>
              {savedPools ? "Regenerate pools" : "Create pools"}
            </button>
            {savedPools && (
              <button className="lv-btn lv-btn-ghost" style={{ color: "var(--lv-error)" }} onClick={async () => {
                if (!confirm("Delete all pools for this tournament?")) return;
                await fetch(`/api/admin/pools?tournament=${activeTab}`, { method: "DELETE" });
                setSavedPools(null);
              }}>
                Delete pools
              </button>
            )}
            {savedPools && savedMatches && !bracketsExist && (
              <button className="lv-btn lv-btn-primary" style={{ background: "var(--lv-gold)", borderColor: "var(--lv-gold)" }} onClick={() => setPlayoffSetup(true)}>
                Generate playoffs
              </button>
            )}
            {bracketsExist && (
              <button className="lv-btn lv-btn-ghost" style={{ color: "var(--lv-error)" }} onClick={async () => {
                if (!confirm("Delete all brackets for this tournament?")) return;
                await fetch(`/api/admin/brackets?tournament=${activeTab}`, { method: "DELETE" });
                setBracketsExist(false);
              }}>
                Delete brackets
              </button>
            )}
          </div>

          {/* Warnings */}
          {unseededWarning.length > 0 && (
            <div className="lv-admin-unseeded-warning">
              <strong>Cannot create pools.</strong>
              <ul>{unseededWarning.map((w) => <li key={w}>{w}</li>)}</ul>
            </div>
          )}

          {/* Persisted pool display */}
          {poolsLoading ? (
            <p style={{ color: "var(--lv-ink-muted)", fontSize: "0.9rem", padding: "1rem 0" }}>Loading pools&hellip;</p>
          ) : savedPools && (
            <div className="lv-admin-pools">
              <div className="lv-admin-pools-header">
                <h3 className="lv-admin-pools-title">Pool Draw</h3>
                <span style={{ fontSize: "0.8rem", color: "var(--lv-ink-muted)" }}>
                  {savedPools.length} pools &middot; Saved
                </span>
              </div>
              <div className="lv-admin-pools-grid">
                {savedPools.map(({ pool, teams: poolTeams }) => (
                  <div key={pool.id} className="lv-admin-pool-card">
                    <div className="lv-admin-pool-court">Pool {pool.pool_label}</div>
                    <div className="lv-admin-pool-count">Court {pool.court_number} &middot; {poolTeams.length} teams</div>
                    <div className="lv-admin-pool-teams">
                      {poolTeams.map((t) => (
                        <div key={t.team_id} className="lv-admin-pool-team">
                          <span className="lv-admin-pool-seed">#{t.overall_seed}</span>
                          <span className="lv-admin-pool-name">{t.team_name}</span>
                          <button
                            className="lv-admin-pool-swap-btn"
                            onClick={() => setSwapModal({ teamId: t.team_id, teamName: t.team_name })}
                            aria-label={`Swap ${t.team_name}`}
                          >
                            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M4 7h12m0 0l-3-3m3 3l-3 3M16 13H4m0 0l3-3m-3 3l3 3" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Match schedule */}
          {savedPools && !matchesLoading && (
            <div className="lv-admin-pools" style={{ marginTop: "1.5rem" }}>
              <div className="lv-admin-pools-header">
                <h3 className="lv-admin-pools-title">Match Schedule</h3>
                <div style={{ display: "flex", gap: 8 }}>
                  {savedMatches ? (
                    <button className="lv-btn lv-btn-ghost" style={{ color: "var(--lv-error)", fontSize: "0.8rem" }} onClick={async () => {
                      if (!confirm("Regenerate match schedule? This deletes all current matches including any reorders or work team changes. This cannot be undone.")) return;
                      await fetch(`/api/admin/matches?tournament=${activeTab}`, { method: "DELETE" });
                      setSavedMatches(null);
                      await generateMatches();
                    }}>Regenerate</button>
                  ) : (
                    <button className="lv-btn lv-btn-primary" style={{ fontSize: "0.8rem", padding: "8px 16px" }} onClick={generateMatches}>
                      Generate match schedule
                    </button>
                  )}
                </div>
              </div>

              {savedMatches && (() => {
                // Group matches by pool
                const byPool = new Map<string, MatchData[]>();
                for (const m of savedMatches) {
                  const key = m.pool.pool_label;
                  if (!byPool.has(key)) byPool.set(key, []);
                  byPool.get(key)!.push(m);
                }

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                    {Array.from(byPool.entries()).map(([poolLabel, poolMatches]) => (
                      <div key={poolLabel} className="lv-admin-pool-card" style={{ padding: "1rem" }}>
                        <div className="lv-admin-pool-court" style={{ marginBottom: "0.75rem" }}>
                          Pool {poolLabel} &middot; Court {poolMatches[0]?.pool.court_number}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          {poolMatches
                            .sort((a, b) => a.match.match_order - b.match.match_order)
                            .map((m) => (
                              <div key={m.match.id} className="lv-admin-match-row">
                                <span className="lv-admin-match-num">{m.match.match_order}</span>
                                <span className="lv-admin-match-teams">
                                  {m.team_a.team_name} ({m.team_a.seed_in_pool}) vs {m.team_b.team_name} ({m.team_b.seed_in_pool})
                                </span>
                                {m.work_team && (
                                  <button
                                    className="lv-admin-match-work"
                                    onClick={() => setWorkTeamModal({
                                      matchId: m.match.id,
                                      poolId: m.match.pool_id,
                                      playingIds: [m.team_a.id, m.team_b.id],
                                    })}
                                  >
                                    Work: {m.work_team.team_name}
                                  </button>
                                )}
                                {m.sets.length > 0 && (
                                  <span className="lv-admin-match-score">
                                    {m.sets.sort((a, b) => a.set_number - b.set_number).map((s) => `${s.team_a_score}-${s.team_b_score}`).join(", ")}
                                  </span>
                                )}
                                <span className={`lv-admin-match-status lv-admin-match-status--${m.match.status}`}>
                                  {m.match.status}
                                </span>
                                {m.token && (
                                  <button
                                    className="lv-admin-action-btn"
                                    title="Copy score link"
                                    onClick={() => {
                                      navigator.clipboard.writeText(`${window.location.origin}/longvolleyball/score/${m.token}`);
                                    }}
                                    aria-label="Copy score link"
                                  >
                                    <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                      <rect x="8" y="8" width="10" height="10" rx="2" /><path d="M4 12H3a1 1 0 01-1-1V3a1 1 0 011-1h8a1 1 0 011 1v1" />
                                    </svg>
                                  </button>
                                )}
                                <div className="lv-admin-match-actions">
                                  <button className="lv-admin-action-btn" onClick={() => swapMatchOrder(m.match.id, "up")} aria-label="Move up">
                                    <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 4v12M10 4l4 4M10 4l-4 4" /></svg>
                                  </button>
                                  <button className="lv-admin-action-btn" onClick={() => swapMatchOrder(m.match.id, "down")} aria-label="Move down">
                                    <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 16V4M10 16l4-4M10 16l-4-4" /></svg>
                                  </button>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Bracket matches (admin view) */}
          {bracketDataAdmin && bracketDataAdmin.length > 0 && (
            <div className="lv-admin-pools" style={{ marginTop: "1.5rem" }}>
              <div className="lv-admin-pools-header">
                <h3 className="lv-admin-pools-title">Playoff Brackets</h3>
              </div>
              {bracketDataAdmin.map((bd) => (
                <div key={bd.bracket.id} style={{ marginBottom: "1.5rem" }}>
                  <div className="lv-admin-pool-court" style={{ marginBottom: "0.75rem" }}>
                    {bd.bracket.bracket_type === "gold" ? "Gold" : "Silver"} Bracket &middot; 1 set to {bd.bracket.points_per_set}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {bd.matches
                      .sort((a, b) => a.match_order - b.match_order)
                      .map((m) => (
                        <div key={m.id} className="lv-admin-match-row">
                          <span className="lv-admin-match-num">{m.match_order}</span>
                          <span className="lv-admin-match-teams">
                            {m.team_a_name ?? "TBD"} vs {m.team_b_name ?? "TBD"}
                          </span>
                          {m.work_team_name && (
                            <span className="lv-admin-match-work" style={{ cursor: "default" }}>
                              Work: {m.work_team_name}
                            </span>
                          )}
                          <span className={`lv-admin-match-status lv-admin-match-status--${m.status}`}>
                            {m.status}
                          </span>
                          {m.status === "complete" && (
                            <button
                              className="lv-admin-action-btn lv-admin-action-btn-danger"
                              title="Undo result"
                              onClick={async () => {
                                if (!confirm("Undo this match result? This will cascade to all dependent later-round matches.")) return;
                                await fetch("/api/admin/brackets/undo", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ match_id: m.id }),
                                });
                                checkBrackets();
                              }}
                              aria-label="Undo result"
                            >
                              <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 10h4l-4-4v4zM7 10a6 6 0 1 1 0 0" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Team table/cards */}
          {loading ? (
            <div className="lv-admin-empty">
              <p className="lv-admin-empty-sub">Loading teams&hellip;</p>
            </div>
          ) : teams.length === 0 ? (
            <div className="lv-admin-empty">
              <DividerOrnament className="lv-admin-empty-ornament" />
              <p className="lv-admin-empty-heading">No teams registered yet</p>
              <p className="lv-admin-empty-sub">Share the registration link to start collecting signups.</p>
              <div className="lv-admin-link-callout">
                <span className="lv-admin-link-callout-label">Registration link</span>
                <span className="lv-admin-link-callout-url">
                  {typeof window !== "undefined" ? window.location.origin : ""}/longvolleyball/register?tournament={activeTab}
                </span>
                <button className="lv-admin-link-callout-copy" onClick={() => {
                  const url = `${window.location.origin}/longvolleyball/register?tournament=${activeTab}`;
                  navigator.clipboard.writeText(url);
                }}>Copy link</button>
              </div>
            </div>
          ) : (
            <>
            {/* Mobile cards */}
            <div className="lv-admin-cards-mobile">
              {teams.map((t) => {
                const captain = t.players.find((p) => p.is_captain);
                const teammates = t.players.filter((p) => !p.is_captain);
                const isExpanded = expandedTeam === t.id;
                return (
                  <div key={t.id} className={`lv-admin-card ${isExpanded ? "expanded" : ""}`}>
                    <button className="lv-admin-card-header" onClick={() => setExpandedTeam(isExpanded ? null : t.id)}>
                      <div className="lv-admin-card-title-row">
                        <span className="lv-admin-card-team-name">{t.team_name}</span>
                        <svg className={`lv-admin-expand-icon ${isExpanded ? "open" : ""}`} width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 8l4 4 4-4" /></svg>
                      </div>
                      <span className="lv-admin-card-captain">
                        {captain?.name ?? "—"}
                        {teamStats.get(t.id) && (
                          <span className="lv-admin-team-record">
                            {" · "}{teamStats.get(t.id)!.wins}-{teamStats.get(t.id)!.losses}
                            {" · "}<span style={{ color: (teamStats.get(t.id)!.point_differential) >= 0 ? "var(--lv-green)" : "var(--lv-error)" }}>
                              {teamStats.get(t.id)!.point_differential >= 0 ? "+" : ""}{teamStats.get(t.id)!.point_differential}
                            </span>
                          </span>
                        )}
                      </span>
                    </button>
                    <div className="lv-admin-card-body">
                      <div className="lv-admin-card-row">
                        <span className="lv-admin-card-label">Seed</span>
                        <input type="number" className="lv-admin-seed" value={t.seed ?? ""} min={1}
                          onChange={(e) => { const val = e.target.value ? parseInt(e.target.value, 10) : null; setTeams((prev) => prev.map((team) => team.id === t.id ? { ...team, seed: val } : team)); }}
                          onBlur={(e) => { const val = e.target.value ? parseInt(e.target.value, 10) : null; patchTeam(t.id, { seed: val }); }}
                        />
                      </div>
                      <div className="lv-admin-card-row">
                        <span className="lv-admin-card-label">Checked in</span>
                        <button className={`lv-toggle ${t.checked_in ? "on" : ""}`} onClick={(e) => { e.stopPropagation(); patchTeam(t.id, { checked_in: !t.checked_in }); }} aria-label={t.checked_in ? "Checked in" : "Not checked in"} />
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="lv-admin-card-details">
                        <div className="lv-admin-card-detail"><span className="lv-admin-card-label">Email</span><span>{t.contact_email}</span></div>
                        <div className="lv-admin-card-detail"><span className="lv-admin-card-label">Phone</span><span>{t.contact_phone}</span></div>
                        <div className="lv-admin-card-detail"><span className="lv-admin-card-label">Registered</span><span>{new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span></div>
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
                        <button className="lv-admin-card-delete" onClick={() => deleteTeam(t.id, t.team_name)}>Remove team</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="lv-admin-table-wrap">
              <table className="lv-admin-table">
                <thead>
                  <tr>
                    <th>Team name</th><th>Captain</th><th>Record</th><th>Pt Diff</th><th>Email</th><th>Phone</th><th>Seed</th><th>Checked in</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((t) => {
                    const captain = t.players.find((p) => p.is_captain);
                    const teammates = t.players.filter((p) => !p.is_captain);
                    const isExpanded = expandedTeam === t.id;
                    return (
                      <React.Fragment key={t.id}>
                        <tr className={`lv-admin-row-clickable ${isExpanded ? "expanded" : ""}`} onClick={() => setExpandedTeam(isExpanded ? null : t.id)}>
                          <td className="lv-admin-team-name">
                            <svg className={`lv-admin-expand-icon ${isExpanded ? "open" : ""}`} width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 8l4 4 4-4" /></svg>
                            {t.team_name}
                          </td>
                          <td>{captain?.name ?? "—"}</td>
                          <td>{teamStats.get(t.id) ? `${teamStats.get(t.id)!.wins}-${teamStats.get(t.id)!.losses}` : "—"}</td>
                          <td style={{ color: (teamStats.get(t.id)?.point_differential ?? 0) >= 0 ? "var(--lv-green)" : "var(--lv-error)" }}>
                            {teamStats.get(t.id) ? `${teamStats.get(t.id)!.point_differential >= 0 ? "+" : ""}${teamStats.get(t.id)!.point_differential}` : "—"}
                          </td>
                          <td>{t.contact_email}</td>
                          <td>{t.contact_phone}</td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <input type="number" className="lv-admin-seed" value={t.seed ?? ""} min={1}
                              onChange={(e) => { const val = e.target.value ? parseInt(e.target.value, 10) : null; setTeams((prev) => prev.map((team) => team.id === t.id ? { ...team, seed: val } : team)); }}
                              onBlur={(e) => { const val = e.target.value ? parseInt(e.target.value, 10) : null; patchTeam(t.id, { seed: val }); }}
                            />
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <button className={`lv-toggle ${t.checked_in ? "on" : ""}`}
                              onClick={(e) => { e.stopPropagation(); patchTeam(t.id, { checked_in: !t.checked_in }); }}
                              aria-label={t.checked_in ? "Checked in" : "Not checked in"} />
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <button className="lv-admin-action-btn lv-admin-action-btn-danger" onClick={() => deleteTeam(t.id, t.team_name)} aria-label="Remove team">
                              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h14M8 6V4a1 1 0 011-1h2a1 1 0 011 1v2m2 0v10a2 2 0 01-2 2H8a2 2 0 01-2-2V6h12" /></svg>
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
        <AddTeamModal tournament={active} onClose={() => setModal(false)} onAdded={() => { setModal(false); loadTeams(); }} />
      )}

      {/* Net count modal — new pools */}
      {poolModal && (
        <NetCountModal
          checkedInCount={teams.filter((t) => t.checked_in).length}
          onClose={() => setPoolModal(false)}
          onConfirm={persistPools}
        />
      )}

      {/* Regenerate confirmation */}
      {regenerateConfirm && (
        <NetCountModal
          checkedInCount={teams.filter((t) => t.checked_in).length}
          onClose={() => setRegenerateConfirm(false)}
          onConfirm={handleRegenerate}
          isRegenerate
        />
      )}

      {/* Swap modal */}
      {swapModal && savedPools && (
        <SwapModal
          teamName={swapModal.teamName}
          teamId={swapModal.teamId}
          pools={savedPools}
          onClose={() => setSwapModal(null)}
          onSwap={handleSwap}
        />
      )}

      {/* Work team change modal */}
      {workTeamModal && savedPools && (
        <WorkTeamModal
          matchId={workTeamModal.matchId}
          poolId={workTeamModal.poolId}
          playingIds={workTeamModal.playingIds}
          pools={savedPools}
          onClose={() => setWorkTeamModal(null)}
          onChange={changeWorkTeam}
        />
      )}

      {/* Playoff setup modal */}
      {playoffSetup && savedPools && (
        <PlayoffSetupModal
          tournamentId={activeTab}
          poolCount={savedPools.length}
          courtCount={savedPools.length}
          onClose={() => setPlayoffSetup(false)}
          onGenerated={() => { setPlayoffSetup(false); checkBrackets(); }}
        />
      )}
    </div>
  );
}

/* ---- ADD TEAM MODAL ---- */
function AddTeamModal({ tournament, onClose, onAdded }: { tournament: Tournament; onClose: () => void; onAdded: () => void }) {
  const [teamName, setTeamName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [players, setPlayers] = useState(Array.from({ length: tournament.teamSize }, () => ({ name: "", email: "" })));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function updatePlayer(idx: number, field: "name" | "email", value: string) {
    setPlayers((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tournamentId: tournament.id, teamName, contactPhone, players }),
    });
    if (!res.ok) { const data = await res.json(); setError(data.error ?? "Failed"); setSubmitting(false); }
    else { onAdded(); }
  }

  return (
    <div className="lv-admin-overlay" onClick={onClose}>
      <div className="lv-admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="lv-admin-modal-header">
          <h2 className="lv-admin-modal-title">Add team</h2>
          <button className="lv-admin-modal-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M5 5l10 10M15 5L5 15" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="lv-form">
          <div className="lv-field"><label className="lv-field-label">Team name</label><input className="lv-input" type="text" value={teamName} onChange={(e) => setTeamName(e.target.value)} required /></div>
          {players.map((p, idx) => {
            const isCaptain = idx === 0;
            return (
              <fieldset key={idx} className="lv-player-group">
                <legend className="lv-player-legend">{isCaptain ? "Captain" : `Player ${idx + 1}`}</legend>
                <div className="lv-field"><label className="lv-field-label">Name</label><input className="lv-input" type="text" value={p.name} onChange={(e) => updatePlayer(idx, "name", e.target.value)} required /></div>
                <div className="lv-field"><label className="lv-field-label">Email{isCaptain ? "" : " (optional)"}</label><input className="lv-input" type="email" value={p.email} onChange={(e) => updatePlayer(idx, "email", e.target.value)} required={isCaptain} /></div>
                {isCaptain && (<div className="lv-field"><label className="lv-field-label">Phone</label><input className="lv-input" type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} required /></div>)}
              </fieldset>
            );
          })}
          {error && <p className="lv-error">{error}</p>}
          <div className="lv-admin-modal-footer">
            <button type="button" className="lv-btn lv-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="lv-btn lv-btn-primary" disabled={submitting}>{submitting ? "Adding…" : "Add team"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---- NET COUNT MODAL ---- */
function NetCountModal({ checkedInCount, onClose, onConfirm, isRegenerate }: {
  checkedInCount: number; onClose: () => void; onConfirm: (nets: number) => void; isRegenerate?: boolean;
}) {
  const [nets, setNets] = useState("");
  const [saving, setSaving] = useState(false);
  const netNum = parseInt(nets, 10);
  const valid = netNum > 0 && netNum <= checkedInCount;

  let preview = "";
  if (valid) {
    const base = Math.floor(checkedInCount / netNum);
    const remainder = checkedInCount % netNum;
    preview = remainder === 0
      ? `${netNum} pools of ${base}`
      : `${remainder} pool${remainder > 1 ? "s" : ""} of ${base + 1}, ${netNum - remainder} pool${netNum - remainder > 1 ? "s" : ""} of ${base}`;
    if (base < 3) preview += " (warning: some pools under 3 teams)";
    if (base + (remainder > 0 ? 1 : 0) > 5) preview += " (warning: pools exceed 5 teams)";
  }

  return (
    <div className="lv-admin-overlay" onClick={onClose}>
      <div className="lv-admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="lv-admin-modal-header">
          <h2 className="lv-admin-modal-title">{isRegenerate ? "Regenerate pools" : "Create pools"}</h2>
          <button className="lv-admin-modal-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M5 5l10 10M15 5L5 15" /></svg>
          </button>
        </div>
        <div className="lv-form">
          {isRegenerate && (
            <div className="lv-admin-unseeded-warning" style={{ marginBottom: "1rem" }}>
              <strong>Warning:</strong> This will delete the current pools and create new ones. This cannot be undone.
            </div>
          )}
          <p style={{ fontSize: "0.9rem", color: "var(--lv-ink-muted)", marginBottom: "0.5rem" }}>
            <strong style={{ color: "var(--lv-ink)" }}>{checkedInCount} teams</strong> checked in and seeded. Serpentine seeding will distribute teams across courts.
          </p>
          <div className="lv-field">
            <label className="lv-field-label" htmlFor="net-count">How many nets?</label>
            <input id="net-count" className="lv-input" type="number" min={1} max={checkedInCount} value={nets} onChange={(e) => setNets(e.target.value)} placeholder="e.g. 7" autoFocus />
          </div>
          {valid && <p className="lv-admin-pool-preview">{preview}</p>}
          <div className="lv-admin-modal-footer">
            <button type="button" className="lv-btn lv-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="button" className={`lv-btn ${isRegenerate ? "lv-btn-primary" : "lv-btn-primary"}`} disabled={!valid || saving}
              onClick={async () => { setSaving(true); await onConfirm(netNum); setSaving(false); }}>
              {saving ? "Saving…" : isRegenerate ? "Regenerate" : "Generate pools"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- SWAP MODAL ---- */
function SwapModal({ teamName, teamId, pools, onClose, onSwap }: {
  teamName: string; teamId: string; pools: PoolWithTeams[]; onClose: () => void; onSwap: (targetTeamId: string) => void;
}) {
  const [swapping, setSwapping] = useState(false);

  // Find which pool the source team is in
  const sourcePool = pools.find((p) => p.teams.some((t) => t.team_id === teamId));

  return (
    <div className="lv-admin-overlay" onClick={onClose}>
      <div className="lv-admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <div className="lv-admin-modal-header">
          <h2 className="lv-admin-modal-title">Move {teamName}</h2>
          <button className="lv-admin-modal-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M5 5l10 10M15 5L5 15" /></svg>
          </button>
        </div>
        <p style={{ fontSize: "0.85rem", color: "var(--lv-ink-muted)", marginBottom: "1rem" }}>
          Tap a team to swap positions with <strong>{teamName}</strong>.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "60vh", overflowY: "auto" }}>
          {pools.filter((p) => p.pool.id !== sourcePool?.pool.id).map(({ pool, teams: poolTeams }) => (
            <div key={pool.id} className="lv-admin-pool-card" style={{ margin: 0 }}>
              <div className="lv-admin-pool-court">Pool {pool.pool_label}</div>
              <div className="lv-admin-pool-teams">
                {poolTeams.map((t) => (
                  <button
                    key={t.team_id}
                    className="lv-admin-pool-team lv-admin-pool-team-swappable"
                    disabled={swapping}
                    onClick={async () => { setSwapping(true); await onSwap(t.team_id); setSwapping(false); }}
                  >
                    <span className="lv-admin-pool-seed">#{t.overall_seed}</span>
                    <span className="lv-admin-pool-name">{t.team_name}</span>
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "auto", opacity: 0.4 }}>
                      <path d="M4 7h12m0 0l-3-3m3 3l-3 3M16 13H4m0 0l3-3m-3 3l3 3" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---- WORK TEAM MODAL ---- */
function WorkTeamModal({ matchId, poolId, playingIds, pools, onClose, onChange }: {
  matchId: string; poolId: string; playingIds: string[]; pools: PoolWithTeams[]; onClose: () => void; onChange: (matchId: string, teamId: string) => void;
}) {
  const pool = pools.find((p) => p.pool.id === poolId);
  if (!pool) return null;

  const playingSet = new Set(playingIds);
  const available = pool.teams.filter((t) => !playingSet.has(t.team_id));

  return (
    <div className="lv-admin-overlay" onClick={onClose}>
      <div className="lv-admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="lv-admin-modal-header">
          <h2 className="lv-admin-modal-title">Change work team</h2>
          <button className="lv-admin-modal-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M5 5l10 10M15 5L5 15" /></svg>
          </button>
        </div>
        <p style={{ fontSize: "0.85rem", color: "var(--lv-ink-muted)", marginBottom: "1rem" }}>
          Select a team to work this match.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {available.map((t) => (
            <button
              key={t.team_id}
              className="lv-admin-pool-team lv-admin-pool-team-swappable"
              onClick={() => onChange(matchId, t.team_id)}
            >
              <span className="lv-admin-pool-seed">#{t.overall_seed}</span>
              <span className="lv-admin-pool-name">{t.team_name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---- PLAYOFF SETUP MODAL ---- */
function PlayoffSetupModal({ tournamentId, poolCount, courtCount, onClose, onGenerated }: {
  tournamentId: string; poolCount: number; courtCount: number; onClose: () => void; onGenerated: () => void;
}) {
  const [standings, setStandings] = useState<OverallTeamStanding[]>([]);
  const [cutoff, setCutoff] = useState(0);
  const [goldFormat, setGoldFormat] = useState<11 | 15>(15);
  const [silverFormat, setSilverFormat] = useState<11 | 15>(11);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/public/standings?tournament=${tournamentId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.pools) {
          const overall = computeOverallStandings(data.pools);
          setStandings(overall);
          setCutoff(getDefaultGoldCutoff(overall, poolCount));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [tournamentId, poolCount]);

  const goldTeams = standings.filter((t) => t.overall_rank <= cutoff);
  const silverTeams = standings.filter((t) => t.overall_rank > cutoff);
  function nextPow2(n: number) { let p = 1; while (p < n) p *= 2; return p; }
  const goldByes = goldTeams.length >= 2 ? nextPow2(goldTeams.length) - goldTeams.length : 0;
  const silverByes = silverTeams.length >= 2 ? nextPow2(silverTeams.length) - silverTeams.length : 0;

  async function handleGenerate() {
    setGenerating(true);
    setError("");
    const res = await fetch("/api/admin/brackets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tournament_id: tournamentId,
        gold_cutoff: cutoff,
        gold_points_per_set: goldFormat,
        silver_points_per_set: silverFormat,
        court_count: courtCount,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      if (res.status === 409 && confirm("Brackets already exist. Delete and regenerate?")) {
        await fetch(`/api/admin/brackets?tournament=${tournamentId}`, { method: "DELETE" });
        await handleGenerate();
        return;
      }
      setError(data.error ?? "Failed to generate");
      setGenerating(false);
      return;
    }
    onGenerated();
  }

  if (loading) {
    return (
      <div className="lv-admin-overlay" onClick={onClose}>
        <div className="lv-admin-modal" onClick={(e) => e.stopPropagation()}>
          <p style={{ textAlign: "center", color: "var(--lv-ink-muted)", padding: "2rem" }}>Loading standings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="lv-admin-overlay" onClick={onClose}>
      <div className="lv-admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: "85vh", overflowY: "auto" }}>
        <div className="lv-admin-modal-header">
          <h2 className="lv-admin-modal-title">Playoff setup</h2>
          <button className="lv-admin-modal-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M5 5l10 10M15 5L5 15" /></svg>
          </button>
        </div>

        <div className="lv-playoff-standings">
          <div className="lv-playoff-header-row">
            <span className="lv-playoff-gold-label">Gold Bracket — {goldTeams.length} teams</span>
            {goldByes > 0 && <span className="lv-playoff-byes">{goldByes} bye{goldByes > 1 ? "s" : ""}</span>}
          </div>

          {standings.map((t, i) => (
            <React.Fragment key={t.team_id}>
              {i === cutoff && (
                <div className="lv-playoff-cutoff">
                  <button className="lv-playoff-cutoff-btn" onClick={() => setCutoff(Math.max(2, cutoff - 1))} disabled={cutoff <= 2}>&#9650;</button>
                  <span className="lv-playoff-cutoff-label">Cutoff</span>
                  <button className="lv-playoff-cutoff-btn" onClick={() => setCutoff(Math.min(standings.length - 1, cutoff + 1))} disabled={cutoff >= standings.length - 1}>&#9660;</button>
                </div>
              )}
              <div className={`lv-playoff-team-row ${i < cutoff ? "lv-playoff-gold" : "lv-playoff-silver"}`}>
                <span className="lv-playoff-rank">#{t.overall_rank}</span>
                <span className="lv-playoff-name">{t.team_name}</span>
                <span className="lv-playoff-origin">Pool {t.pool_label} #{t.pool_rank}</span>
                <span className="lv-playoff-record">{t.matches_won}-{t.matches_lost}</span>
                <span style={{ color: t.point_differential >= 0 ? "var(--lv-green)" : "var(--lv-error)", fontSize: "0.8rem" }}>
                  {t.point_differential >= 0 ? "+" : ""}{t.point_differential}
                </span>
              </div>
            </React.Fragment>
          ))}

          {silverTeams.length >= 2 && (
            <div className="lv-playoff-header-row" style={{ marginTop: "0.5rem" }}>
              <span className="lv-playoff-silver-label">Silver Bracket — {silverTeams.length} teams</span>
              {silverByes > 0 && <span className="lv-playoff-byes">{silverByes} bye{silverByes > 1 ? "s" : ""}</span>}
            </div>
          )}
        </div>

        {goldByes === 0 ? (
          <p className="lv-playoff-rec">Clean bracket — no byes needed for gold.</p>
        ) : (
          <p className="lv-playoff-rec">
            {goldByes} bye{goldByes > 1 ? "s" : ""} in gold (top seed{goldByes > 1 ? "s" : ""} auto-advance).
          </p>
        )}

        <div className="lv-playoff-formats">
          <div className="lv-playoff-format-row">
            <span className="lv-field-label">Gold format</span>
            <div className="lv-playoff-format-toggle">
              <button className={`lv-playoff-format-btn ${goldFormat === 15 ? "active" : ""}`} onClick={() => setGoldFormat(15)}>To 15</button>
              <button className={`lv-playoff-format-btn ${goldFormat === 11 ? "active" : ""}`} onClick={() => setGoldFormat(11)}>To 11</button>
            </div>
          </div>
          <div className="lv-playoff-format-row">
            <span className="lv-field-label">Silver format</span>
            <div className="lv-playoff-format-toggle">
              <button className={`lv-playoff-format-btn ${silverFormat === 15 ? "active" : ""}`} onClick={() => setSilverFormat(15)}>To 15</button>
              <button className={`lv-playoff-format-btn ${silverFormat === 11 ? "active" : ""}`} onClick={() => setSilverFormat(11)}>To 11</button>
            </div>
          </div>
        </div>

        {error && <div className="lv-error">{error}</div>}

        <div className="lv-admin-modal-footer">
          <button className="lv-btn lv-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="lv-btn lv-btn-primary" disabled={generating || goldTeams.length < 2} onClick={handleGenerate}>
            {generating ? "Generating..." : "Generate brackets"}
          </button>
        </div>
      </div>
    </div>
  );
}

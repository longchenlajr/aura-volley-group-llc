"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { getTournament, type Tournament } from "@/lib/tournaments";
import type { PoolWithTeams } from "@/lib/pools";
import { generatePools as runPoolGeneration } from "@/lib/pool-generation";
import { computeOverallStandings, getDefaultGoldCutoff, type OverallTeamStanding } from "@/lib/tournament-standings";
import { getMatchFormat } from "@/lib/score-format";
import { TournamentToolbar } from "./TournamentToolbar";
import { PoolSummaryCard } from "./PoolSummaryCard";
import { BracketSummaryCard } from "./BracketSummaryCard";
import { TeamRoster } from "./TeamRoster";
import { WithdrawTeamModal } from "./WithdrawTeamModal";
import type { MatchData, Team } from "./types";

export default function TournamentViewPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const router = useRouter();
  const tournament = getTournament(tournamentId);

  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedPools, setSavedPools] = useState<PoolWithTeams[] | null>(null);
  const [poolsLoading, setPoolsLoading] = useState(false);
  const [savedMatches, setSavedMatches] = useState<MatchData[] | null>(null);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [bracketsExist, setBracketsExist] = useState(false);
  const [bracketDataAdmin, setBracketDataAdmin] = useState<Array<{
    bracket: { id: string; bracket_type: string; points_per_set: number };
    matches: Array<{ id: string; round_number: number; match_position: number; court_number: number; match_order: number; status: string; team_a_name: string | null; team_b_name: string | null; work_team_name: string | null; winner_slot_id: string | null; token?: string | null; score?: { team_a_score: number; team_b_score: number } | null }>;
  }> | null>(null);
  const [bracketScoreModal, setBracketScoreModal] = useState<{ matchId: string; pointsPerSet: number; team_a_name: string; team_b_name: string; existingScore: { team_a_score: number; team_b_score: number } | null } | null>(null);

  // Expansion state (persists within session)
  const [expandedPools, setExpandedPools] = useState<Set<string>>(new Set());
  const [expandedBrackets, setExpandedBrackets] = useState<Set<string>>(new Set());

  // Modals
  const [addTeamModal, setAddTeamModal] = useState(false);
  const [editTeamModal, setEditTeamModal] = useState<Team | null>(null);
  const [poolModal, setPoolModal] = useState(false);
  const [regenerateConfirm, setRegenerateConfirm] = useState(false);
  const [swapModal, setSwapModal] = useState<{ teamId: string; teamName: string } | null>(null);
  const [scoreOverrideModal, setScoreOverrideModal] = useState<string | null>(null);
  const [withdrawModal, setWithdrawModal] = useState<Team | null>(null);
  const [playoffSetup, setPlayoffSetup] = useState(false);
  const [emailLinksModal, setEmailLinksModal] = useState(false);
  const [emailLinksSending, setEmailLinksSending] = useState(false);
  const [emailLinksResult, setEmailLinksResult] = useState<{ sent: number; failed: number; skippedWithdrawn?: number } | null>(null);
  const [emailLinksError, setEmailLinksError] = useState("");
  const [unseededWarning, setUnseededWarning] = useState<string[]>([]);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // --- Data loading ---
  const loadTeams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/teams?tournament=${tournamentId}`);
      const data = await res.json();
      setTeams(data.teams ?? []);
    } catch (err) {
      console.error("Failed to load teams:", err);
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  const loadPools = useCallback(async () => {
    setPoolsLoading(true);
    try {
      const res = await fetch(`/api/admin/pools?tournament=${tournamentId}`);
      const data = await res.json();
      setSavedPools(data.pools?.length > 0 ? data.pools : null);
    } catch {
      setSavedPools(null);
    } finally {
      setPoolsLoading(false);
    }
  }, [tournamentId]);

  const loadMatches = useCallback(async () => {
    setMatchesLoading(true);
    try {
      const res = await fetch(`/api/admin/matches?tournament=${tournamentId}`);
      const data = await res.json();
      setSavedMatches(data.matches?.length > 0 ? data.matches : null);
    } catch {
      setSavedMatches(null);
    } finally {
      setMatchesLoading(false);
    }
  }, [tournamentId]);

  const checkBrackets = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/brackets?tournament=${tournamentId}`);
      const data = await res.json();
      const brackets = data.brackets ?? [];
      setBracketsExist(brackets.length > 0);
      setBracketDataAdmin(brackets.length > 0 ? brackets : null);
    } catch {
      setBracketsExist(false);
      setBracketDataAdmin(null);
    }
  }, [tournamentId]);

  useEffect(() => {
    if (tournamentId) {
      loadTeams();
      loadPools();
      loadMatches();
      checkBrackets();
    }
  }, [tournamentId, loadTeams, loadPools, loadMatches, checkBrackets]);

  // Poll matches every 12s for live score updates
  useEffect(() => {
    if (!tournamentId || !savedMatches) return;
    const interval = setInterval(() => {
      loadMatches();
    }, 12000);
    return () => clearInterval(interval);
  }, [tournamentId, savedMatches, loadMatches]);

  // --- Derived state ---
  const withdrawnTeamIds = useMemo(() => {
    const set = new Set<string>();
    for (const t of teams) {
      if (t.withdrawn_at) set.add(t.id);
    }
    return set;
  }, [teams]);

  const matchesByPool = useMemo(() => {
    const map = new Map<string, MatchData[]>();
    if (!savedMatches) return map;
    for (const m of savedMatches) {
      const key = m.pool.id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return map;
  }, [savedMatches]);

  const matchProgress = useMemo(() => {
    if (!savedMatches) return null;
    const complete = savedMatches.filter((m) => m.match.status === "complete").length;
    return { complete, total: savedMatches.length };
  }, [savedMatches]);

  const poolPlayComplete = useMemo(() => {
    if (!savedMatches || savedMatches.length === 0) return false;
    return savedMatches.every((m) => m.match.status === "complete");
  }, [savedMatches]);

  const tournamentPhase = useMemo(() => {
    if (!savedPools) return "Not started";
    if (!savedMatches || savedMatches.length === 0) return "Pools created · Matches not generated";
    if (bracketsExist) return "In playoffs";
    if (poolPlayComplete) return "Pool play complete · Ready for playoffs";
    const inProgress = savedMatches.some((m) => m.match.status === "in_progress");
    if (inProgress) return "Pool play";
    const anyComplete = savedMatches.some((m) => m.match.status === "complete");
    if (anyComplete) return "Pool play";
    return "Pool play · Not started";
  }, [savedPools, savedMatches, bracketsExist, poolPlayComplete]);

  // --- Team actions ---
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

  async function handleDeleteTeam(team: Team) {
    if (!confirm(`Remove "${team.team_name}"? This cannot be undone.`)) return;
    await fetch(`/api/admin/teams/${team.id}`, { method: "DELETE" });
    loadTeams();
    loadPools();
  }

  async function handleWithdraw() {
    if (!withdrawModal) return;
    const res = await fetch(`/api/admin/teams/${withdrawModal.id}/withdraw`, {
      method: "POST",
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "Withdrawal failed");
      return;
    }
    setWithdrawModal(null);
    loadTeams();
    loadMatches();
    loadPools();
  }

  async function handleHardDelete() {
    if (!withdrawModal) return;
    await fetch(`/api/admin/teams/${withdrawModal.id}`, { method: "DELETE" });
    setWithdrawModal(null);
    loadTeams();
    loadPools();
    loadMatches();
  }

  // --- Pool generation ---
  function handleCreatePools() {
    const checkedIn = teams.filter((t) => t.checked_in && !t.withdrawn_at);

    // Check for duplicate seeds among seeded teams
    const seeded = checkedIn.filter((t) => t.seed != null);
    const seedMap = new Map<number, string[]>();
    for (const t of seeded) {
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

    if (savedPools) {
      setRegenerateConfirm(true);
      return;
    }

    setPoolModal(true);
  }

  async function persistPools(netCount: number) {
    const checkedIn = teams
      .filter((t) => t.checked_in && !t.withdrawn_at)
      .map((t) => ({ id: t.id, team_name: t.team_name, seed: t.seed }));

    const result = runPoolGeneration({ teams: checkedIn, netCount });

    if ("error" in result) {
      setUnseededWarning([result.error]);
      setPoolModal(false);
      return;
    }

    const res = await fetch("/api/admin/pools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tournament_id: tournamentId, pools: result.pools }),
    });

    if (!res.ok) {
      const data = await res.json();
      setUnseededWarning([data.error ?? "Failed to save pools"]);
    }

    setPoolModal(false);
    loadPools();
  }

  async function handleRegenerate(netCount: number) {
    await fetch(`/api/admin/pools?tournament=${tournamentId}`, { method: "DELETE" });
    setSavedPools(null);
    await persistPools(netCount);
    setRegenerateConfirm(false);
  }

  // --- Match actions ---
  async function generateMatches() {
    const res = await fetch("/api/admin/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tournament_id: tournamentId }),
    });
    if (!res.ok) {
      const data = await res.json();
      if (res.status === 409 && confirm("Matches already exist. Delete and regenerate?")) {
        await fetch(`/api/admin/matches?tournament=${tournamentId}`, { method: "DELETE" });
        await generateMatches();
        return;
      }
      alert(data.error ?? "Failed to generate matches");
      return;
    }
    loadMatches();
  }

  function handleGenerateMatches() {
    if (savedMatches) {
      if (!confirm("Regenerate match schedule? This deletes all current matches including scores. This cannot be undone.")) return;
      fetch(`/api/admin/matches?tournament=${tournamentId}`, { method: "DELETE" })
        .then(() => { setSavedMatches(null); return generateMatches(); });
      return;
    }
    generateMatches();
  }

  async function swapMatchOrder(matchId: string, direction: "up" | "down") {
    if (!savedMatches) return;
    const idx = savedMatches.findIndex((m) => m.match.id === matchId);
    if (idx === -1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= savedMatches.length) return;
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

  async function changeWorkTeam(matchId: string, newWorkTeamId: string) {
    await fetch(`/api/admin/matches/${matchId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ work_team_id: newWorkTeamId }),
    });
    loadMatches();
  }

  function handleCopyScoreLink(token: string) {
    navigator.clipboard.writeText(`${window.location.origin}/longvolleyball/score/${token}`);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  }

  // --- Score override ---
  function handleOverrideScore(matchId: string) {
    setScoreOverrideModal(matchId);
  }

  // --- Reset scores ---
  async function handleResetScores(matchId: string) {
    if (!confirm("Erase all scores for this match? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/admin/matches/${matchId}/reset-scores`, { method: "POST" });
      if (res.ok) {
        await loadMatches();
      } else {
        const data = await res.json();
        alert(data.error ?? "Failed to reset scores.");
      }
    } catch {
      alert("Something went wrong.");
    }
  }

  // If tournament not found, redirect back
  if (!tournament) {
    return (
      <div className="lv-admin-page">
        <p style={{ color: "var(--lv-ink-muted)" }}>Tournament not found.</p>
        <button className="lv-btn lv-btn-ghost" onClick={() => router.push("/admin")}>
          Back to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="lv-admin-page">
      <p className="lv-label lv-admin-page-label">Dashboard</p>
      <h1 className="lv-admin-page-heading">{tournament.name}</h1>

      <div className="lv-admin-info">
        <span style={{ cursor: "pointer", textDecoration: "underline", textDecorationColor: "var(--lv-border)" }} onClick={() => router.push("/admin")}>
          &larr; All tournaments
        </span>
      </div>

      {/* Toolbar */}
      <TournamentToolbar
        tournament={tournament}
        poolsExist={!!savedPools}
        matchesExist={!!savedMatches}
        bracketsExist={bracketsExist}
        poolPlayComplete={poolPlayComplete}
        matchProgress={matchProgress}
        tournamentPhase={tournamentPhase}
        onEmailWorkLinks={() => { setEmailLinksResult(null); setEmailLinksError(""); setEmailLinksModal(true); }}
        onGeneratePools={handleCreatePools}
        onGenerateMatches={handleGenerateMatches}
        onGeneratePlayoffs={() => setPlayoffSetup(true)}
      />

      {/* Warnings */}
      {unseededWarning.length > 0 && (
        <div className="lv-admin-unseeded-warning">
          <strong>Cannot create pools.</strong>
          <ul>{unseededWarning.map((w) => <li key={w}>{w}</li>)}</ul>
        </div>
      )}

      {/* Team roster — shows first when no pools */}
      {!savedPools && (
        <TeamRoster
          teams={teams}
          poolsExist={false}
          onAddTeam={() => setAddTeamModal(true)}
          onEditTeam={(t) => setEditTeamModal(t)}
          onWithdrawTeam={(t) => setWithdrawModal(t)}
          onDeleteTeam={handleDeleteTeam}
          onPatchTeam={patchTeam}
          setTeams={setTeams}
        />
      )}

      {/* Bracket summary cards — above pools when playoffs exist */}
      {bracketDataAdmin && bracketDataAdmin.length > 0 && (
        <div className="lv-pool-grid">
          <div className="lv-bracket-grid-header">
            <span className="lv-bracket-grid-title">Playoff Brackets</span>
            <button className="lv-btn lv-btn-destructive" style={{ fontSize: "0.75rem", padding: "4px 10px" }} onClick={async () => {
              if (!confirm("Delete all brackets for this tournament?")) return;
              await fetch(`/api/admin/brackets?tournament=${tournamentId}`, { method: "DELETE" });
              setBracketsExist(false);
              setBracketDataAdmin(null);
            }}>
              Delete brackets
            </button>
          </div>
          {bracketDataAdmin.map((bd) => (
            <BracketSummaryCard
              key={bd.bracket.id}
              bracket={bd.bracket}
              matches={bd.matches}
              expanded={expandedBrackets.has(bd.bracket.id)}
              onToggle={() => {
                setExpandedBrackets((prev) => {
                  const next = new Set(prev);
                  if (next.has(bd.bracket.id)) next.delete(bd.bracket.id);
                  else next.add(bd.bracket.id);
                  return next;
                });
              }}
              onOverrideScore={(matchId) => {
                const match = bd.matches.find((m) => m.id === matchId);
                if (!match) return;
                setBracketScoreModal({
                  matchId,
                  pointsPerSet: bd.bracket.points_per_set,
                  team_a_name: match.team_a_name ?? "TBD",
                  team_b_name: match.team_b_name ?? "TBD",
                  existingScore: match.score ?? null,
                });
              }}
              onResetScores={async (matchId) => {
                if (!confirm("Undo this match result? This will cascade to all dependent later-round matches.")) return;
                const res = await fetch(`/api/admin/brackets/${matchId}/reset-scores`, { method: "POST" });
                if (res.ok) {
                  checkBrackets();
                } else {
                  const data = await res.json();
                  alert(data.error ?? "Failed to reset scores.");
                }
              }}
              onCopyScoreLink={(token) => {
                navigator.clipboard.writeText(`${window.location.origin}/longvolleyball/bracket-score/${token}`);
                setCopiedToken(token);
                setTimeout(() => setCopiedToken(null), 2000);
              }}
            />
          ))}
        </div>
      )}

      {/* Pool summary cards */}
      {poolsLoading ? (
        <p style={{ color: "var(--lv-ink-muted)", fontSize: "0.9rem", padding: "1rem 0" }}>Loading pools&hellip;</p>
      ) : savedPools && (
        <div className="lv-pool-grid">
          {savedPools.map((poolData) => (
            <PoolSummaryCard
              key={poolData.pool.id}
              pool={poolData}
              matches={matchesByPool.get(poolData.pool.id) ?? []}
              expanded={expandedPools.has(poolData.pool.id)}
              onToggle={() => {
                setExpandedPools((prev) => {
                  const next = new Set(prev);
                  if (next.has(poolData.pool.id)) next.delete(poolData.pool.id);
                  else next.add(poolData.pool.id);
                  return next;
                });
              }}
              withdrawnTeamIds={withdrawnTeamIds}
              onSwapTeam={(teamId, teamName) => setSwapModal({ teamId, teamName })}
              onOverrideScore={handleOverrideScore}
              onResetScores={handleResetScores}
              onCopyScoreLink={handleCopyScoreLink}
              onSwapMatchOrder={swapMatchOrder}
            />
          ))}
        </div>
      )}

      {/* Team roster — shows below pools when pools exist */}
      {savedPools && (
        <TeamRoster
          teams={teams}
          poolsExist={true}
          onAddTeam={() => setAddTeamModal(true)}
          onEditTeam={(t) => setEditTeamModal(t)}
          onWithdrawTeam={(t) => setWithdrawModal(t)}
          onDeleteTeam={handleDeleteTeam}
          onPatchTeam={patchTeam}
          setTeams={setTeams}
        />
      )}

      {/* Copied toast */}
      {copiedToken && (
        <div style={{
          position: "fixed",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          background: "var(--lv-bg-dark-elevated)",
          color: "var(--lv-cream)",
          padding: "8px 16px",
          borderRadius: "var(--lv-radius-md)",
          fontSize: "0.8rem",
          fontWeight: 500,
          zIndex: 300,
        }}>
          Copied score link
        </div>
      )}

      {/* --- MODALS --- */}

      {/* Add team modal */}
      {addTeamModal && tournament && (
        <AddTeamModal tournament={tournament} onClose={() => setAddTeamModal(false)} onAdded={() => { setAddTeamModal(false); loadTeams(); }} />
      )}

      {editTeamModal && (
        <EditTeamModal team={editTeamModal} onClose={() => setEditTeamModal(null)} onSaved={() => { setEditTeamModal(null); loadTeams(); }} />
      )}

      {/* Net count modal */}
      {poolModal && (
        <NetCountModal
          checkedInCount={teams.filter((t) => t.checked_in && !t.withdrawn_at).length}
          onClose={() => setPoolModal(false)}
          onConfirm={persistPools}
        />
      )}

      {/* Regenerate confirmation */}
      {regenerateConfirm && (
        <NetCountModal
          checkedInCount={teams.filter((t) => t.checked_in && !t.withdrawn_at).length}
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

      {/* Withdraw modal */}
      {withdrawModal && (
        <WithdrawTeamModal
          team={withdrawModal}
          matches={savedMatches ?? []}
          pools={savedPools ?? []}
          onClose={() => setWithdrawModal(null)}
          onWithdraw={handleWithdraw}
          onHardDelete={handleHardDelete}
          onChangeWorkTeam={changeWorkTeam}
        />
      )}

      {/* Playoff setup modal */}
      {playoffSetup && savedPools && (
        <PlayoffSetupModal
          tournamentId={tournamentId}
          poolCount={savedPools.length}
          courtCount={savedPools.length}
          withdrawnTeamIds={withdrawnTeamIds}
          onClose={() => setPlayoffSetup(false)}
          onGenerated={() => { setPlayoffSetup(false); checkBrackets(); }}
        />
      )}

      {/* Score override modal */}
      {scoreOverrideModal && (
        <ScoreOverrideModal
          matchId={scoreOverrideModal}
          match={savedMatches?.find((m) => m.match.id === scoreOverrideModal) ?? null}
          pools={savedPools}
          onClose={() => setScoreOverrideModal(null)}
          onSaved={() => { setScoreOverrideModal(null); loadMatches(); }}
        />
      )}

      {/* Bracket score override modal */}
      {bracketScoreModal && (
        <BracketScoreModal
          matchId={bracketScoreModal.matchId}
          pointsPerSet={bracketScoreModal.pointsPerSet}
          teamAName={bracketScoreModal.team_a_name}
          teamBName={bracketScoreModal.team_b_name}
          existingScore={bracketScoreModal.existingScore}
          onClose={() => setBracketScoreModal(null)}
          onSaved={() => { setBracketScoreModal(null); checkBrackets(); }}
        />
      )}

      {/* Email work links modal */}
      {emailLinksModal && (
        <div className="lv-admin-overlay" onClick={() => !emailLinksSending && setEmailLinksModal(false)}>
          <div className="lv-admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="lv-admin-modal-header">
              <h2 className="lv-admin-modal-title">Send work assignment emails?</h2>
              <button className="lv-admin-modal-close" onClick={() => !emailLinksSending && setEmailLinksModal(false)} aria-label="Close">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M5 5l10 10M15 5L5 15" /></svg>
              </button>
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--lv-ink-muted)", marginBottom: "0.75rem" }}>
              This will send match score link emails to all active teams assigned to work matches.
              {bracketsExist ? " Pool matches and bracket matches are both included." : ""}
            </p>
            {(() => {
              // Count work teams, excluding withdrawn
              const activeWorkTeamIds = new Set<string>();
              const withdrawnWorkTeamIds = new Set<string>();
              savedMatches?.forEach((m) => {
                if (m.work_team) {
                  if (withdrawnTeamIds.has(m.work_team.id)) withdrawnWorkTeamIds.add(m.work_team.id);
                  else activeWorkTeamIds.add(m.work_team.id);
                }
              });
              const poolMatchCount = savedMatches?.filter((m) => m.work_team && !withdrawnTeamIds.has(m.work_team.id)).length ?? 0;
              return (
                <>
                  <p style={{ fontSize: "0.85rem", color: "var(--lv-ink)", fontWeight: 600 }}>
                    {poolMatchCount} pool matches across {activeWorkTeamIds.size} active teams.
                  </p>
                  {withdrawnWorkTeamIds.size > 0 && (
                    <div className="lv-email-withdrawn-warning">
                      {withdrawnWorkTeamIds.size} withdrawn team{withdrawnWorkTeamIds.size > 1 ? "s" : ""} assigned as work team will be skipped.
                    </div>
                  )}
                </>
              );
            })()}

            {emailLinksResult && (
              <div style={{ marginTop: "0.75rem", padding: "8px 12px", borderRadius: 6, background: emailLinksResult.failed > 0 ? "rgba(180,60,60,0.08)" : "rgba(60,140,60,0.08)", fontSize: "0.85rem" }}>
                {emailLinksResult.failed === 0
                  ? `Emails sent to ${emailLinksResult.sent} active teams.`
                  : `Sent to ${emailLinksResult.sent} teams. ${emailLinksResult.failed} failed — check logs.`
                }
                {(emailLinksResult.skippedWithdrawn ?? 0) > 0 && (
                  <span style={{ color: "var(--lv-gold)" }}> ({emailLinksResult.skippedWithdrawn} withdrawn skipped)</span>
                )}
              </div>
            )}
            {emailLinksError && (
              <div className="lv-error" style={{ marginTop: "0.75rem" }}>{emailLinksError}</div>
            )}

            <div className="lv-admin-modal-footer">
              <button type="button" className="lv-btn lv-btn-ghost" onClick={() => setEmailLinksModal(false)} disabled={emailLinksSending}>
                {emailLinksResult ? "Close" : "Cancel"}
              </button>
              {!emailLinksResult && (
                <button
                  type="button"
                  className="lv-btn lv-btn-primary"
                  disabled={emailLinksSending}
                  onClick={async () => {
                    setEmailLinksSending(true);
                    setEmailLinksError("");
                    try {
                      const res = await fetch("/api/admin/matches/email-work-links", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ tournament_id: tournamentId }),
                      });
                      const data = await res.json();
                      if (!res.ok) {
                        setEmailLinksError(data.error ?? "Failed to send emails.");
                      } else {
                        setEmailLinksResult({ sent: data.sent ?? 0, failed: data.failed ?? 0, skippedWithdrawn: data.skippedWithdrawn ?? 0 });
                      }
                    } catch {
                      setEmailLinksError("Network error. Try again.");
                    } finally {
                      setEmailLinksSending(false);
                    }
                  }}
                >
                  {emailLinksSending ? "Sending..." : "Send emails"}
                </button>
              )}
            </div>
          </div>
        </div>
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
            <button type="submit" className="lv-btn lv-btn-primary" disabled={submitting}>{submitting ? "Adding..." : "Add team"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---- EDIT TEAM MODAL ---- */
function EditTeamModal({ team, onClose, onSaved }: { team: Team; onClose: () => void; onSaved: () => void }) {
  const [teamName, setTeamName] = useState(team.team_name);
  const [contactPhone, setContactPhone] = useState(team.contact_phone);
  const [players, setPlayers] = useState(
    team.players.map((p) => ({ id: p.id, name: p.name, email: p.email ?? "", is_captain: p.is_captain }))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function updatePlayer(idx: number, field: "name" | "email", value: string) {
    setPlayers((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const captain = players.find((p) => p.is_captain);
    const res = await fetch(`/api/admin/teams/${team.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        team_name: teamName,
        contact_phone: contactPhone,
        contact_email: captain?.email || team.contact_email,
        players: players.map((p) => ({ id: p.id, name: p.name, email: p.email || null })),
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Update failed");
      setSubmitting(false);
    } else {
      onSaved();
    }
  }

  return (
    <div className="lv-admin-overlay" onClick={onClose}>
      <div className="lv-admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="lv-admin-modal-header">
          <h2 className="lv-admin-modal-title">Update team</h2>
          <button className="lv-admin-modal-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M5 5l10 10M15 5L5 15" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="lv-form">
          <div className="lv-field"><label className="lv-field-label">Team name</label><input className="lv-input" type="text" value={teamName} onChange={(e) => setTeamName(e.target.value)} required /></div>
          {players.map((p, idx) => {
            const isCaptain = p.is_captain;
            return (
              <fieldset key={p.id} className="lv-player-group">
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
            <button type="submit" className="lv-btn lv-btn-primary" disabled={submitting}>{submitting ? "Saving..." : "Update team"}</button>
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
            <button type="button" className="lv-btn lv-btn-primary" disabled={!valid || saving}
              onClick={async () => { setSaving(true); await onConfirm(netNum); setSaving(false); }}>
              {saving ? "Saving..." : isRegenerate ? "Regenerate" : "Generate pools"}
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
          {pools.map(({ pool, teams: poolTeams }) => (
            <div key={pool.id} className="lv-admin-pool-card" style={{ margin: 0 }}>
              <div className="lv-admin-pool-court">Pool {pool.pool_label}{pool.id === sourcePool?.pool.id ? " (current)" : ""}</div>
              <div className="lv-admin-pool-teams">
                {poolTeams.filter((t) => t.team_id !== teamId).map((t) => (
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

/* ---- PLAYOFF SETUP MODAL ---- */
function PlayoffSetupModal({ tournamentId, poolCount, courtCount, withdrawnTeamIds, onClose, onGenerated }: {
  tournamentId: string; poolCount: number; courtCount: number; withdrawnTeamIds: Set<string>; onClose: () => void; onGenerated: () => void;
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
          const overall = computeOverallStandings(data.pools)
            .filter((t) => !withdrawnTeamIds.has(t.team_id))
            .map((t, i) => ({ ...t, overall_rank: i + 1 }));
          setStandings(overall);
          setCutoff(getDefaultGoldCutoff(overall, poolCount));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [tournamentId, poolCount, withdrawnTeamIds]);

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
                <span className="lv-playoff-record">{t.sets_won}-{t.sets_lost}</span>
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

/* ---- SCORE OVERRIDE MODAL ---- */
function ScoreOverrideModal({ matchId, match, pools, onClose, onSaved }: {
  matchId: string;
  match: MatchData | null;
  pools: PoolWithTeams[] | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Determine format from pool size
  const poolSize = useMemo(() => {
    if (!match || !pools) return 4;
    const pool = pools.find((p) => p.pool.id === match.pool.id);
    return pool?.teams.length ?? 4;
  }, [match, pools]);

  const format = useMemo(() => getMatchFormat(poolSize), [poolSize]);

  const [sets, setSets] = useState<Array<{ team_a_score: number; team_b_score: number }>>(() => {
    const result = [];
    for (let i = 0; i < format.sets; i++) {
      const existing = match?.sets.find((s) => s.set_number === i + 1);
      result.push({
        team_a_score: existing?.team_a_score ?? 0,
        team_b_score: existing?.team_b_score ?? 0,
      });
    }
    return result;
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const payload = sets.map((s, i) => ({
      set_number: i + 1,
      team_a_score: s.team_a_score,
      team_b_score: s.team_b_score,
    }));
    const res = await fetch(`/api/admin/matches/${matchId}/score`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sets: payload }),
    });
    if (res.ok) {
      // Update match status
      await fetch(`/api/admin/matches/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "complete" }),
      });
      onSaved();
    } else {
      alert("Failed to save scores");
      setSaving(false);
    }
  }

  if (!match) return null;

  return (
    <div className="lv-admin-overlay" onClick={onClose}>
      <div className="lv-admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="lv-admin-modal-header">
          <h2 className="lv-admin-modal-title">Override score</h2>
          <button className="lv-admin-modal-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M5 5l10 10M15 5L5 15" /></svg>
          </button>
        </div>
        <p style={{ fontSize: "0.85rem", color: "var(--lv-ink)", marginBottom: "1rem" }}>
          {match.team_a.team_name} vs {match.team_b.team_name}
        </p>
        {sets.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: "0.75rem", color: "var(--lv-ink-muted)", minWidth: 40 }}>Set {i + 1}</span>
            <input
              type="number"
              className="lv-admin-seed"
              style={{ width: 60 }}
              min={0}
              value={s.team_a_score}
              onChange={(e) => setSets((prev) => prev.map((ps, j) => j === i ? { ...ps, team_a_score: parseInt(e.target.value) || 0 } : ps))}
            />
            <span style={{ fontSize: "0.8rem", color: "var(--lv-ink-muted)" }}>—</span>
            <input
              type="number"
              className="lv-admin-seed"
              style={{ width: 60 }}
              min={0}
              value={s.team_b_score}
              onChange={(e) => setSets((prev) => prev.map((ps, j) => j === i ? { ...ps, team_b_score: parseInt(e.target.value) || 0 } : ps))}
            />
          </div>
        ))}
        <div className="lv-admin-modal-footer">
          <button type="button" className="lv-btn lv-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="lv-btn lv-btn-primary" disabled={saving} onClick={handleSave}>
            {saving ? "Saving..." : "Save score"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---- BRACKET SCORE MODAL ---- */
function BracketScoreModal({ matchId, pointsPerSet, teamAName, teamBName, existingScore, onClose, onSaved }: {
  matchId: string;
  pointsPerSet: number;
  teamAName: string;
  teamBName: string;
  existingScore: { team_a_score: number; team_b_score: number } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [scoreA, setScoreA] = useState(existingScore?.team_a_score ?? 0);
  const [scoreB, setScoreB] = useState(existingScore?.team_b_score ?? 0);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/admin/brackets/${matchId}/score`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team_a_score: scoreA, team_b_score: scoreB }),
    });
    if (res.ok) {
      onSaved();
    } else {
      alert("Failed to save score");
      setSaving(false);
    }
  }

  return (
    <div className="lv-admin-overlay" onClick={onClose}>
      <div className="lv-admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="lv-admin-modal-header">
          <h2 className="lv-admin-modal-title">Override bracket score</h2>
          <button className="lv-admin-modal-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M5 5l10 10M15 5L5 15" /></svg>
          </button>
        </div>
        <p style={{ fontSize: "0.85rem", color: "var(--lv-ink)", marginBottom: "0.5rem" }}>
          {teamAName} vs {teamBName}
        </p>
        <p style={{ fontSize: "0.75rem", color: "var(--lv-ink-muted)", marginBottom: "1rem" }}>
          1 set to {pointsPerSet}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: "0.75rem", color: "var(--lv-ink-muted)", minWidth: 40 }}>Set 1</span>
          <input
            type="number"
            className="lv-admin-seed"
            style={{ width: 60 }}
            min={0}
            value={scoreA}
            onChange={(e) => setScoreA(parseInt(e.target.value) || 0)}
          />
          <span style={{ fontSize: "0.8rem", color: "var(--lv-ink-muted)" }}>&mdash;</span>
          <input
            type="number"
            className="lv-admin-seed"
            style={{ width: 60 }}
            min={0}
            value={scoreB}
            onChange={(e) => setScoreB(parseInt(e.target.value) || 0)}
          />
        </div>
        <div className="lv-admin-modal-footer">
          <button type="button" className="lv-btn lv-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="lv-btn lv-btn-primary" disabled={saving} onClick={handleSave}>
            {saving ? "Saving..." : "Save score"}
          </button>
        </div>
      </div>
    </div>
  );
}

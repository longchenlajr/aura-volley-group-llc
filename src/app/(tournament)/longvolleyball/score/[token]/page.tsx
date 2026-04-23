"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { MatchFormat, MatchSet } from "@/lib/score-format";
import { formatMatchFormat, isSetComplete, isMatchComplete, matchWinner } from "@/lib/score-format";
import { SectionDivider } from "../../../ornaments";

interface MatchInfo {
  id: string;
  pool_label: string;
  court_number: number;
  match_order: number;
  total_matches: number;
  team_a: { id: string; team_name: string };
  team_b: { id: string; team_name: string };
  work_team: { id: string; team_name: string } | null;
  status: string;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function ScoreSubmissionPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [reason, setReason] = useState("");
  const [match, setMatch] = useState<MatchInfo | null>(null);
  const [format, setFormat] = useState<MatchFormat>({ sets: 1, pointsPerSet: 15 });
  const [setScores, setSetScores] = useState<Array<{ a: number; b: number }>>([]);
  const [activeSet, setActiveSet] = useState(1); // 1-indexed
  const [confirmedSets, setConfirmedSets] = useState<Set<number>>(new Set());
  const [matchComplete, setMatchComplete] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [showEndSetModal, setShowEndSetModal] = useState(false);
  const [error, setError] = useState("");

  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestScores = useRef(setScores);
  latestScores.current = setScores;

  const fetchMatch = useCallback(async () => {
    try {
      const res = await fetch(`/api/score/${token}`);
      const data = await res.json();

      if (!data.token_valid) {
        setTokenValid(false);
        setReason(data.reason ?? "not_found");
        setLoading(false);
        return;
      }

      setTokenValid(true);
      setMatch(data.match);
      setFormat(data.format);

      // Initialize set scores from existing data
      const scores: Array<{ a: number; b: number }> = [];
      const confirmed = new Set<number>();
      for (let i = 1; i <= data.format.sets; i++) {
        const existing = (data.existing_sets as MatchSet[])?.find((s) => s.set_number === i);
        scores.push({
          a: existing?.team_a_score ?? 0,
          b: existing?.team_b_score ?? 0,
        });
      }

      // Determine which sets are confirmed and active set
      // A set is confirmed if it's complete AND a later set has scores
      for (let i = 0; i < scores.length - 1; i++) {
        const setComplete = isSetComplete(scores[i].a, scores[i].b, data.format.pointsPerSet);
        const nextHasScores = scores[i + 1].a > 0 || scores[i + 1].b > 0;
        if (setComplete && nextHasScores) {
          confirmed.add(i + 1);
        }
      }

      // If match is already complete, all sets confirmed
      if (data.match.status === "complete") {
        for (let i = 1; i <= data.format.sets; i++) confirmed.add(i);
        setMatchComplete(true);
      }

      setConfirmedSets(confirmed);
      setSetScores(scores);

      // Active set = first non-confirmed set
      const active = Array.from({ length: data.format.sets }, (_, i) => i + 1)
        .find((n) => !confirmed.has(n)) ?? data.format.sets;
      setActiveSet(active);
    } catch {
      setTokenValid(false);
      setReason("not_found");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchMatch(); }, [fetchMatch]);

  // Auto-save: debounced POST on every score change
  const autoSave = useCallback(async (scores: Array<{ a: number; b: number }>, setNum: number) => {
    const s = scores[setNum - 1];
    if (s.a === 0 && s.b === 0) return;

    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/score/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sets: [{ set_number: setNum, team_a_score: s.a, team_b_score: s.b }],
        }),
      });
      if (res.ok) {
        setSaveStatus("saved");
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    }
  }, [token]);

  function updateScore(team: "a" | "b", delta: number) {
    if (matchComplete) return;
    const idx = activeSet - 1;

    setSetScores((prev) => {
      const next = prev.map((s, i) => {
        if (i !== idx) return s;
        const newVal = Math.max(0, s[team] + delta);
        return { ...s, [team]: newVal };
      });

      // Debounced auto-save
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => {
        autoSave(next, activeSet);
      }, 400);

      return next;
    });
  }

  function handleEndSet() {
    setShowEndSetModal(true);
  }

  async function confirmEndSet() {
    setShowEndSetModal(false);

    // Final save of this set
    const s = setScores[activeSet - 1];
    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/score/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sets: [{ set_number: activeSet, team_a_score: s.a, team_b_score: s.b }],
        }),
      });
      if (!res.ok) {
        setSaveStatus("error");
        return;
      }
      const data = await res.json();
      setSaveStatus("saved");

      // Mark this set as confirmed
      setConfirmedSets((prev) => new Set([...prev, activeSet]));

      if (data.complete) {
        setMatchComplete(true);
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      } else {
        // Advance to next set
        setActiveSet(activeSet + 1);
        if (navigator.vibrate) navigator.vibrate(100);
      }
    } catch {
      setSaveStatus("error");
    }
  }

  // ── Loading / invalid states ──

  if (loading) {
    return (
      <div className="lv-score-page">
        <div className="lv-container" style={{ textAlign: "center", padding: "4rem 2rem" }}>
          <p style={{ color: "var(--lv-ink-muted)" }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="lv-score-page">
        <div className="lv-container" style={{ textAlign: "center", padding: "4rem 2rem" }}>
          <SectionDivider style={{ width: 160, color: "var(--lv-gold)", opacity: 0.4, margin: "0 auto 1.5rem" }} />
          <h1 style={{ fontFamily: "var(--lv-font-display), Georgia, serif", fontWeight: 700, fontSize: "1.5rem", color: "var(--lv-ink)", marginBottom: "0.5rem" }}>
            This link isn&rsquo;t valid
          </h1>
          <p style={{ color: "var(--lv-ink-muted)", marginBottom: "2rem" }}>
            {reason === "expired" ? "This token has expired (past tournament date)." : "The link is incorrect or no longer active."}
          </p>
          <Link href="/longvolleyball" className="lv-btn lv-btn-primary">Go to tournament home</Link>
        </div>
      </div>
    );
  }

  if (!match) return null;

  // ── Derived state ──

  const currentScore = setScores[activeSet - 1] ?? { a: 0, b: 0 };
  const setIsComplete = isSetComplete(currentScore.a, currentScore.b, format.pointsPerSet);
  const isLastSet = activeSet === format.sets;

  // For final summary
  const allSetsData = setScores.map((s, i) => ({ set_number: i + 1, team_a_score: s.a, team_b_score: s.b }));
  const winner = matchComplete
    ? matchWinner(allSetsData, format)
    : null;
  const setsWonA = allSetsData.filter((s) => s.team_a_score > s.team_b_score).length;
  const setsWonB = allSetsData.filter((s) => s.team_b_score > s.team_a_score).length;
  const totalPtsA = allSetsData.reduce((sum, s) => sum + s.team_a_score, 0);
  const totalPtsB = allSetsData.reduce((sum, s) => sum + s.team_b_score, 0);

  // ── Match complete view ──

  if (matchComplete) {
    return (
      <div className="lv-score-page">
        <div className="lv-container lv-score-content">
          <div className="lv-score-context">
            <span className="lv-score-context-pool">Pool {match.pool_label} &middot; Court {match.court_number}</span>
            <h1 className="lv-score-context-match">Match {match.match_order} — Final</h1>
          </div>

          <div className="lv-score-complete-card">
            <div className="lv-score-complete-matchup">
              {match.team_a.team_name} vs {match.team_b.team_name}
            </div>

            {format.sets > 1 && (
              <div className="lv-score-complete-record">{setsWonA}-{setsWonB}</div>
            )}

            <div className="lv-score-complete-sets">
              {allSetsData.filter((s) => s.team_a_score > 0 || s.team_b_score > 0).map((s) => (
                <span key={s.set_number} className="lv-score-complete-set">
                  {format.sets > 1 && <span className="lv-score-complete-set-label">S{s.set_number}</span>}
                  {s.team_a_score}&ndash;{s.team_b_score}
                </span>
              ))}
            </div>

            <div className="lv-score-complete-diff">
              <div className="lv-score-complete-diff-row">
                <span>{match.team_a.team_name}</span>
                <span style={{ color: totalPtsA >= totalPtsB ? "var(--lv-green)" : "var(--lv-error)" }}>
                  {totalPtsA - totalPtsB >= 0 ? "+" : ""}{totalPtsA - totalPtsB}
                </span>
              </div>
              <div className="lv-score-complete-diff-row">
                <span>{match.team_b.team_name}</span>
                <span style={{ color: totalPtsB >= totalPtsA ? "var(--lv-green)" : "var(--lv-error)" }}>
                  {totalPtsB - totalPtsA >= 0 ? "+" : ""}{totalPtsB - totalPtsA}
                </span>
              </div>
            </div>

            {winner && (
              <div className="lv-score-complete-winner">
                {winner === "team_a" ? match.team_a.team_name : match.team_b.team_name} wins
              </div>
            )}
          </div>

          <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
            <Link href="/longvolleyball/live" className="lv-btn lv-btn-ghost">View tournament live</Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Active scoring view ──

  return (
    <div className="lv-score-page">
      {/* End Set confirmation modal */}
      {showEndSetModal && (
        <div className="lv-score-overlay" onClick={() => setShowEndSetModal(false)}>
          <div className="lv-score-overlay-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="lv-score-modal-title">
              {isLastSet && format.sets > 1 ? "End Match" : `End Set ${activeSet}`}
            </h3>

            {/* Show previous confirmed sets if this is the last set */}
            {isLastSet && format.sets > 1 && (
              <div className="lv-score-modal-prior-sets">
                {allSetsData.slice(0, activeSet - 1).map((s) => (
                  <div key={s.set_number} className="lv-score-modal-set-line">
                    <span>Set {s.set_number}</span>
                    <span>{s.team_a_score}&ndash;{s.team_b_score}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="lv-score-modal-final">
              <span className="lv-score-modal-final-label">
                {format.sets > 1 ? `Set ${activeSet}` : "Final Score"}
              </span>
              <div className="lv-score-modal-final-score">
                <span>{match.team_a.team_name}</span>
                <strong>{currentScore.a}&ndash;{currentScore.b}</strong>
                <span>{match.team_b.team_name}</span>
              </div>
            </div>

            {error && <div className="lv-error" style={{ marginBottom: "0.75rem" }}>{error}</div>}

            <div className="lv-score-modal-actions">
              <button className="lv-btn lv-btn-ghost" onClick={() => setShowEndSetModal(false)}>
                Go back
              </button>
              <button className="lv-btn lv-btn-primary" onClick={confirmEndSet}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="lv-container lv-score-content">
        {/* Match context */}
        <div className="lv-score-context">
          <span className="lv-score-context-pool">Pool {match.pool_label} &middot; Court {match.court_number}</span>
          <h1 className="lv-score-context-match">Match {match.match_order}{match.total_matches > 0 ? ` of ${match.total_matches}` : ""}</h1>
          <span className="lv-score-context-format">{formatMatchFormat(format)}</span>
        </div>

        {/* Previous confirmed sets summary */}
        {confirmedSets.size > 0 && (
          <div className="lv-score-prior-sets">
            {Array.from(confirmedSets).sort().map((setNum) => {
              const s = setScores[setNum - 1];
              return (
                <div key={setNum} className="lv-score-prior-set">
                  <span className="lv-score-prior-set-label">Set {setNum}</span>
                  <span className="lv-score-prior-set-score">{s.a}&ndash;{s.b}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Active set label */}
        <div className="lv-score-set-label">
          {format.sets > 1 ? `Set ${activeSet}` : "Score"}
        </div>

        {/* Score card */}
        <div className="lv-score-card">
          {/* Team A */}
          <div className="lv-score-card-team">
            <span className="lv-score-card-name">{match.team_a.team_name}</span>
            <div className="lv-score-card-controls">
              <button
                className="lv-score-card-btn lv-score-card-btn-minus"
                onClick={() => updateScore("a", -1)}
                disabled={currentScore.a === 0}
                aria-label="Remove point"
              >
                &minus;
              </button>
              <span className="lv-score-card-value">{currentScore.a}</span>
              <button
                className="lv-score-card-btn lv-score-card-btn-plus"
                onClick={() => updateScore("a", 1)}
                aria-label="Add point"
              >
                +
              </button>
            </div>
          </div>

          <div className="lv-score-card-divider">vs</div>

          {/* Team B */}
          <div className="lv-score-card-team">
            <span className="lv-score-card-name">{match.team_b.team_name}</span>
            <div className="lv-score-card-controls">
              <button
                className="lv-score-card-btn lv-score-card-btn-minus"
                onClick={() => updateScore("b", -1)}
                disabled={currentScore.b === 0}
                aria-label="Remove point"
              >
                &minus;
              </button>
              <span className="lv-score-card-value">{currentScore.b}</span>
              <button
                className="lv-score-card-btn lv-score-card-btn-plus"
                onClick={() => updateScore("b", 1)}
                aria-label="Add point"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Save status */}
        <div className="lv-score-save-status">
          {saveStatus === "saving" && <span className="lv-score-status-saving">Saving...</span>}
          {saveStatus === "saved" && <span className="lv-score-status-saved">Saved</span>}
          {saveStatus === "error" && <span className="lv-score-status-error">Save failed — tap a score to retry</span>}
        </div>

        {/* End Set button */}
        {setIsComplete && (
          <button className="lv-btn lv-btn-primary lv-score-end-set" onClick={handleEndSet}>
            {isLastSet && format.sets > 1 ? "End Match" : format.sets > 1 ? `End Set ${activeSet}` : "End Match"}
          </button>
        )}

        {/* Work team info */}
        {match.work_team && (
          <p className="lv-score-work-info">
            Scorekeeper: {match.work_team.team_name}
          </p>
        )}

        <div style={{ textAlign: "center", marginTop: "1rem" }}>
          <Link href="/longvolleyball/live" className="lv-btn lv-btn-ghost">View tournament live</Link>
        </div>
      </div>
    </div>
  );
}

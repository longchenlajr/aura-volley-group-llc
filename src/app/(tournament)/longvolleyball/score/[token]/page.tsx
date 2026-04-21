"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { MatchFormat, MatchSet } from "@/lib/score-format";
import { formatMatchFormat, isSetComplete, isMatchComplete, matchWinner, editTimeRemaining, isSetEditable } from "@/lib/score-format";
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

export default function ScoreSubmissionPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [reason, setReason] = useState("");
  const [match, setMatch] = useState<MatchInfo | null>(null);
  const [format, setFormat] = useState<MatchFormat>({ sets: 1, pointsPerSet: 15 });
  const [setScores, setSetScores] = useState<Array<{ a: number; b: number; submittedAt?: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [error, setError] = useState("");
  const [, setTick] = useState(0); // for timer re-renders

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

      // Initialize set scores from existing data or empty
      const scores: Array<{ a: number; b: number; submittedAt?: string }> = [];
      for (let i = 1; i <= data.format.sets; i++) {
        const existing = (data.existing_sets as MatchSet[])?.find((s) => s.set_number === i);
        scores.push({
          a: existing?.team_a_score ?? 0,
          b: existing?.team_b_score ?? 0,
          submittedAt: existing?.submitted_at,
        });
      }
      setSetScores(scores);
    } catch {
      setTokenValid(false);
      setReason("not_found");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchMatch(); }, [fetchMatch]);

  // Timer tick for edit countdown
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  function updateScore(setIdx: number, team: "a" | "b", delta: number) {
    setSetScores((prev) => prev.map((s, i) => {
      if (i !== setIdx) return s;
      const key = team;
      const newVal = Math.max(0, s[key] + delta);
      return { ...s, [key]: newVal };
    }));
  }

  async function handleSubmit() {
    if (!match) return;
    setSubmitting(true);
    setError("");

    const setsToSubmit = setScores
      .map((s, i) => ({ set_number: i + 1, team_a_score: s.a, team_b_score: s.b }))
      .filter((s) => s.team_a_score > 0 || s.team_b_score > 0);

    if (setsToSubmit.length === 0) {
      setError("Enter at least one score before submitting.");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`/api/score/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sets: setsToSubmit }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Submission failed.");
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
      setShowOverlay(true);
      if (navigator.vibrate) navigator.vibrate(200);

      // Refresh data
      await fetchMatch();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

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

  const allSetsComplete = isMatchComplete(
    setScores.map((s, i) => ({ set_number: i + 1, team_a_score: s.a, team_b_score: s.b })),
    format,
  );
  const winner = allSetsComplete
    ? matchWinner(setScores.map((s, i) => ({ set_number: i + 1, team_a_score: s.a, team_b_score: s.b })), format)
    : null;
  const anySubmitted = setScores.some((s) => s.submittedAt);
  const allLocked = setScores.every((s) => s.submittedAt && !isSetEditable(s.submittedAt));

  // Compute results for the results card
  const setsData = setScores.map((s, i) => ({ set_number: i + 1, team_a_score: s.a, team_b_score: s.b }));
  const setsWonA = setsData.filter((s) => s.team_a_score > s.team_b_score).length;
  const setsWonB = setsData.filter((s) => s.team_b_score > s.team_a_score).length;
  const totalPtsA = setsData.reduce((sum, s) => sum + s.team_a_score, 0);
  const totalPtsB = setsData.reduce((sum, s) => sum + s.team_b_score, 0);
  const diffA = totalPtsA - totalPtsB;
  const diffB = totalPtsB - totalPtsA;

  return (
    <div className="lv-score-page">
      {/* Results overlay */}
      {showOverlay && anySubmitted && (
        <div className="lv-score-overlay" onClick={() => setShowOverlay(false)}>
          <div className="lv-score-overlay-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="lv-score-results-title">Score submitted</h3>
            <div className="lv-score-results-matchup">
              {match.team_a.team_name} vs {match.team_b.team_name}
            </div>
            {format.sets > 1 && (
              <div className="lv-score-results-record">{setsWonA}-{setsWonB}</div>
            )}
            <div className="lv-score-results-sets">
              {setsData.filter((s) => s.team_a_score > 0 || s.team_b_score > 0).map((s) => (
                <span key={s.set_number} className="lv-score-results-set">
                  {s.team_a_score}-{s.team_b_score}
                </span>
              ))}
            </div>
            <div className="lv-score-results-diff">
              <div className="lv-score-results-diff-row">
                <span>{match.team_a.team_name}</span>
                <span style={{ color: diffA >= 0 ? "var(--lv-green)" : "var(--lv-error)" }}>
                  {diffA >= 0 ? "+" : ""}{diffA}
                </span>
              </div>
              <div className="lv-score-results-diff-row">
                <span>{match.team_b.team_name}</span>
                <span style={{ color: diffB >= 0 ? "var(--lv-green)" : "var(--lv-error)" }}>
                  {diffB >= 0 ? "+" : ""}{diffB}
                </span>
              </div>
            </div>
            {winner && (
              <div className="lv-score-results-winner">
                {winner === "team_a" ? match.team_a.team_name : match.team_b.team_name} wins
              </div>
            )}
            <button className="lv-btn lv-btn-ghost" style={{ marginTop: "1rem" }} onClick={() => setShowOverlay(false)}>
              Dismiss
            </button>
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

        {/* Set score inputs */}
        {setScores.map((s, idx) => {
          const setNum = idx + 1;
          const locked = s.submittedAt && !isSetEditable(s.submittedAt);
          const remaining = s.submittedAt ? editTimeRemaining(s.submittedAt) : 0;
          const setComplete = isSetComplete(s.a, s.b, format.pointsPerSet);

          return (
            <div key={setNum} className="lv-score-set">
              <div className="lv-score-set-header">
                <span className="lv-label">{format.sets > 1 ? `Set ${setNum}` : "Final Score"}</span>
                {s.submittedAt && !locked && (
                  <span className="lv-score-timer">
                    Editable for {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
                  </span>
                )}
                {locked && <span className="lv-score-locked-badge">Locked</span>}
              </div>

              <div className="lv-score-teams">
                {/* Team A */}
                <div className="lv-score-team lv-score-team-a">
                  <span className="lv-score-team-name">{match.team_a.team_name}</span>
                  <div className="lv-score-input-group">
                    <button className="lv-score-btn" disabled={!!locked} onClick={() => updateScore(idx, "a", 1)} aria-label="Add point">+</button>
                    <input
                      className="lv-score-input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={s.a}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val >= 0) {
                          setSetScores((prev) => prev.map((sc, i) => i === idx ? { ...sc, a: val } : sc));
                        }
                      }}
                      disabled={!!locked}
                    />
                    <button className="lv-score-btn" disabled={!!locked || s.a === 0} onClick={() => updateScore(idx, "a", -1)} aria-label="Remove point">-</button>
                  </div>
                </div>

                <span className="lv-score-vs">vs</span>

                {/* Team B */}
                <div className="lv-score-team lv-score-team-b">
                  <span className="lv-score-team-name">{match.team_b.team_name}</span>
                  <div className="lv-score-input-group">
                    <button className="lv-score-btn" disabled={!!locked} onClick={() => updateScore(idx, "b", 1)} aria-label="Add point">+</button>
                    <input
                      className="lv-score-input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={s.b}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val >= 0) {
                          setSetScores((prev) => prev.map((sc, i) => i === idx ? { ...sc, b: val } : sc));
                        }
                      }}
                      disabled={!!locked}
                    />
                    <button className="lv-score-btn" disabled={!!locked || s.b === 0} onClick={() => updateScore(idx, "b", -1)} aria-label="Remove point">-</button>
                  </div>
                </div>
              </div>

              {setComplete && (
                <div className="lv-score-set-complete">Set complete</div>
              )}
            </div>
          );
        })}

        {/* Work team info */}
        {match.work_team && (
          <p className="lv-score-work-info">
            Submitted by: {match.work_team.team_name}
          </p>
        )}

        {/* Error */}
        {error && <div className="lv-error" style={{ marginBottom: "1rem" }}>{error}</div>}

        {/* Submit button */}
        {allLocked ? (
          <div style={{ textAlign: "center" }}>
            <button className="lv-btn lv-btn-primary lv-score-submit" disabled>Score locked</button>
            <p style={{ color: "var(--lv-ink-muted)", fontSize: "0.8rem", marginTop: "0.5rem" }}>
              Need to fix this score? Find an admin on site.
            </p>
          </div>
        ) : (
          <button
            className="lv-btn lv-btn-primary lv-score-submit"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "Submitting..." : anySubmitted ? "Update score" : "Submit score"}
          </button>
        )}

        <div style={{ textAlign: "center", marginTop: "1rem" }}>
          <Link href="/longvolleyball/live" className="lv-btn lv-btn-ghost">View tournament live</Link>
        </div>
      </div>
    </div>
  );
}

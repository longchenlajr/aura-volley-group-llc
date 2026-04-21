"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { isSetComplete, isSetEditable, editTimeRemaining } from "@/lib/score-format";
import { SectionDivider } from "../../../ornaments";

interface BracketMatchInfo {
  id: string;
  bracket_type: string;
  round_label: string;
  court_number: number;
  match_order: number;
  points_per_set: number;
  team_a: { id: string; team_name: string };
  team_b: { id: string; team_name: string };
  work_team: { id: string; team_name: string } | null;
  status: string;
}

export default function BracketScorePage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [reason, setReason] = useState("");
  const [match, setMatch] = useState<BracketMatchInfo | null>(null);
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [submittedAt, setSubmittedAt] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [error, setError] = useState("");
  const [, setTick] = useState(0);

  const fetchMatch = useCallback(async () => {
    try {
      const res = await fetch(`/api/bracket-score/${token}`);
      const data = await res.json();
      if (!data.token_valid) { setTokenValid(false); setReason(data.reason ?? "not_found"); setLoading(false); return; }
      setTokenValid(true);
      setMatch(data.match);
      const existing = data.existing_sets?.[0];
      if (existing) {
        setScoreA(existing.team_a_score);
        setScoreB(existing.team_b_score);
        setSubmittedAt(existing.submitted_at);
      }
    } catch { setTokenValid(false); setReason("not_found"); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchMatch(); }, [fetchMatch]);
  useEffect(() => { const i = setInterval(() => setTick((t) => t + 1), 1000); return () => clearInterval(i); }, []);

  async function handleSubmit() {
    if (!match) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/bracket-score/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_a_score: scoreA, team_b_score: scoreB }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed"); setSubmitting(false); return; }
      setSubmitted(true);
      setShowOverlay(true);
      if (navigator.vibrate) navigator.vibrate(200);
      await fetchMatch();
    } catch { setError("Something went wrong."); }
    finally { setSubmitting(false); }
  }

  if (loading) return <div className="lv-score-page"><div className="lv-container" style={{ textAlign: "center", padding: "4rem 2rem" }}><p style={{ color: "var(--lv-ink-muted)" }}>Loading...</p></div></div>;

  if (!tokenValid || !match) {
    return (
      <div className="lv-score-page">
        <div className="lv-container" style={{ textAlign: "center", padding: "4rem 2rem" }}>
          <SectionDivider style={{ width: 160, color: "var(--lv-gold)", opacity: 0.4, margin: "0 auto 1.5rem" }} />
          <h1 style={{ fontFamily: "var(--lv-font-display), Georgia, serif", fontWeight: 700, fontSize: "1.5rem", color: "var(--lv-ink)", marginBottom: "0.5rem" }}>This link isn&rsquo;t valid</h1>
          <p style={{ color: "var(--lv-ink-muted)", marginBottom: "2rem" }}>
            {reason === "expired" ? "This token has expired." : "The link is incorrect or no longer active."}
          </p>
          <Link href="/longvolleyball" className="lv-btn lv-btn-primary">Go to tournament home</Link>
        </div>
      </div>
    );
  }

  const pps = match.points_per_set;
  const complete = isSetComplete(scoreA, scoreB, pps);
  const locked = submittedAt && !isSetEditable(submittedAt);
  const remaining = submittedAt ? editTimeRemaining(submittedAt) : 0;
  const winner = complete ? (scoreA > scoreB ? "team_a" : "team_b") : null;
  const diffA = scoreA - scoreB;
  const diffB = scoreB - scoreA;

  return (
    <div className="lv-score-page">
      {/* Results overlay */}
      {showOverlay && submitted && (
        <div className="lv-score-overlay" onClick={() => setShowOverlay(false)}>
          <div className="lv-score-overlay-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="lv-score-results-title">Score submitted</h3>
            <div className="lv-score-results-matchup">{match.team_a.team_name} vs {match.team_b.team_name}</div>
            <div className="lv-score-results-record" style={{ fontSize: "2rem" }}>{scoreA}-{scoreB}</div>
            <div className="lv-score-results-diff">
              <div className="lv-score-results-diff-row">
                <span>{match.team_a.team_name}</span>
                <span style={{ color: diffA >= 0 ? "var(--lv-green)" : "var(--lv-error)" }}>{diffA >= 0 ? "+" : ""}{diffA}</span>
              </div>
              <div className="lv-score-results-diff-row">
                <span>{match.team_b.team_name}</span>
                <span style={{ color: diffB >= 0 ? "var(--lv-green)" : "var(--lv-error)" }}>{diffB >= 0 ? "+" : ""}{diffB}</span>
              </div>
            </div>
            {winner && <div className="lv-score-results-winner">{winner === "team_a" ? match.team_a.team_name : match.team_b.team_name} advances</div>}
            <button className="lv-btn lv-btn-ghost" style={{ marginTop: "1rem" }} onClick={() => setShowOverlay(false)}>Dismiss</button>
          </div>
        </div>
      )}

      <div className="lv-container lv-score-content">
        <div className="lv-score-context">
          <span className="lv-score-context-pool">
            {match.bracket_type === "gold" ? "Gold" : "Silver"} Bracket &middot; {match.round_label} &middot; Court {match.court_number}
          </span>
          <h1 className="lv-score-context-match">{match.round_label}</h1>
          <span className="lv-score-context-format">1 set to {pps}</span>
        </div>

        <div className="lv-score-set">
          <div className="lv-score-set-header">
            <span className="lv-label">Final Score</span>
            {submittedAt && !locked && <span className="lv-score-timer">Editable for {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</span>}
            {locked && <span className="lv-score-locked-badge">Locked</span>}
          </div>

          <div className="lv-score-teams">
            <div className="lv-score-team lv-score-team-a">
              <span className="lv-score-team-name">{match.team_a.team_name}</span>
              <div className="lv-score-input-group">
                <button className="lv-score-btn" disabled={!!locked} onClick={() => setScoreA((v) => v + 1)}>+</button>
                <input className="lv-score-input" type="text" inputMode="numeric" pattern="[0-9]*" value={scoreA}
                  onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 0) setScoreA(v); }}
                  disabled={!!locked} />
                <button className="lv-score-btn" disabled={!!locked || scoreA === 0} onClick={() => setScoreA((v) => Math.max(0, v - 1))}>-</button>
              </div>
            </div>
            <span className="lv-score-vs">vs</span>
            <div className="lv-score-team lv-score-team-b">
              <span className="lv-score-team-name">{match.team_b.team_name}</span>
              <div className="lv-score-input-group">
                <button className="lv-score-btn" disabled={!!locked} onClick={() => setScoreB((v) => v + 1)}>+</button>
                <input className="lv-score-input" type="text" inputMode="numeric" pattern="[0-9]*" value={scoreB}
                  onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 0) setScoreB(v); }}
                  disabled={!!locked} />
                <button className="lv-score-btn" disabled={!!locked || scoreB === 0} onClick={() => setScoreB((v) => Math.max(0, v - 1))}>-</button>
              </div>
            </div>
          </div>

          {complete && <div className="lv-score-set-complete">Match complete</div>}
        </div>

        {match.work_team && <p className="lv-score-work-info">Submitted by: {match.work_team.team_name}</p>}
        {error && <div className="lv-error" style={{ marginBottom: "1rem" }}>{error}</div>}

        {locked ? (
          <div style={{ textAlign: "center" }}>
            <button className="lv-btn lv-btn-primary lv-score-submit" disabled>Score locked</button>
            <p style={{ color: "var(--lv-ink-muted)", fontSize: "0.8rem", marginTop: "0.5rem" }}>Need to fix? Find an admin.</p>
          </div>
        ) : (
          <button className="lv-btn lv-btn-primary lv-score-submit" onClick={handleSubmit} disabled={submitting || (scoreA === 0 && scoreB === 0)}>
            {submitting ? "Submitting..." : submittedAt ? "Update score" : "Submit score"}
          </button>
        )}

        <div style={{ textAlign: "center", marginTop: "1rem" }}>
          <Link href="/longvolleyball/live" className="lv-btn lv-btn-ghost">View tournament live</Link>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { isSetComplete } from "@/lib/score-format";
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

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function BracketScorePage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [reason, setReason] = useState("");
  const [match, setMatch] = useState<BracketMatchInfo | null>(null);
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [matchComplete, setMatchComplete] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [showEndModal, setShowEndModal] = useState(false);
  const [error, setError] = useState("");

  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchMatch = useCallback(async () => {
    try {
      const res = await fetch(`/api/bracket-score/${token}`);
      const data = await res.json();
      if (!data.token_valid) {
        setTokenValid(false);
        setReason(data.reason ?? "not_found");
        setLoading(false);
        return;
      }
      setTokenValid(true);
      setMatch(data.match);
      const existing = data.existing_sets?.[0];
      if (existing) {
        setScoreA(existing.team_a_score);
        setScoreB(existing.team_b_score);
      }
      if (data.match.status === "complete") {
        setMatchComplete(true);
      }
    } catch {
      setTokenValid(false);
      setReason("not_found");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchMatch(); }, [fetchMatch]);

  const autoSave = useCallback(async (a: number, b: number) => {
    if (a === 0 && b === 0) return;
    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/bracket-score/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_a_score: a, team_b_score: b }),
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
    const newA = team === "a" ? Math.max(0, scoreA + delta) : scoreA;
    const newB = team === "b" ? Math.max(0, scoreB + delta) : scoreB;
    if (team === "a") setScoreA(newA);
    else setScoreB(newB);

    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => autoSave(newA, newB), 400);
  }

  async function confirmEndMatch() {
    setShowEndModal(false);
    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/bracket-score/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_a_score: scoreA, team_b_score: scoreB }),
      });
      if (!res.ok) {
        setSaveStatus("error");
        return;
      }
      const data = await res.json();
      setSaveStatus("saved");
      if (data.complete) {
        setMatchComplete(true);
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
    } catch {
      setSaveStatus("error");
    }
  }

  // --- Loading / invalid ---

  if (loading) {
    return (
      <div className="lv-score-page">
        <div className="lv-container" style={{ textAlign: "center", padding: "4rem 2rem" }}>
          <p style={{ color: "var(--lv-ink-muted)" }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!tokenValid || !match) {
    return (
      <div className="lv-score-page">
        <div className="lv-container" style={{ textAlign: "center", padding: "4rem 2rem" }}>
          <SectionDivider style={{ width: 160, color: "var(--lv-gold)", opacity: 0.4, margin: "0 auto 1.5rem" }} />
          <h1 style={{ fontFamily: "var(--lv-font-display), Georgia, serif", fontWeight: 700, fontSize: "1.5rem", color: "var(--lv-ink)", marginBottom: "0.5rem" }}>
            This link isn&rsquo;t valid
          </h1>
          <p style={{ color: "var(--lv-ink-muted)", marginBottom: "2rem" }}>
            {reason === "expired" ? "This token has expired." : "The link is incorrect or no longer active."}
          </p>
          <Link href="/longvolleyball" className="lv-btn lv-btn-primary">Go to tournament home</Link>
        </div>
      </div>
    );
  }

  const pps = match.points_per_set;
  const setIsComplete = isSetComplete(scoreA, scoreB, pps);
  const winner = matchComplete ? (scoreA > scoreB ? "team_a" : "team_b") : null;
  const diffA = scoreA - scoreB;
  const diffB = scoreB - scoreA;

  // --- Match complete view ---

  if (matchComplete) {
    return (
      <div className="lv-score-page">
        <div className="lv-container lv-score-content">
          <div className="lv-score-context">
            <span className="lv-score-context-pool">
              {match.bracket_type === "gold" ? "Gold" : "Silver"} Bracket &middot; Court {match.court_number}
            </span>
            <h1 className="lv-score-context-match">{match.round_label} &mdash; Final</h1>
          </div>

          <div className="lv-score-complete-card">
            <div className="lv-score-complete-matchup">
              {match.team_a.team_name} vs {match.team_b.team_name}
            </div>
            <div className="lv-score-complete-sets">
              <span className="lv-score-complete-set">{scoreA}&ndash;{scoreB}</span>
            </div>
            <div className="lv-score-complete-diff">
              <div className="lv-score-complete-diff-row">
                <span>{match.team_a.team_name}</span>
                <span style={{ color: diffA >= 0 ? "var(--lv-green)" : "var(--lv-error)" }}>
                  {diffA >= 0 ? "+" : ""}{diffA}
                </span>
              </div>
              <div className="lv-score-complete-diff-row">
                <span>{match.team_b.team_name}</span>
                <span style={{ color: diffB >= 0 ? "var(--lv-green)" : "var(--lv-error)" }}>
                  {diffB >= 0 ? "+" : ""}{diffB}
                </span>
              </div>
            </div>
            {winner && (
              <div className="lv-score-complete-winner">
                {winner === "team_a" ? match.team_a.team_name : match.team_b.team_name} advances
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

  // --- Active scoring view ---

  return (
    <div className="lv-score-page">
      {/* End Match confirmation modal */}
      {showEndModal && (
        <div className="lv-score-overlay" onClick={() => setShowEndModal(false)}>
          <div className="lv-score-overlay-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="lv-score-modal-title">End Match</h3>

            <div className="lv-score-modal-final">
              <span className="lv-score-modal-final-label">Final Score</span>
              <div className="lv-score-modal-final-score">
                <span>{match.team_a.team_name}</span>
                <strong>{scoreA}&ndash;{scoreB}</strong>
                <span>{match.team_b.team_name}</span>
              </div>
            </div>

            {error && <div className="lv-error" style={{ marginBottom: "0.75rem" }}>{error}</div>}

            <div className="lv-score-modal-actions">
              <button className="lv-btn lv-btn-ghost" onClick={() => setShowEndModal(false)}>Go back</button>
              <button className="lv-btn lv-btn-primary" onClick={confirmEndMatch}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      <div className="lv-container lv-score-content">
        <div className="lv-score-context">
          <span className="lv-score-context-pool">
            {match.bracket_type === "gold" ? "Gold" : "Silver"} Bracket &middot; Court {match.court_number}
          </span>
          <h1 className="lv-score-context-match">{match.round_label}</h1>
          <span className="lv-score-context-format">1 set to {pps}</span>
        </div>

        {/* Score label */}
        <div className="lv-score-set-label">Score</div>

        {/* Score card */}
        <div className="lv-score-card">
          <div className="lv-score-card-team">
            <span className="lv-score-card-name">{match.team_a.team_name}</span>
            <div className="lv-score-card-controls">
              <button
                className="lv-score-card-btn lv-score-card-btn-minus"
                onClick={() => updateScore("a", -1)}
                disabled={scoreA === 0}
                aria-label="Remove point"
              >
                &minus;
              </button>
              <span className="lv-score-card-value">{scoreA}</span>
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

          <div className="lv-score-card-team">
            <span className="lv-score-card-name">{match.team_b.team_name}</span>
            <div className="lv-score-card-controls">
              <button
                className="lv-score-card-btn lv-score-card-btn-minus"
                onClick={() => updateScore("b", -1)}
                disabled={scoreB === 0}
                aria-label="Remove point"
              >
                &minus;
              </button>
              <span className="lv-score-card-value">{scoreB}</span>
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

        {/* End Match button */}
        {setIsComplete && (
          <button className="lv-btn lv-btn-primary lv-score-end-set" onClick={() => setShowEndModal(true)}>
            End Match
          </button>
        )}

        {/* Work team info */}
        {match.work_team && (
          <p className="lv-score-work-info">Scorekeeper: {match.work_team.team_name}</p>
        )}

        <div style={{ textAlign: "center", marginTop: "1rem" }}>
          <Link href="/longvolleyball/live" className="lv-btn lv-btn-ghost">View tournament live</Link>
        </div>
      </div>
    </div>
  );
}

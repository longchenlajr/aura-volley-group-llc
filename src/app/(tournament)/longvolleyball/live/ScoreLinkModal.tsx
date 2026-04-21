"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  matchId: string;
  workTeamName: string;
  onClose: () => void;
}

export function ScoreLinkModal({ matchId, workTeamName, onClose }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setVerifying(true);
    setError("");

    try {
      const res = await fetch("/api/public/score-link/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: matchId, email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Verification failed.");
        setVerifying(false);
        return;
      }

      // Redirect to score submission page
      router.push(`/longvolleyball/score/${data.token}`);
    } catch {
      setError("Something went wrong. Try again.");
      setVerifying(false);
    }
  }

  return (
    <div className="lv-admin-overlay" onClick={onClose}>
      <div className="lv-admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="lv-admin-modal-header">
          <h2 className="lv-admin-modal-title">Verify you&rsquo;re the scorekeeper</h2>
          <button className="lv-admin-modal-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>

        <p style={{ fontSize: "0.85rem", color: "var(--lv-ink-muted)", marginBottom: "1rem" }}>
          Enter the email of any player on <strong>{workTeamName}</strong> to access the score submission form.
        </p>

        <form onSubmit={handleVerify} className="lv-form">
          <div className="lv-field">
            <label className="lv-field-label" htmlFor="verify-email">Player email</label>
            <input
              id="verify-email"
              className="lv-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              placeholder="captain@email.com"
            />
          </div>

          {error && <div className="lv-error">{error}</div>}

          <div className="lv-admin-modal-footer">
            <button type="button" className="lv-btn lv-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="lv-btn lv-btn-primary" disabled={verifying}>
              {verifying ? "Verifying..." : "Verify"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

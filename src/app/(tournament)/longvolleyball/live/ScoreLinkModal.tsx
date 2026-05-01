"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  matchId: string;
  matchType?: "pool" | "bracket";
  onClose: () => void;
}

export function ScoreLinkModal({ matchId, matchType = "pool", onClose }: Props) {
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
        body: JSON.stringify({ match_id: matchId, match_type: matchType, email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Verification failed.");
        setVerifying(false);
        return;
      }

      // Redirect using the path returned by the API
      router.push(data.redirectPath);
    } catch {
      setError("Something went wrong. Try again.");
      setVerifying(false);
    }
  }

  return (
    <div className="lv-admin-overlay" onClick={onClose}>
      <div className="lv-admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="lv-admin-modal-header">
          <h2 className="lv-admin-modal-title">Submit scores</h2>
          <button className="lv-admin-modal-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>

        <p style={{ fontSize: "0.85rem", color: "var(--lv-ink-muted)", marginBottom: "1rem" }}>
          Enter any registered player&rsquo;s email to access the score form. Your team will be recorded as the scorekeeper.
        </p>

        <form onSubmit={handleVerify} className="lv-form">
          <div className="lv-field">
            <label className="lv-field-label" htmlFor="verify-email">Your email</label>
            <input
              id="verify-email"
              className="lv-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              placeholder="player@email.com"
            />
          </div>

          {error && <div className="lv-error">{error}</div>}

          <div className="lv-admin-modal-footer">
            <button type="button" className="lv-btn lv-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="lv-btn lv-btn-primary" disabled={verifying}>
              {verifying ? "Verifying..." : "Continue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

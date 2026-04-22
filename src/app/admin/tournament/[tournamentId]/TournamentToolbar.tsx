"use client";

import { useState, useRef, useEffect } from "react";
import type { Tournament } from "@/lib/tournaments";

interface TournamentToolbarProps {
  tournament: Tournament;
  poolsExist: boolean;
  matchesExist: boolean;
  bracketsExist: boolean;
  poolPlayComplete: boolean;
  matchProgress: { complete: number; total: number } | null;
  tournamentPhase: string;
  onEmailWorkLinks: () => void;
  onGeneratePools: () => void;
  onGenerateMatches: () => void;
  onGeneratePlayoffs: () => void;
}

export function TournamentToolbar({
  tournament,
  poolsExist,
  matchesExist,
  bracketsExist,
  poolPlayComplete,
  matchProgress,
  tournamentPhase,
  onEmailWorkLinks,
  onGeneratePools,
  onGenerateMatches,
  onGeneratePlayoffs,
}: TournamentToolbarProps) {
  const [infoOpen, setInfoOpen] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) {
        setInfoOpen(false);
      }
    }
    if (infoOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [infoOpen]);

  const date = new Date(tournament.date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const fmt = tournament.format === "doubles"
    ? "Doubles (2v2)"
    : tournament.format === "triples"
      ? "Triples (3v3)"
      : `${tournament.format} (${tournament.teamSize}v${tournament.teamSize})`;

  return (
    <>
      <div className="lv-toolbar">
        {/* Email work links — most used on tournament day */}
        {(matchesExist || bracketsExist) && (
          <button className="lv-btn lv-btn-secondary" onClick={onEmailWorkLinks}>
            Email work links
          </button>
        )}

        {/* Generate/Regenerate pools */}
        {!poolsExist ? (
          <button className="lv-btn lv-btn-primary" onClick={onGeneratePools}>
            Generate pools
          </button>
        ) : (
          <button className="lv-btn lv-btn-destructive" onClick={onGeneratePools}>
            Regenerate pools
          </button>
        )}

        {/* Generate/Regenerate matches */}
        {poolsExist && !matchesExist && (
          <button className="lv-btn lv-btn-primary" onClick={onGenerateMatches}>
            Generate matches
          </button>
        )}
        {poolsExist && matchesExist && (
          <button className="lv-btn lv-btn-destructive" onClick={onGenerateMatches}>
            Regenerate matches
          </button>
        )}

        {/* Generate playoffs */}
        {poolPlayComplete && !bracketsExist && (
          <button
            className="lv-btn lv-btn-primary"
            style={{ background: "var(--lv-gold)", borderColor: "var(--lv-gold)" }}
            onClick={onGeneratePlayoffs}
          >
            Generate playoffs
          </button>
        )}

        {/* Tournament info */}
        <div className="lv-info-dropdown" ref={infoRef}>
          <button
            className="lv-btn lv-btn-ghost"
            onClick={() => setInfoOpen(!infoOpen)}
            style={{ fontSize: "0.8rem" }}
          >
            Tournament info
            <svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ marginLeft: 4 }}>
              <path d="M6 8l4 4 4-4" />
            </svg>
          </button>
          {infoOpen && (
            <div className="lv-info-panel">
              <div className="lv-info-row">
                <span className="lv-info-row-label">Name</span>
                <span className="lv-info-row-value">{tournament.name}</span>
              </div>
              <div className="lv-info-row">
                <span className="lv-info-row-label">Date</span>
                <span className="lv-info-row-value">{date}</span>
              </div>
              <div className="lv-info-row">
                <span className="lv-info-row-label">Format</span>
                <span className="lv-info-row-value">{fmt}</span>
              </div>
              <div className="lv-info-row">
                <span className="lv-info-row-label">Location</span>
                <span className="lv-info-row-value">{tournament.location}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status indicator */}
      <div className="lv-tournament-status">
        {tournamentPhase}
        {matchProgress && matchProgress.total > 0 && (
          <> &middot; <strong>{matchProgress.complete}</strong> of {matchProgress.total} matches complete</>
        )}
      </div>
    </>
  );
}

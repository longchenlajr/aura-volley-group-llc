"use client";

import { useState } from "react";
import { getTournamentsWithStatus, type TournamentWithStatus } from "@/lib/tournaments";
import { SectionDivider } from "../../ornaments";
import { DecorativeAsset } from "../../DecorativeAsset";
import { StatusTag } from "../../StatusTag";

export default function LivePage() {
  const tournaments = getTournamentsWithStatus();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = tournaments.find((t) => t.id === selectedId) ?? null;

  return (
    <div className="lv-live-page">
      <div className="lv-container">
        {/* Header */}
        <div className="lv-live-header">
          <p className="lv-label" style={{ color: "var(--lv-red)", marginBottom: "0.5rem" }}>
            Live
          </p>
          <h1 className="lv-h1">Tournament live</h1>
          <p style={{ color: "var(--lv-ink-muted)", fontSize: "0.95rem", marginTop: "0.5rem" }}>
            Standings, scores, and tournament updates.
          </p>
          <div style={{ marginTop: "1.5rem" }}>
            <SectionDivider className="lv-section-divider" style={{ color: "var(--lv-gold)", opacity: 0.5 }} />
          </div>
        </div>

        {/* Date selector — collapsible list with status tags */}
        <div className="lv-field" style={{ marginBottom: "1.5rem" }}>
          <span className="lv-field-label">Tournament Date</span>
          {selected ? (
            <button
              type="button"
              className="lv-date-list-selected"
              onClick={() => setSelectedId(null)}
            >
              <StatusTag status={selected.status} />
              <span className="lv-date-list-date">
                {new Date(selected.date).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <span className="lv-date-list-change">Change</span>
            </button>
          ) : (
            <div className="lv-date-list" role="listbox" aria-label="Select tournament date">
              {tournaments.map((t) => {
                const d = new Date(t.date);
                const label = d.toLocaleDateString("en-US", {
                  weekday: "long",
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
                    onClick={() => setSelectedId(t.id)}
                  >
                    <StatusTag status={t.status} />
                    <span className="lv-date-list-date">{label}</span>
                    <span className="lv-date-list-format">{formatLabel}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Placeholder content based on status */}
        {selected && (
          <div className="lv-live-placeholder">
            <DecorativeAsset src="cloud-1.png" className="lv-live-placeholder-cloud" width={100} height={60} />
            <SectionDivider className="lv-live-placeholder-divider" />

            {selected.status === "upcoming" && (
              <>
                <h2 className="lv-live-placeholder-heading">
                  This tournament hasn&rsquo;t started yet.
                </h2>
                <p className="lv-live-placeholder-text">
                  Check back on{" "}
                  {new Date(selected.date).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}{" "}
                  for live scores and standings. Pool assignments will appear here
                  once registration closes and teams are seeded.
                </p>
              </>
            )}

            {selected.status === "live" && (
              <>
                <h2 className="lv-live-placeholder-heading">
                  Live scoring coming soon.
                </h2>
                <p className="lv-live-placeholder-text">
                  Live pool standings and current match scores will appear here on
                  tournament day. This feature is being built — stay tuned.
                </p>
              </>
            )}

            {selected.status === "archive" && (
              <>
                <h2 className="lv-live-placeholder-heading">
                  Tournament archive coming soon.
                </h2>
                <p className="lv-live-placeholder-text">
                  Final results, standings, and bracket winners from past
                  tournaments will be shown here.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

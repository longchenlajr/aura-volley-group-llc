"use client";

import { useState } from "react";
import Link from "next/link";
import type { Tournament } from "@/lib/tournaments";
import { ArrowRight, DividerOrnament } from "./ornaments";
import { DecorativeAsset } from "./DecorativeAsset";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getEntryFee(teamSize: number): string {
  if (teamSize === 2) return "$25/player · $50/team";
  if (teamSize === 3) return "$25/player · $75/team";
  return `$25/player · $${25 * teamSize}/team`;
}

function formatLabel(format: string): string {
  if (format === "doubles") return "Doubles (2v2)";
  if (format === "triples") return "Triples (3v3)";
  if (format === "quads") return "Quads (4v4)";
  if (format === "sixes") return "Sixes (6v6)";
  return format;
}

export function TournamentPicker({ tournaments }: { tournaments: Tournament[] }) {
  const sorted = [...tournaments].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = sorted.find((t) => t.id === selectedId) ?? null;

  return (
    <div className="lv-picker">
      {/* Date strip */}
      <div className="lv-date-strip" role="listbox" aria-label="Select tournament date">
        {sorted.map((t) => {
          const d = new Date(t.date);
          const month = MONTHS[d.getMonth()];
          const day = d.getDate();
          const dayName = DAYS[d.getDay()];
          const isSelected = t.id === selectedId;

          return (
            <button
              key={t.id}
              role="option"
              aria-selected={isSelected}
              className={`lv-date-chip ${isSelected ? "selected" : ""}`}
              onClick={() => setSelectedId(isSelected ? null : t.id)}
            >
              <span className="lv-date-chip-month">{month}</span>
              <span className="lv-date-chip-day">{day}</span>
              <span className="lv-date-chip-dayname">{dayName}</span>
            </button>
          );
        })}

      </div>

      {/* Dossier card — appears when date is selected */}
      {selected && (
        <div className="lv-dossier" key={selected.id} style={{ position: "relative" }}>
          <DecorativeAsset src="corner-flourish.png" className="lv-dossier-flourish lv-dossier-flourish-tl" width={50} height={50} />
          <DecorativeAsset src="corner-flourish.png" className="lv-dossier-flourish lv-dossier-flourish-br" width={50} height={50} />
          <div className="lv-dossier-inner">
            {/* Left — big date */}
            <div className="lv-dossier-date">
              <span className="lv-dossier-date-day">
                {new Date(selected.date).getDate()}
              </span>
              <span className="lv-dossier-date-month">
                {MONTHS[new Date(selected.date).getMonth()]} {new Date(selected.date).getFullYear()}
              </span>
              <span className="lv-dossier-date-dayname">
                {DAYS[new Date(selected.date).getDay()]}
              </span>
            </div>

            {/* Right — data rows */}
            <div className="lv-dossier-data">
              <div className="lv-dossier-row">
                <span className="lv-dossier-label">Format</span>
                <span className="lv-dossier-value">{formatLabel(selected.format)}</span>
              </div>
              <div className="lv-dossier-row">
                <span className="lv-dossier-label">Location</span>
                <span className="lv-dossier-value">{selected.location}</span>
              </div>
              <div className="lv-dossier-row">
                <span className="lv-dossier-label">Entry</span>
                <span className="lv-dossier-value">{getEntryFee(selected.teamSize)}</span>
              </div>
              <div className="lv-dossier-row">
                <span className="lv-dossier-label">Status</span>
                <span className={`lv-dossier-value ${selected.registrationOpen ? "lv-dossier-open" : "lv-dossier-closed"}`}>
                  {selected.registrationOpen ? "Registration Open" : "Registration Closed"}
                </span>
              </div>
            </div>
          </div>

          <DividerOrnament style={{ width: 120, color: "rgba(155, 107, 30, 0.25)", margin: "1.25rem auto" }} />

          {/* CTA */}
          <div className="lv-dossier-cta">
            {selected.registrationOpen ? (
              <Link
                href={`/longvolleyball/register?tournament=${selected.id}`}
                className="lv-btn lv-btn-primary"
              >
                Register for this date
                <ArrowRight className="lv-btn-arrow" style={{ width: 16, height: 16 }} />
              </Link>
            ) : (
              <span className="lv-dossier-closed-msg">Registration is not open yet</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

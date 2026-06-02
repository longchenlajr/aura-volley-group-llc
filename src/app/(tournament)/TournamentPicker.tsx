"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Tournament, TournamentStatus } from "@/lib/tournaments";
import { ArrowRight, CalendarIcon, DividerOrnament } from "./ornaments";
import { DecorativeAsset } from "./DecorativeAsset";
import { StatusTag } from "./StatusTag";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getEntryFee(teamSize: number): string {
  if (teamSize === 2) return "$25/player · $50/team";
  if (teamSize === 3) return "$25/player · $75/team";
  return `$25/player · $${25 * teamSize}/team`;
}

function formatLabel(format: string): string {
  const f = format.toLowerCase();
  if (f === "doubles") return "Doubles (2v2)";
  if (f === "triples") return "Triples (3v3)";
  if (f === "quads") return "Quads (4v4)";
  if (f === "sixes") return "Sixes (6v6)";
  return format;
}

function buildGCalEventUrl(t: Tournament & { status?: TournamentStatus }): string {
  const start = new Date(t.date);
  const end = new Date(start.getTime() + 8 * 60 * 60 * 1000);
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const title = encodeURIComponent(`Long's Grass Volleyball – ${formatLabel(t.format)}`);
  const details = encodeURIComponent(`Entry: ${getEntryFee(t.teamSize)}\nLocation: ${t.location}`);
  const loc = encodeURIComponent(t.location);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmt(start)}/${fmt(end)}&details=${details}&location=${loc}`;
}

interface TournamentPickerProps {
  tournaments: (Tournament & { status?: TournamentStatus })[];
  showStatus?: boolean;
}

export function TournamentPicker({ tournaments, showStatus = false }: TournamentPickerProps) {
  // If no pre-sorting from parent, sort chronologically
  const sorted = [...tournaments].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = sorted.find((t) => t.id === selectedId) ?? null;

  return (
    <div className="lv-picker">
      {/* Date strip */}
      <div
        className="lv-date-strip"
        role="listbox"
        aria-label="Select tournament date"
      >
        {sorted.map((t) => {
          const d = new Date(t.date);
          const month = MONTHS[d.getMonth()];
          const day = d.getDate();
          const dayName = DAYS[d.getDay()];
          const isSelected = t.id === selectedId;
          const status = t.status;
          const isArchive = status === "archive";
          const isAwesome = t.name.toLowerCase().includes("awesome");

          return (
            <button
              key={t.id}
              role="option"
              aria-selected={isSelected}
              aria-disabled={isArchive}
              className={`lv-date-chip ${isSelected ? "selected" : ""} ${showStatus && status === "live" ? "lv-date-chip--live" : ""} ${isAwesome ? "lv-date-chip--event" : ""} ${isArchive ? "lv-date-chip--archive" : ""}`}
              onClick={() => {
                if (isArchive) return;
                setSelectedId(isSelected ? null : t.id);
              }}
            >
              {showStatus && status && !isArchive && (
                <span className="lv-date-chip-status">
                  <StatusTag status={status} />
                </span>
              )}
              <span className="lv-date-chip-month">{month}</span>
              <span className="lv-date-chip-day">{day}</span>
              <span className="lv-date-chip-dayname">{isArchive ? "Done" : dayName}</span>
              {isAwesome && !isArchive && (
                <span className="lv-date-chip-event-tag">AWESOME! Fest</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Dossier card — appears when date is selected */}
      {selected &&
        (() => {
          const isAwesomeFest = selected.name.toLowerCase().includes("awesome");
          return (
            <div
              className="lv-dossier"
              key={selected.id}
              style={{ position: "relative" }}
            >
              <DecorativeAsset
                src="corner-flourish.png"
                className="lv-dossier-flourish lv-dossier-flourish-tl"
                width={50}
                height={50}
              />
              <DecorativeAsset
                src="corner-flourish.png"
                className="lv-dossier-flourish lv-dossier-flourish-br"
                width={50}
                height={50}
              />
              <div
                className={`lv-dossier-inner ${isAwesomeFest ? "lv-dossier-inner--event" : ""}`}
              >
                {/* Left — big date */}
                <div className="lv-dossier-date">
                  {isAwesomeFest && (
                    <Image
                      src="/longvolleyball/awesomefest.avif"
                      alt="AWESOME Fest"
                      width={64}
                      height={64}
                      className="lv-dossier-event-logo lv-dossier-event-logo--mobile"
                    />
                  )}
                  <span className="lv-dossier-date-day">
                    {new Date(selected.date).getDate()}
                  </span>
                  <span className="lv-dossier-date-month">
                    {MONTHS[new Date(selected.date).getMonth()]}{" "}
                    {new Date(selected.date).getFullYear()}
                  </span>
                  <span className="lv-dossier-date-dayname">
                    {DAYS[new Date(selected.date).getDay()]}
                  </span>
                </div>

                {/* Middle — data rows */}
                <div className="lv-dossier-data">
                  <div className="lv-dossier-row">
                    <span className="lv-dossier-label">Format</span>
                    <span className="lv-dossier-value">
                      {formatLabel(selected.format)}
                    </span>
                  </div>
                  <div className="lv-dossier-row">
                    <span className="lv-dossier-label">Location</span>
                    <span className="lv-dossier-value">
                      {selected.location}
                    </span>
                  </div>
                  <div className="lv-dossier-row">
                    <span className="lv-dossier-label">Entry</span>
                    <span className="lv-dossier-value">
                      {getEntryFee(selected.teamSize)}
                    </span>
                  </div>
                  <div className="lv-dossier-row">
                    <span className="lv-dossier-label">Status</span>
                    <span
                      className={`lv-dossier-value ${selected.registrationOpen ? "lv-dossier-open" : "lv-dossier-closed"}`}
                    >
                      {selected.registrationOpen
                        ? "Registration Open"
                        : "Registration Closed"}
                    </span>
                  </div>
                </div>
                {isAwesomeFest && (
                  <div className="lv-dossier-event-logo lv-dossier-event-logo--desktop">
                    <Image
                      src="/longvolleyball/awesomefest.avif"
                      alt="AWESOME Fest"
                      width={160}
                      height={160}
                    />
                  </div>
                )}
              </div>

              <DividerOrnament
                style={{
                  width: 120,
                  color: "rgba(155, 107, 30, 0.25)",
                  margin: "1.25rem auto",
                }}
              />

              {/* CTA */}
              <div className="lv-dossier-cta">
                {selected.status === "archive" ? (
                  <span className="lv-dossier-closed-msg">
                    This tournament has passed.
                  </span>
                ) : selected.registrationOpen ? (
                  <Link
                    href={`/longvolleyball/register?tournament=${selected.id}`}
                    className="lv-btn lv-btn-primary"
                  >
                    Register for this date
                    <ArrowRight
                      className="lv-btn-arrow"
                      style={{ width: 16, height: 16 }}
                    />
                  </Link>
                ) : (
                  <span className="lv-dossier-closed-msg">
                    Registration is not open yet
                  </span>
                )}
                {selected.status !== "archive" && (
                  <a
                    href={buildGCalEventUrl(selected)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="lv-btn lv-btn-ghost"
                    style={{ fontSize: "13px" }}
                  >
                    <CalendarIcon style={{ width: 14, height: 14 }} />
                    Add to my calendar
                  </a>
                )}
              </div>
            </div>
          );
        })()}
    </div>
  );
}

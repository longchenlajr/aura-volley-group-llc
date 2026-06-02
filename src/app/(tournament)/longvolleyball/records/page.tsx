"use client";

import { useState, useEffect, useRef } from "react";
import { SectionDivider } from "../../ornaments";
import data from "@/config/results.json";

interface TournamentResult {
  date: string;
  name: string;
  format: string;
  gold: { first: string; second: string };
  silver?: { first: string; second: string };
}

const RESULTS: TournamentResult[] = (data as { results: TournamentResult[] }).results;

const MONTH_ABBR = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

function getYear(date: string): string {
  const parts = date.split("/");
  const yr = parts[parts.length - 1];
  return yr.length === 2 ? `20${yr}` : yr;
}

function formatDate(date: string): string {
  const parts = date.split("/");
  const month = parseInt(parts[0], 10);
  const day = parseInt(parts[1], 10);
  const year = getYear(date);
  return `${MONTH_ABBR[month - 1]} ${day} · ${year}`;
}

function groupByYear(results: TournamentResult[]): { year: string; results: TournamentResult[] }[] {
  const map = new Map<string, TournamentResult[]>();
  for (const r of results) {
    const y = getYear(r.date);
    if (!map.has(y)) map.set(y, []);
    map.get(y)!.push(r);
  }
  return Array.from(map.entries())
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([year, results]) => ({ year, results }));
}

export default function RecordsPage() {
  const grouped = groupByYear(RESULTS);
  const [openYears, setOpenYears] = useState<Set<string>>(
    new Set(grouped.length > 0 ? [grouped[0].year] : []),
  );
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Set up scroll-reveal observer once on mount
  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReduced) {
      document.querySelectorAll<HTMLElement>(".lv-record").forEach((el) => {
        el.classList.add("lv-record--visible");
      });
      return;
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const delay = parseInt(el.dataset.delay ?? "0", 10);
            setTimeout(() => el.classList.add("lv-record--visible"), delay);
            observerRef.current?.unobserve(el);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -24px 0px" },
    );

    document
      .querySelectorAll<HTMLElement>(".lv-record:not(.lv-record--visible)")
      .forEach((el) => observerRef.current!.observe(el));

    return () => observerRef.current?.disconnect();
  }, []);

  // Re-observe after accordion animation completes when a year is toggled open
  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReduced) return;

    const timeout = setTimeout(() => {
      if (!observerRef.current) return;
      document
        .querySelectorAll<HTMLElement>(".lv-record:not(.lv-record--visible)")
        .forEach((el) => observerRef.current!.observe(el));
    }, 420);

    return () => clearTimeout(timeout);
  }, [openYears]);

  function toggleYear(year: string) {
    setOpenYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  }

  return (
    <div className="lv-records-page">
      <div className="lv-container">
        {/* Phase 1: Monument header */}
        <div className="lv-live-header">
          <p
            className="lv-label"
            style={{ color: "var(--lv-red)", marginBottom: "0.5rem" }}
          >
            Records
          </p>
          <h1
            className="lv-h1"
            style={{
              fontSize: "clamp(2.5rem, 8vw, 4.5rem)",
              fontWeight: 900,
              letterSpacing: "-0.025em",
              lineHeight: 1.05,
            }}
          >
            Tournament History
          </h1>
          <p
            style={{
              fontFamily: "var(--lv-font-body)",
              fontSize: "0.6rem",
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              color: "var(--lv-gold)",
              opacity: 0.8,
              marginTop: "0.875rem",
            }}
          >
            Carved in stone.
          </p>
          <div style={{ marginTop: "1.5rem" }}>
            <SectionDivider
              className="lv-section-divider"
              style={{ color: "var(--lv-gold)", opacity: 0.5 }}
            />
          </div>
        </div>

        {/* Phase 2+3+4: Year groups with plaque entries */}
        {grouped.map(({ year, results }) => {
          const isOpen = openYears.has(year);
          return (
            <div key={year} className="lv-records-year">
              <button
                className={`lv-records-year-toggle ${isOpen ? "open" : ""}`}
                onClick={() => toggleYear(year)}
                aria-expanded={isOpen}
              >
                <span className="lv-records-year-label">{year}</span>
                <span className="lv-records-year-count">
                  {results.length}&nbsp;
                  {results.length !== 1 ? "tournaments" : "tournament"}
                </span>
                <svg
                  className="lv-records-year-chevron"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6 8l4 4 4-4" />
                </svg>
              </button>

              <div
                className={`lv-records-year-content ${isOpen ? "open" : ""}`}
              >
                <div className="lv-records-list">
                  {results.map((r, idx) => (
                    <div
                      key={r.date}
                      className="lv-record"
                      data-delay={String(idx * 50)}
                    >
                      {/* Meta kicker: formatted date + tournament name */}
                      <div className="lv-record-meta">
                        <span className="lv-record-meta-date">
                          {formatDate(r.date)}
                        </span>
                        <span
                          className="lv-record-meta-sep"
                          aria-hidden="true"
                        />
                        <span className="lv-record-meta-name">{r.name}</span>
                      </div>

                      <div
                        className={`lv-record-brackets ${!r.silver ? "lv-record-brackets--single" : ""}`}
                      >
                        {/* Gold bracket plaque */}
                        <div className="lv-record-bracket lv-record-bracket-gold">
                          <div className="lv-record-bracket-title">
                            Gold Bracket
                          </div>
                          <div className="lv-record-placement lv-record-placement--first">
                            <span className="lv-record-place">1st</span>
                            <span className="lv-record-team">
                              {/* <span className="lv-record-champion-mark" aria-hidden="true">★</span> */}
                              {r.gold.first}
                            </span>
                          </div>
                          <div className="lv-record-placement lv-record-placement--second">
                            <span className="lv-record-place">2nd</span>
                            <span className="lv-record-team">
                              {r.gold.second}
                            </span>
                          </div>
                        </div>

                        {/* Silver bracket plaque */}
                        {r.silver && (
                          <div className="lv-record-bracket lv-record-bracket-silver">
                            <div className="lv-record-bracket-title">
                              Silver Bracket
                            </div>
                            <div className="lv-record-placement lv-record-placement--first">
                              <span className="lv-record-place">1st</span>
                              <span className="lv-record-team">
                                {r.silver.first}
                              </span>
                            </div>
                            <div className="lv-record-placement lv-record-placement--second">
                              <span className="lv-record-place">2nd</span>
                              <span className="lv-record-team">
                                {r.silver.second}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

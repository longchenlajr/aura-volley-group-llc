"use client";

import { useState, useEffect, useRef } from "react";
import { SectionDivider } from "../../ornaments";

interface TournamentResult {
  date: string;
  name: string;
  format: string;
  gold: { first: string; second: string };
  silver?: { first: string; second: string };
}

const RESULTS: TournamentResult[] = [
  {
    date: "5/24/26",
    name: "Doubles @ Hamilton",
    format: "doubles",
    gold: {
      first: "Fernando Munoz + Eduardo Munoz",
      second: "Owen McFadden + Donald Joseph West III",
    },
    silver: {
      first: "Alex Mkryan + Mike Mkryan",
      second: "Heng Long + Christian Flores",
    },
  },
  {
    date: "5/9/26",
    name: "Doubles @ Hamilton",
    format: "doubles",
    gold: {
      first: "Owen McFadden + Alberto Ramon",
      second: "Chenla Long, Jr. + Kyle Whiteman",
    },
    silver: {
      first: "Van Wyck Mason+ Marcus Scheirer",
      second: "Tim Carnes + Elden Campbell",
    },
  },
  {
    date: "4/26/26",
    name: "Doubles @ Hamilton",
    format: "doubles",
    gold: {
      first: "Owen McFadden + Donald Joseph West III",
      second: "Chenla Long, Jr. + Justin Flor",
    },
    silver: {
      first: "Alvinkhang Phung + Fernando Munoz",
      second: "Elias Carreras + Joseph Rodriquez",
    },
  },
  {
    date: "10/12/25",
    name: "Doubles @ Hamilton",
    format: "doubles",
    gold: {
      first: "Brayden McCreery + Steven McCreery",
      second: "Jacob Posluszny + Carlos Vergara",
    },
    silver: {
      first: "Mason Strawn + Frank Benedetto",
      second: "Cameron Rogers + Luis Romano",
    },
  },
  {
    date: "9/28/25",
    name: "Doubles @ Hamilton",
    format: "doubles",
    gold: {
      first: "Lucas Adam + Rachel Robb",
      second: "Fernando Munoz + Luis Angel Ruiz",
    },
    silver: {
      first: "Walmy Veras + Jacob Hernandez",
      second: "Cameron Rogers + Hanzy Chalas",
    },
  },
  {
    date: "9/14/25",
    name: "Doubles @ Hamilton",
    format: "doubles",
    gold: {
      first: "Chenla Long, Jr. + Quinn Hornberger",
      second: "Owen McFadden + Keith Hardaway",
    },
    silver: {
      first: "Walmy Veras + Jai Hills",
      second: "Cameron Rogers + Evan Rice",
    },
  },
  {
    date: "8/17/25",
    name: "Doubles @ Hamilton",
    format: "doubles",
    gold: {
      first: "Nairi Lin + Klo Kynaw",
      second: "Caden Dempsey + Kieran Lieb",
    },
    silver: {
      first: "Heng Long + Nelly Rodriguez",
      second: "Michael Spradlin + Joseph Spradlin",
    },
  },
  {
    date: "7/5/25",
    name: "Doubles @ Hamilton",
    format: "doubles",
    gold: {
      first: "Owen McFadden + Kyle Whiteman",
      second: "Chenla Long, Sr. + Chris Weber",
    },
    silver: {
      first: "Christian DeMrag + Noah Bogar",
      second: "Brian Badillo + Nick Chang",
    },
  },
  {
    date: "6/29/25",
    name: "Doubles @ Hamilton",
    format: "doubles",
    gold: {
      first: "Chenla Long, Jr. + Thor Long",
      second: "Rob McVicker + Victor Saleet",
    },
    silver: {
      first: "Nick Mkryan + Mike Mkryan",
      second: "Kalliyana Long + Anh Hyunh",
    },
  },
  {
    date: "5/24/25",
    name: "Doubles @ Hamilton",
    format: "doubles",
    gold: {
      first: "Owen McFadden + Kyle Whiteman",
      second: "Mo Clark + Josh Marks",
    },
    silver: {
      first: "Chenla Long, Sr. + Anh Hyunh",
      second: "Heng Long + Nelly Rodriguez",
    },
  },
  {
    date: "5/10/25",
    name: "Doubles @ Hamilton",
    format: "doubles",
    gold: {
      first: "Justin Flor + Lucas Adam",
      second: "Will Stiles + Aidan OBrien",
    },
    silver: {
      first: "Brad Chamberlain + Joshua Harclerode",
      second: "Jordan Morris + Lexi Straub",
    },
  },
  {
    date: "9/29/24",
    name: "Doubles @ Hamilton",
    format: "doubles",
    gold: {
      first: "Owen McFadden + Zander Marks",
      second: "Daniel Sledz + Dan Barckholtz",
    },
    silver: {
      first: "Alex Mkryan + Mike Mkryan",
      second: "Marcus Scherier + Theresa Crimi",
    },
  },
  {
    date: "9/15/24",
    name: "Doubles @ Hamilton",
    format: "doubles",
    gold: {
      first: "Chenla Long, Jr. + Justin Flor",
      second: "Owen McFadden + Donald Joseph West III",
    },
  },
  {
    date: "9/30/24",
    name: "Doubles @ Hamilton",
    format: "doubles",
    gold: {
      first: "David Barnes + Youssef Ellozy",
      second: "Owen McFadden + Juan Rosario",
    },
    silver: {
      first: "Quinn Hornberger + Gracie Kiser",
      second: "Matt Achey + Suzie Brito",
    },
  },
  {
    date: "8/17/24",
    name: "Doubles @ Hamilton",
    format: "doubles",
    gold: {
      first: "Caleb Bauder + Quinn Hornberger",
      second: "Nairi Lin + Harry Lin",
    },
    silver: {
      first: "Brad Chamberlain + Caden Dempsey",
      second: "Janilyz Romero + Luis Romero",
    },
  },
  {
    date: "7/13/24",
    name: "Quads @ Hamilton",
    format: "quads",
    gold: {
      first: "Nairi Lin + Harry Lin + Klo Kynaw + Luther Ser",
      second: "Bryce Nelligan + Reno Plesnarski + Liam Ruggie + Owen Pratt",
    },
  },
  {
    date: "6/8/24",
    name: "Doubles @ Hamilton",
    format: "doubles",
    gold: {
      first: "Chenla Long, Jr. + Quinn Hornberger",
      second: "Justin Flor + Kalliyana Long",
    },
    silver: {
      first: "Alex Schoenen + Marcus Scheirer",
      second: "Jon Yu + Harry Lin",
    },
  },
  {
    date: "8/19/23",
    name: "Quads @ Hamilton",
    format: "quads",
    gold: {
      first: "Chenla Long, Jr. + Kalliyana Long + Justin Flor + Dylan Flor",
      second: "Quinn Hornberger + Zachary Shay + Caleb Bauder + Nilansh Gupta",
    },
  },
  {
    date: "7/8/23",
    name: "Doubles @ Hamilton",
    format: "doubles",
    gold: {
      first: "Calvin Long + Will Stiles",
      second: "Owen Pratt + Liam Ruggie",
    },
    silver: {
      first: "Mark Fredericksen + Devin Ellis",
      second: "Nairi Lin + Harry Lin",
    },
  },
  {
    date: "6/10/23",
    name: "Doubles @ Hamilton",
    format: "doubles",
    gold: {
      first: "Chenla Long, Jr. + Mo Clark",
      second: "Chenla Long, Sr. + Dalin Long",
    },
    silver: {
      first: "Mark Fredericksen + Devin Ellis",
      second: "Harry Lin + Edward Popa",
    },
  },
];

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

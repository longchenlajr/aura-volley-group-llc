"use client";

import { useState } from "react";
import { DecorativeAsset } from "../../DecorativeAsset";

interface TournamentResult {
  date: string;
  name: string;
  format: string;
  gold: { first: string; second: string };
  silver?: { first: string; second: string };
}

const RESULTS: TournamentResult[] = [
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
      first: "Walmy Veras + Jacob",
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
      second: "Cameron Rogers + Evan",
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
      second: "Owen McFadden + Trey West",
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
      second: "Janilyz + Luis",
    },
  },
  {
    date: "7/13/24",
    name: "Quads @ Hamilton",
    format: "quads",
    gold: {
      first: "Nairi Lin + Harry Lin + Klo Kynaw + Luther Ser",
      second: "Bryce Nelligan + Reno Plesnarski + Liam Ruggie Pratt + Owen",
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
      second: "Owen + Liam Ruggie Pratt",
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

function getYear(date: string): string {
  const parts = date.split("/");
  const yr = parts[parts.length - 1];
  return yr.length === 2 ? `20${yr}` : yr;
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
  // Most recent year open by default
  const [openYears, setOpenYears] = useState<Set<string>>(
    new Set(grouped.length > 0 ? [grouped[0].year] : []),
  );

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
        <div className="lv-records-header">
          <div style={{ marginBottom: "1.5rem" }}>
            <DecorativeAsset src="divider.png" className="lv-divider-img" width={280} height={24} />
          </div>
          <h1 className="lv-h1">Tournament Records</h1>
        </div>

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
                  {results.length} tournament{results.length !== 1 ? "s" : ""}
                </span>
                <svg className="lv-records-year-chevron" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 8l4 4 4-4" />
                </svg>
              </button>

              <div className={`lv-records-year-content ${isOpen ? "open" : ""}`}>
                <div className="lv-records-list">
                  {results.map((r) => (
                    <div key={r.date} className="lv-record">
                      <div className="lv-record-header">
                        <span className="lv-record-date">{r.date}</span>
                        <span className="lv-record-name">{r.name}</span>
                      </div>

                      <div className={`lv-record-brackets ${!r.silver ? "lv-record-brackets--single" : ""}`}>
                        <div className="lv-record-bracket lv-record-bracket-gold">
                          <div className="lv-record-bracket-title">Gold Bracket</div>
                          <div className="lv-record-placement">
                            <span className="lv-record-place">1st</span>
                            <span className="lv-record-team">{r.gold.first}</span>
                          </div>
                          <div className="lv-record-placement">
                            <span className="lv-record-place">2nd</span>
                            <span className="lv-record-team">{r.gold.second}</span>
                          </div>
                        </div>

                        {r.silver && (
                          <div className="lv-record-bracket lv-record-bracket-silver">
                            <div className="lv-record-bracket-title">Silver Bracket</div>
                            <div className="lv-record-placement">
                              <span className="lv-record-place">1st</span>
                              <span className="lv-record-team">{r.silver.first}</span>
                            </div>
                            <div className="lv-record-placement">
                              <span className="lv-record-place">2nd</span>
                              <span className="lv-record-team">{r.silver.second}</span>
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

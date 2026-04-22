"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getTournaments, type Tournament } from "@/lib/tournaments";
import { DividerOrnament } from "../(tournament)/ornaments";

export default function AdminDashboard() {
  const router = useRouter();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);

  useEffect(() => {
    const all = getTournaments().sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    setTournaments(all);
    // If only one tournament, go straight to it
    if (all.length === 1) {
      router.replace(`/admin/tournament/${all[0].id}`);
    }
  }, [router]);

  return (
    <div className="lv-admin-page">
      <p className="lv-label lv-admin-page-label">Dashboard</p>
      <h1 className="lv-admin-page-heading">Tournament management</h1>

      {tournaments.length === 0 ? (
        <div className="lv-admin-empty">
          <DividerOrnament className="lv-admin-empty-ornament" />
          <p className="lv-admin-empty-heading">No tournaments configured</p>
          <p className="lv-admin-empty-sub">Add a tournament to the config to get started.</p>
        </div>
      ) : (
        <div className="lv-date-list" role="listbox">
          {tournaments.map((t) => {
            const d = new Date(t.date);
            const label = d.toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            });
            const fmt =
              t.format === "doubles"
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
                onClick={() => router.push(`/admin/tournament/${t.id}`)}
              >
                <span className="lv-date-list-date">{label}</span>
                <span className="lv-date-list-format">{fmt}</span>
                <span style={{ fontSize: "0.7rem", color: "var(--lv-ink-muted)" }}>
                  {t.location}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

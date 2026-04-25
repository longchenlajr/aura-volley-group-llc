"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getTournaments, getTournamentStatus, type Tournament } from "@/lib/tournaments";
import { StatusTag } from "../(tournament)/StatusTag";
import { DividerOrnament } from "../(tournament)/ornaments";

export default function AdminDashboard() {
  const router = useRouter();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [teamCounts, setTeamCounts] = useState<Record<string, number | null>>({});

  useEffect(() => {
    const all = getTournaments().sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    setTournaments(all);
    // If only one tournament, go straight to it
    if (all.length === 1) {
      router.replace(`/admin/tournament/${all[0].id}`);
    }
    // Fetch team counts for each tournament
    for (const t of all) {
      fetch(`/api/public/team-count?tournament=${t.id}`)
        .then((r) => r.json())
        .then((d) => setTeamCounts((prev) => ({ ...prev, [t.id]: d.count ?? 0 })))
        .catch(() => setTeamCounts((prev) => ({ ...prev, [t.id]: null })));
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
        <div className="lv-admin-dash-table-wrap">
          <table className="lv-admin-dash-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Status</th>
                <th className="lv-dash-hide-mobile">Format</th>
                <th className="lv-dash-hide-mobile"># Registered</th>
              </tr>
            </thead>
            <tbody>
              {tournaments.map((t) => {
                const d = new Date(t.date);
                const label = d.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });
                const fmtLabel = `${t.teamSize}s`;
                const count = teamCounts[t.id];

                return (
                  <tr
                    key={t.id}
                    className="lv-admin-dash-row"
                    onClick={() => router.push(`/admin/tournament/${t.id}`)}
                  >
                    <td>{label}</td>
                    <td>
                      <StatusTag status={getTournamentStatus(t.date)} />
                      <span className="lv-dash-mobile-badges">
                        <span className="lv-admin-badge lv-admin-badge-format">{fmtLabel}</span>
                        <span className="lv-admin-badge lv-admin-badge-count">{count != null ? count : "—"}</span>
                      </span>
                    </td>
                    <td className="lv-dash-hide-mobile"><span className="lv-admin-badge lv-admin-badge-format">{fmtLabel}</span></td>
                    <td className="lv-dash-hide-mobile"><span className="lv-admin-badge lv-admin-badge-count">{count != null ? count : "—"}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

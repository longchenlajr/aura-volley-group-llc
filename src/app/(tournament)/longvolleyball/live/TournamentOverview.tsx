"use client";

import type { PoolStandings } from "@/lib/standings";

interface StandingsData {
  pools: PoolStandings[];
}

interface TeamSeed {
  team_name: string;
  seed: number;
  record: string;
}

interface Props {
  standingsData: StandingsData | null;
  onSelectPool: (poolId: string) => void;
  totalMatchesByPool: Map<string, { total: number; complete: number }>;
  teamSeeds: Map<string, TeamSeed>;
}

export function TournamentOverview({ standingsData, onSelectPool, totalMatchesByPool, teamSeeds }: Props) {
  if (!standingsData?.pools?.length) {
    return (
      <div className="lv-overview-empty">
        <p className="lv-overview-empty-text">Waiting for pool data...</p>
      </div>
    );
  }

  return (
    <div className="lv-overview">
      {standingsData.pools.map((pool) => {
        const matchInfo = totalMatchesByPool.get(pool.pool_id);
        return (
          <button
            key={pool.pool_id}
            className="lv-overview-pool"
            onClick={() => onSelectPool(pool.pool_id)}
          >
            <div className="lv-overview-pool-header">
              <span className="lv-overview-pool-title">Pool {pool.pool_label}</span>
              <span className="lv-overview-pool-court">Court {pool.court_number}</span>
            </div>

            <table className="lv-overview-table">
<thead>
                <tr>
                  <th>Rank</th>
                  <th>Team</th>
                  <th>Set W-L</th>
                  <th>+/-</th>
                </tr>
              </thead>
              <tbody>
                {pool.standings.map((t, i) => (
                  <tr key={t.team_id} className={i === 0 ? "lv-overview-row-first" : ""}>
                    <td className="lv-overview-rank">{i + 1}</td>
                    <td className="lv-overview-name">({t.overall_seed ?? t.seed_in_pool}) {t.team_name}</td>
                    <td>{t.sets_won}-{t.sets_lost}</td>
                    <td className={t.point_differential >= 0 ? "lv-overview-diff-pos" : "lv-overview-diff-neg"}>
                      {t.point_differential >= 0 ? "+" : ""}{t.point_differential}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {matchInfo && (
              <div className="lv-overview-pool-progress">
                {matchInfo.complete} of {matchInfo.total} matches complete
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

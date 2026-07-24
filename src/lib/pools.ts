export interface Pool {
  id: string;
  tournament_id: string;
  pool_label: string;
  court_number: number;
  created_at: string;
  sets_per_match?: number | null;
  points_per_set?: number | null;
  points_cap?: number | null;
}

export interface PoolTeam {
  id: string;
  pool_id: string;
  team_id: string;
  seed_in_pool: number;
  created_at: string;
}

export interface PoolWithTeams {
  pool: Pool;
  teams: Array<{
    team_id: string;
    team_name: string;
    overall_seed: number | null;
    seed_in_pool: number;
  }>;
}

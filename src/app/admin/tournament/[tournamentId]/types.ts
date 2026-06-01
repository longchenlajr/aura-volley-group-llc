import type { PoolWithTeams } from "@/lib/pools";

export interface MatchData {
  match: {
    id: string;
    pool_id: string;
    court_number: number;
    match_order: number;
    status: string;
  };
  team_a: { id: string; team_name: string; seed_in_pool: number };
  team_b: { id: string; team_name: string; seed_in_pool: number };
  work_team: { id: string; team_name: string } | null;
  pool: { id: string; pool_label: string; court_number: number };
  token: string | null;
  sets: Array<{
    set_number: number;
    team_a_score: number;
    team_b_score: number;
    is_forfeit?: boolean;
  }>;
}

export interface Team {
  id: string;
  tournament_id: string;
  team_name: string;
  contact_email: string;
  contact_phone: string;
  seed: number | null;
  checked_in: boolean;
  created_at: string;
  withdrawn_at: string | null;
  players: { id: string; name: string; email: string | null; phone: string | null; is_captain: boolean }[];
}

export type { PoolWithTeams };

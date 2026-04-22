import { getMatchFormat } from "./score-format";

export interface ForfeitScore {
  match_id: string;
  sets: Array<{
    set_number: number;
    team_a_score: number;
    team_b_score: number;
  }>;
  /** Which slot the withdrawn team occupies: "team_a" or "team_b" */
  withdrawn_slot: "team_a" | "team_b";
}

/**
 * Generate forfeit scores for all remaining scheduled matches involving a withdrawn team.
 * The withdrawn team gets 0 in every set; the opponent gets the pool's points_per_set.
 */
export function generateForfeitScores(
  scheduledMatches: Array<{
    match_id: string;
    team_a_id: string;
    team_b_id: string;
    pool_size: number;
  }>,
  withdrawnTeamId: string,
): ForfeitScore[] {
  return scheduledMatches.map((m) => {
    const format = getMatchFormat(m.pool_size);
    const isTeamA = m.team_a_id === withdrawnTeamId;
    const sets: ForfeitScore["sets"] = [];

    for (let i = 1; i <= format.sets; i++) {
      sets.push({
        set_number: i,
        team_a_score: isTeamA ? 0 : format.pointsPerSet,
        team_b_score: isTeamA ? format.pointsPerSet : 0,
      });
    }

    return {
      match_id: m.match_id,
      sets,
      withdrawn_slot: isTeamA ? "team_a" : "team_b",
    };
  });
}

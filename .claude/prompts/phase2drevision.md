Claude Code Prompt — Phase 2d Revision: Side-Out Scoring & Multi-Set Matches
Before building Phase 2d, revise the plan. The original assumption of single-score, rally-scoring-to-21 is wrong. Here's the correct scoring system:
Scoring rules:

Side-out scoring (point only on serve, not rally scoring)
Format varies by pool size
Win-by-2 in all sets

Format matrix (determined by pool size):
Pool sizeSets per matchPoints per set32154215521161157111
Match result determination:

Multi-set matches (2 sets): best-of-2 doesn't work cleanly. Treat as "must win 2 sets" — if teams split 1-1, play a third set to 11 as a tiebreaker. Or, simpler and more common for grass volleyball: both sets count and the match winner is whoever wins the most points across both sets combined. Confirm which rule the Longs use before building.
Single-set matches (1 set): winner is whoever wins the set.

Ask me which multi-set resolution rule to use before proceeding. My guess is "both sets count, cumulative points decide match winner if tied 1-1" but verify before building.
Schema changes from original Phase 2d:
Replace the match_scores table design with a match_sets table:
sqlcreate table match_sets (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  set_number integer not null check (set_number >= 1),
  team_a_score integer not null check (team_a_score >= 0),
  team_b_score integer not null check (team_b_score >= 0),
  submitted_by text not null check (submitted_by in ('work_team', 'admin')),
  submitted_by_team_id uuid references teams(id) on delete set null,
  submitted_at timestamptz not null default now(),
  
  constraint match_sets_match_set_unique unique (match_id, set_number)
);
Drop match_scores from the plan entirely.
New derived data:
Match format is determined by the pool size, not stored on the match itself. Create a helper:
typescriptexport function getMatchFormat(poolSize: number): {
  sets: number;
  pointsPerSet: number;
} {
  switch (poolSize) {
    case 3: return { sets: 2, pointsPerSet: 15 };
    case 4: return { sets: 2, pointsPerSet: 15 };
    case 5: return { sets: 2, pointsPerSet: 11 };
    case 6: return { sets: 1, pointsPerSet: 15 };
    case 7: return { sets: 1, pointsPerSet: 11 };
    default: throw new Error(`Unsupported pool size: ${poolSize}`);
  }
}
Score submission page changes:
Instead of two score inputs, render N score input pairs based on match format:

For 2-set matches: show "Set 1" and "Set 2" sections, each with Team A / Team B score inputs
For 1-set matches: show single set inputs
Optional tiebreaker set appears if first two sets split 1-1 (if rule is "win 2 of 3")

Each set is submitted independently, allowing real-world flow: work team enters set 1 score, taps submit, then set 2 starts, enters set 2 score later. A single submit at the end works too — both sets filled in, one submit tap.
UI structure:

Header: "Pool A · Court 1 · Match 3 of 6" (unchanged)
Match format indicator: "Best of 2 sets to 15" (displayed clearly below header)
Per-set card:

"Set 1" label in tracked small caps
Two team score inputs side by side (same design as original spec: plus/minus buttons, centered number, inputMode="numeric")
Visual separator between sets


Submit button at the bottom — submits all sets that have scores entered
Status per set: unsubmitted / submitted / locked (based on 10-min edit window per set)

Edit window logic: the 10-minute re-edit window applies per set, not per match. Once a set's score is submitted, that set's inputs lock 10 minutes later even if the match isn't over.
Match completion logic:
typescriptexport function isMatchComplete(sets: MatchSet[], format: MatchFormat): boolean {
  // 1-set match: complete if set 1 is valid (>= pointsPerSet with win-by-2)
  // 2-set match: complete if one team has won 2 sets, OR if all scheduled sets are played
  //   depending on the tiebreaker rule determined above
}

export function matchWinner(sets: MatchSet[], format: MatchFormat): "team_a" | "team_b" | null {
  // Based on sets won, or cumulative points if that's the rule
}
Admin view changes:
Score display per match shows all set scores:

"21-14, 15-21" or "15-12, 14-15, 11-9" format
Match winner tag based on final result
Per-set admin override via admin modal (pick which set to edit)

Email work links:
Update email template to mention format:

"This match is best of 2 sets to 15" (or 1 set to 15 for larger pools)
Explains the work team records both sets (or the one set)

Everything else from the original Phase 2d stays:

Token generation per match (1 token per match, submits multiple sets)
10-minute re-edit window (per set now)
Admin manual entry
Email work links flow
Score submission page UX (large inputs, plus/minus, haptic feedback on complete)
submitted_by: 'work_team' vs 'admin' provenance
Vibration feedback on match completion

Tiebreaker rule confirmed: cumulative points across all sets decide the match winner if sets are split.
Match winner logic:
typescriptexport function matchWinner(sets: MatchSet[]): "team_a" | "team_b" | null {
  if (sets.length === 0) return null;
  if (!allSetsComplete(sets)) return null;
  
  // Single-set match: winner is winner of the set
  if (sets.length === 1) {
    return sets[0].team_a_score > sets[0].team_b_score ? "team_a" : "team_b";
  }
  
  // Multi-set match: check sets won first
  const setsWonA = sets.filter(s => s.team_a_score > s.team_b_score).length;
  const setsWonB = sets.filter(s => s.team_b_score > s.team_a_score).length;
  
  if (setsWonA !== setsWonB) {
    return setsWonA > setsWonB ? "team_a" : "team_b";
  }
  
  // Sets split — cumulative points decides
  const totalA = sets.reduce((sum, s) => sum + s.team_a_score, 0);
  const totalB = sets.reduce((sum, s) => sum + s.team_b_score, 0);
  
  if (totalA === totalB) return null;  // truly tied — shouldn't happen with win-by-2 rule
  return totalA > totalB ? "team_a" : "team_b";
}
Display convention:

If a team wins 2-0, show result as "2-0" with set scores
If a team wins 1-1 on cumulative points, show result as "1-1 (split)" with total points underscored, e.g. "15-11, 13-15 · 28-26"
Admin tools should make this tie-on-sets case visible so they can verify the cumulative call

Go ahead and build.

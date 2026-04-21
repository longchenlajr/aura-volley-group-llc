laude Code Prompt — Phase 2f: Playoff Bracket System

Build the playoff bracket system. After pool play completes, admin generates gold and silver brackets with top teams from each pool automatically seeding into gold, remaining teams into silver. Admin has a visual cutoff adjustment tool to move teams between brackets. Bracket play uses a configurable single-set format. Work teams for bracket matches are assigned by loser-of-previous-match-on-court rule, with fallback logic for first round.

1. Database migration
Create supabase/migrations/007_playoffs_schema.sql:
sql-- Playoff brackets
create table brackets (
  id uuid primary key default gen_random_uuid(),
  tournament_id text not null,
  bracket_type text not null check (bracket_type in ('gold', 'silver')),
  points_per_set integer not null check (points_per_set in (11, 15)),
  created_at timestamptz not null default now(),
  
  constraint brackets_tournament_type_unique unique (tournament_id, bracket_type)
);

-- Bracket slots (the positions in the bracket)
create table bracket_slots (
  id uuid primary key default gen_random_uuid(),
  bracket_id uuid not null references brackets(id) on delete cascade,
  round_number integer not null,           -- 1 = first round, 2 = quarterfinal, etc.
  slot_position integer not null,          -- position within the round (1-indexed)
  team_id uuid references teams(id) on delete set null,
  is_bye boolean not null default false,
  source_match_id uuid,                    -- if this slot is filled by a winner from a previous match
  source_slot_ids uuid[],                  -- the two slot IDs that feed into this match
  created_at timestamptz not null default now(),
  
  constraint bracket_slots_position_unique unique (bracket_id, round_number, slot_position)
);

-- Playoff matches (similar to pool matches but linked to brackets)
create table bracket_matches (
  id uuid primary key default gen_random_uuid(),
  bracket_id uuid not null references brackets(id) on delete cascade,
  round_number integer not null,
  match_position integer not null,          -- position within the round
  
  slot_a_id uuid not null references bracket_slots(id) on delete cascade,
  slot_b_id uuid not null references bracket_slots(id) on delete cascade,
  winner_slot_id uuid references bracket_slots(id),  -- null until complete
  
  team_a_id uuid references teams(id) on delete restrict,
  team_b_id uuid references teams(id) on delete restrict,
  work_team_id uuid references teams(id) on delete set null,
  
  court_number integer not null,
  match_order integer not null,              -- sequence across the tournament day
  
  status text not null default 'scheduled' check (status in ('scheduled', 'in_progress', 'complete')),
  
  start_time timestamptz,
  end_time timestamptz,
  created_at timestamptz not null default now(),
  
  constraint bracket_matches_position_unique unique (bracket_id, round_number, match_position)
);

-- Bracket match scores (same structure as match_sets but linked to bracket_matches)
create table bracket_match_sets (
  id uuid primary key default gen_random_uuid(),
  bracket_match_id uuid not null references bracket_matches(id) on delete cascade,
  set_number integer not null check (set_number = 1),  -- single set only for playoffs
  team_a_score integer not null check (team_a_score >= 0),
  team_b_score integer not null check (team_b_score >= 0),
  submitted_by text not null check (submitted_by in ('work_team', 'admin')),
  submitted_by_team_id uuid references teams(id) on delete set null,
  submitted_at timestamptz not null default now(),
  
  constraint bracket_match_sets_match_set_unique unique (bracket_match_id, set_number)
);

-- Bracket match tokens (for score submission links)
create table bracket_match_tokens (
  id uuid primary key default gen_random_uuid(),
  bracket_match_id uuid not null references bracket_matches(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_used_at timestamptz,
  
  constraint bracket_match_tokens_match_unique unique (bracket_match_id)
);

create index brackets_tournament_idx on brackets(tournament_id);
create index bracket_slots_bracket_idx on bracket_slots(bracket_id);
create index bracket_matches_bracket_idx on bracket_matches(bracket_id);
create index bracket_matches_status_idx on bracket_matches(bracket_id, status);
create index bracket_match_sets_match_idx on bracket_match_sets(bracket_match_id);
create index bracket_match_tokens_token_idx on bracket_match_tokens(token);

alter table brackets enable row level security;
alter table bracket_slots enable row level security;
alter table bracket_matches enable row level security;
alter table bracket_match_sets enable row level security;
alter table bracket_match_tokens enable row level security;

create policy "brackets_anon_select" on brackets for select to anon using (true);
create policy "bracket_slots_anon_select" on bracket_slots for select to anon using (true);
create policy "bracket_matches_anon_select" on bracket_matches for select to anon using (true);
create policy "bracket_match_sets_anon_select" on bracket_match_sets for select to anon using (true);
-- No anon access to tokens (service role only via API routes)
Key design notes:

bracket_slots represents positions in the bracket (including empty slots filled later by winners). This lets the bracket structure exist before all matches are complete.
source_slot_ids on a slot tracks which two slots feed into it — the winner propagates forward through this relationship.
Playoff matches are always single-set. Format at the bracket level — points_per_set either 11 or 15, chosen at generation time.
match_order on bracket_matches is global across the tournament day to sequence courts correctly (separate from pool match_order).


2. Overall tournament standings
Create src/lib/tournament-standings.ts:
typescriptexport interface OverallTeamStanding {
  team_id: string;
  team_name: string;
  pool_label: string;
  pool_rank: number;          // position within their pool (1st, 2nd, etc.)
  matches_won: number;
  matches_lost: number;
  sets_won: number;
  sets_lost: number;
  point_differential: number;
  overall_rank: number;        // rank across the whole tournament
}

export function computeOverallStandings(
  tournamentId: string,
  pools: PoolStandings[]      // from Phase 2e
): OverallTeamStanding[]
Logic:

Take each pool's standings (ranked by the Phase 2e sorting rules)
Flatten into a single list
Compute cross-pool overall rank using:

Pool rank (1st place pool finishers all rank higher than 2nd place pool finishers, etc.)
Within the same pool rank tier: sets won → point differential → points for


Return sorted list with overall_rank assigned (1 = best)

This is used to determine bracket cutoffs and seeding.
Critical: the "top 2 from each pool to gold" rule is applied here — all pool 1st place finishers get overall_rank 1 through N (N = pool count), then all 2nd place finishers get N+1 through 2N, etc. Within each tier, sets won / point diff breaks ties.

3. Playoff generation
Create src/lib/bracket-generation.ts:
typescriptexport interface BracketGenerationInput {
  tournament_id: string;
  overall_standings: OverallTeamStanding[];
  gold_cutoff: number;         // teams 1 to N go to gold, remaining go to silver
  gold_points_per_set: 11 | 15;
  silver_points_per_set: 11 | 15;
  court_count: number;         // from tournament's net count
}

export interface GeneratedBracket {
  bracket_type: 'gold' | 'silver';
  points_per_set: number;
  slots: Array<{
    round_number: number;
    slot_position: number;
    team_id?: string;
    is_bye: boolean;
  }>;
  matches: Array<{
    round_number: number;
    match_position: number;
    slot_a_position: number;  // references slot in same round
    slot_b_position: number;
    court_number: number;
    match_order: number;
  }>;
}

export function generateBracket(
  teams: OverallTeamStanding[],
  bracket_type: 'gold' | 'silver',
  points_per_set: 11 | 15,
  court_count: number
): GeneratedBracket
Bracket size calculation:
For N teams in a bracket, the bracket size is the next power of 2 ≥ N:

3-4 teams → 4-slot bracket
5-8 teams → 8-slot bracket
9-16 teams → 16-slot bracket

Teams get byes if the bracket isn't full. Byes go to top seeds (highest overall_rank in the bracket).
Seeding logic (critical):
The key rule you specified: teams from the same pool should not meet again until the final if they both keep winning. This is achieved by:

Split teams into two halves of the bracket (top half, bottom half)
Assign pool winners to separate halves — distribute them so no two 1st-place finishers from the same pool land in the same half until final
Standard seeding within each half: 1 vs lowest, 2 vs next lowest, etc.

Example — 4 pools, 8 teams go to gold (top 2 each):
Pool 1st place finishers: A1, B1, C1, D1 (overall ranks 1, 2, 3, 4)
Pool 2nd place finishers: A2, B2, C2, D2 (overall ranks 5, 6, 7, 8)
Top half of bracket: seed 1 (A1), seed 4 (D1), seed 6 (B2), seed 7 (C2)
Bottom half: seed 2 (B1), seed 3 (C1), seed 5 (A2), seed 8 (D2)
This ensures:

A1 and A2 are in opposite halves (meet only in final)
B1 and B2 are in opposite halves
Same for all other pool pairings

Match-up pattern within a half:

Highest seed vs lowest seed in that half
Second-highest vs second-lowest

Byes:

If gold has 6 teams (2 byes to get to 8-slot bracket):

Top 2 overall get byes
Bye slots go straight to quarterfinal


Byes always go to the highest-seeded teams in the bracket

Court assignment for playoff matches:

First round matches spread across all available courts
Later rounds consolidate (quarterfinals on fewer courts, semifinals on 2, finals on 1)
match_order is global and sequences matches in time order


4. Playoff cutoff adjustment UI
Create a dedicated admin flow for playoff generation. When pool play is complete (all pool matches have winners), show in admin:

A new button on the tournament tab: "Generate playoffs"
Clicking opens a new admin view or modal: "Playoff setup"

Playoff setup view layout:
Show the full list of teams ranked by overall_rank:

Each team row shows: overall rank, team name, pool origin (e.g., "Pool A · #1"), record, pt diff
A horizontal cutoff bar appears between teams
Teams above the bar = gold bracket, teams below = silver bracket
The bar is initially positioned at the auto-calculated cutoff (top 2 per pool = default gold cutoff)
Admin can drag the bar or use up/down buttons to move the cutoff
As the bar moves, the "Gold bracket" and "Silver bracket" labels update with current team counts
Below the list, a recommendation panel suggests better cutoff options:

"Recommendation: Move cutoff to 8 for a balanced 8-team gold bracket (no byes needed)"
"Alternative: Current 6-team gold requires 2 byes for top seeds"



Format selection:
Below the cutoff adjuster:

"Gold bracket format": toggle between "1 set to 15" and "1 set to 11"
"Silver bracket format": toggle between "1 set to 15" and "1 set to 11"

Generate button:

"Generate brackets" (primary crimson)
On click: POST to /api/admin/brackets with cutoff + formats
Returns generated brackets, redirects to bracket view


5. Bracket API endpoints
Create src/app/api/admin/brackets/route.ts:

GET /api/admin/brackets?tournament=X — returns both gold and silver bracket structures with teams, slots, matches, scores
POST /api/admin/brackets — body: { tournament_id, gold_cutoff, gold_points_per_set, silver_points_per_set }. Generates both brackets and persists.

If brackets already exist for this tournament, return 409
Uses service role client
Also generates tokens for all bracket matches


DELETE /api/admin/brackets?tournament=X — deletes all brackets (cascades to slots, matches, sets, tokens). Used for regenerate.

Create src/app/api/admin/brackets/[id]/route.ts:

PATCH /api/admin/brackets/[id]/matches/[match_id] — update specific bracket match (work team, match_order, court, status)

Create src/app/api/admin/brackets/propagate/route.ts:

POST /api/admin/brackets/propagate — body: { tournament_id }. Advances winners from completed matches into their next-round slot. Called automatically after each bracket match score submission, but also exposed as admin action for manual sync.

Public endpoint:

src/app/api/public/brackets/route.ts — GET /api/public/brackets?tournament=X — returns bracket structures with team names (no PII) for Live page display


6. Work team assignment for bracket matches
This is more complex than pool play. The rule: loser of the previous match on this court works the next match.
Apply this logic when generating bracket matches:
First round work assignment:

If a team has a bye in this bracket, they work the first match on their eventual court
If no byes on a court, assign a team that has a bye on another court to work first round (if available)
If no available bye teams, assign the lowest-seeded team from a pool not playing this round to work
If none of that applies (small bracket, no byes, all teams playing): leave work_team_id null initially and admin assigns manually

Subsequent round work assignment:

Loser of the previous match on the same court works the next match
This is deterministic but depends on match outcomes — work assignments update when previous match completes

Implementation:
When a bracket match completes (final set submitted), a trigger or function updates the next match on that court:

Find the next scheduled match on court N
Set its work_team_id to the losing team of the just-completed match
If that team has another bracket match scheduled around the same time, skip and assign the next available team (rare edge case)

Use a Postgres function called via RPC:
sqlcreate or replace function assign_next_work_team(completed_match_id uuid)
returns void as $$
declare
  completed bracket_matches%rowtype;
  losing_team uuid;
  next_match bracket_matches%rowtype;
begin
  select * into completed from bracket_matches where id = completed_match_id;
  
  -- Determine loser
  if completed.winner_slot_id = completed.slot_a_id then
    losing_team := completed.team_b_id;
  else
    losing_team := completed.team_a_id;
  end if;
  
  -- Find next scheduled match on same court, same bracket
  select * into next_match from bracket_matches
  where bracket_id = completed.bracket_id
    and court_number = completed.court_number
    and match_order > completed.match_order
    and status = 'scheduled'
  order by match_order asc
  limit 1;
  
  if next_match.id is not null then
    update bracket_matches
    set work_team_id = losing_team
    where id = next_match.id;
  end if;
end;
$$ language plpgsql;
Called from the bracket score submission endpoint after a match is marked complete.

7. Winner propagation
When a bracket match completes:

Determine winner (team with more points in the single set)
Update winner_slot_id on the match
Find the next-round slot that lists this match in its source_slot_ids
Update that slot's team_id to the winning team
If both feeder matches for a next-round match are complete, populate that match's team_a_id and team_b_id

This is handled server-side via an RPC function propagate_bracket_winner(match_id uuid) called after each bracket match score is submitted.

8. Bracket score submission
Uses the same pattern as Phase 2d pool match score submission, but for bracket_matches:
Create src/app/api/bracket-score/[token]/route.ts:

GET — fetch bracket match details via token
POST — submit/update single-set score, trigger propagation and work team assignment

Create src/app/(tournament)/longvolleyball/bracket-score/[token]/page.tsx:

Same score submission UX as pool matches (plus/minus buttons, large inputs, numeric keypad)
Single set only (format is 1 set to 11 or 15 depending on bracket config)
Header shows "Gold Quarterfinal · Court 1" or similar round label
On complete, triggers both winner propagation and next work team assignment


9. Public bracket view on Live page
Add a new view to the Live page accessible from pool tabs:

New tab: "Gold Bracket" and "Silver Bracket" (appears only once brackets are generated)
Default to Overview tab if brackets don't exist yet

Bracket view layout:
Traditional bracket display — one round per column, matches stacked vertically within each column, lines connecting winners to next round slots.
Round headers: "Round 1", "Quarterfinals", "Semifinals", "Final"
Each match box:

Team A name and score (if complete)
Team B name and score (if complete)
Winner name highlighted
If in-progress: "Live" badge, current score shown
If scheduled: both slots show placeholder text or source match reference
Byes shown as "BYE" in grey

Mobile bracket view:
Desktop bracket visualizations don't work on mobile. On mobile:

Show rounds as a vertical scrollable list
Each round is a section with its matches as cards
Winner of each match highlighted
Progression indicated by arrows or text ("Winner advances to Semifinal match 1")

Alternative mobile pattern: "Current round" filter — show only matches that are currently live or recently completed, with a way to scroll through past rounds.

10. Admin bracket view
In admin, once brackets exist, add them as sub-tabs under the tournament (similar to pool tabs):

"Overview" | "Pools" | "Gold" | "Silver"

Gold/Silver tabs show:

Full bracket view (same as public, but with admin actions)
Per-match admin controls: edit work team, manual score entry, copy score link, regenerate token
Bracket progression visible — who advanced, who's eliminated
"Undo bracket advancement" button on matches that were wrongly completed (restores team to original slot, deletes score, clears winner)


11. Champion determination for archive view
Update the Phase 2e archive view to use bracket data when available:

If brackets exist and are complete: champion is the gold bracket final winner
Display: "Tournament champion: [Gold Winner]" prominently
Show "Silver bracket champion: [Silver Winner]" as secondary
If brackets don't exist (pool play only tournament): fall back to current champion logic (top overall standings)


12. Email work links for brackets
When brackets are generated, send work team emails similar to pool match emails but with bracket-specific content:

Subject: "Your playoff match work assignments — [Tournament Name]"
Lists all bracket matches the team is assigned to work
Includes score submission links per match
Sent from info@longvolleyball.com via Resend

Add the "Email work links" button logic to cover both pool and bracket matches — a single action sends all assignments.

13. Manual steps after deployment

Run migration 007 in Supabase SQL Editor
Verify all five new tables exist
Verify the two RPC functions exist: assign_next_work_team, propagate_bracket_winner
Test full tournament day simulation:

Complete all pool matches for a test tournament
Use admin "Generate playoffs" flow
Adjust cutoff, choose formats, generate
Verify brackets appear in admin with correct seeding
Submit bracket match scores via token links
Verify winners propagate to next round
Verify work teams auto-assign to next matches
Verify championship displays in archive view after final completes




14. Verify

npm run build passes
Migration 007 runs cleanly
Bracket generation respects pool separation rule (verify same-pool teams land in opposite halves)
Byes go to top seeds correctly
Single-set score format works for bracket matches (11 or 15 configurable)
Winner propagation updates next-round slots automatically
Work team assignment follows the loser-works-next rule
Cutoff adjustment UI updates team assignments in real time
Bracket regenerate cleanly deletes old and creates new
Mobile bracket view is readable and scrollable
Champion banner in archive shows correct winner after gold final completes


Do not build yet. First confirm:

Your approach to seeding teams into bracket halves — specifically how you ensure the "same pool not meeting until final" rule. Walk through a 3-pool, 6-team gold example showing your seeding.
How you'll handle the case where the cutoff creates an odd number going to gold (e.g., 5 teams to gold). Silver may also have an odd count. Both will need byes. Explain your plan.
The mobile bracket view — which pattern you'll implement (scrollable vertical rounds, current-round filter, or something else). Propose your approach.
How the "loser works next on this court" rule handles the edge case where a team loses round 1 but has already been pre-assigned to work a match that's about to start on a different court. Two conflicting assignments — propose resolution.
Whether the cutoff adjustment UI should be drag-drop or button-based. Drag is nicer but tricky on mobile. My take: use a slider or +/- buttons for the cutoff position, drag was mentioned but precision matters here.
Your plan for the "undo bracket advancement" feature — should it cascade (if I undo round 1, does it wipe all dependent round 2+ data for that team)? My take: yes, full cascade with a confirmation modal warning.
Any plans to support double-elimination brackets or is this strictly single-elim? My take: single-elim only for now, double-elim can be a future extension.
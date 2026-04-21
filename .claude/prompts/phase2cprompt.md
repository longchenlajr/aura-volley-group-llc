Claude Code Prompt — Phase 2c: Match Generation & Work Team Assignment

Generate round-robin matches for each pool with intelligent scheduling, work team assignment, and admin visibility. Runs after pools are finalized (Phase 2b).

1. Database migration
Create supabase/migrations/005_matches_schema.sql:
sql-- Matches table
create table matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id text not null,
  pool_id uuid references pools(id) on delete cascade,
  bracket_round text,
  
  team_a_id uuid not null references teams(id) on delete restrict,
  team_b_id uuid not null references teams(id) on delete restrict,
  work_team_id uuid references teams(id) on delete set null,
  
  court_number integer not null,
  match_order integer not null,
  
  status text not null default 'scheduled' check (status in ('scheduled', 'in_progress', 'complete')),
  
  start_time timestamptz,
  end_time timestamptz,
  created_at timestamptz not null default now(),
  
  constraint matches_distinct_teams check (team_a_id != team_b_id),
  constraint matches_work_not_playing check (work_team_id is null or (work_team_id != team_a_id and work_team_id != team_b_id))
);

create index matches_tournament_idx on matches(tournament_id);
create index matches_pool_idx on matches(pool_id);
create index matches_status_idx on matches(tournament_id, status);
create index matches_order_idx on matches(pool_id, match_order);

alter table matches enable row level security;

create policy "matches_anon_select" on matches for select to anon using (true);
The on delete restrict on team FKs prevents deleting a team that's in scheduled matches without explicit action. The work_team_id uses on delete set null because work assignments can be reassigned if a team withdraws.
The check constraints ensure team A ≠ team B and the work team isn't one of the playing teams — database-level guards against malformed matches.

2. Match generation algorithm
Create src/lib/match-generation.ts:
typescriptexport interface MatchGenerationInput {
  pool_id: string;
  court_number: number;
  teams: Array<{
    team_id: string;
    seed_in_pool: number;
  }>;
}

export interface GeneratedMatch {
  match_order: number;
  team_a_id: string;
  team_b_id: string;
  work_team_id: string | null;
  court_number: number;
}

export function generatePoolMatches(input: MatchGenerationInput): GeneratedMatch[]
Algorithm requirements:

Standard round robin — every team plays every other team exactly once. For pool size N, total matches = N * (N-1) / 2.
Match ordering uses the circle method — the canonical algorithm that keeps one seed fixed and rotates the others. This naturally produces good spacing between rematches.
Top seeds in final match — after running the circle method, reorder the sequence so the match between the two highest seeds (#1 and #2 in pool) is placed last. If that match happens to already be last, leave it. If not, swap it with the actual last match.
Minimize back-to-back matches per team:

After initial ordering, scan through the sequence
Identify any team playing two consecutive matches
If two adjacent matches would force a back-to-back for a higher-seeded team but not a lower-seeded team after swap, perform the swap
Lower-seeded teams absorb the back-to-backs when unavoidable
This is a local optimization pass, not a global solver — good enough for pool sizes up to 5


Work team assignment:

For 3-team pools: the non-playing team works the match. No choices to make.
For 4+ team pools: multiple teams aren't playing at any given time. Assign work based on:

Rotate through pool teams evenly — each team should end with roughly total_matches/team_count work assignments (rounded)
Lower seeds get extra work when rotation isn't even (e.g., 6 matches / 4 teams = 1.5 each → seeds 3 and 4 each work 2 matches, seeds 1 and 2 each work 1)
A team can never work a match they're playing in (enforced by DB constraint too)


Start with a rotation pattern and adjust to honor the seed-based load distribution



Edge case handling:

If two adjacent matches would cause a back-to-back for both teams in the second match, don't attempt the swap — just accept it
For pool sizes > 5, still generate but flag a warning (pools that large are non-standard anyway)

Include unit-test-like inline verification: after generating matches, sanity-check that every team plays every other team exactly once and no team plays more than 2 matches in a row anywhere in the sequence.

3. Tournament-wide match scheduling
Generating pool matches in isolation per pool is simple. The harder problem: all pools play simultaneously on different courts, so match ordering across pools determines the actual time slots.
Simplification: each pool's match_order is independent and represents "this match is the Nth match on this court." Matches with the same match_order across different pools happen at roughly the same time.
In other words — match_order 1 for pool A happens concurrently with match_order 1 for pool B, because they're on separate courts. This is how it actually works in reality.
No cross-pool coordination logic needed in this phase. Pool match ordering is self-contained.

4. Admin API endpoints
Create src/app/api/admin/matches/route.ts:

GET /api/admin/matches?tournament=X — returns all matches for a tournament with team data joined. Response shape:

typescript  {
    matches: Array<{
      match: Match;
      team_a: { id: string; team_name: string; seed_in_pool: number };
      team_b: { id: string; team_name: string; seed_in_pool: number };
      work_team: { id: string; team_name: string } | null;
      pool: { id: string; pool_label: string; court_number: number };
    }>
  }

POST /api/admin/matches — body: { tournament_id }. Generates and inserts matches for all pools in the tournament. If matches already exist for this tournament, return 409. Uses service role client.
DELETE /api/admin/matches?tournament=X — deletes all matches for a tournament. Used for regenerate flow.

Create src/app/api/admin/matches/[id]/route.ts:

PATCH /api/admin/matches/[id] — update match details. Primarily for admin overrides: changing work_team_id, adjusting match_order, changing court_number. Body shape: { work_team_id?, match_order?, court_number?, status? }
DELETE /api/admin/matches/[id] — delete a single match (edge case, rarely needed)

All require admin session.

5. Admin UI — Matches view
Add a new section to the admin tournament tab, appearing below pool cards when pools exist:
If matches don't exist yet:

Button: "Generate match schedule" (primary crimson)
On click: POST to /api/admin/matches
Show a brief generating state, then render the matches view

If matches exist:

Show a "Match schedule" heading with a "Regenerate matches" button (destructive outline, with confirmation modal)
Display matches grouped by pool in a readable format

Match display layout:
For each pool, show a card with:

Pool label + court number header (e.g., "Pool A · Court 1")
Match list, ordered by match_order
Each match row shows:

Match number (1, 2, 3...)
Team A vs Team B (with seed numbers in parentheses: "Sand Slingers (1) vs Dig Deep (3)")
Work team with a small work icon (e.g., "Work: Bump Squad (2)")
Status indicator (scheduled / in progress / complete) as a small tag
Admin actions: small icon buttons to edit work team or reorder



Reorder:
On each match row, small up/down arrow buttons to adjust match_order. Clicking swaps the match with the adjacent one in the sequence (both match_order values get updated). Simpler than drag-and-drop and reliable on mobile.
Edit work team:
Small "change work team" icon opens a modal showing all teams in the pool that aren't playing this match. Tap one to reassign. Same UX pattern as pool swap.
Regenerate confirmation modal:
"Regenerate match schedule? This will delete all current matches and reset scores. This cannot be undone."

6. Live page — match schedule integration
Update the Upcoming view on the Live page:

If pools exist AND matches exist: show the pool preview (from Phase 2b) PLUS a collapsible "Match schedule" section below it
If pools exist but no matches: show just the pool preview (current behavior)
If neither: existing placeholder

Match schedule public view shows:

Per pool: ordered list of matches with team names and work team
No seeds shown publicly (cleaner), no status yet since no scores are live
No admin actions

Update src/app/api/public/pools/route.ts or create src/app/api/public/matches/route.ts to return a public-safe match schedule (team names + work team names, no IDs beyond what's needed for rendering).

7. Guards and validation
Before generating matches, verify:

Pools exist for this tournament
Every pool has at least 3 teams
Every pool has team assignments with valid seed_in_pool values

If any guard fails, return a clear error message instead of generating.
After generating, run the sanity check: every team plays every other team in their pool exactly once. If the check fails (shouldn't happen with correct algorithm), rollback the insert and return 500 with the details.

8. Manual steps after deployment

Run migration 005 in Supabase SQL editor
Verify matches table and indexes exist
In admin, on a tournament with pools generated:

Click "Generate match schedule"
Verify matches appear in admin view, grouped by pool
Verify each team plays every other team in pool exactly once
Verify work team assignments look balanced
Check Supabase matches table has the rows


Test the reorder up/down buttons — match_order should update and the list re-render
Test changing a work team via the modal
Test regenerate flow — confirmation modal, delete, re-insert
Check the Live page Upcoming view shows the match schedule for a tournament that has matches


9. Verify

npm run build passes
Migration 005 runs cleanly
Match generation produces mathematically correct round robins (N * (N-1) / 2 matches per pool)
Top seeds play in the final match of each pool
No team plays 3 matches in a row anywhere
Back-to-backs, when they exist, are on lower seeds
Work assignments are distributed with lower seeds taking more when rotation is uneven
Admin reorder updates match_order correctly in the database
Changing work team via admin modal persists
Public Live page shows match schedule without exposing PII


Do not build yet. First confirm:

Your approach to the circle method + top-seeds-last reordering — specifically whether the reorder step could accidentally create a new back-to-back that the initial ordering avoided
How you'll handle the 3-team pool case cleanly (trivial round robin, but the "last match = top seeds" rule still applies: match order should be 2v3, 1v3, 1v2)
Whether you'll run the back-to-back optimization as a separate pass or fold it into the circle method directly
How you'll communicate "this pool has been left with a back-to-back on team X because it was unavoidable" in the admin UI — a small info badge? tooltip? nothing at all?
Your plan for preserving any admin overrides (reordered matches, reassigned work teams) if matches are regenerated — my suggestion: don't preserve, regenerate from scratch, document this in the confirmation modal
Claude Code Prompt — Phase 2b: Pool Persistence & Management

Build the database schema, persistence, and management UI for tournament pools. Currently pools are generated client-side in admin but vanish on page refresh — this phase makes them permanent and editable.

1. Database migration
Create supabase/migrations/004_pools_schema.sql:
sql-- Pools table
create table pools (
  id uuid primary key default gen_random_uuid(),
  tournament_id text not null,
  pool_label text not null,              -- 'A', 'B', 'C', etc.
  court_number integer not null,
  created_at timestamptz not null default now(),
  
  constraint pools_tournament_label_unique unique (tournament_id, pool_label)
);

-- Pool team assignments (junction)
create table pool_teams (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references pools(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  seed_in_pool integer not null,
  created_at timestamptz not null default now(),
  
  constraint pool_teams_pool_team_unique unique (pool_id, team_id),
  constraint pool_teams_pool_seed_unique unique (pool_id, seed_in_pool)
);

-- Indexes for common queries
create index pools_tournament_idx on pools(tournament_id);
create index pool_teams_pool_idx on pool_teams(pool_id);
create index pool_teams_team_idx on pool_teams(team_id);

-- RLS policies
alter table pools enable row level security;
alter table pool_teams enable row level security;

-- Anonymous read (for public Live page)
create policy "pools_anon_select" on pools for select to anon using (true);
create policy "pool_teams_anon_select" on pool_teams for select to anon using (true);

-- Service role has full access by default (bypasses RLS)
The constraint pool_teams_pool_team_unique prevents the same team appearing twice in the same pool. The constraint pool_teams_pool_seed_unique prevents two teams having the same seed position in one pool.

2. TypeScript types
Add to src/lib/tournaments.ts (or a new src/lib/pools.ts):
typescriptexport interface Pool {
  id: string;
  tournament_id: string;
  pool_label: string;      // "A", "B", "C"
  court_number: number;
  created_at: string;
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
    overall_seed: number;      // from teams table
    seed_in_pool: number;
  }>;
}

3. Admin API endpoints
Create src/app/api/admin/pools/route.ts:

GET /api/admin/pools?tournament=X — returns all pools for a tournament with their team assignments, joined with team data. Response shape: { pools: PoolWithTeams[] }
POST /api/admin/pools — body: { tournament_id, pools: [{ pool_label, court_number, team_ids: [...] }] }. Creates pools and pool_teams in a single transaction. If pools already exist for this tournament, return 409 with "Pools already exist for this tournament. Delete them first or use the edit endpoint."
DELETE /api/admin/pools?tournament=X — deletes all pools (cascades to pool_teams) for the tournament. Used for "regenerate pools" flow.

Create src/app/api/admin/pools/[id]/route.ts:

PATCH /api/admin/pools/[id] — update pool metadata (court_number)
DELETE /api/admin/pools/[id] — delete a single pool (with confirmation on the client)

Create src/app/api/admin/pool-teams/swap/route.ts:

POST /api/admin/pool-teams/swap — body: { team_a_id, team_b_id, tournament_id }. Swaps two teams between pools atomically. This is the critical operation for the swap UI:

Find both teams' current pool_teams records
Swap their pool_id values
Keep their original seed_in_pool (teams swap slots exactly)
Return the updated pools



All endpoints require admin session. Use the service role Supabase client.

4. Update admin pool generation to persist
The existing admin pool generation currently runs client-side and displays pools without saving. Update the flow:

After the serpentine algorithm generates the pool structure client-side, POST the result to /api/admin/pools
On success, redirect or re-fetch to show the persisted state
If the POST returns 409 (pools already exist), show a confirmation modal: "Pools are already generated for this tournament. Do you want to delete them and start over?" → on confirm, DELETE then POST
Add a loading state during the save — prevent double-submits


5. Admin pool view — persisted
After pools are saved, the admin view should load pools from the database instead of regenerating them client-side. On the tournament tab in /admin:

On page load, fetch /api/admin/pools?tournament=X
If pools exist: show the saved pool cards
If no pools yet: show the existing "Generate pools" flow
Add a "Regenerate pools" button (destructive, crimson outline) that triggers DELETE + POST flow

Pool cards should show:

Pool label (A, B, C)
Court number
Teams in the pool with seed position
A small "Swap team" button on each team row (see section 6)


6. Pool swap UI
When admin clicks "Swap team" on a team row inside a pool card:

Opens a modal titled "Move [Team Name]"
Shows all other pools as cards, with each team inside shown as a tappable row
Tapping a team on another pool triggers the swap: POST to /api/admin/pool-teams/swap with the two team IDs
On success, close modal and re-fetch pools to update the display
On error, show the error message in the modal

Design spec for the modal:

Same parchment-themed modal as the existing "Add team" modal
Header: "Move [Team Name] to another pool"
Body: scrollable list of pool cards, each showing pool label and courtside teams
Each team in the destination list is a tappable row with a small "swap arrows" icon on the right
Confirmation is implicit — tapping swaps immediately (no separate confirm button). Admin can reverse with another swap.

Mobile responsive — pool cards in the modal stack vertically.

7. Pool generation algorithm refinement
The existing client-side serpentine algorithm works but should be consolidated and documented. Move it to src/lib/pool-generation.ts:
typescriptexport interface PoolGenerationInput {
  teams: Array<{ id: string; team_name: string; seed: number }>;
  net_count: number;
}

export interface PoolGenerationOutput {
  pools: Array<{
    pool_label: string;        // "A", "B", "C"
    court_number: number;
    team_ids: string[];        // ordered by seed_in_pool (1-indexed)
  }>;
}

export function generatePools(input: PoolGenerationInput): PoolGenerationOutput {
  // Calculate pool sizes from team count + net count
  // Assign pool labels and court numbers
  // Run serpentine draft: teams sorted by overall seed, distributed in snaking order
  // Return pool assignments
}
Pool sizing logic:

Divide total teams by net count to get target pool size
If result is not a whole number, mix pool sizes: e.g., 11 teams with 3 nets = one pool of 4 + two pools of 3 (or 3/4/4, depending on preference)
Prefer pools of 3-5 teams (4 is ideal); reject generation with a friendly error if constraints can't be met (e.g., 20 teams across 2 nets would require 10-team pools — too big)

Validation before generation:

All checked-in teams must have a seed assigned (no nulls)
No duplicate seeds
Net count must be ≥ 1 and reasonable relative to team count
At least 6 teams required to form pools (3 teams × 2 nets minimum)

If any validation fails, return a clear error message without generating.

8. Live page — wire up upcoming view team count + pool preview
Update the Live page Upcoming placeholder:

Keep the team count from the existing public endpoint
Add: if pools exist for this tournament, show a read-only pool preview (pool labels, courts, team names) with the header "Pools locked in"
If pools don't exist yet: show existing copy ("Pool assignments will appear here once registration closes and teams are seeded.")

Create src/app/api/public/pools/route.ts:

GET /api/public/pools?tournament=X — returns public-safe pool structure with team names only (no contact info, no emails). Uses anon client + RLS policies we created.


9. Manual steps after this phase is deployed

Run the new migration 004_pools_schema.sql in Supabase SQL editor
Verify the pools and pool_teams tables exist with correct RLS policies
Test the full flow in admin:

Generate pools → persist → refresh page → pools still visible
Swap two teams → verify in Supabase
Regenerate pools → confirm delete + recreate works


Test the Live page Upcoming view shows pools once they're generated


10. Verify

npm run build passes
New migration runs cleanly
Admin pool generation writes to Supabase and persists across refreshes
Pool swap works atomically (no states where a team is in two pools or no pool)
Public Live page shows pool preview when pools exist
Deleting a team cascades correctly: cascade to players (existing) AND cascade to pool_teams (new) — verify with a delete test
Admin can regenerate pools without database errors


Do not build yet. First confirm:

Your plan for the atomic swap — how you'll ensure no intermediate state where the swap is half-complete if something fails partway through
Whether existing teams that are deleted will cascade correctly to pool_teams (should be automatic via on delete cascade but confirm)
How you'll handle the edge case: team gets removed from a pool (via swap) but the swap target pool is full — propose behavior (reject swap? force eject an existing team?)
Your plan for the "pools already exist" flow — modal UI vs inline warning
Any interactions with Phase 2a's Live page that need updating
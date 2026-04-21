Here's Phase 2e:

Claude Code Prompt — Phase 2e: Live Standings & Real-Time Tournament View

Wire up the Live page to display real-time tournament state — pool standings computed from submitted scores, active matches with current progress, completed matches, and upcoming matches. Auto-refreshes during tournament day so anyone on the sideline can pull up the site and see live standings.

1. Standings computation
Create src/lib/standings.ts:
typescriptexport interface TeamStanding {
  team_id: string;
  team_name: string;
  seed_in_pool: number;
  matches_played: number;
  matches_won: number;
  matches_lost: number;
  sets_won: number;
  sets_lost: number;
  points_for: number;
  points_against: number;
  point_differential: number;
}

export interface PoolStandings {
  pool_id: string;
  pool_label: string;
  court_number: number;
  standings: TeamStanding[];  // sorted by ranking rules below
}

export function computePoolStandings(
  poolTeams: Array<{ team_id: string; team_name: string; seed_in_pool: number }>,
  matches: Array<{ 
    id: string; 
    team_a_id: string; 
    team_b_id: string; 
    sets: Array<{ team_a_score: number; team_b_score: number }>;
    status: string;
  }>
): TeamStanding[]
Sorting rules (for pool standings):

Matches won — descending
Head-to-head — if two teams are tied on matches won, check whether they played each other and who won that match
Sets won (total across all their matches) — descending
Point differential (sum of points for minus sum of points against across all their matches) — descending
Points for (total points scored) — descending
Seed in pool — ascending (lower seed breaks ties, rewards better initial seeding)

Rule 2 (head-to-head) only applies when exactly two teams are tied. For three-way ties, skip head-to-head and go straight to sets won, then point differential, etc. — this is the standard volleyball tournament convention.
Only completed matches count toward standings. In-progress matches don't contribute until finalized.
Edge case: If no matches are complete yet, return standings with all teams at 0-0, sorted by seed. This is the "before the day starts" state.

2. Public standings API
Create src/app/api/public/standings/route.ts:

GET /api/public/standings?tournament=X — returns all pool standings for the tournament
Response:

typescript  {
    pools: PoolStandings[];
    last_updated: string;  // ISO timestamp
  }

Uses the anon Supabase client
Joins teams, pools, pool_teams, matches, match_sets
Returns team names only — no contact info, no emails, no seeds (seeds are internal metadata)

Caching: add a short cache header — Cache-Control: public, max-age=10 — so the browser doesn't hammer the endpoint but still gets fresh data.

3. Live matches API
Create src/app/api/public/live-matches/route.ts:

GET /api/public/live-matches?tournament=X — returns currently in-progress matches and recently completed matches
Response:

typescript  {
    in_progress: Array<{
      match_id: string;
      pool_label: string;
      court_number: number;
      match_order: number;
      team_a: { id: string; name: string };
      team_b: { id: string; name: string };
      current_sets: Array<{ team_a_score: number; team_b_score: number; is_complete: boolean }>;
      format: { sets: number; points_per_set: number };
    }>;
    recently_complete: Array<{
      match_id: string;
      pool_label: string;
      court_number: number;
      team_a: { id: string; name: string };
      team_b: { id: string; name: string };
      final_sets: Array<{ team_a_score: number; team_b_score: number }>;
      winner_team_id: string;
      completed_at: string;
    }>;
    upcoming: Array<{
      match_id: string;
      pool_label: string;
      court_number: number;
      match_order: number;
      team_a: { id: string; name: string };
      team_b: { id: string; name: string };
    }>;
    last_updated: string;
  }
Definitions:

in_progress — matches with at least one match_sets row but no match winner determined yet
recently_complete — matches with winner determined, completed within the last 30 minutes (so the Live view can highlight just-finished results before rotating them off)
upcoming — next 2 matches per court (next in match_order that hasn't been scored)


4. Live page — Live view implementation
Replace the "Live scoring coming soon" placeholder on the Live page with the real Live view. This activates when a tournament is in Live status (today's calendar day in ET).
Layout (desktop):
Top section — "In progress" strip:

Heading: "Now playing" in Fraunces 700
Horizontal scroll of large match cards (one per court currently playing)
Each card shows:

Court number as a prominent label
Pool label and match order
Team A name, team A current set score (large, Fraunces 700, 48px)
"vs" divider
Team B name, team B current set score (large)
Set indicator: "Set 2 of 2" if applicable
Previous sets shown compactly below the current set: "Set 1: 15–11"
Subtle pulse animation on the score numbers to show they're "live"


If no matches are in progress: show "Between matches — check back shortly" with a small decorative cloud

Middle section — "Standings":

Heading: "Pool standings"
Grid of standings cards, one per pool, 2-3 columns on desktop
Each standings card:

Pool label header (e.g. "Pool A · Court 1")
Compact table with columns: Rank, Team, W-L, Sets, Pt Diff
Top team highlighted with a gold left border
Second place has a slightly lighter crimson accent
Rows ordered by the sorting rules above



Bottom section — "Recent results":

Heading: "Recent results"
Compact list of recently completed matches
Each row: pool label · team names · final set scores · winner highlighted
Fades older matches out (CSS gradient) so the most recent ones are prominent


Layout (mobile):
Single column stack. Priority of sections:

In progress (highest — people want to see live scores)
Standings (also high)
Recent results (useful but less urgent)
Upcoming (lowest priority)

In progress matches on mobile: cards stack vertically, each card takes full width. Score font stays large.
Standings on mobile: one pool per row, table is compact but readable. Horizontal scroll if the table is too wide — don't shrink the font below 13px.

5. Auto-refresh polling
The Live view polls the standings and live-matches endpoints every 12 seconds to refresh state.
Implement with a custom React hook:
typescript// src/app/(tournament)/longvolleyball/live/useLivePolling.ts
function useLivePolling<T>(
  url: string,
  intervalMs: number = 12000,
  enabled: boolean = true
): { data: T | null; error: string | null; lastUpdated: Date | null; refresh: () => void }

Fetches on mount
Sets interval based on intervalMs
Clears interval on unmount
Pauses polling when browser tab is hidden (document.visibilityState === 'hidden') and resumes when visible
Exposes manual refresh

Use this hook for both the standings and live-matches fetches on the Live page.
Subtle refresh indicator:

Small dot in the top-right of the page that pulses gently when polling
Crimson when actively fetching, gold when idle
Tooltip on hover: "Live — updates every 12 seconds"
Hidden if tournament status is not Live (upcoming/archive don't need the indicator)


6. Upcoming view improvements
The Upcoming view (for tournaments in the future) currently shows team count and pool preview (Phase 2b) and match schedule (Phase 2c). Keep those, and add:

Countdown: "12 days until tournament" displayed prominently. Auto-updates daily (or on page load — no need for seconds-level precision).
Registered teams list: if no pools yet, show the list of registered team names. If pools are generated, this section is replaced by the pool preview.
Share block: small card near the bottom with copy: "Registration link" and the URL longvolleyball.com/longvolleyball/register with a copy button. Helps people on the Live page share the tournament.


7. Archive view for past tournaments
The Archive placeholder currently says "Tournament archive coming soon." Replace with a real archive view:

Final pool standings (computed the same way as live standings, but all matches are complete)
Winner banner at the top: "Tournament champion: [Winning Team]"

Champion is determined as: the first-place team in whichever pool. If multiple pools, it's the #1 seed of the overall tournament based on cumulative sets won and point differential across all teams (no playoff bracket yet — that's Phase 2f)
If tournament had a playoff (future phase), show the playoff winner here instead


Same standings cards as the Live view but with "Final" tag on each pool label
All set scores for all matches, organized by pool
Small decorative element: the decorative divider ornament at the bottom of the page

Note: for tournaments that happened before Phase 2b was built, there won't be pool/match data. Handle gracefully — show "Results not available for this tournament" with a note.

8. Status-aware rendering
The TournamentStatus from Phase 2a (upcoming/live/archive) drives which view renders:
typescriptswitch (selectedTournamentStatus) {
  case "upcoming": return <UpcomingView tournament={selected} />;
  case "live": return <LiveView tournament={selected} />;
  case "archive": return <ArchiveView tournament={selected} />;
}
Each view fetches only the data it needs. Don't fetch live-matches data when viewing an Upcoming tournament — wasteful and the endpoint would return empty.

9. Performance considerations

Each standings and live-matches query should complete in under 500ms on the free Supabase tier for tournaments with < 30 teams
Use Supabase's query builder efficiently: single joins, no N+1 patterns
Consider adding a composite index on match_sets(match_id) (probably already exists) and matches(tournament_id, status) for the hot paths
If queries start slowing: add a materialized standings table updated via a Postgres trigger on match_sets. Not needed yet but plan for it.


10. Score display conventions
Throughout all views:

Set scores shown as "15-11" (en-dash, not hyphen, if possible)
Match results: "2-0" if shutout, "1-1 (split)" if tied on sets with cumulative winner
Standings:

W-L shown as "3-0" (wins-losses)
Sets shown as "6-1" (sets won-sets lost)
Point diff shown as "+12" or "-5" with sign


Time stamps: "2 min ago" for recent completions, "12:34 PM" for older

Create src/lib/time-format.ts with formatRelativeTime(date: Date | string): string for the "2 min ago" style.

11. Manual steps after deployment

No new migration required (uses existing schema)
Deploy and test Live view on a tournament that has pools + matches + some submitted scores:

Standings compute correctly
Sorting rules apply
Live matches show with current scores
Polling refreshes every 12 seconds
Mobile layout works


Test Upcoming view:

Countdown calculates correctly
Registered teams list shows when no pools
Pool preview and match schedule appear once generated


Test Archive view on a past tournament with complete data:

Final standings render
Champion is identified
Match history is accessible




12. Verify

npm run build passes
Standings endpoint returns correct data for a tournament with mixed match states (some complete, some in progress, some not started)
Sorting rules produce correct rankings when manually verified against expected results
Head-to-head tiebreaker works for 2-team ties
Cumulative-points tiebreaker works for 3+ team ties
Polling stops when tab is hidden, resumes when visible
No memory leaks from polling intervals on unmount
Mobile layout readable in bright sunlight simulation (test: phone at full brightness, outdoor)
Refresh indicator pulses only during Live status
Archive view gracefully handles tournaments with no recorded data


Do not build yet. First confirm:

Your plan for the head-to-head tiebreaker — specifically, how you'll detect that exactly two teams are tied (not three+) and handle the three+ case by skipping head-to-head. Edge case: three teams all tied at 2-1, go directly to sets won.
Polling implementation — will you use setInterval with a ref, or a cleaner abstraction like SWR or React Query? Given this is a single page with 2 endpoints, a simple custom hook is probably right, but confirm.
The "recently completed" 30-minute window — is there a better signal for "show this result"? My intuition: 30 minutes is fine for pool play where matches finish every ~20 minutes. If a match ends and immediately rotates off the Live view, users miss the result. 30-min window ensures visibility.
Whether to cache standings at the CDN level (Vercel edge cache for 10 seconds) or just rely on Supabase's inherent speed. Caching smooths out request spikes but might show slightly stale data.
How you'll visually distinguish in-progress matches that haven't started scoring yet (scheduled, no sets submitted) from ones that are genuinely mid-game (sets being actively updated). My take: "scheduled" matches shouldn't appear in In Progress — only matches with at least one submitted set. Confirm.


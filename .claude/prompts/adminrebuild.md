Claude Code Prompt — Admin Tournament View Rebuild (Pool Play)

Replace the current admin tournament dashboard with a consolidated, tournament-day-optimized view. This is the surface admin uses during actual tournament management — focused on pool play now, playoffs handled in a follow-up build. All existing functionality preserved, but restructured around what an admin needs to see and do in under 3 seconds on a phone with one hand.

1. Scope
Replace the admin tournament tab UI entirely. Old tab structure is removed. New structure:

Tournament-action toolbar at the top — all tournament-wide actions in one row
Pool summaries as collapsible/expandable cards showing standings and drilling into match tables
Team roster as a collapsible section that lives below the pool content once pools exist (or above if no pools yet)

Everything that admin can do today must still be doable. Nothing is removed — only reorganized.

2. Tournament-action toolbar (top of view)
A horizontal toolbar at the top of the tournament dashboard. On mobile this may wrap to two rows.
Buttons (ordered by tournament-day frequency of use):

Email work links — sends all pool + bracket work emails (confirmation modal as specced elsewhere)
Generate pools — appears only when no pools exist; once pools exist this button is replaced by Regenerate pools with destructive styling and confirmation modal
Generate matches — appears when pools exist but matches don't; once matches exist this is replaced by Regenerate matches with destructive styling and confirmation
Generate playoffs — appears only after pool play is complete; routes to the playoff generation flow (existing behavior)
Tournament info — dropdown/menu opening details: tournament name, date, format, location, entry fee reminder

Toolbar button styling: small secondary buttons (gold outline) for neutral actions, small primary (crimson) for primary flow actions, small destructive (crimson outline with warning hover state) for regenerate actions.
Tournament status indicator: small text below the toolbar showing current state — "Not started" / "Pool play · 3 of 12 matches complete" / "Pool play complete · ready for playoffs" / "In playoffs" / "Complete". Calculated from match data, updates live.

3. Pool summary cards
Once pools are generated, render pool summary cards in a grid (2 columns on desktop, 1 column on mobile).
Each pool summary card shows:
Collapsed state (default):

Pool label + court number header: "Pool A · Court 1"
Match progress indicator: "3 of 6 matches complete" with a thin progress bar underneath
Compact standings: top 2 teams inline:

"#1 Sand Slingers (2-0) · Sets 4-0 · +14"
"#2 Dig Deep (1-1) · Sets 2-2 · +3"


Small expand chevron in the top-right corner

Expanded state:

Full standings table:

Rank | Seed (#) | Team | W-L | Sets | Pt Diff
Rank is position within pool (1-4)
Seed column shows pre-tournament overall seed (#1, #4, etc.)
Color accents: #1 team row gets gold left border, #2 gets crimson left border


Swap team icon on each standings row (existing pool swap functionality preserved — opens swap modal from Phase 2b)
Below standings, the full match table for that pool (see section 4)

Clicking the card header toggles expansion. State persists within the session (if you expand Pool A, then navigate to a different tournament tab and back, Pool A stays expanded).
On mobile the expanded card takes full width and pushes subsequent pool cards below it.

4. Match table within each pool
When a pool card is expanded, show the match schedule for that pool as an inline table below the standings.
Desktop layout:
A table with these columns:

# — match order (1-6)
Match — "Sand Slingers (#1) vs Dig Deep (#4)" with pre-tournament seeds in parentheses after team names
Work — "Bump Squad (#2)" with seed in parens
Score — shows set scores if complete ("15-11, 13-15 · +2"), "Live" badge with pulse if in-progress, "—" if scheduled
Actions — icon buttons (see below)

Mobile layout:
Each match becomes a card, stacked vertically:

Top row: "Match 3" label + status tag (Scheduled / Live / Final)
Team A line: "Sand Slingers (#1)" + score
Team B line: "Dig Deep (#4)" + score
Work team line (smaller text): "Work: Bump Squad (#2)"
Actions row at the bottom: icon buttons

Actions available on each match row (both layouts):

Override score — opens a modal to enter/edit scores manually. Uses the existing admin score entry UI from Phase 2d. Works for scheduled, in-progress, or complete matches (admin can always override).
Copy score link — copies the score submission URL for the working team to clipboard. Shows "Copied" toast.
Swap match order — reorder arrows (up/down). Up arrow swaps this match with the match above it in match_order; down arrow swaps with the match below. Disabled at the edges (first match can't swap up, last can't swap down). Same mechanism as today.

No "change work team" action (as specified).
Status-based styling:

Scheduled: neutral ink-muted row
In-progress: subtle crimson left border, "Live" pulsing tag
Complete: slightly dimmed with "Final" tag, winner's name bolded


5. Team roster section
Below the pool summary cards (when pools exist) or at the top (when pools don't yet exist), the team roster lives as a collapsible section.
Header:

"Registered teams · 12" with expand/collapse chevron
Small button next to header: "Add team" (opens existing add-team modal)

Expanded state (desktop):
Table with columns:

Team name | Captain | Email | Phone | Players | Seed (editable) | Checked in (toggle) | Actions (delete icon)

Expanded state (mobile):
Each team as a card:

Team name (Fraunces, prominent)
Captain name + email + phone stacked small beneath
Player count: "3 players"
Seed input (inline) + checked-in toggle in a row
Delete icon top-right

The existing record + pt diff display from Phase 2e Polish — remove this from the roster view. It lives on the pool summary cards now where it's more useful.
Collapsed state:
Single line: "Registered teams · 12 · 10 checked in · Avg seed assigned" with expand chevron. Tap to expand.
Default state: collapsed when pools exist (admin doesn't need to see the roster during match play). Expanded when no pools exist (admin is setting up the tournament).

6. Team drop handling — BYE forfeit mechanism
When admin deletes a team and pools already exist, show a confirmation modal:

Title: "Remove team from active tournament?"
Body:

"Removing [Team Name] will replace them with a BYE in Pool [X]."
"All of [Team Name]'s completed matches will remain in the record as they were played."
"All of [Team Name]'s remaining scheduled matches will be auto-recorded as forfeit wins for their opponents:"

List the affected matches with the auto-score that will be recorded
For 2 sets to 15 pools: "15-0, 15-0"
For 2 sets to 11 pools: "11-0, 11-0"
For 1 set to 15: "15-0"
For 1 set to 11: "11-0"


"You can manually adjust any of these scores later if needed."


Buttons: Ghost "Cancel" + Destructive "Remove team and record forfeits"

On confirm:

Soft-delete or flag the team (add withdrawn_at timestamp on the teams table — keeps historical record intact)
Insert forfeit scores for all remaining scheduled matches involving this team
Each forfeit match uses the appropriate score format based on pool size (from getMatchFormat)
submitted_by: 'admin' with a forfeit: true flag on match_sets
Update match status to complete
Propagate standings updates

Schema change needed:
Add to teams table migration:
sqlalter table teams add column withdrawn_at timestamptz;
Add to match_sets table migration:
sqlalter table match_sets add column is_forfeit boolean not null default false;
The is_forfeit flag lets the admin view and standings visually indicate forfeit matches (small "Forfeit" tag on the row) vs real scores.
Teams with withdrawn_at set:

Don't appear in pool standings for future matches
Don't appear in the roster default view (show a "Show withdrawn teams" toggle in roster section)
Historical matches still display their name
Work team assignments for future matches involving them are NOT changed (the work team stays as originally assigned — the match itself just auto-records as forfeit)

If admin wants to truly hard-delete a team (not just withdraw them), provide a secondary admin action: "Permanently delete team data" — only visible if admin clicks a "Show advanced" option. Not exposed by default. This is the existing cascade-delete behavior.

7. Playoff handling (out of scope for this build)
The tournament-action toolbar shows "Generate playoffs" button when pool play is complete, routing to the existing playoff flow. But the post-playoff admin view (bracket management, etc.) stays as it currently exists from Phase 2f.
A follow-up build will rework the admin view for playoff mode — pool summaries bump down and bracket views become primary. For now, playoffs use the existing admin bracket view when they're generated.

8. Styling notes

Use existing admin design tokens from admin.css and tournament palette
Pool summary cards use --lv-bg-elevated with crimson accent borders on the top team rows
Match table rows use consistent status-based color accents (crimson for live, gold for winner)
All icons use existing ornament and icon components from the tournament system
Mobile-first: every table becomes a card list below 768px

Key visual principle: dense information, clear hierarchy, no scroll chrome getting in the way. Admin on tournament day is glancing at this between conversations. Info density matters.

9. Files to create/modify
New files:

src/app/admin/tournament/[tournamentId]/page.tsx — the new rebuilt admin tournament view (replaces existing view)
src/app/admin/tournament/[tournamentId]/TournamentToolbar.tsx
src/app/admin/tournament/[tournamentId]/PoolSummaryCard.tsx
src/app/admin/tournament/[tournamentId]/PoolMatchTable.tsx
src/app/admin/tournament/[tournamentId]/TeamRoster.tsx
src/app/admin/tournament/[tournamentId]/WithdrawTeamModal.tsx

Modified files:

src/app/admin/page.tsx — routes to the new tournament view when a tournament is selected
src/app/admin/admin.css — new styles for toolbar, pool cards, match tables
src/lib/match-generation.ts or new src/lib/forfeit-handling.ts — forfeit score insertion logic

New migrations:

supabase/migrations/008_team_withdrawal.sql — adds withdrawn_at on teams, is_forfeit on match_sets

New endpoint:

POST /api/admin/teams/[id]/withdraw — soft-deletes team, inserts forfeit scores for remaining matches, updates standings. Returns affected match count.


10. Verify

npm run build passes
Migration 008 runs cleanly
Admin tournament view renders correctly at 375px mobile and 1440px desktop
All existing pool/match/team actions still work in the new layout:

Create pools, regenerate pools, swap teams in pools
Generate matches, regenerate matches, reorder matches, manual score override
Add team, delete team (with BYE flow), edit seed, toggle check-in
Email work links, copy score link per match


Pool summary cards collapse/expand correctly
Team roster collapses/expands correctly, default state is correct based on pool existence
Forfeit flow: delete a team mid-tournament, verify all their future matches get appropriate forfeit scores, verify standings update, verify completed matches remain untouched
Withdrawn teams don't appear in active standings or default roster view
"Show withdrawn teams" toggle reveals them in roster


Do not build yet. First confirm:

Your approach to handling the case where a team is withdrawn and they were the work team for a future match — how you'll surface this so admin knows to manually reassign or accept the unfilled work slot
The URL structure — do you prefer /admin/tournament/[id] or keeping everything at /admin with tournament selection via tab/dropdown? My take: individual routes are cleaner for deep-linking and mobile back-button behavior
Whether the existing admin pool tabs from Phase 2e Polish stay (accessible separately for drill-down view) or get folded entirely into the new pool summary cards. My take: fold everything into the new cards, delete the old tabbed pool view — less surface area to maintain
How you'll handle withdrawn team display in the match table — if a completed match had the withdrawn team in it, do you mark the team name visually (strikethrough? small "(withdrawn)" tag?) or display normally? My take: small "(withdrawn)" tag next to the team name, nothing else
Whether the Tournament Info dropdown in the toolbar should expose any inline editing (e.g., change format) or be purely read-only. My take: purely read-only — tournament config is JSON-based and requires redeploy to change
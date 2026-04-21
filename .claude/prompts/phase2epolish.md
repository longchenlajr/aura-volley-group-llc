Claude Code Prompt — Phase 2e Polish: Records, Mobile Pool Tabs, Authenticated Score Links

Four additions to the existing Phase 2e Live view and admin: expose team records/point differentials in both admin and Live, restructure the Live page with a mobile-friendly tabbed pool folder structure, add a tournament overview as the default landing state, and enable email-authenticated score submission for work teams who may not have their original email link.

1. Team record and point differential display
On admin tournament dashboard:
Extend the team table. Add two new columns (desktop; collapse into the expandable row details on mobile):

Record: "W-L" format, live current record (wins-losses) for this tournament
Pt Diff: "+12" or "-5" with sign

Data source: computed from match_sets for the tournament. A team's wins/losses and point differential come from completed matches only — in-progress matches don't count.
The admin table should re-fetch this data when the match data is refreshed. Use the existing match fetch pipeline — no new endpoint needed, just expose more computed fields.
On Live page team cards:
Each team appearing in the standings and in pool view rows gets inline record and pt diff displayed:

Small text beneath the team name: "3-0 · +18"
Styled using the tracked small caps pattern, crimson for the record and ink-muted for the differential

Both admin and Live record data must be live — updates after every completed match.

2. Mobile-first tabbed pool folder structure
Complete restructure of the Live page main content area.
Default landing view — "Tournament overview"
When a user lands on a selected tournament in Live status, the default view (no tab selected) is a "Tournament overview" page that shows:

"Now playing" strip — in-progress matches across all pools and courts (same as Phase 2e specs)
Pool summary tiles — a grid of compact cards, one per pool:

Pool label and court number: "Pool A · Court 1"
Brief standings preview: top team + record, runner-up + record
Match progress: "3 of 6 complete"
Tappable — opens that pool's detailed view


Recent results — last 3-5 completed matches across all pools

This is the mobile-friendly default. No horizontal scrolling required.
Tab navigation structure:
Below the tournament header, a horizontal scrollable tab bar appears with:

"Overview" (default active)
"Pool A · Court 1"
"Pool B · Court 2"
etc.

Each tab is a pill button with tracked small caps label. Active tab gets crimson background + parchment text. Inactive tabs get parchment-white with ink text.
On mobile, the tab bar horizontally scrolls if there are more tabs than fit on screen.
Pool view (when a pool tab is selected):
When a user taps "Pool A · Court 1" (or similar):

Pool header card at the top:

Pool label + court number
Total teams in pool, match count (e.g., "4 teams · 6 matches · 3 complete")


Pool standings section:

Each team as a row/card with seed position, team name, record (W-L), sets (sets won - sets lost), point differential
Sorted by standings rules (matches won → head-to-head if 2-way tie → sets won → pt diff → points for → seed)
Top team gets gold accent, 2nd gets crimson accent


Matches section:

All matches for this pool, in order of match_order
Each match row shows:

Match number (e.g. "Match 3")
Team A name vs Team B name
If complete: final set scores displayed with winner marked
If in progress: current set scores shown with a "Live" badge, pulsing subtly
If scheduled: shows "Not yet played" with scheduled placeholder
Work team displayed below each match row with the note "Scorekeeper"
If user has authenticated as part of the working team (see section 4), a "Submit scores" button appears — otherwise no button is visible to the public





Overall tournament-level data still accessible:
When a pool tab is selected, the user can swipe back to Overview by tapping the Overview tab. A small "breadcrumb" element at the top of the pool view says "← Overview" as a discoverability aid.
Desktop behavior:
On desktop (≥1024px), the tabs still appear but the layout takes advantage of width:

Left sidebar: tab list stacked vertically
Right main content: the selected pool's view
If Overview is selected on desktop: full-width Overview view with grid of pool summary tiles

On tablet (768-1023px), use the mobile tabs-on-top layout — don't try to fit sidebar.

3. Email-authenticated score submission for publicly-visible matches
Currently score submission uses a token URL. Working teams get the token via email. If a team can't find the email on tournament day, they have no path to submit scores without going to admin.
New flow:
On the public Live page pool view, each match row that is currently in-progress or scheduled shows a small "Submit scores" button visible to everyone.
When tapped, a modal appears:

Title: "Verify you're the scorekeeper"
Subtitle: "Enter the email of any player on [Work Team Name]"
Email input
Submit button: "Verify"
Cancel button

On submit, POST /api/public/score-link/verify:

Body: { match_id: string, email: string }
Looks up the match's work team
Checks if the email matches any player in the players table associated with that work team
If match: returns { token: "XYZ..." } — the match's token for score submission
If no match: returns 403 with "That email doesn't match a player on the working team. Please check with an admin."
Rate limit: 5 verification attempts per IP per match per hour (prevents brute forcing)

On successful verification, redirect the browser to /longvolleyball/score/[token] — the existing score submission page. All existing Phase 2d logic applies from there.
Security notes:

The token itself remains the ultimate authentication — even if someone guesses a player email, they still can't submit a score unless the correct token is returned
Brute-forcing player emails is mitigated by rate limiting
The public "Submit scores" button is only visible if the match has a work team assigned
Admin-visible score link copy (from Phase 2d) still works unchanged — this is the public alternative flow, not a replacement

Add the verification modal component: src/app/(tournament)/longvolleyball/live/ScoreLinkModal.tsx.
Create the endpoint: src/app/api/public/score-link/verify/route.ts.

4. Admin tournament dashboard restructure to mirror Live
Update the admin tournament dashboard to adopt the same tabbed pool structure as the Live page, with admin controls layered in.
Default view: Tournament overview — team list (existing admin table), seed management, check-in toggles. This matches today's admin experience.
Pool tabs: When pools are generated, a "Pools" tab or dropdown appears. Clicking into a specific pool shows:

Pool-specific standings with records and point differential
Match list with all admin controls (reorder arrows, work team swap, manual score entry, copy score link, regenerate token)
All existing admin actions stay, just scoped to this pool

This structure makes the admin interface tournament-day-friendly — admins can focus on one pool at a time when running a specific court.
Keep the existing master admin view: Everything that works today (add team, remove team, regenerate pools, regenerate matches, email work links) stays accessible from the tournament overview level. The pool tabs are an additional navigation layer, not a replacement.

5. Files to create/modify
New files:

src/lib/team-stats.ts — compute team record and point differential from matches
src/app/(tournament)/longvolleyball/live/PoolTabs.tsx — the tab navigation component
src/app/(tournament)/longvolleyball/live/PoolView.tsx — pool detail view (standings + matches)
src/app/(tournament)/longvolleyball/live/TournamentOverview.tsx — default overview landing
src/app/(tournament)/longvolleyball/live/ScoreLinkModal.tsx — email verification modal
src/app/api/public/score-link/verify/route.ts — email verification endpoint

Modified files:

src/app/(tournament)/longvolleyball/live/page.tsx — wires in tabs, routes to overview/pool views
src/app/admin/page.tsx — adds pool tab structure, records/pt diff columns
src/app/(tournament)/tournament.css — new tab styles, pool view layout
src/app/admin/admin.css — records/pt diff columns, pool tab styles in admin


6. Performance
The Live page now makes two additional queries on pool tab selection (pool standings, pool matches). Both can use the existing /api/public/standings and /api/public/live-matches endpoints — filter client-side by pool_id rather than making per-pool endpoint calls. Same data load, same polling, no extra DB load.

7. Verify

npm run build passes
Mobile (375px viewport): tabs scroll horizontally, pool view renders cleanly, all interactions work with thumb
Tablet (768px): tabs on top, full-width content below
Desktop (1024px+): sidebar tabs, main content on right
Team records show live and update after match completion
Point differential calculation matches manual verification on a sample tournament
Email verification modal validates correctly, rate-limits repeated attempts
Admin pool tabs preserve all existing admin actions within the new structure
Existing token-email flow (original score link from email) still works — nothing from Phase 2d should break
"Submit scores" public button doesn't appear on matches without a work team assigned


Do not build yet. First confirm:

Your approach to rate limiting the email verification — in-memory map or something more robust? In-memory is fine for this, but confirm the 5-attempts-per-IP-per-match-per-hour logic and how you'll key the limiter
How you'll handle desktop vs mobile tab rendering differences — single component with conditional styling, or two separate layouts?
The tournament overview's "Pool summary tile" — how dense do you want the information? Top team + record is specced; should runner-up also show, or keep it minimal?
Whether the email verification modal should remember the email in localStorage so returning users don't re-enter it (on the same match). My take: don't remember — low friction to re-enter, and it prevents confusion if multiple people on the same phone use it
How the admin pool tab view handles the "regenerate matches" action — should it be scoped per-pool (regenerate just this pool) or stay tournament-wide (regenerate all pools)? My take: keep it tournament-wide to prevent inconsistent states. Admin can regenerate from the overview level only.


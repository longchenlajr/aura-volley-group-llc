Do not write any code for this task. This is a read-only audit + planning exercise. I need a clear picture of where the Long Volleyball project stands and what's needed next.

Part 1 — Launch readiness audit
Walk through the entire public-facing registrant flow and report on:
A. The landing page (/longvolleyball)

What content is currently displayed
Which tournaments from tournaments.json populate correctly
Any placeholder or lorem-ipsum copy that still needs to be replaced
Any broken links, images, or assets
Mobile responsiveness state

B. The registration flow (/longvolleyball/register)

Is the form fully functional end-to-end — does submitting actually write to Supabase?
What validation exists (required fields, email format, etc.)
What happens on success and error states
Does the captain email → team contact_email logic work correctly
Does teamSize from tournaments.json correctly drive the number of player fields (verify for doubles=2 and triples=3 specifically, since those are our actual formats)
Confirmation state: what does the user see after submitting?

C. The admin dashboard (/admin)

Authentication: is ADMIN_PASSWORD + NextAuth working correctly?
What admin sees upon login
Registration data flow — are registered teams appearing in the admin table?
Inline editing (seed, checked_in) — does it persist to Supabase?
Manual add team — does it work?
Delete team — does it work with cascade to players?
Pool generation — what exists in the admin currently? Describe what it does, what inputs it takes, and whether it's functional or WIP
Any admin surfaces that are half-implemented or bug-prone

D. Domain + routing

Does longvolleyball.com correctly rewrite to serve the tournament pages?
Does auravolley.com/admin correctly route to admin (not tournament)?
SSL, DNS — any flags

E. Data layer

Supabase tables currently deployed: which ones, what columns, what RLS policies
Any migrations not yet applied
Any schema that was designed but not yet executed


Part 2 — Pre-launch blockers
Based on the audit, produce a prioritized list of things that must be done before public registration launch. Categorize as:

Critical (blocks launch) — broken functionality, missing error handling, security concerns, data integrity issues
Important (should fix before launch) — polish, copy, obvious UX gaps, missing confirmation emails
Nice-to-have (post-launch) — enhancements, optimizations, secondary features

For each item, include: what it is, why it matters, and a rough effort estimate (trivial / small / medium / large).
Specifically verify:

Is there any confirmation email sent to the captain after registration? If not, note this as a gap — Resend is already in the stack
Is there any rate-limiting or spam protection on the public registration endpoint?
If two teams submit with the exact same team_name for the same tournament, what happens?
What if the tournaments.json file has a tournament that's already passed — does it still show in the public list?
What if someone navigates to /longvolleyball/register?tournament=nonexistent-id?


Part 3 — Live feature scoping
Scope out the new "Live" feature (/live). Do not build. Provide the implementation plan.
Overview:
A new section of the tournament site where registrants and spectators can view live tournament state — pool assignments, current scores, standings. Distinct from /admin which is the behind-the-scenes control surface.
Specific requirements to plan for:

New navigation item: Add "Live" as a fourth item in the tournament header, next to "Records." 
Page structure (/longvolleyball/live). also needs to accomodate rerouting in production to longvolleyball.com/live:

Reuse the existing tournament date selector component from the landing page
Each date pill gets a status tag: "Upcoming," "Live," or "Archive" — calculated from the tournament date relative to today
Tag colors: Upcoming (gold outline), Live (crimson solid, with a subtle pulse animation), Archive (ink-muted outline)
When a date is selected, show the relevant view:

Upcoming → registered team list, pool assignments if generated, count of teams, days-until-event
Live → live pool standings, current matches in progress with scores, upcoming matches queue
Archive → final standings, bracket results, tournament summary




Pool management completion in admin:

The current pool generation flow exists but lacks the ability to swap teams between pools. Plan the UI and backend for this: drag-and-drop? explicit swap buttons? what's cleanest?
Once pools are locked in, generate matches for each pool (round-robin based on pool size)
Work team assignment per match (the team not playing)


Database schema for match tracking:
Propose a complete schema with tables, columns, types, relationships, and RLS policies. Cover at minimum:

pools — tournament_id, pool_label (A/B/C), created_at
pool_teams — pool_id, team_id (junction)
matches — pool_id OR bracket_round, team_a_id, team_b_id, working_team_id, court_number, match_order, status (scheduled/in_progress/complete), start_time, end_time
match_scores — match_id, set_number, team_a_score, team_b_score (or decide if sets are needed vs single score)
score_submissions — match_id, submitted_by_team_id, submitted_at, confirmed (for the confirm-score flow if we go that route)

Key schema questions to answer in the plan:

Do we track sets or just a single final score per match?
How do we handle serve possession in live view — is this useful to track, or too granular?
Do we need a separate standings table or compute standings on-the-fly from matches?


Score submission flow (to be built later but planned now):

Working team receives a unique token link per match they're assigned to work
They tap the link, see the two teams playing and input score fields
On submit, standings recompute, live view updates
Tokens must be single-use or re-editable within a time window — propose a recommendation


Live view visual design:

The Live page should feel like a scoreboard — bold, readable at a distance, quick scanning
Pool standings as large cards showing team name, W/L record, point differential
Matches in progress prominently displayed with live-updating scores (polling every 10-15s is fine — no WebSockets needed at this scale)
Propose the component layout and hierarchy for the Live page


Phased build order for Live feature:
Break the Live feature into a sequence of shippable sub-phases, smallest-first. Something like:

Phase 2a: Add /live route, nav item, date selector with status tags — no data yet
Phase 2b: Schema migration for pools/matches, pool generation completed in admin, pool swap UI
Phase 2c: Match generation + work assignment logic
Phase 2d: Score submission via token links
Phase 2e: Live view reads match/score data and displays it
Phase 2f: Archive view for past tournaments




Deliverable format:
Structured markdown report with clear section headers matching the three parts above. Each finding or recommendation should be concrete enough that I can act on it or turn it into a Claude Code prompt directly.
Do not write code. Do not make changes. Only audit and plan.
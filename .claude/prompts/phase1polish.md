Claude Code Prompt — Pre-Launch Polish Pass
Apply the following fixes in this order. These are the remaining pre-launch blockers before we open public registration.
1. Delete unused hero asset
Remove public/longvolleyball/hero.png. It's no longer referenced in the codebase. Verify no imports remain.
2. Fix invalid date in records data
Find the hardcoded record with date "9/31/24" and change it to "9/30/24". September has 30 days.
3. Past-date filtering on tournament list
In src/lib/tournaments.ts, add a helper getUpcomingTournaments() that returns tournaments where new Date(tournament.date) > new Date(). Use this in:

The landing page (/longvolleyball) tournament list and date selector
The registration page (/longvolleyball/register) dropdown
Tournaments that have passed should not appear in public-facing lists. Admin dashboard should still show all tournaments including past ones (admin needs historical access).

4. Unique constraint on team names per tournament
Create supabase/migrations/003_unique_team_name.sql that adds a unique constraint on (tournament_id, team_name) in the teams table.
In src/app/api/register/route.ts, catch the Postgres unique constraint violation error (23505) and return a friendly 409 response: "A team with that name is already registered for this tournament. Please choose a different team name."
Display this error clearly in the registration form error state.
5. Rate limiting on /api/register
Add simple in-memory rate limiting keyed by IP: max 5 registration attempts per 10 minutes per IP. Use a Map in module scope with expiring entries. If limit hit, return 429 with "Too many registration attempts. Please try again in a few minutes." This is coarse but sufficient for current scale.
6. Phone validation
In the registration form and server handler, validate phone as 10 digits (strip non-digits first, then check /^\d{10}$/). Store in E.164-style format +1XXXXXXXXXX. Show inline form error if invalid.
7. Registration confirmation email via Resend
After successful registration in /api/register, send an email to the captain's email address using the Resend API.
Email contents:

Subject: "You're registered — [Tournament Name], [Date]"
From: "The Long's Grass Volleyball <hello@longvolleyball.com>" (requires Resend domain to be verified — fall back to "hello@[resend-test-domain]" if not yet verified)
HTML body using a simple parchment-themed inline-styled email template:

Fraunces-style serif heading (system serif fallback since web fonts are unreliable in email): "You're registered."
Tournament name, date (formatted like "Saturday, June 21, 2026"), location
Team name
Full player roster with names and emails
Entry fee reminder: "$25 per player, due at check-in on tournament day"
Small note: "We'll send another email with tournament details the week of the event."
Footer: "The Long Family · longvolleyball.com"


Plain text version included alongside HTML

Email sending failure should NOT fail the registration — wrap the Resend call in try/catch, log the error, and still return success. The registration in the database is the source of truth.
8. Delete the "hero.png" dead file
(If not done in step 1, confirm.)

Do not build yet. First walk me through:

Your plan for each of the 7 items
Any interactions between them I should know about
Confirmation that the Resend domain is verified (if not, which test sending domain will you use and what's my path to switching once I verify?)


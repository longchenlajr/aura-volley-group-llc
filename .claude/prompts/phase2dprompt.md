Claude Code Prompt — Phase 2d: Score Submission via Token Links

Build the score submission flow for working teams. On tournament day, the team assigned to work each match receives a unique token link that lets them submit the final score. No account or login required — the token is the authentication.

1. Database migration
Create supabase/migrations/006_scores_and_tokens.sql:
sql-- Match scores
create table match_scores (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  team_a_score integer not null check (team_a_score >= 0),
  team_b_score integer not null check (team_b_score >= 0),
  submitted_by text not null check (submitted_by in ('work_team', 'admin')),
  submitted_by_team_id uuid references teams(id) on delete set null,
  submitted_at timestamptz not null default now(),
  
  constraint match_scores_match_unique unique (match_id)
);

-- Score submission tokens (one per match per working team assignment)
create table match_tokens (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_used_at timestamptz,
  
  constraint match_tokens_match_unique unique (match_id)
);

create index match_scores_match_idx on match_scores(match_id);
create index match_tokens_token_idx on match_tokens(token);
create index match_tokens_match_idx on match_tokens(match_id);

alter table match_scores enable row level security;
alter table match_tokens enable row level security;

-- Public read on scores for Live view
create policy "match_scores_anon_select" on match_scores for select to anon using (true);

-- No anon access to tokens — they're validated server-side only via service role
-- (RLS enabled but no anon policies means anon cannot read the table)
Key design choices:

One token per match (match_tokens_match_unique) — if the work team changes, the token stays with the match but who gets the link changes
One score per match (match_scores_match_unique) — submitting again replaces via upsert
Tokens expire to prevent use after tournament ends
last_used_at tracks when a token was first used for the 10-minute re-edit window


2. Token generation utility
Create src/lib/tokens.ts:
typescriptexport function generateMatchToken(): string {
  // 12-character alphanumeric, URL-safe, no ambiguous characters (no 0/O, 1/l/I)
  // Example: "X7K3M9P2Q5RT"
  // Use crypto.randomBytes for security
}

export function tokenExpiryForTournament(tournamentDate: string): Date {
  // Returns 11:59 PM ET on the tournament date
  // Ensures tokens can't be reused after the tournament ends
}
Use Node's crypto.randomBytes for the random string. 12 characters from a 32-character safe alphabet gives ~60 bits of entropy — more than enough for a single-day tournament.

3. Token lifecycle — admin actions
Update Phase 2c's match generation to also create tokens:
When POST /api/admin/matches generates matches for all pools, immediately create one match_tokens row per match with:

token: freshly generated
expires_at: 11:59 PM ET on the tournament date

Tokens are created once, paired with the match, and don't regenerate unless explicitly refreshed.
When matches are regenerated (DELETE + POST), tokens cascade-delete with the old matches and fresh tokens are created with the new matches.
Add a new admin endpoint POST /api/admin/matches/[id]/refresh-token:

Regenerates the token for a single match (if a work team complains their link isn't working, or to invalidate a leaked token)
Returns the new token
Requires admin session


4. Score submission API
Create src/app/api/score/[token]/route.ts:
GET /api/score/[token] — fetches the match details for the score submission page. Public endpoint, uses service role client internally to look up the match via token.
Response shape:
typescript{
  match: {
    id: string;
    pool_label: string;
    court_number: number;
    match_order: number;
    team_a: { id: string; team_name: string };
    team_b: { id: string; team_name: string };
    work_team: { id: string; team_name: string } | null;
    status: "scheduled" | "in_progress" | "complete";
  };
  existing_score: { team_a_score: number; team_b_score: number } | null;
  token_valid: boolean;
  token_editable: boolean;  // true if within 10-min re-edit window or unsubmitted
  reason?: string;  // "expired", "not_found" if token_valid is false
}
Logic:

Look up token. If not found, return { token_valid: false, reason: "not_found" }
If expired (current time > expires_at), return { token_valid: false, reason: "expired" }
Fetch match + team data
Fetch existing score if present
Determine token_editable:

Always true if no score submitted yet
True if score submitted within last 10 minutes
False if submitted > 10 minutes ago (admin-only edits after that)


Update last_used_at on the token to track first use

POST /api/score/[token] — submits or updates the score.
Body:
typescript{
  team_a_score: number;
  team_b_score: number;
}
Logic:

Validate token (exists, not expired)
If token_editable is false (score submitted > 10 min ago), return 403 with "This match's score can no longer be edited. Please ask an admin."
Validate scores: both ≥ 0, at least one > 0 (no 0-0 final scores), no absurd values (cap at 30 per side as a sanity check — volleyball games to 21 or 25)
Upsert into match_scores with submitted_by: 'work_team' and submitted_by_team_id: match.work_team_id
Update match status:

If score is a completed game (one team has 21+ or 25+ with 2-point lead), set status: 'complete' and end_time: now()
Otherwise set status: 'in_progress'


Return updated state

Rate limit: 10 submissions per token per minute (prevents accidental repeated taps). In-memory Map keyed by token, same pattern as /api/register.

5. Score submission page
Create src/app/(tournament)/longvolleyball/score/[token]/page.tsx.
This page is its own branded surface — simplified, big, readable on a phone held by someone on the sidelines in bright sun.
Layout:
The page does NOT use the standard tournament header (no nav bar, no monogram + wordmark). Instead a compact branded strip at the top:

Parchment background
Small monogram on the left (clickable → /longvolleyball but subtly styled, not encouraging navigation away)
Center: "Score submission" in Fraunces 500, 15px
Nothing on the right

Page content wrapped in .lv-container:
Top card — match context:

Pool label + court number as a header: "Pool A · Court 1"
Fraunces heading: match order label ("Match 3 of 6" or similar)
Below: teams displayed prominently

Teams and score inputs:
Large side-by-side layout on desktop, stacked on mobile. Each team gets its own card:
Team card:

Parchment-white background
Team name in Fraunces 700, 22px, ink
Large score input — a single number input, 60px tall, 60px wide, font-size 32px, centered text, bold
Plus/minus buttons above and below the input for easy tapping on a phone (10px spacing): Plus button adds 1, minus button subtracts 1, disabled at 0
Visually distinct cards — Team A has a thin crimson accent border on the left, Team B has thin gold accent border on the right

Between the two team cards: a centered "vs" label in Fraunces 500, ink-muted, 18px.
Below the team cards:
Work team attestation:

Small ink-muted line: "You're working this match for [Pool A]."
If match has a work team assigned: "Submitted by: [Work Team Name]"
If not: generic "Score submitter"

Action buttons:

Primary button: "Submit score" (crimson, full-width on mobile, auto-width centered on desktop)
If score was already submitted and is editable: button text changes to "Update score" and shows a timer: "Editable for X more minutes"
Ghost button below: "View tournament live" → links to /longvolleyball/live

States:
Initial state (no score yet):

Both score inputs at 0
Submit button active when at least one score > 0

Submitted state (within 10 min edit window):

Score pre-populated from existing submission
Submit button says "Update score" with live timer: "Editable for 7:23 more"
Timer counts down visibly every second
After timer hits 0, all inputs lock and button becomes disabled with text "Score locked — contact admin"

Locked state (after 10 min):

Inputs disabled, styled with reduced opacity
Submit button disabled, text: "Score locked"
Small line below: "Need to fix this score? Find an admin on site."

Invalid token state:

Centered card with a decorative cloud ornament
Fraunces heading: "This link isn't valid"
Subtext explains: expired (past tournament date) or not found (wrong URL)
Button: "Go to tournament home" → links to /longvolleyball

Mobile optimization:

Entire page optimized for one-handed phone use
Score inputs large enough to tap accurately with thumb
Keyboard auto-shows numeric keypad (inputMode="numeric")
No small tap targets — buttons 44px minimum


6. Admin — view tokens and score status
Update the admin match view from Phase 2c to include per-match:

Score column: if submitted, show "14 – 21" style. If not, show "—"
Token actions dropdown: small icon button that opens a menu with:

Copy score link → copies https://longvolleyball.com/longvolleyball/score/[token] to clipboard
Regenerate token → confirms and calls the refresh endpoint, shows the new link
Manually enter score → opens a modal where admin can enter the score directly, bypassing the 10-minute window


Status column from Phase 2c continues to update based on score submission

Admin score entry modal:

Same score input UX as the submission page (simplified)
Submits via PATCH /api/admin/matches/[id]/score (new endpoint)
Marks submitted_by: 'admin'
Not subject to the 10-minute re-edit lock (admin can always edit)

Create src/app/api/admin/matches/[id]/score/route.ts:

PUT /api/admin/matches/[id]/score — body { team_a_score, team_b_score }, upserts score with admin provenance
DELETE /api/admin/matches/[id]/score — clears the score (edge case: admin realizes wrong score was submitted)

Requires admin session.

7. Email work links when matches are generated
When matches are generated (POST /api/admin/matches) and work teams are assigned, send an email to each work team's captain with their match links.
Use Resend from info@longvolleyball.com (per the address setup established earlier):
Email content per working team:

Subject: "Your match work assignments — [Tournament Name]"
HTML body using the same parchment-themed inline template as the registration email
Greeting to the team captain by name
"You're assigned to work these matches on [tournament date]:"
For each match they work:

Match number, pool label, court number
"Team A vs Team B"
Score submission link: https://longvolleyball.com/longvolleyball/score/[token]
Formatted clearly, each match in its own bordered box


Footer explanation: "You'll input the final score after each match using the link above. The link only works on tournament day. Questions? Reply to this email."

Send from: "The Long's <info@longvolleyball.com>" with reply-to info@longvolleyball.com.
Wrap in try/catch — email failures don't block match generation. Log failures to Vercel logs with [RESEND] prefix including recipient address.
Add an admin action to resend work emails on demand:

Button on the admin tournament view: "Email work links to all teams"
Opens a confirmation modal: "Send work assignment emails to all X teams?"
Hits POST /api/admin/matches/email-work-links which re-sends all work emails
Useful if a captain deletes their email or wants a fresh copy

Create src/app/api/admin/matches/email-work-links/route.ts.

8. Score submission page — small ceremony for completion
When a score submission marks a match as complete (volleyball scoring rules: first to 21 or 25 with 2-point lead), the UI celebrates subtly:

On successful submit, show a brief 2-second overlay:

Centered on the page over a parchment backdrop
Decorative divider ornament (from Phase 2a) in gold
Fraunces heading: "Score submitted"
Winner's team name below: "Sand Slingers wins"
Auto-dismisses after 2 seconds


Then reveals the updated state (button says "Update score", timer starts)

This is the only animated "moment" in the entire flow — everything else stays functional and quick.

9. Score formatting helper
Create src/lib/score-format.ts:
typescriptexport function isMatchComplete(teamAScore: number, teamBScore: number): boolean {
  // Volleyball: first to 21 OR 25 (depending on format — let's default to 21 for grass tournaments)
  // with at least a 2-point lead
  // Return true if match is complete
}

export function matchWinner(teamAScore: number, teamBScore: number): "team_a" | "team_b" | null {
  // Returns the winner, or null if match not complete
}

export function formatScore(teamAScore: number, teamBScore: number): string {
  // Returns "21 – 14" style string
}
Use throughout both the score submission page and admin views.

10. Verify

npm run build passes
Migration 006 runs cleanly
Tokens generated on match creation match the match count 1:1
/longvolleyball/score/[token] loads for a valid token, shows teams and score inputs
Score submission writes to match_scores correctly with submitted_by: 'work_team'
Match status updates to in_progress or complete based on score
10-minute re-edit window works correctly — within window allows edits, outside window locks
Admin can override any score via the admin modal
Admin can regenerate a token and the old token stops working
Work link email sends successfully when matches are generated
Invalid/expired tokens show the correct error UI
Score submission page works well on a phone (large tap targets, numeric keypad)


Do not build yet. First confirm:

Your handling of concurrent submissions — what happens if two devices submit scores for the same match at the same time (rare but possible). Propose a strategy — last-write-wins with a timestamp check?
Your plan for the "match complete" logic — is the 21-point, win-by-2 rule the right default, or should it be configurable per tournament in the JSON config?
How you'll handle the case where work team was reassigned AFTER emails were already sent — the new work team doesn't have the link. Should the admin workflow auto-send a fresh email when work team changes, or rely on manual resend?
Whether the score submission page should have any authentication beyond the token — e.g., requiring the captain email as a second factor. My take: token is enough, don't add friction, but confirm this matches your expectation.
Mobile layout for the score submission page — how you'll ensure the number input behaves well on iOS Safari specifically (it sometimes has quirky behavior with type="number").
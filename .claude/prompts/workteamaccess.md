Claude Code Prompt — Work Team Access Unification

Close the four gaps identified in the audit. Unify work team score link access across pool and bracket matches through a single consistent flow.

1. Add "Email work links" button to admin tournament dashboard
The API endpoint /api/admin/matches/email-work-links already exists and handles both pool and bracket work assignments. What's missing is the admin button to trigger it.
Add a button to the admin tournament dashboard, positioned in the tournament overview level (not inside pool or bracket tabs — it's a tournament-wide action):

Label: "Email work links to all teams"
Style: secondary gold-outline button (matches the existing "Create pools" / "Generate matches" button family)
Placement: in a toolbar row near the top of the tournament view, alongside existing tournament-level actions
On click: opens a confirmation modal

Title: "Send work assignment emails?"
Body: "This will send match score link emails to all teams assigned to work matches in this tournament. Pool matches and bracket matches (if generated) are both included."
If both pool matches and brackets exist: "This includes [X] pool matches and [Y] bracket matches across [Z] teams."
If only pool matches exist: "[X] pool matches across [Z] teams."
Buttons: Ghost "Cancel" + Primary crimson "Send emails"


On confirm:

Calls POST /api/admin/matches/email-work-links
Shows loading state: "Sending..."
On success: toast or inline message: "Emails sent to [N] teams"
On error: inline error with the returned message


Button is disabled if no matches exist yet (neither pool nor bracket)

Make this action repeatable — admin can click it multiple times throughout the day (e.g., after reassigning a work team) without issue.

2. Wire up the ScoreLinkModal on pool match cards
ScoreLinkModal.tsx is already built, imported in PoolView.tsx, but never triggered. The modal state scoreLinkMatch exists but no onClick handler ever sets it.
Fix:

On each pool match row in PoolView.tsx, add a "Submit scores" button that calls setScoreLinkMatch(match)
Button visibility rules:

Show if match status is scheduled OR in_progress
Show only if match has a work_team_id assigned (no work team = no one to authenticate as)
Hide if match status is complete (score already submitted; admin overrides if wrong)


Button styling: secondary gold-outline, small size, text "Submit scores" with a small right-arrow icon
Placement: at the end of the match row, next to the work team label or below it on mobile

When the button is clicked, the existing modal opens with the match context, user enters an email, the verify endpoint is called, and on success they're redirected to /longvolleyball/score/[token].

3. Extend the verify endpoint to support bracket matches
src/app/api/public/score-link/verify/route.ts currently only looks up pool matches. Extend it to handle bracket matches too.
Update the endpoint to accept either match type:
typescriptPOST /api/public/score-link/verify
Body: {
  match_id: string,
  match_type: "pool" | "bracket",
  email: string
}
Logic:

If match_type === "pool":

Look up matches table by id to find work_team_id
Look up players on work team, check email match
Return token from match_tokens if verified


If match_type === "bracket":

Look up bracket_matches table by id to find work_team_id
Look up players on work team, check email match
Return token from bracket_match_tokens if verified


Return 400 if match_type is invalid
Return 403 if email doesn't match any player on the work team
Return 404 if match not found in the specified table
Rate limit: 5 attempts per IP per match per hour (match_id + match_type as composite key)

The response should include the score submission URL path:

Pool: /longvolleyball/score/[token]
Bracket: /longvolleyball/bracket-score/[token]

So the client can redirect correctly without knowing which token format to use.

4. Update ScoreLinkModal to handle both match types
The modal currently passes a pool match to the verify endpoint. Update it to accept a match_type prop:
typescriptinterface ScoreLinkModalProps {
  match: PoolMatch | BracketMatch;
  match_type: "pool" | "bracket";
  onClose: () => void;
}
Internal logic: passes match_type to the verify endpoint. Uses the returned redirect URL to navigate to either the pool or bracket score submission page.

5. Expose "Submit scores" button in bracket view (public Live page)
Phase 2f.3 built the bracket view on the Live page. Extend it to surface score submission access on bracket match cards.
In the bracket view (both desktop tree and mobile vertical rounds):

Each bracket match card shows a "Submit scores" button
Visibility rules: same as pool matches (scheduled/in_progress AND work team assigned)
Tapping opens the same ScoreLinkModal but with match_type="bracket"
After verification, redirects to /longvolleyball/bracket-score/[token]


6. Add "Copy score link" button to admin bracket match rows
Parallel to the existing clipboard button on pool match admin rows, add the same to bracket match rows in the admin bracket view.

Icon button on each bracket match row
On click: copies the bracket score URL https://longvolleyball.com/longvolleyball/bracket-score/[token] to clipboard
Shows brief "Copied!" tooltip
Same UX as the existing pool match copy button

Also add: "Regenerate token" admin action on bracket match rows (parallel to the pool match regenerate token — invalidates old link, generates new one).
Create the endpoint if not already built: POST /api/admin/brackets/[match_id]/refresh-token.

7. Unified component pattern
Since pool and bracket match cards now share the same "Submit scores" interaction, extract a shared component:
typescript// src/app/(tournament)/longvolleyball/live/SubmitScoresButton.tsx

interface SubmitScoresButtonProps {
  match_id: string;
  match_type: "pool" | "bracket";
  work_team_name: string;
  status: "scheduled" | "in_progress" | "complete";
  has_work_team: boolean;
  onOpenModal: (match_type: "pool" | "bracket", match_id: string, work_team_name: string) => void;
}
This component handles visibility rules and the click handler. Both PoolView and BracketView use it.
Same extraction for the ScoreLinkModal — it now accepts the unified input shape and handles both types internally.

8. Optional: "My matches today" helper
Low-priority but nice for tournament day. After a user successfully verifies their email once (on any match), store the verified email in sessionStorage with a key like lv_verified_email. Expires at end of day.
On subsequent pool/bracket match interactions, if the email matches a player on the work team, skip the modal entirely and redirect directly to the score submission page. Adds significant QoL for someone scoring multiple matches throughout the day.
Optional: add a small "Your matches today" panel at the top of the Live page if a verified email exists — shows all matches that email is eligible to score, ranked by match_order / time.
If this feels like too much, skip it and flag for a future polish pass. Focus on the critical four fixes first.

9. Files to create/modify
New files:

src/app/(tournament)/longvolleyball/live/SubmitScoresButton.tsx — shared component

Modified files:

src/app/admin/page.tsx — add "Email work links to all teams" button + confirmation modal
src/app/(tournament)/longvolleyball/live/PoolView.tsx — wire up ScoreLinkModal with SubmitScoresButton
src/app/(tournament)/longvolleyball/live/BracketView.tsx (or wherever bracket view lives) — add SubmitScoresButton to match cards
src/app/(tournament)/longvolleyball/live/ScoreLinkModal.tsx — accept match_type, handle bracket lookup
src/app/api/public/score-link/verify/route.ts — extend to handle bracket_matches
src/app/admin/BracketView.tsx (or wherever admin bracket view lives) — add copy link + regenerate token per match

New endpoint (if not existing):

src/app/api/admin/brackets/[match_id]/refresh-token/route.ts


10. Verify

npm run build passes
Admin "Email work links" button sends emails successfully to all work teams (pool + bracket)
Confirmation modal shows correct counts before sending
Pool match "Submit scores" button appears on scheduled/in-progress matches with work teams
Pool match modal → email verify → redirect to /longvolleyball/score/[token] works end-to-end
Bracket match "Submit scores" button appears on scheduled/in-progress bracket matches with work teams
Bracket match modal → email verify → redirect to /longvolleyball/bracket-score/[token] works end-to-end
Rate limiting on verify endpoint works for both pool and bracket
Admin "Copy score link" and "Regenerate token" work on bracket match rows
Buttons correctly hide when work team not assigned or match is complete


Do not build yet. First confirm:

Your plan for the shared SubmitScoresButton component — specifically how you'll pass match data generically since pool matches and bracket matches have different fields
How the "Email work links" button handles partial failures — if 3 out of 10 emails fail to send, what does the admin see? (My take: show count of successes and count of failures, log failures with [RESEND] prefix as existing pattern)
Whether the optional "My matches today" session feature is in scope for this build or should be deferred — I'm fine either way; default to deferring unless it's trivial
How you'll avoid breaking the existing pool flow during the refactor — do all changes in a way that doesn't regress the current working pool score submission
Whether the bracket copy-link button already exists (I said parallel to the existing pool button) or needs to be built from scratch — check first
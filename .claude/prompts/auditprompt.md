Claude Code Prompt — Work Team Access Audit

Do not write code for this task. Read-only audit of how working teams currently access score submission pages across pool play and playoffs. Identify gaps, inconsistencies, and opportunities for improvement.

Part 1 — Current state audit
A. Pool match score submission
Trace the full lifecycle of a pool match score link:

When is the token generated? (Which endpoint, which conditions)
What happens to the token — is it emailed? To whom? From which address?
Where in the admin UI can admin copy or share the link?
Where (if anywhere) on the public Live page can a user access score submission for a match?
What authentication exists on the score submission page itself?
What authentication exists on the email verification endpoint (/api/public/score-link/verify)?
How does a work team find their score link if they lost the email?

Walk through each pool match token touchpoint from creation to submission. Note every file involved.
B. Bracket match score submission (post-2f.2)
If bracket match tokens exist yet, same trace for brackets:

When are bracket tokens generated?
Are they emailed? If so, when and to whom?
Is there a bracket equivalent of the public score-link/verify endpoint?
Where on the public Live page are bracket score links exposed (if anywhere)?
Where in the admin bracket view are score links accessible?

If brackets don't yet have this flow (Phase 2f.3 hasn't built it), document what's missing.
C. Email sends
Inventory all emails currently sent by the system:

Registration confirmation (from Phase 1 polish)
Work team assignment emails for pool matches
Work team assignment emails for bracket matches (if any)

For each: when is it sent, from what address, what content does it contain, does it include score submission links per match?
Identify: are there any score-link-bearing emails that currently don't get sent automatically when they should?
D. Public score link access patterns
Document the current public flow for a work team member who opens longvolleyball.com/live:

Can they find their assigned matches? Where?
Can they access the score submission page? How?
What's the user experience from landing on the site to actually submitting a score?
What's the fallback if the email didn't arrive or was deleted?

Be specific about clicks, scrolls, and friction points.
E. Authentication comparison
For each access pattern to the score submission page, document the auth model:

Direct token URL (from email): token is the auth
Public score link verification (via Live page): email verification unlocks token
Admin manual score entry: admin session bypasses tokens entirely

Identify any inconsistencies, security gaps, or confusing divergence between these paths.

Part 2 — Gaps and recommendations
Based on the audit, produce a prioritized list of issues and recommendations organized as:
Critical (prevents tournament day function)

Work teams who lose their email with no clear recovery path
Bracket work links not emailed or not accessible publicly
Inconsistent auth between pool and bracket score submission

Important (degrades tournament day experience)

Too many clicks to find the right match to score
No visual indicator on Live page that a match needs a score submitted
Bracket work links only accessible via admin copy-paste

Polish (can wait)

Confusing copy on verification modal
Score submission page lacks clear "You're scoring this match" confirmation
Missing error states


Part 3 — Proposed unified solution
Design a single coherent flow that works for both pool and bracket matches. Think through:

Where should work links be exposed on the public Live page?

Pool matches: currently in pool tab match rows (from Phase 2e Polish)
Bracket matches: new — likely on bracket match cards in the bracket view
Consider: should there be a dedicated "I'm a scorekeeper" entry point at the top of the Live page?


What's the unified authentication pattern?

Email verification works for both pool and bracket (same /api/public/score-link/verify endpoint, extended to cover both match types)
Token remains the ultimate authentication
Rate limiting covers both


What UI element signals "score me" on both pool and bracket views?

Propose a consistent button design, placement, and copy


Should there be a "My matches" helper?

After a user successfully authenticates via email once, offer "Show me all matches I'm working today" — display every match their team is assigned to work across pool and bracket play
Requires storing a short-lived session (sessionStorage keyed by verified email, expires end of day)
Optional feature but worth considering


Admin exposure for bracket work links

Bracket view in admin needs "Copy score link" per match (parallel to pool admin)
Bulk resend email for all bracket work assignments
Regenerate bracket token option




Part 4 — Implementation plan
Break the unified solution into concrete build steps. Estimate effort per step (trivial / small / medium / large). Identify dependencies between steps.
Do not implement. Only audit, analyze, and plan.
Deliver as a structured markdown report.
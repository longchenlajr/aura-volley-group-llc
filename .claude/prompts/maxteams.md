Claude Code Prompt — Remove maxTeams Cap Logic

I'm removing the maxTeams field from tournaments.json. Tournaments no longer have a hard team capacity. Update the codebase to handle this cleanly.
Changes needed:

src/lib/tournaments.ts

Update the Tournament TypeScript interface: make maxTeams optional (maxTeams?: number).


src/app/api/register/route.ts

Remove the capacity check that blocks registration when maxTeams is reached.
The endpoint should always accept valid registrations. If maxTeams is defined on a tournament, it's purely informational — not enforced.
Remove any "capacity reached" / "tournament full" error responses.


src/app/(tournament)/longvolleyball/register/page.tsx

Remove the "registration closed — capacity reached" UI state.
The only reason the form shows as closed is now registrationOpen: false in the config.
If the tournament has a maxTeams set, display it as informational copy ("~16 team target") but never block submission.


src/app/(tournament)/longvolleyball/page.tsx (landing page tournament cards)

Remove the "X / Y teams" display that showed current registrations vs max.
Replace with just the current registered team count — e.g. "12 teams registered" or "Registration open" if 0.
The "Registration closed" card state should only trigger from registrationOpen: false, not from a capacity cap.


src/app/admin/page.tsx

Remove the "X / Y teams" ratio pill next to the active tournament name.
Replace with a simple team count: "12 teams" or "12 registered".
No change to the add/remove team flow.


src/app/api/register/route.ts GET handler

If it currently returns capacity info, remove the capacity field from the response.
Keep the current registered count in the response since UI still uses it.



Verify:

Run the build — no type errors from maxTeams being optional.
Registration form and landing page render correctly when maxTeams is absent from a tournament config entry.
Admin dashboard shows team counts without breaking when maxTeams is missing.

Do not build yet. First list the files you'll touch and flag any code paths that still reference maxTeams that I didn't mention above.
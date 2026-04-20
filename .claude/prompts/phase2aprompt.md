Claude Code Prompt — Phase 2a: Live Feature Scaffold

Build the visible shell of the new Live feature. No backend data yet — just the route, navigation, and date selector with automatic status tagging. This gives registrants a place to return to and see upcoming/live/archive states per tournament.

1. Route + page creation
Create src/app/(tournament)/longvolleyball/live/page.tsx.
This page reuses the existing tournament date selector component and layout patterns from the landing page. Users land here from the nav and see:

Page header section inside .lv-container:

Tracked label "LIVE" in crimson
Display heading "Tournament live" in Fraunces 700
Subheading: "Standings, scores, and tournament updates." in ink-muted
<SectionDivider /> below


Date selector: same component pattern as the landing page, but enhanced to show status tags on each date pill (see Section 3)
Selected state placeholder content (real data comes in 2b–2f). Based on the selected tournament's status, render one of three placeholder views:
Upcoming placeholder:

Small decorative <SectionDivider />
Fraunces 600 heading: "This tournament hasn't started yet."
Ink-muted copy: "Check back on [tournament date] for live scores and standings. Pool assignments will appear here once registration closes and teams are seeded."
Below: a registered team count ("X teams registered so far") — fetch from existing /api/admin/teams?tournament=X via a new public-safe endpoint (see section 5)

Live placeholder:

Same structure but: "Live scoring coming soon."
Copy: "Live pool standings and current match scores will appear here on tournament day. This feature is being built — stay tuned."

Archive placeholder:

"Tournament archive coming soon."
Copy: "Final results, standings, and bracket winners from past tournaments will be shown here."



These placeholders are intentional — they set reader expectations while 2b–2f are built. Do not mock fake data.
Add export const dynamic = "force-dynamic" so date comparisons evaluate at request time.

2. Navigation updates
Update the tournament header component (lives in src/app/(tournament)/layout.tsx or wherever the header is currently rendered).
The header currently has a single "Register" link on the right. Expand to two links:

Layout: monogram left, center wordmark, right side has "Live" and "Register" as text links with 24px gap between them
Active link state: the current page's link gets a thin 1px crimson underline (2px offset from the text baseline)
Hover state on inactive: ink-muted text becomes ink, 160ms transition
On mobile (<768px): stack the two nav links horizontally on the right side with smaller spacing (12px gap), or if space is tight, collapse the center wordmark to monogram-only on mobile and keep nav links right-aligned

Update the admin header similarly if it exists as a separate component — but admin doesn't need the Live link (that's a public-facing feature).

3. Date selector enhancement — status tags
The existing tournament date picker on the landing page uses date pills that show month/day. On the Live page, each date pill must also display a status tag.
Status calculation logic (in src/lib/tournaments.ts):
typescriptexport type TournamentStatus = "upcoming" | "live" | "archive";

export function getTournamentStatus(tournamentDate: string): TournamentStatus {
  // All tournaments run on ET calendar days
  // Compare the tournament date (calendar day in ET) to today (calendar day in ET)
  // Return "live" if they're the same calendar day, "upcoming" if future, "archive" if past
  
  const etFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  
  const tournamentDay = etFormatter.format(new Date(tournamentDate));
  const todayInET = etFormatter.format(new Date());
  
  if (tournamentDay === todayInET) return "live";
  if (new Date(tournamentDate) > new Date()) return "upcoming";
  return "archive";
}
This ensures Live status lasts the full Eastern-timezone calendar day, regardless of the user's browser timezone.
Tag component to create at src/app/(tournament)/StatusTag.tsx:
tsxinterface StatusTagProps {
  status: "upcoming" | "live" | "archive";
}
Visual spec:

Upcoming: 1px gold border (rgba(155, 107, 30, 0.5)), transparent background, gold text (--lv-gold), text "Upcoming" (sentence case), letter-spacing 0.08em, 10px font, padding 3px 8px, border-radius full
Live: solid crimson background (--lv-red), parchment text, text "Live", same size spec, plus a subtle CSS pulse animation:

css  animation: lv-live-pulse 2s ease-in-out infinite;
  @keyframes lv-live-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

Archive: 1px ink-muted border, transparent background, ink-muted text, text "Archive", same size spec

Integration with the date picker:
The tag should appear on the date pill itself — positioned at the top of the pill, small, above the month/date text. Adjust the date pill layout:
┌────────────┐
│  Upcoming  │  ← status tag (small, top)
│    AUG     │  ← month abbrev
│     16     │  ← day number
│    Sun     │  ← weekday abbrev
└────────────┘
The Live status tag should be visually prominent — larger on Live pills to draw attention, and the pill itself gets a subtle crimson glow (box-shadow: 0 0 0 2px rgba(122, 28, 28, 0.2)) when status is Live.
Important: The date selector on the landing page (for registration) should NOT show these status tags — it's for choosing which tournament to register for, not for showing tournament status. The status tags are a Live page feature only. Create this as a prop on the date picker: showStatus?: boolean (defaults to false), and pass showStatus={true} only from the Live page.

4. Date selector — include past tournaments on Live page
The Live page differs from the landing page in a critical way: it must show archived tournaments so users can look back at past results (even if they're placeholder for now).
The landing page uses getUpcomingTournaments() to hide past tournaments. The Live page uses getTournaments() (all tournaments) so the archive is reachable.
Sort order on the Live page:

Live tournament (if any) — always first, pinned
Upcoming tournaments — next, sorted chronologically (nearest first)
Archive tournaments — last, sorted reverse-chronologically (most recent first)

Add a helper function to src/lib/tournaments.ts:
typescriptexport function getTournamentsWithStatus(): Array<Tournament & { status: TournamentStatus }> {
  return getTournaments()
    .map((t) => ({ ...t, status: getTournamentStatus(t.date) }))
    .sort((a, b) => {
      const priority = { live: 0, upcoming: 1, archive: 2 };
      if (priority[a.status] !== priority[b.status]) {
        return priority[a.status] - priority[b.status];
      }
      if (a.status === "archive") {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
}

5. Public-safe team count endpoint
The Upcoming placeholder needs to show a registered team count. The existing /api/admin/teams endpoint requires admin auth and shouldn't be exposed.
Create src/app/api/public/team-count/route.ts:
typescript// GET /api/public/team-count?tournament=tournament-id
// Returns { count: number } — safe to expose publicly, returns aggregate only, no PII
Uses the anon Supabase client, selects count on teams where tournament_id = ?. Returns { count }. No rate limiting needed — this is cheap.
Do NOT expose any team names, player info, or contact data from this endpoint. Count only.

6. Placeholder design polish
The three placeholder views (Upcoming, Live, Archive) all use the same visual container so the page doesn't feel empty:

Wrapped in a card matching the tournament detail card on the landing page — dark background (--lv-bg-elevated ink surface) on the parchment page for contrast, radius --lv-radius-lg, padding 3rem 2rem, max-width 680px centered
Inside the card:

Small decorative <DecorativeAsset src="cloud-1.png" /> at 20% opacity positioned absolutely in one corner of the card
Centered text content
Subtle <SectionDivider /> above the heading inside the card



This ensures the page looks intentional and branded even without real data.

7. Accessibility + fallbacks

Status tag text must be readable — all three states pass WCAG AA contrast on their respective backgrounds
The Live pulse animation respects prefers-reduced-motion — if reduced motion is set, hold opacity at 1 with no pulse
If getTournamentStatus() is called with an invalid date, return "archive" (safest fallback — user sees past-style placeholder rather than false "Live")


8. Files touched

src/lib/tournaments.ts — add getTournamentStatus(), getTournamentsWithStatus(), TournamentStatus type
src/app/(tournament)/layout.tsx — update header nav to include "Live" link + active state styling
src/app/(tournament)/StatusTag.tsx — new component
src/app/(tournament)/TournamentPicker.tsx (or wherever the date picker lives) — add showStatus prop and render <StatusTag /> on each pill when enabled
src/app/(tournament)/longvolleyball/live/page.tsx — new page
src/app/(tournament)/live.css (or append to tournament.css) — Live page specific styles + pulse keyframe
src/app/api/public/team-count/route.ts — new public endpoint


9. Verify

npm run build passes
Landing page date picker is unchanged — no status tags shown
Live page date picker shows status tags correctly:

Today's tournament (if any) shows "Live" tag with pulse
Future tournaments show "Upcoming"
Past tournaments show "Archive"


Sorting: Live first, Upcoming next (chronological), Archive last (reverse-chronological)
Nav "Live" and "Register" both work, active state shows for current page
Upcoming placeholder correctly shows team count from /api/public/team-count
Mobile layout of the Live page works at 375px viewport
prefers-reduced-motion: reduce disables the pulse animation


Do not build yet. First confirm:

Where the tournament date picker component currently lives (file path)
Whether the header is part of layout.tsx or extracted as its own component
Any date-handling utilities that already exist that you'll reuse vs. creating new
Whether prefers-reduced-motion handling exists anywhere in the codebase yet (if not, you'll need to add a small CSS @media query for the pulse)
Proposed order of implementation (probably: helper functions → StatusTag component → date picker update → page → nav → API endpoint)


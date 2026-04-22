# Work Team Access Audit — Score Submission Flows

**Date:** 2026-04-21
**Scope:** Read-only audit of how work teams currently access score submission pages across pool play and playoffs.
**Branch:** `main` at commit `41e61e2`

---

## Part 1 — Current State Audit

### A. Pool Match Score Submission — Full Lifecycle

#### 1. Token generation

**When:** Tokens are generated at the moment the admin generates the match schedule.
**Endpoint:** `POST /api/admin/matches` → `src/app/api/admin/matches/route.ts:209-226`
**Conditions:** Admin clicks "Generate matches" in the admin dashboard. All pools must exist with 3+ teams each. Tokens are batch-created for every match in a single insert.
**How:** `generateMatchToken()` from `src/lib/tokens.ts:10-15` produces a 12-character URL-safe string using a 30-character alphabet (~60 bits entropy). Tokens are stored in the `match_tokens` table with an expiry set to 05:59 AM UTC the day after the tournament (`tokenExpiryForTournament()` at `src/lib/tokens.ts:21-31`).

#### 2. Token delivery — email

**Endpoint:** `POST /api/admin/matches/email-work-links` → `src/app/api/admin/matches/email-work-links/route.ts`
**From address:** `Long Volleyball <info@longvolleyball.com>`
**To:** The work team's `contact_email` (captain's email set at registration)
**Content:** Styled HTML email containing one card per assigned match with:
- Pool label, court number, match order
- Team A vs Team B
- Match format (e.g., "2 sets to 15")
- A "Submit score" button linking to `https://longvolleyball.com/longvolleyball/score/{token}`

**CRITICAL FINDING:** There is **no button in the admin UI** that triggers this endpoint. The API route exists and is fully functional, but `src/app/admin/page.tsx` contains zero references to `email-work-links`, `Email work`, or any email-sending action. The admin has no way to send work link emails through the dashboard.

#### 3. Admin UI — copy/share score link

**File:** `src/app/admin/page.tsx:510-523`
**Where:** Each pool match row in the admin match list shows a clipboard icon button. Clicking it copies `{origin}/longvolleyball/score/{token}` to the clipboard.
**Limitation:** This is the **only** way to distribute pool match score links today — manual copy-paste by admin.

#### 4. Public Live page — score submission access

**File:** `src/app/(tournament)/longvolleyball/live/PoolView.tsx`
**Finding:** The `ScoreLinkModal` component is imported (line 5), state is declared (`scoreLinkMatch` at line 54), and the modal is conditionally rendered (lines 159-166). **However, `setScoreLinkMatch` is never called.** There is no button, link, or click handler anywhere in PoolView that opens the verification modal.

**Result:** A user on the public Live page **cannot** access score submission for pool matches. The infrastructure exists but is disconnected.

#### 5. Score submission page authentication

**Page:** `src/app/(tournament)/longvolleyball/score/[token]/page.tsx`
**API:** `GET /api/score/[token]` → `src/app/api/score/[token]/route.ts:19-102`
**Auth model:** **Token-only**. The page fetches match data using the token. The API checks:
- Token exists in `match_tokens` table
- Token has not expired (past tournament day)
- No login, no email verification, no session required

Anyone with the URL can view and submit scores.

#### 6. Email verification endpoint

**Endpoint:** `POST /api/public/score-link/verify` → `src/app/api/public/score-link/verify/route.ts`
**Auth model:** Email verification — checks if the provided email matches:
1. Any player's email on the work team (`players` table, matched case-insensitive), OR
2. The team's `contact_email`
**Rate limiting:** 5 attempts per IP per match per hour (in-memory Map)
**Returns:** The match token on success
**Scope:** **Pool matches only** — queries `matches` table at line 42. No support for bracket matches.

#### 7. Recovery if email lost

**No clear recovery path exists.** The ScoreLinkModal (which calls the verify endpoint) is unreachable from the public UI. The only options are:
1. Ask the admin to manually copy-paste the score link (requires admin access)
2. Ask the admin to resend the email (impossible — no UI button exists)

---

### B. Bracket Match Score Submission

#### 1. Bracket token generation

**When:** Tokens are generated when the admin creates brackets.
**Endpoint:** `POST /api/admin/brackets` → `src/app/api/admin/brackets/route.ts:251-266`
**How:** Same `generateMatchToken()` function. Tokens stored in `bracket_match_tokens` table with same expiry logic.
**Confirmed:** Bracket tokens DO exist.

#### 2. Bracket work link emails

**Endpoint:** Same `POST /api/admin/matches/email-work-links` — lines 147-206 handle bracket matches.
**From:** `Long Volleyball <info@longvolleyball.com>`
**Content:** Styled HTML cards with Gold/Silver bracket type, court number, team names, and a "Submit score" button linking to `https://longvolleyball.com/longvolleyball/bracket-score/{token}`
**Subject line:** "Your playoff work assignments — {tournament}, {date}"

**Same critical issue:** No admin UI button to trigger this. The bracket email code is functional but unreachable.

#### 3. Bracket score-link/verify equivalent

**Does not exist.** The `/api/public/score-link/verify` endpoint only queries the `matches` table (pool matches). It does not check `bracket_matches` or `bracket_match_tokens`. There is no way for a public user to verify their identity and receive a bracket score token.

#### 4. Public Live page — bracket score access

**File:** `src/app/(tournament)/longvolleyball/live/BracketView.tsx`
**Finding:** No `ScoreLinkModal` import. No score submission button. No click handler on bracket matchups. The bracket view is **display-only** for the public.

Work team names ARE shown on bracket match cards (line 199: `Work: {workTeam}`), but there is no interactive element to access score submission.

#### 5. Admin bracket view — score link access

**File:** `src/app/admin/page.tsx:543-597`
**Finding:** The admin bracket section shows:
- Bracket type and format
- Match order, team names, work team names
- Match status
- An "Undo result" button for completed matches

**Missing:** No "Copy score link" button for bracket matches. Unlike pool matches (which have a clipboard copy button), bracket matches have no way for the admin to copy or share the bracket score link.

#### Summary: What's missing for brackets

| Feature | Pool matches | Bracket matches |
|---|---|---|
| Token generation | Yes | Yes |
| Score submission page | Yes (`/score/[token]`) | Yes (`/bracket-score/[token]`) |
| Email work links API | Yes | Yes |
| Admin UI to send emails | **No** | **No** |
| Admin "Copy score link" button | Yes | **No** |
| Public verify endpoint | Yes (pool-only) | **No** |
| Public Live page score access | No (dead code) | **No** (not implemented) |
| Admin manual score override | Yes (`/api/admin/matches/[id]/score`) | **No endpoint** |

---

### C. Email Inventory

#### 1. Registration Confirmation

| Field | Value |
|---|---|
| **Trigger** | Successful `POST /api/register` |
| **File** | `src/app/api/register/route.ts:172-312` |
| **From** | `Long Volleyball Registration <registration@longvolleyball.com>` |
| **To** | Captain's email |
| **CC** | Other players with emails |
| **BCC** | `info@longvolleyball.com` |
| **Subject** | "You're registered — {tournament}, {date}" |
| **Content** | Tournament details, roster, $25/player cost, check-in at 9 AM, location, what to bring, restroom info, code of conduct, Instagram link |
| **Score links** | None (teams haven't been assigned to work yet) |
| **Blocking** | Non-blocking — email failure doesn't prevent registration |

#### 2. Work Team Assignment — Pool Matches

| Field | Value |
|---|---|
| **Trigger** | `POST /api/admin/matches/email-work-links` (admin-authenticated) |
| **File** | `src/app/api/admin/matches/email-work-links/route.ts:1-145` |
| **From** | `Long Volleyball <info@longvolleyball.com>` |
| **To** | Work team's `contact_email` |
| **Subject** | "Your match work assignments — {tournament}, {date}" |
| **Content** | Greeting with team name, one card per match (pool/court/order, teams, format, "Submit score" button with direct token link) |
| **Score links** | Yes — one per match, direct token URL |
| **UI trigger** | **NONE — no button in admin dashboard** |

#### 3. Work Team Assignment — Bracket Matches

| Field | Value |
|---|---|
| **Trigger** | Same endpoint, lines 147-206 |
| **From** | `Long Volleyball <info@longvolleyball.com>` |
| **To** | Work team's `contact_email` |
| **Subject** | "Your playoff work assignments — {tournament}, {date}" |
| **Content** | One card per bracket match (Gold/Silver, court, teams, "Submit score" button with bracket-score token link) |
| **Score links** | Yes — one per match, direct token URL |
| **UI trigger** | **NONE — same as pool** |

#### Emails that SHOULD be sent but aren't

1. **Work link emails (pool + bracket)** — The API is built, tested, and functional. The only missing piece is a button in the admin UI to invoke it. This is the highest-impact gap.
2. **Re-send for individual work teams** — No ability to resend to a single team. The endpoint sends to ALL work teams for the tournament. If one team lost their email, you must re-send to everyone.
3. **Bracket work assignment on propagation** — When a bracket match completes and the `assign_bracket_work_team` RPC assigns work teams to later rounds, no email is sent to the newly assigned team. They have no way to know they've been assigned.

---

### D. Public Score Link Access Patterns

#### User journey: Work team member opens longvolleyball.com/live

**Step 1 — Landing**
User arrives at the Live page (`src/app/(tournament)/longvolleyball/live/page.tsx`). They see a tournament selector at the top. If a tournament is live, it auto-selects.

**Step 2 — Find their matches**
Pool tabs show each pool with standings and a match feed. Each match card displays:
- Match number
- Team A vs Team B
- Set scores (if submitted)
- Work team name ("Scorekeeper: {team}")
- Status (Upcoming / Live / Final)

The user CAN find their assigned matches by scanning for their team name in the "Scorekeeper" line. For bracket matches, the BracketView shows "Work: {team}" in the caption below each matchup.

**Step 3 — Access score submission**
**They cannot.** There is no button, link, or interactive element on any match card that leads to score submission. The match cards are display-only.

**Step 4 — Fallback options**
- **Check their email** — Only works if the admin manually called the email-work-links API (which has no UI button)
- **Contact admin** — Admin can copy-paste the score link from the admin dashboard (pool only, not bracket)
- **Direct URL guess** — Impossible; tokens are 12-character random strings

#### Friction analysis

| Step | Pool matches | Bracket matches |
|---|---|---|
| Find assigned match on Live page | Medium friction — must scan cards for team name | Medium friction — must scan bracket for "Work:" caption |
| Access score submission from Live page | **Impossible** | **Impossible** |
| Access via email link | Works IF email was sent (currently requires API call outside UI) | Works IF email was sent (same issue) |
| Fallback: admin copies link | Works — clipboard button exists | **Impossible** — no clipboard button for brackets |
| Fallback: admin resends email | **Impossible** — no UI button | **Impossible** — no UI button |

---

### E. Authentication Comparison

#### Path 1: Direct Token URL (from email)

| Aspect | Details |
|---|---|
| **Auth model** | Token IS the authentication. Possession = access. |
| **Pool** | `/longvolleyball/score/{token}` → `GET /api/score/{token}` validates token exists + not expired |
| **Bracket** | `/longvolleyball/bracket-score/{token}` → `GET /api/bracket-score/{token}` validates token exists + not expired |
| **Rate limiting** | 10 requests/token/minute on POST (submission), none on GET (page load) |
| **Risk** | Anyone with the URL can submit scores. No verification that the submitter is on the work team. URL in email could be forwarded. |
| **Edit window** | 10 minutes from first submission. After that, scores locked. |

#### Path 2: Public Score Link Verification (via Live page)

| Aspect | Details |
|---|---|
| **Auth model** | Email verification → token return. Two-factor: know the match + prove identity via email. |
| **Endpoint** | `POST /api/public/score-link/verify` |
| **Pool** | Supported — queries `matches` table |
| **Bracket** | **NOT supported** — only checks `matches`, not `bracket_matches` |
| **Rate limiting** | 5 attempts/IP/match/hour |
| **UI trigger** | **Unreachable** — ScoreLinkModal in PoolView is dead code; not present in BracketView |
| **Risk** | Low risk when functional — requires email match. But currently serves no purpose since it can't be triggered. |

#### Path 3: Admin Manual Score Entry

| Aspect | Details |
|---|---|
| **Auth model** | Admin session (NextAuth JWT). Password-based login. |
| **Pool** | `PUT /api/admin/matches/[id]/score` — can set/override any score, bypasses edit window |
| **Bracket** | **No equivalent endpoint exists**. Admin cannot manually correct bracket scores. The only option is "Undo result" which cascades to dependent matches. |
| **Risk** | Admin has full override power for pools but no fine-grained control for brackets. |

#### Inconsistencies

1. **Pool vs bracket verification parity** — The verify endpoint only supports pool matches. If extended to brackets, the same email-based verification could work, but it currently doesn't.
2. **Dead verification UI** — The ScoreLinkModal component is fully built and functional, but it's orphaned code. Wiring it up would take a single `onClick` handler.
3. **Admin score correction asymmetry** — Pool matches have admin score override. Bracket matches have only "undo result" (nuclear option that cascades). No way to correct a bracket typo without undoing the entire result chain.
4. **Token-only auth on score pages** — Once someone has a token URL, no further verification occurs. The verify endpoint adds security, but only for the Live page flow (which is currently broken).

---

## Part 2 — Gaps and Recommendations

### Critical (Prevents tournament-day function)

| # | Issue | Files involved | Impact |
|---|---|---|---|
| C1 | **No admin UI button to send work link emails** | `admin/page.tsx` (missing), `email-work-links/route.ts` (ready) | Work teams have NO way to receive score links unless admin manually copy-pastes each one. With 20+ matches, this is a tournament-blocking bottleneck. |
| C2 | **ScoreLinkModal never opens on Live page** | `PoolView.tsx:54` — `setScoreLinkMatch` never called | Work teams who lose their email or never received one have zero recovery path from the public site. |
| C3 | **No bracket score link copy in admin** | `admin/page.tsx:543-597` | Admin cannot distribute bracket score links AT ALL — not by email (no button) and not by copy-paste (no clipboard button). Bracket scoring requires someone to query the database directly. |
| C4 | **Verify endpoint doesn't support brackets** | `score-link/verify/route.ts:42` — only queries `matches` | Even if the ScoreLinkModal were wired up for brackets, verification would fail because the endpoint only looks up pool matches. |

### Important (Degrades tournament-day experience)

| # | Issue | Files involved | Impact |
|---|---|---|---|
| I1 | **No admin score override for bracket matches** | No `/api/admin/bracket-matches/[id]/score` endpoint exists | If a bracket score has a typo after the 10-min window, admin must "Undo result" which cascades to ALL dependent later-round matches — potentially wiping completed games. |
| I2 | **No per-team email resend** | `email-work-links/route.ts` sends to ALL teams | If one team lost their email, admin must blast everyone again. Could cause confusion ("did something change?"). |
| I3 | **No email on bracket work team propagation** | `bracket-score/[token]/route.ts:167` calls `assign_bracket_work_team` RPC but sends no email | When a bracket match completes and the next round's work team is assigned via RPC, that team is never notified. They won't know they have a bracket match to score. |
| I4 | **No visual "needs score" indicator on Live page** | `PoolView.tsx`, `BracketView.tsx` | Match cards show status (Upcoming/Live/Final) but there's no scorekeeper-specific signal like "Awaiting your score" or a highlighted state for matches needing work team input. |
| I5 | **Too many clicks/scrolls to find assigned matches** | `PoolView.tsx`, `BracketView.tsx` | A work team member must manually scan every pool tab or scroll the bracket to find matches where their team name appears. No filtering or "my matches" view. |

### Polish (Can wait)

| # | Issue | Files involved | Impact |
|---|---|---|---|
| P1 | **ScoreLinkModal copy is vague** | `ScoreLinkModal.tsx:59` | "Enter the email of any player on {team} to access the score submission form" — doesn't explain what's about to happen or why they need to verify. |
| P2 | **Score submission page lacks confirmation header** | `score/[token]/page.tsx`, `bracket-score/[token]/page.tsx` | No prominent banner saying "You're scoring Match 3: Team A vs Team B" — user jumps straight into inputs. Could submit scores for the wrong match without realizing. |
| P3 | **Missing error states on score pages** | `score/[token]/page.tsx` | Invalid/expired token shows a basic message. No clear next step ("Contact the tournament admin at..."). |
| P4 | **In-memory rate limiting resets on deploy** | `score/[token]/route.ts`, `score-link/verify/route.ts`, `register/route.ts` | All rate limiters use in-memory Maps. A server restart or new deployment clears all rate limit state. Low risk for a single-day tournament but fragile. |
| P5 | **Registration email doesn't mention work team duties** | `register/route.ts` | New teams aren't told they may be assigned to score other teams' matches. First-time teams may be confused on tournament day. |

---

## Part 3 — Proposed Unified Solution

### 3.1 Public Live Page — Score Link Exposure

#### Pool matches (fix existing)

Wire up the existing `ScoreLinkModal` in `PoolView.tsx`. Add a "Submit score" button to each match card where:
- `status !== "complete"` (match isn't finished)
- `work_team` is not null (a work team is assigned)

Clicking the button calls `setScoreLinkMatch({ matchId: m.match_id, workTeamName: m.work_team })`, which opens the existing modal.

**Placement:** Inside the match card, below the "Scorekeeper: {team}" line. Styled as a secondary action button.

#### Bracket matches (new)

Add `ScoreLinkModal` to `BracketView.tsx` with identical behavior. Add a small "Score" button inside each bracket matchup box where `status !== "complete"` and `workTeam` is not null.

**Placement:** Inside the `lv-bk-caption` div, next to the "Work: {team}" text.

#### "I'm a scorekeeper" entry point (recommended)

Add a persistent element at the top of the Live page (above pool/bracket tabs):

```
┌─────────────────────────────────────────┐
│  Are you keeping score today?           │
│  [Enter your email to find your matches]│
└─────────────────────────────────────────┘
```

Clicking opens a simplified flow:
1. User enters email
2. System queries all matches + bracket matches where the email matches a player on the assigned work team
3. Returns a list of all matches the user is assigned to work, with direct "Submit score" links

This solves the "find my matches" problem in one interaction.

### 3.2 Unified Authentication Pattern

#### Extend `/api/public/score-link/verify` to support both match types

Current endpoint only queries `matches`. Extend it to accept a `match_type` parameter:

```
POST /api/public/score-link/verify
Body: { match_id: string, email: string, match_type: "pool" | "bracket" }
```

- `"pool"` (default) → current behavior, queries `matches` + `match_tokens`
- `"bracket"` → queries `bracket_matches` + `bracket_match_tokens`

Same email verification logic: check player emails on the work team + team contact_email.
Same rate limiting: 5 attempts/IP/match/hour.

#### Update ScoreLinkModal

Add a `matchType` prop. On successful verification:
- Pool: redirect to `/longvolleyball/score/{token}`
- Bracket: redirect to `/longvolleyball/bracket-score/{token}`

#### Auth hierarchy remains

1. **Email link (primary):** Token URL from email — token is the auth
2. **Live page verification (secondary):** Email verification → token — two-factor
3. **Admin override (fallback):** Admin session bypasses tokens

### 3.3 Unified "Score Me" UI Element

#### Design proposal

A consistent button across both pool and bracket views:

**Pool match card:**
```
┌─────────────────────────────┐
│ Match 3                     │
│ Team A  vs  Team B          │
│ Scorekeeper: Team C         │
│ [📋 Submit score]           │  ← new button
└─────────────────────────────┘
```

**Bracket matchup box:**
```
┌───────────────────┐
│ (1) Team A     15 │
│ (4) Team D     11 │
│ Ct 2 · Work: E    │
│      [Score]      │  ← new button
└───────────────────┘
```

**Button specs:**
- Copy: "Submit score" (pool), "Score" (bracket, space-constrained)
- Style: Secondary/ghost button using existing `lv-btn lv-btn-ghost` classes
- Visibility: Only when `status !== "complete"` and `work_team` is assigned
- Completed matches: Show "Final" badge, no button

### 3.4 "My Matches" Helper (Optional)

#### Concept

After a user successfully verifies their email once (via ScoreLinkModal or the "I'm a scorekeeper" entry point), offer a "Show all my matches" view.

#### Implementation

1. On successful email verification, store the verified email in `sessionStorage` (keyed as `lv_verified_email`)
2. Create a new endpoint: `GET /api/public/my-matches?email={email}&tournament={id}`
   - Queries all `matches` where the work team contains a player with that email
   - Queries all `bracket_matches` where the work team contains a player with that email
   - Returns match details + tokens (since email is already verified)
3. On the Live page, if `sessionStorage` has a verified email, show a "My matches" tab/banner at the top listing all assigned matches with direct score links
4. Session expires at end of day or when `sessionStorage` is cleared (tab close)

**Trade-off:** Reduces friction significantly for work teams with multiple matches. Adds one endpoint and minor sessionStorage logic. Low complexity, high tournament-day quality-of-life improvement.

### 3.5 Admin Exposure for Bracket Work Links

#### Required additions to `src/app/admin/page.tsx`

| Feature | Pool (exists) | Bracket (needed) |
|---|---|---|
| "Copy score link" per match | Yes (line 510) | Add clipboard button per bracket match row |
| "Email work links" button | **No (build this)** | Same button — endpoint already handles both |
| "Regenerate token" per match | Yes (`/api/admin/matches/[id]/refresh-token`) | Add `/api/admin/bracket-matches/[id]/refresh-token` |

#### Specific changes

1. **Add "Email work links" button** to the admin matches section header. One button that calls `POST /api/admin/matches/email-work-links` with the current `tournament_id`. Shows a confirmation dialog ("Send work assignment emails to all teams?") and a success/failure toast.

2. **Add clipboard button to bracket match rows** (lines 556-592). Same pattern as pool matches:
   ```tsx
   <button onClick={() => navigator.clipboard.writeText(
     `${window.location.origin}/longvolleyball/bracket-score/${token}`
   )}>Copy score link</button>
   ```
   Requires the admin brackets API to return tokens (currently doesn't).

3. **Add admin bracket score override endpoint**: `PUT /api/admin/bracket-matches/[id]/score` — parallel to the pool version at `/api/admin/matches/[id]/score`. Allows admin to correct bracket scores without cascading undo.

---

## Part 4 — Implementation Plan

### Step 1: Wire up "Email work links" button in admin UI

**Effort:** Trivial
**Dependencies:** None
**Files:** `src/app/admin/page.tsx`
**What:** Add a button to the matches section that calls the existing `POST /api/admin/matches/email-work-links` endpoint. Include a confirm dialog and success/error toast. The API already handles both pool and bracket emails.

### Step 2: Wire up ScoreLinkModal in PoolView

**Effort:** Trivial
**Dependencies:** None
**Files:** `src/app/(tournament)/longvolleyball/live/PoolView.tsx`
**What:** Add an `onClick` handler to match cards (for non-complete matches with a work team) that calls `setScoreLinkMatch({ matchId, workTeamName })`. The modal, state, and rendering are already in place.

### Step 3: Extend verify endpoint for bracket matches

**Effort:** Small
**Dependencies:** None
**Files:** `src/app/api/public/score-link/verify/route.ts`
**What:** Accept optional `match_type` param. When `"bracket"`, query `bracket_matches` for work_team_id and `bracket_match_tokens` for the token. Default to `"pool"` for backwards compatibility.

### Step 4: Add ScoreLinkModal to BracketView

**Effort:** Small
**Dependencies:** Step 3 (verify must support brackets)
**Files:** `src/app/(tournament)/longvolleyball/live/BracketView.tsx`, `ScoreLinkModal.tsx`
**What:** Import ScoreLinkModal. Add state + "Score" button to matchup boxes. Pass `matchType="bracket"` to the modal. Update modal to redirect to `/bracket-score/{token}` when matchType is bracket.

### Step 5: Add "Copy score link" to admin bracket view

**Effort:** Small
**Dependencies:** Admin brackets API must return tokens
**Files:** `src/app/api/admin/brackets/route.ts`, `src/app/admin/page.tsx`
**What:** Extend GET brackets response to include tokens from `bracket_match_tokens`. Add clipboard button per bracket match row in admin page.

### Step 6: Add admin bracket score override endpoint

**Effort:** Medium
**Dependencies:** None
**Files:** New: `src/app/api/admin/bracket-matches/[id]/score/route.ts`
**What:** Mirror `src/app/api/admin/matches/[id]/score/route.ts` for bracket matches. PUT updates `bracket_match_sets` directly, bypasses edit window. Must handle bracket propagation (if changing a score flips the winner, cascade or warn). Add UI button in admin bracket view.

### Step 7: Add "I'm a scorekeeper" entry point on Live page

**Effort:** Medium
**Dependencies:** Step 3 (verify must support brackets)
**Files:** `src/app/(tournament)/longvolleyball/live/page.tsx`, new endpoint `src/app/api/public/my-matches/route.ts`
**What:** Add banner at top of Live page. New API endpoint queries all matches + bracket matches by work team email. Returns match list with tokens. Stores verified email in sessionStorage. Shows "My matches" persistent view with direct score links.

### Step 8: Send email on bracket work team propagation

**Effort:** Medium
**Dependencies:** Step 1 (email sending must work)
**Files:** `src/app/api/bracket-score/[token]/route.ts` (after RPC call), or new Supabase trigger
**What:** After `assign_bracket_work_team` RPC succeeds and a new work team is assigned to the next round, send that team an email with their bracket score link. Requires fetching the newly assigned team's contact_email and the bracket match token.

### Dependency graph

```
Step 1  ─────────────────────────────────────────── (standalone, highest priority)
Step 2  ─────────────────────────────────────────── (standalone, highest priority)
Step 3  ──────┬──── Step 4 (bracket modal)
              └──── Step 7 ("I'm a scorekeeper")
Step 5  ─────────────────────────────────────────── (standalone)
Step 6  ─────────────────────────────────────────── (standalone)
Step 8  ──────────── depends on email infra (Step 1)
```

### Priority order

1. **Step 1** (trivial) — Unblocks ALL email delivery. Highest ROI.
2. **Step 2** (trivial) — Unblocks pool score recovery from Live page.
3. **Step 5** (small) — Gives admin bracket link distribution ability.
4. **Step 3** (small) — Prerequisite for Steps 4 and 7.
5. **Step 4** (small) — Bracket score recovery from Live page.
6. **Step 6** (medium) — Admin bracket score correction without cascade.
7. **Step 7** (medium) — Quality-of-life for multi-match work teams.
8. **Step 8** (medium) — Auto-notification for bracket propagation.

---

## File Index

All files referenced in this audit:

| File | Role |
|---|---|
| `src/lib/tokens.ts` | Token generation + expiry |
| `src/app/api/admin/matches/route.ts` | Pool match + token creation |
| `src/app/api/admin/matches/[id]/route.ts` | Match updates (work team assignment) |
| `src/app/api/admin/matches/[id]/score/route.ts` | Admin score override (pool only) |
| `src/app/api/admin/matches/[id]/refresh-token/route.ts` | Token regeneration (pool only) |
| `src/app/api/admin/matches/email-work-links/route.ts` | Email sending (pool + bracket) |
| `src/app/api/admin/brackets/route.ts` | Bracket + token creation |
| `src/app/api/admin/brackets/undo/route.ts` | Bracket result undo |
| `src/app/api/score/[token]/route.ts` | Pool score submission API |
| `src/app/api/bracket-score/[token]/route.ts` | Bracket score submission API |
| `src/app/api/public/score-link/verify/route.ts` | Email verification (pool only) |
| `src/app/api/register/route.ts` | Registration + confirmation email |
| `src/app/(tournament)/longvolleyball/score/[token]/page.tsx` | Pool score submission UI |
| `src/app/(tournament)/longvolleyball/bracket-score/[token]/page.tsx` | Bracket score submission UI |
| `src/app/(tournament)/longvolleyball/live/page.tsx` | Public Live page |
| `src/app/(tournament)/longvolleyball/live/PoolView.tsx` | Pool view (has dead ScoreLinkModal) |
| `src/app/(tournament)/longvolleyball/live/BracketView.tsx` | Bracket view (no score access) |
| `src/app/(tournament)/longvolleyball/live/ScoreLinkModal.tsx` | Email verification modal |
| `src/app/admin/page.tsx` | Admin dashboard |
| `src/lib/score-format.ts` | Match format + edit window logic |
| `src/lib/match-generation.ts` | Pool match generation |
| `src/lib/bracket-generation.ts` | Bracket generation |
| `src/auth.ts` | Admin authentication (NextAuth) |
| `src/middleware.ts` | Route protection |

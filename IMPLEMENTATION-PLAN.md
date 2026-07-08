# Implementation Plan — Tournament System Audit Remediation

**Date:** 2026-06-10
**Source:** Full-system audit (algorithms, API/auth, database/RPCs, client flows)
**Execution model:** Goal loop. Each phase defines a goal, failing-tests-first, and a single
verify command. A phase is DONE when its verify command is green AND all previous phases'
verify commands are still green. Work phases strictly in order — later phases depend on
earlier schema/RPC changes.

---

## Resolved design decisions (do not re-litigate during implementation)

| # | Decision | Resolution |
|---|----------|-----------|
| D1 | Scope | Criticals + Highs + correctness Mediums. Deferred: login rate-limit, error-message sanitization, email HTML escaping, tournaments table, token modulo bias, dead-code cleanup. |
| D2 | Withdrawal policy | **Played matches stand; scheduled AND in_progress matches become forfeit wins** (full sets at points-per-set, 0 for withdrawn team). Withdrawn team stays in standings, sinks to bottom via the existing `withdrawn` sort rule in `standings.ts:118`. Remove all withdrawn-team pre-filtering in consumers. |
| D3 | Ranking | Raw `sets_won` primary → head-to-head (2-way ties only) → point differential is the **official rule**. Pin with tests; do not change the comparator. `matches_won` stays display-only. |
| D4 | Completed matches | Token routes **reject score POSTs once a match is complete** (HTTP 409, "match is final — see the tournament desk"). Corrections are admin-only (admin route already has undo-on-flip). Completion becomes an **explicit client action** (`complete: true` sent only from the End Match confirm) — the server must NOT auto-complete on any win-condition score. |
| D5 | Open access | Any registered team's email can mint a score link and `work_team_id` updates to the actual scorer — **by design, keep**. D4 bounds the abuse window to in-progress matches. |
| D6 | RLS | The anon key is used only by the server-side register route. Switch register to the service-role client, then **drop ALL anon policies** (001 INSERT on teams/players, 002/004/005/006/007 SELECTs). Tables become service-role-only. Revoke anon/authenticated EXECUTE on all RPCs. |
| D7 | Schema depth | Targeted constraints only. No tournaments table (deferred). |
| D8 | Courts | 6/7-team pools **consume two adjacent courts**. `generatePools` validates total net demand vs `netCount` up front and rejects with an actionable message. Patch the SCHEDULE_6 slot-3 play/work conflict. Keep the proven two-net schedules. |
| D9 | Concurrency | Two-device last-write-wins on in-progress scoring is an **accepted risk** (one-scorer social norm; `submitted_by_team_id` is the audit trail). Documented, not fixed. |
| D10 | Verification | Three layers: vitest unit (lib), vitest integration (real local Postgres + PostgREST via `scripts/db-*.sh`), Playwright E2E (scorer + admin flows against `next dev`). |

---

## Loop protocol

For each phase:

1. `npm run db:reset` (integration phases) — fresh schema from migrations.
2. Write the phase's tests FIRST; run verify; confirm the new tests FAIL for the expected reason.
3. Implement until the phase verify command is green.
4. Run the cumulative gate: `npm run test` (after Phase 7: `npm run test && npm run test:e2e`).
5. Commit with message `fix(phaseN): <summary>` before starting the next phase.

Environment notes:
- DB scripts are bash (`scripts/db-start.sh`, `db-reset.sh`) — run via the Bash tool / Git Bash, not PowerShell.
- Local stack: Postgres :5432, PostgREST :3001, proxy :54321 (`/rest/v1`). `.env.development.local` already points the Supabase clients at the proxy.
- Integration tests must talk to the SAME stack the app uses (service-role headers through the proxy) and may use `psql` directly for constraint assertions.
- `npm run db:reset` re-runs ALL migrations — new migrations are picked up automatically.

---

## Phase 0 — Test harness

**Goal:** `npm run test` runs two vitest projects (unit + integration); `npm run test:e2e` exists (may be empty until Phase 7).

Tasks:
- Convert `vitest.config.ts` to a workspace with two projects:
  - `unit`: `src/lib/__tests__/**` (existing tests keep passing, no env needed).
  - `integration`: `tests/integration/**`, `globalSetup` that (a) verifies Postgres is up (`pg_isready`) and PostgREST responds, (b) runs `db-reset` logic or truncates all tables; per-file setup truncates tables for isolation. Sequential execution (`fileParallelism: false`) — shared DB.
- Shared test helpers: `tests/helpers/db.ts` (psql exec, truncate-all, seed-tournament factory: N teams → pools → matches → tokens), `tests/helpers/api.ts` (invoke Next route handlers directly with a mocked `auth()` for admin routes — import the handler functions, pass `NextRequest`).
- Add `test:unit`, `test:integration`, `test:e2e` npm scripts. Install Playwright (`@playwright/test`) and create `playwright.config.ts` with a `webServer` block running `next dev` (depends on db:start).
- Smoke integration test: insert a team via PostgREST proxy with service headers → read it back.

**Verify:** `npm run test` → both projects green (1 smoke integration test). `npx playwright test --list` exits 0.

---

## Phase 1 — Migration 014: constraints, RLS lockdown, RPC guards

**Goal:** the database refuses every corruption state found in the audit, and anon can do nothing.

Migration `014_integrity_and_rls.sql`:
1. `alter table bracket_match_sets add column is_forfeit boolean not null default false;` (CRITICAL prerequisite for Phase 2).
2. `alter table bracket_match_sets add constraint no_tied_sets check (team_a_score <> team_b_score);`
3. On `bracket_matches`: `check (team_a_id is null or team_a_id <> team_b_id)`, `check (work_team_id is null or (work_team_id <> team_a_id and work_team_id <> team_b_id))`, `check (slot_a_id <> slot_b_id)`.
4. One-pool-per-team: `create unique index pool_teams_one_pool_per_team on pool_teams(team_id);` (team ids are globally unique, so this enforces per-tournament uniqueness too).
5. TOCTOU guard for generation: `alter table matches add constraint matches_pool_order_unique unique (pool_id, match_order);` — second concurrent generation insert fails instead of duplicating the schedule. (Brackets are already guarded by `brackets_tournament_type_unique` IF the route inserts the brackets row before slots/matches — verify and fix ordering in Phase 6 if needed.)
6. Drop all anon policies: the two INSERT policies from 001, every "Allow anonymous select" policy from 002/004/005/006/007. Keep RLS enabled on all tables (service role bypasses).
7. `revoke execute on function propagate_bracket_winner(uuid), assign_bracket_work_team(uuid), undo_bracket_match(uuid), swap_pool_teams(uuid, uuid) from public, anon, authenticated;` and `alter function ... set search_path = '';` on all four (qualify table refs in bodies if needed).
8. `create or replace function propagate_bracket_winner` — add guards at top: return early (raise exception) if the match has no sets, or if `score_a = score_b` (defense-in-depth behind the CHECK).
9. `create or replace function assign_bracket_work_team` — add `if completed.winner_slot_id is null then return 'no winner'; end if;` so calling it before propagation can never mark team A as loser.
10. `create or replace function undo_bracket_match` — also clear `work_team_id` on any **sibling/same-court** match where the work team was the undone match's loser or winner (i.e., any match whose `work_team_id` is one of the undone match's two teams and whose status is still `scheduled`), not just downstream matches. Do NOT clear the target match's own `work_team_id` (that assignment came from an earlier, still-valid match) — current line 19 behavior is a bug, fix it.
11. Update register route to `getSupabaseAdmin()` (required by step 6) and wrap team+players insert so a players-insert failure deletes the orphan team row (best-effort compensation; PostgREST has no multi-statement transaction).

Tests first (`tests/integration/migration-014.test.ts`):
- anon headers: SELECT on teams → empty/denied; INSERT on teams → denied; rpc call → denied.
- service role: tied bracket set insert → rejected; same team both sides of bracket_match → rejected; team into second pool → rejected; duplicate (pool_id, match_order) → rejected.
- `propagate_bracket_winner` on a match with no sets → error, no slot mutation.
- `assign_bracket_work_team` before propagate → no-op, work_team_id unchanged.
- undo-flip scenario: complete M1 (A beats B) → B assigned to work sibling M2 → undo M1 → M2.work_team_id is NULL again → rescore M1 (B beats A) → propagate+assign → M2.work_team_id = A.
- register route with players-insert failure → no orphan team row; register happy path still works with anon policies dropped.

**Verify:** `npm run db:reset && npm run test`.

---

## Phase 2 — Transactional withdrawal RPC

**Goal:** withdrawing a team, at any tournament stage, leaves a fully consistent state in one atomic call — including brackets (currently a silent no-op due to the nonexistent `bracket_matches.tournament_id` column and missing `is_forfeit`).

Migration `015_withdraw_team_rpc.sql` — `withdraw_team(p_team_id uuid, p_points_per_set int, p_sets_per_match int)` (plpgsql, single transaction):
1. Lock the team row (`for update`); if `withdrawn_at` already set, return early with counts (idempotent — safe retry).
2. Pool matches with `status in ('scheduled','in_progress')` involving the team: upsert forfeit `match_sets` (full sets: opponent gets `p_points_per_set` per set × `p_sets_per_match`, withdrawn team 0, `is_forfeit = true`, overwriting any partial in-progress sets), set `status = 'complete'`.
3. Bracket matches: join through `brackets` for tournament scoping (`bracket_matches.bracket_id → brackets.tournament_id`) — NOT a `tournament_id` column on bracket_matches. For `scheduled`/`in_progress` matches where the team occupies a side: insert forfeit `bracket_match_sets` (now has `is_forfeit`), set complete, then call `propagate_bracket_winner` + `assign_bracket_work_team` inline.
4. Bracket slots holding the team whose downstream match teams aren't populated yet (`bracket_matches.team_*_id` null because the other feeder is unfinished): record these and handle when populated — simplest correct approach: leave `bracket_slots.team_id` set but flag via the team's `withdrawn_at`; the propagate function gains a check: when filling a next-round match where the opponent slot's team is withdrawn, immediately forfeit that match too (recursive walk-up). Implement and test this path explicitly.
5. Clear `work_team_id` on any scheduled bracket match where it references the withdrawn team (reassignment is manual/next-completion).
6. Set `withdrawn_at` **last** (it is the idempotency marker; partial failure rolls back everything since it's one transaction).
7. Rewrite `src/app/api/admin/teams/[id]/withdraw/route.ts` to: read the pool's stored format (after Phase 3 lands, the pool columns; until then pass current `getMatchFormat` values) and call the RPC once. Delete the multi-step logic.

Tests first (`tests/integration/withdrawal.test.ts`):
- Withdraw before any play → all pool matches vs team are complete forfeits, opponents have full sets.
- Withdraw with one match `in_progress` (partial set rows exist) → that match is forfeited too (overwritten), nothing stranded in_progress.
- Withdraw during playoffs: team in a scheduled R1 bracket match → opponent advanced to R2, work team assigned, `is_forfeit` set.
- Withdraw when team sits in an R2 slot whose match teams aren't populated → when the feeder match completes, the R2 match auto-forfeits and the feeder's winner advances to R3.
- Call RPC twice → second call is a no-op, counts stable (idempotent).
- Inject a failure mid-RPC (e.g., temporarily add a violating row) → team is NOT marked withdrawn, zero forfeit rows (atomicity).

**Verify:** `npm run db:reset && npm run test`.

---

## Phase 3 — Stored match format + forfeit-aware standings

**Goal:** a withdrawal never changes how existing scores are interpreted; forfeit wins count; legitimately earned wins vs the withdrawn team are preserved.

Migration `016_pool_format.sql`:
- `alter table pools add column sets_per_match int, add column points_per_set int, add column points_cap int;`
- Backfill existing rows from current `getMatchFormat(roster size)` logic (one UPDATE per size bucket).

Code:
- `POST /api/admin/pools` (generation) writes the format columns from `getMatchFormat(pool.teams.length)` at creation time — the ONLY place roster size is consulted.
- All consumers read the stored format instead of recomputing from live roster size: `public/standings/route.ts:128`, `admin/brackets/route.ts:191`, `PoolSummaryCard.tsx:34-39`, both score token routes, withdraw route (Phase 2 RPC inputs), `email-work-links`.
- Remove withdrawn-team pre-filtering everywhere standings are computed (`public/standings/route.ts:72`, `admin/brackets/route.ts:156`, `PoolSummaryCard.tsx`): pass the FULL roster (with `withdrawn` flags) to `computePoolStandings`. The existing `withdrawn` sort rule (`standings.ts:118`) now activates; the `if (!a || !b) continue` guard (`standings.ts:74`) stops dropping matches.
- Bracket seeding (`admin/brackets/route.ts`) excludes withdrawn teams from SEEDING (they can't play playoffs) but their match results still count in everyone's standings — exclusion happens AFTER `computePoolStandings`, by filtering the ranked output.

Tests first:
- Unit (`standings.test.ts` — new): sets-won-primary ranking pinned (D3); 2-way H2H tiebreak fires; 3-way circular tie falls to point differential; withdrawn team sorts last; forfeit sets count identically to played sets; team that beat the withdrawn team keeps the win.
- Unit (`score-format.test.ts` — new): `isSetComplete`/`isMatchComplete`/`matchWinner` pinned across formats incl. cap win-by-1 and the split-set equal-points null winner.
- Integration: 5-team pool, two real matches played at 2×11, withdraw one team → public standings show the same W-L/sets for the played matches as before withdrawal; matches are still `complete`; admin (PoolSummaryCard data path = same lib + same stored format) agrees with the public endpoint; bracket generation seeds N−1 teams using full-roster standings.

**Verify:** `npm run db:reset && npm run test`.

---

## Phase 4 — Token route hardening (lock-on-complete, explicit completion)

**Goal:** completed matches are immutable via tokens; completion and bracket propagation happen only on an explicit, confirmed action; propagation failures are loud.

`src/app/api/score/[token]/route.ts` and `bracket-score/[token]/route.ts`:
- POST returns **409 `{ error: "match_final" }`** when `match.status === 'complete'`.
- Add a `complete: boolean` field to the POST body. Status transitions to `complete` ONLY when `complete: true` is sent AND the stored sets satisfy `isMatchComplete` server-side (recomputed from DB, not from the request). Otherwise status stays/returns to `in_progress`. The fat-finger 15-13 autosave can no longer complete or propagate anything.
- Bracket route: propagation (`propagate_bracket_winner` + `assign_bracket_work_team`) runs only inside the `complete: true` path. Remove the swallowing try/catch — on RPC failure, revert status to `in_progress` and return 500 `{ error: "propagation_failed" }` so the scorer sees it and can retry.
- Bracket route input validation: integer check + upper bound (reuse the pool route's 0–99) — closes the 1,000,000–0 hole.
- Admin score routes (`admin/matches/[id]/score`, `admin/brackets/[match_id]/score`): integer + 0–99 bounds + `set_number` within the stored format's set count.
- Register route: enforce `maxTeams` when defined on the tournament config (count non-withdrawn teams; 409 when full).

Client (`score/[token]/page.tsx`, `bracket-score/[token]/page.tsx`):
- `confirmEndMatch` / final `confirmEndSet` sends `complete: true`; plain +/- autosaves never do.
- Handle 409 `match_final`: replace the scoring UI with a read-only "Match is final" state.
- Handle 500 `propagation_failed`: show a retry button; wire the dead `error` state (`page.tsx:37/330`) so End Set/Match failures are visible in the modal.

Tests first (integration, invoking route handlers directly):
- Score POST to a complete match → 409, sets unchanged.
- Bracket: POST 15-13 without `complete` → status `in_progress`, next-round slot still empty.
- POST with `complete: true` and valid sets → status complete, winner propagated, work team assigned.
- POST `complete: true` but sets don't satisfy win condition → 400, not completed.
- Winner can no longer be flipped via token after completion (409); admin route flip still works (undo-on-flip path re-tested end-to-end with Phase 1's fixed `undo_bracket_match`).
- Bracket score 1000000 → 400. Admin score set_number 99 → 400. Registration #maxTeams+1 → 409.

**Verify:** `npm run db:reset && npm run test`.

---

## Phase 5 — Pool/court generation correctness

**Goal:** generated schedules are physically playable: no court double-booking, no team in two places at once.

- `src/lib/pool-generation.ts`: net demand model — a pool of 6–7 consumes 2 courts, ≤5 consumes 1. Validate `sum(demand) <= netCount` BEFORE building pools; reject with `"N teams needs X nets (pools of 6+ use two courts). Reduce pool sizes or add nets."`. Assign court numbers cumulatively (a 2-net pool advances the counter by 2) so neighbors never overlap. Fix the stale doc comments (serpentine actually yields 3/4/4 for 11 teams, and pool A gets the smaller pool).
- `src/lib/match-generation.ts`: fix SCHEDULE_6 slot 3 (team 4 plays net 1 and works net 2 simultaneously) — swap the net-2 work assignment in that slot to a team idle in slot 3, preserving the no-self-work and balance properties; the new schedule must pass the invariant tests below. Fix the circle-method odd-n fallback (add bye dummy: `rotating.length` must be even) or make it throw explicitly before generating an incomplete schedule.
- `src/app/api/admin/matches/route.ts`: extend `validateMatches` to assert the physical invariants (cheap insurance behind the generators).

Tests first (unit — `match-generation.test.ts`, `pool-generation.test.ts`, new):
- For EVERY hardcoded schedule (4/5/6/7): round-robin completeness (each pair exactly once), no team works a match it plays in, and **no team appears on two courts in the same time slot** (play+work) — currently fails on SCHEDULE_6 slot 3.
- Circle fallback: every n in 8..16 → C(n,2) matches, every pair once.
- Pool generation: 12 teams/2 nets → rejected; 12/4 → pools on courts (1,2) and (3,4); 13/3 → rejected; mixed sizes get non-overlapping court ranges; awkward counts (7, 9, 11, 13) distribution balanced ±1; 6 teams/1 net → rejected.

**Verify:** `npm run test` (pure unit; no DB needed for this phase).

---

## Phase 6 — Client/admin behavioral fixes

**Goal:** what spectators and the admin see is live, consistent, and derived from the server's source of truth.

- **Live bracket polling**: `live/page.tsx:101-104` — move the brackets fetch into `useLivePolling` alongside standings/matches (same 12s cadence, only while live). Admin page: poll brackets with the existing pool-match poll, or refetch in the same interval.
- **Winner from `winner_slot_id`**: expose `winner_slot_id`/winner team id through `public/brackets` and use it in `BracketView.tsx:178`, `ResultsView.tsx:74`, `BracketSummaryCard.computeOutcome` instead of `score_a > score_b`. (Ties are now DB-impossible, but the stored winner is the contract.)
- **Seed labels**: `public/brackets` already knows each slot's frozen seed from generation — render bracket seed labels from bracket data, not from live-recomputed `computeOverallStandings` (`live/page.tsx:244-258`).
- **Generation guards**: in-flight `disabled` state on "Generate matches" and "Delete brackets" (`TournamentToolbar.tsx:82-90`, admin page `:450`); verify the brackets route inserts the `brackets` rows FIRST so `brackets_tournament_type_unique` + Phase 1's `(pool_id, match_order)` unique make double-generation a clean 409 server-side.
- **Honest destructive confirms**: regenerate-pools modal copy mentions that all matches AND scores are deleted; `handleRegenerate` calls `loadMatches()` after; delete/regenerate-brackets confirm states score loss.
- **`patchTeam`**: check `res.ok`, revert optimistic state + surface error on failure; `persistPools` refetches teams from the server immediately before running pool generation (pools generated from DB truth, not possibly-stale client state).
- **Playoff cutoff TOCTOU**: the generate-brackets POST includes the team IDs the admin previewed for gold; server recomputes and returns 409 `{ error: "standings_changed" }` if its computed gold set differs — modal re-opens with fresh data.

Tests first:
- Integration: `public/brackets` payload includes winner + frozen seeds; brackets double-POST → second gets 409 and DB has exactly one bracket set; matches double-POST → one schedule.
- Unit: any extracted pure helpers (e.g., outcome-from-winner-id).
- Client behavior beyond this is covered by Phase 7 E2E.

**Verify:** `npm run db:reset && npm run test`.

---

## Phase 7 — E2E suite (Playwright)

**Goal:** the full tournament-day lifecycle works through real browsers; the goal loop's final gate.

Scenarios (against `next dev` + local stack, DB reset per run):
1. **Happy path day**: register 8 teams → admin login → check-in + seed → generate pools (2 nets) → generate matches → open a score link via the live page's email-verify modal (any team's email — D5) → score a full match with +/- → End Set/End Match → standings update on live page within poll interval.
2. **Lock-on-complete**: reopen the same score URL → read-only "Match is final"; admin override modal can still correct the score and standings follow.
3. **Playoffs**: generate brackets → bracket score link → score to win condition (NOT complete yet, bracket unchanged) → End Match → next round populates on the live bracket WITHOUT a page reload (polling), work team shown.
4. **Undo/flip**: admin undoes the bracket match → re-scores with opposite winner → downstream slot + work team are correct (Phase 1 semantics, verified through the UI).
5. **Withdrawal**: withdraw a team mid-pool through the WithdrawTeamModal → opponents' forfeit wins appear in live standings; withdrawn team shown last; previously played results unchanged.
6. **Double-click**: hammer "Generate matches" → exactly one schedule.

**Verify:** `npm run test && npm run test:e2e` — the full cumulative gate.

---

## Deferred (explicitly out of scope — D1)

- Admin login rate limiting / per-admin credentials (single shared password remains).
- Raw Postgres error message sanitization on public routes.
- Email HTML escaping for team/player names; email-enumeration response shaping on `/verify`.
- `tournaments` table + FK migration; admin-managed tournament config.
- Two-device concurrent-scoring protection (D9 accepted risk).
- Token alphabet modulo bias; `team-stats.ts` dead code removal; polling error surfacing/backoff.

## Accepted-risk register

| Risk | Why accepted | Mitigation in place |
|---|---|---|
| Any participant can score any in-progress match | Deliberate open-access design (2026-04-27 tournament feedback) | Lock-on-complete (Phase 4), `submitted_by_team_id` audit trail, admin undo |
| Two devices scoring the same in-progress match overwrite each other | One-scorer social norm; rare; self-corrects with continued scoring | Lock-on-complete bounds the blast radius |

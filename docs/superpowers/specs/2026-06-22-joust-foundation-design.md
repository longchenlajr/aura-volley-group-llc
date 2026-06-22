# JoustHQ — Sub-Project 1: Foundation (Data Model + Generalized Engine)

- **Working name:** JoustHQ (final name pending domain/trademark check; does not affect design)
- **Date:** 2026-06-22
- **Status:** Design — pending user review, then implementation plan
- **Spec scope:** Sub-Project 1 of the JoustHQ v1 only. Sub-Projects 2 and 3 get their own spec → plan → build cycles.

---

## 1. Background

A volleyball tournament management system exists today as a custom build inside the Long Volleyball
("LV") page of the `aura-volley-group-llc` repo (Next.js 16 / React 19 / TypeScript / Supabase /
NextAuth). It runs a two-stage tournament: **pool play → single-elimination playoffs**, with three
audiences — an authenticated director, tokenized score-entry for "work teams," and a public live
scoreboard.

The system works well but encodes LV's specific event as **hardcoded constants**, not data:
tournament definitions live in `src/config/tournaments.json`; match formats are hardcoded by pool
size in `src/lib/score-format.ts`; round-robin schedules are hand-authored lookup tables capped at
3–7 teams in `src/lib/match-generation.ts`; there is a single implicit division; playoffs are a fixed
Gold/Silver split; and access is service-role-only with no tenancy.

The goal is to extract this into a standalone, sellable **Platform-as-a-Service** for tournament
directors, coaches, and schools.

## 2. Goals & Non-Goals (v1)

**v1 product shape (decided in brainstorming):**

- **Operated-for-client.** The operator (us) onboards each customer manually. No self-signup, no
  billing in v1.
- **Sport-agnostic core, volleyball-first profile.** The engine and schema are built around a
  pluggable **Sport Profile** abstraction. v1 ships **only** the volleyball profile. Adding a sport
  later is "author a new profile," with no engine changes.
- **Greenfield repo.** A new standalone project. The proven pure-function engine logic is lifted
  from the LV repo and generalized. LV stays running untouched and may become "customer zero" later.

**v1 feature scope:**

- Config-as-data hierarchy: **Series → Event → Division**, owned by an **Organization**.
- Multiple **independent divisions** per event, each with its own teams, courts/nets, pools, and
  playoff bracket(s).
- Per-division **match format** (presets + custom: sets/units, target, cap, win-by), and a separate
  format per bracket tier.
- **Playoff flexibility:** single-elimination, adjustable **qualification cutoff** (all / top-N
  overall / top-N per pool), and a configurable number of bracket **tiers** (generalizing today's
  Gold/Silver to 1..N).
- **Generalized round-robin scheduling** for arbitrary pool sizes (replacing the 3–7 lookup tables).

**Non-goals (explicitly deferred):**

- Billing, subscriptions, self-serve signup, plan limits.
- Auth-enforced multi-tenant isolation (RLS per tenant). We stamp ownership now as a seam; we do not
  build tenant isolation in v1.
- Additional sport profiles beyond volleyball (basketball, soccer, etc.).
- Double elimination; 3rd-place / consolation matches.
- Cross-event aggregation (season-long standings) and shared-across-events rosters. A Series is an
  organizational grouping only in v1.
- Director UI and participant UI — those are Sub-Projects 2 and 3.

## 3. v1 Decomposition

The full v1 is three subsystems built in dependency order, each with its own spec/plan/build:

1. **Foundation: data model + generalized engine** — *this spec*. The greenfield scaffold, the clean
   schema, and the ported-and-generalized engine. Carries all algorithmic risk; testable headless
   with no UI.
2. **Director surfaces: setup + run UI** — create/configure Series→Event→Division; operational
   control center (generate pools/matches/brackets, manage teams, override scores). Depends on (1).
3. **Participant surfaces: registration, token scoring, live board** — public registration,
   tokenized score entry, live scoreboard, all division-aware. Depends on (1); parallelizable
   with (2).

## 4. Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | v1 is operated-for-client (no billing/signup) | Fastest path to a real second customer; validates the engine generalization before platform plumbing |
| D2 | Sport-agnostic core, volleyball-only profile in v1 | Most of the engine is already sport-neutral; the sport-specific surface is small and bounded; avoids volleyball lock-in cheaply |
| D3 | Greenfield repo, lift pure engine functions | Engine is already pure functions; clean schema for divisions/tenancy beats retrofitting 16 legacy migrations; zero risk to live LV site |
| D4 | Hierarchy: Organization → Series → Event → Division | Matches the operator's mental model; Division is the independent unit of competition |
| D5 | Series = organizational grouping only | Cross-event aggregation is a large feature; defer until a customer needs it |
| D6 | Playoffs: single-elim + multi-tier + adjustable cutoff; defer 3rd-place & double-elim | Covers the stated must-haves; double-elim is significantly more complex bracket logic |
| D7 | Match format configured per-division (presets) + per-bracket-tier | Covers the vast majority of real tournaments without per-pool/per-stage config complexity |
| D8 | Generic "result units" model instead of volleyball `match_sets` | The single most important schema change; lets a profile interpret units as sets/periods/games and allows draws for future sports |
| D9 | Working name: JoustHQ | "HQ" frames it as the director's control center; warm/clear for non-technical buyers; "tournament" historically *was* a joust (on-theme) |

## 5. Detailed Design

### 5.1 Entity / Data Model

```
Organization            ← thin ownership seam; future multi-tenant root
└── Series              ← organizational grouping (e.g., "Summer 2026 League")
    └── Event           ← a date + venue
        └── Division    ← an independent mini-tournament
            ├── Teams / Participants
            ├── Pools          → Pool Matches      → Match Results (units)
            └── Bracket Tiers  → Bracket Matches   → Match Results (units)
```

Key model decisions:

1. **`sport_profile`** is a first-class concept (see §5.4 for the interface). A profile defines the
   result shape, draw rules, standings tiebreaker chain, and labels. A **Division** references a
   profile plus its specific format settings. v1 seeds exactly one profile row: `volleyball`.

2. **Generic match result, not `match_sets`.** Matches store an ordered list of **result units**
   (`unit_number`, `home_score`, `away_score`) plus a computed `winner` / `is_draw`. The volleyball
   profile interprets a unit as a "set." A future basketball profile treats one unit as the whole
   game; soccer allows `is_draw = true` in pool play. This replaces both the pool `match_sets` and
   bracket `bracket_match_sets` tables with one generic results model.

3. **Division owns its config as data** — `courts` (nets) allocated to the division, the pool-play
   match format, and the playoff config. Nothing that was a global constant remains a constant.

4. **Playoff config** lives on the Division:
   - `qualification_cutoff`: `all` | `top_n_overall` | `top_n_per_pool` (+ the N value).
   - `tiers`: integer 1..N. Tier 1 is seeded from the top qualifying group, tier 2 from the next,
     etc. (generalizing Gold/Silver). Each tier carries its own match format.

5. **Match format is frozen at generation time** onto the pool / bracket-tier (the pattern LV
   migration 016 already established), so a late withdrawal cannot retro-change how completed matches
   were scored.

6. **`Organization` as a thin ownership seam.** Every Series belongs to one Organization. v1 enforces
   no auth isolation (the operator runs everything), but stamping ownership now makes future
   multi-tenancy additive rather than a migration.

7. **Ported tables stay close to today** where already generic — `teams`, `pools`, `pool_teams`,
   `bracket_slots`, `bracket_matches`, score tokens — but scoped by `division_id` instead of a text
   `tournament_id`.

### 5.2 Generalized Engine

Module-by-module changes from the LV build:

1. **Seeding** — the serpentine/snake seeding is already generic (split seeded vs. unseeded, sort
   seeded, shuffle the rest, distribute serpentine). Parameterized on pool count/sizes. Ports nearly
   verbatim.

2. **Pool formation & round-robin scheduling — the main rewrite.** The hand-authored
   `SCHEDULE_4…SCHEDULE_7` lookup tables (capped at 7) encode three things at once: pairings, work-team
   assignment, and court-splitting for 6–7 team pools. Replace with an algorithm:
   - **Pairings:** standard **circle method** round-robin for any N (bye slot when N is odd).
   - **Work-team assignment:** derived algorithmically (the team sitting out / a fair rotation works).
   - **Court spreading:** generalize "two nets per pool" to "spread a pool's concurrent matches across
     the courts allocated to that division."
   - **Ordering quality:** LV's hand-tuned schedules minimize back-to-back games and balance work
     duty. A naive circle method won't match that, so add an **ordering pass** and lock the desired
     properties with property tests (see §5.5). This is the highest-risk new code.

3. **Match format — config-driven.** `getMatchFormat(poolSize)` is deleted. Format comes from the
   Division's pool-play format and each bracket tier's format, both drawn from presets the Sport
   Profile defines.

4. **Scoring, completion & winner — moved into the Sport Profile.** `isSetComplete` /
   `isMatchComplete` / `matchWinner` become profile behaviors operating on generic result units. The
   volleyball profile supplies win-by-2 + cap + best-of-N, answers "can this match draw?" (no), and
   "does a knockout need a decider?" Engine code never hardcodes "sets" again.

5. **Standings — tiebreaker chain from the profile.** `computePoolStandings` keeps its accumulation
   loop (wins, units-won, scored-for/against, differential) but the tiebreaker order becomes a
   profile-supplied ordered list of keys (volleyball: units-won → head-to-head → point-diff →
   points-for → seed). A `draws` column and optional win/draw/loss points support future sports;
   volleyball ignores them. `computeOverallStandings` (cross-pool, rate-normalized ranking that feeds
   bracket seeding) ports as-is.

6. **Playoff generation — multi-tier + adjustable cutoff.** Today: fixed Gold/Silver, top-2 default,
   `CHECK (bracket_type IN ('gold','silver'))`. Generalized:
   - Qualification cutoff is config: all / top-N overall / top-N per pool.
   - Tiers become 1..N; top qualifying group seeds tier 1, next group tier 2, etc.
   - Existing **pool-separation seeding** (recursive bisection keeping pool-mates apart) and
     **power-of-2 bye handling** port directly. Court allocation across tiers generalizes the
     Gold/Silver court split.
   - Single-elim advancement RPCs (`propagate_bracket_winner`, `assign_bracket_work_team`,
     `undo_bracket_match`, forfeit cascade) port largely intact — they are structure-driven, not
     volleyball-specific.

**Headline:** the only genuinely *new* algorithmic work is the generalized round-robin scheduler
(#2). Everything else is parameterization plus relocating volleyball constants into the volleyball
profile.

### 5.3 Module Boundaries

The engine is a **pure, framework-free module** — no Next.js, no Supabase imports. It takes plain
inputs and returns plain data, so it is testable headless and portable.

```
engine/                  ← pure TypeScript, zero framework deps
  seeding.ts             (serpentine seeding)
  scheduling.ts          (generalized round-robin + work/court assignment)
  brackets.ts            (multi-tier seeding, byes, advancement math)
  standings.ts           (accumulation + profile-driven tiebreakers)
  layout.ts              (bracket positioning math)
  profiles/
    types.ts             (SportProfile interface)
    volleyball.ts        (the only v1 profile)
db/                      ← schema, migrations, advancement RPCs
  (data-access layer maps DB rows ⇄ engine inputs/outputs)
```

The **data-access layer** is the only code that knows about both the DB and the engine; the engine
never touches the database. Transactional advancement logic (`propagate_bracket_winner`, etc.)
remains in the DB as RPCs for integrity.

### 5.4 Sport Profile Interface

A profile declares:

- `id`, `labels` — unit singular/plural and score noun (e.g., "set"/"sets"/"point").
- `formatPresets` plus the format field schema — best-of / target / cap / win-by.
- `allowsDraw` (pool play) and `knockoutRequiresDecider`.
- `isUnitComplete(unit, format)`, `isMatchComplete(units, format)`.
- `matchResult(units, format) → { winner | isDraw, summary }`.
- `standingsTiebreakers` — ordered list of keys.
- optional `standingsPoints` — win/draw/loss values, for future sports.

The volleyball profile fills these with LV's exact rules. Adding a sport later is one new file
implementing this interface, with zero engine edits.

### 5.5 Testing Strategy

1. **Characterization / golden tests (key de-risk).** Capture the current LV build's outputs — pool
   schedules for sizes 3–7, standings from real match data, Gold/Silver bracket seedings — as
   fixtures. Assert the new generalized engine + volleyball profile reproduces them exactly. Any
   change in volleyball output is caught immediately.
2. **Property tests for the scheduler (riskiest new code).** For pool sizes 3 through ~16: every pair
   meets exactly once; no team plays twice consecutively where avoidable; work duty is balanced; no
   team double-booked across a division's courts in one time slot.
3. **Profile-behavior unit tests.** Win-by-2 / cap / best-of edge cases; draw handling; tiebreaker
   ordering.
4. **Playoff tests.** Cutoff variants (all / top-N / top-N-per-pool); tier assignment; bye placement
   at non-power-of-2 counts; advancement + forfeit cascade.

### 5.6 Error Handling & Edge Cases

The design must explicitly handle:

- Too few teams for the requested pool/tier configuration.
- A qualification cutoff that exceeds the team count.
- Odd team counts (bye handling) in both pools and brackets.
- A division mid-flight when a team withdraws: forfeit cascade with format already frozen.
- Empty or under-filled bracket tiers.

## 6. Success Criteria

- The greenfield repo scaffolds and builds; the engine module has zero framework dependencies.
- The schema models Organization → Series → Event → Division with division-scoped config, generic
  result units, and playoff/format config as data.
- The volleyball Sport Profile, run through the generalized engine, **reproduces LV's current
  outputs** for representative fixtures (golden tests pass).
- The generalized round-robin scheduler produces valid, high-quality schedules for pool sizes 3–16
  (property tests pass).
- Multi-tier playoffs generate correctly for cutoff variants and non-power-of-2 team counts.

## 7. Open Questions (for implementation planning, not blocking this spec)

- Exact tech choices for the greenfield repo (confirm Next.js + Supabase to match the lifted code, or
  reconsider given no UI is in Sub-Project 1).
- Whether the engine ships as an internal module or an installable package from day one (leaning
  internal module; promote later if/when LV migrates).
- Concrete preset list for the volleyball profile (enumerate during implementation).

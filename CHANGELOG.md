# Changelog

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com), and this project adheres to [Semantic Versioning](https://semver.org).

---

## v0.1.0 — 2026-07-08

### Added
- **Tournament audit remediation** — Implemented three-phase integrity overhaul addressing correctness, security, and consistency issues identified in full-system audit.
- **Migration 014: schema integrity and RLS lockdown** — Added constraints on bracket matches and sets (no ties, no duplicate teams, work team guards), enforced one-pool-per-team uniqueness, added TOCTOU guard on schedule generation, dropped all anonymous RLS policies, hardened RPC access controls, and added guard checks in propagate/assign/undo functions.
- **Migration 015: transactional withdrawal RPC** — Implemented `withdraw_team(p_team_id, p_points_per_set, p_sets_per_match)` function handling atomically: scheduled/in-progress pool and bracket matches convert to forfeit wins, bracket slots manage deferred team populations, and recursive forfeit walk-up for downstream matches.
- **Migration 016: match format and forfeit standings** — Stored match format (sets/points per set) on pools, updated standings calculation to exclude forfeits from point differential and head-to-head comparisons, and ensured withdrawn teams rank below active teams.
- **Test harness (Phase 0)** — Converted vitest to workspace with separate unit and integration projects, created shared test helpers for database seeding and API invocation, configured Playwright E2E framework with local database orchestration, and added npm scripts for `test:unit`, `test:integration`, and `test:e2e`.
- **Local development tooling** — Added PostgREST proxy at `:54321/rest/v1`, CLI score editor (admin utility), development menus, and database scripts for deterministic integration testing.
- **Google Calendar and Drive integrations** — Connected tournament scheduling to Google Calendar, extracted tournament results to JSON, and automated gallery photo sync from shared Drive.

### Fixed
- **Playoff seeding and bracket labels** — Corrected seeding algorithms and bracket display labels across tournament types.
- **Registration flow** — Enhanced team/player registration validation and error handling.
- **Admin roster management** — Fixed team roster assignment and player synchronization in admin interface.
- **Bracket correction** — Added admin-only routes to reverse match scores, undo bracket propagation, and correct draw conflicts.
- **Withdrawn team handling** — Teams withdrawn at any stage now produce consistent bracket and standing states; no orphaned matches or lost team data.

### Changed
- **Architecture** — Refactored to service-role-only database access (dropped anonymous key usage except in registration now protected), increased validation at API and RPC boundaries, and moved towards integration-test-driven verification.
- **Ranking logic** — Primary sort by sets won, head-to-head tiebreaker for 2-way ties, point differential fallback. Match wins remain display-only. Withdrawn teams sort to bottom.
- **Scoring workflow** — Score submissions POST to token routes; once a match is complete (explicit `complete: true`), subsequent POSTs are rejected (HTTP 409). Corrections require admin interface.
- **Email handling** — Switched to Resend for transactional email delivery (confirmations, score links, admin alerts).

### Removed
- **Boilerplate scaffolding** — Replaced `create-next-app` template with domain-specific documentation and test framework.
- **Anonymous RLS policies** — All public/anon SELECT/INSERT policies removed; database is now service-role-only.
- **JoustHQ sub-project docs** — Foundation spec moved to joust-hq repository.

### Known limitations
- **Concurrent scoring** — Two-device simultaneous score entry on a single match is last-write-wins; mitigated by social norm (one scorer per match) and audit trail (`submitted_by_team_id`). Accepted risk per D9 in IMPLEMENTATION-PLAN.
- **Deferred work** — Login rate-limiting, error-message sanitization, email HTML escaping, explicit tournaments table, token modulo bias, and dead-code cleanup scheduled for future phases.

---

## Earlier versions

Earlier work on this codebase focused on initial tournament system scaffolding, player archival and historical records management, and foundational database schema. Refer to git history for pre-v0.1.0 details.

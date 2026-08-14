# Design: The payment data model and its states

**Ticket:** [Design the payment data model and its states](https://github.com/longchenlajr/aura-volley-group-llc/issues/18)

Pulls together the price model (#14), the fee decision (#16), and the payment-ordering decision (#17) into one concrete schema. This is a design, not a migration file — the implementer writes the actual migration (numbered whatever the latest is at that time) following this shape.

## `teams` table — one new column

```sql
alter table teams add column paid boolean not null default false;
```

Mirrors `checked_in` exactly: same type, same default, same toggle pattern in `TeamRoster.tsx`, same allowlist entry in the admin PATCH route. Every existing admin/CLI pattern for a boolean team field applies unchanged.

**No `payment_preference` field.** Considered and rejected — once the one-shot payment screen closes without completing (per #17), there's no operational difference between "chose in-person" and "chose online but didn't finish." Not worth a column for a distinction nothing acts on.

## New `payments` table

```sql
create table payments (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null unique references teams(id) on delete cascade,
  status text not null check (status in ('pending', 'completed', 'failed', 'refunded')),
  paypal_order_id text not null,
  paypal_capture_id text,
  entry_fee_cents integer not null,
  convenience_fee_cents integer not null,
  amount_cents integer not null,
  currency text not null default 'USD',
  payer_email text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table payments enable row level security;
-- No policies added. Service-role only, following migration 014's house style.
```

**One row per team, not per attempt.** The `unique` constraint on `team_id` makes this structural, not just a convention — it gives a clean 1:1 join from `teams` and enables `ON CONFLICT (team_id) DO UPDATE` for the webhook's idempotent upsert. If a buyer's card is declined and they retry within the same one-shot screen, the row is updated in place with the new attempt's order id, not duplicated. Considered and rejected: one-row-per-attempt history — nothing decided so far calls for attempt-level debugging, and PayPal's own dashboard already retains that history if it's ever needed.

**Column notes:**

- `status` — `pending` (order created, not yet captured) → `completed` (captured) or `failed`. `refunded` exists as a placeholder state; #20 (refund/withdrawal behavior) defines exactly when and how it's set — not resolved here.
- `entry_fee_cents` / `convenience_fee_cents` stored **separately**, not just as a combined total — required for itemizing the $3 fee as its own line per #16's resolution, and useful for reporting (e.g., total convenience fees collected vs. total entry fees, if that's ever wanted).
- `amount_cents` — the actual total charged/captured, stored explicitly rather than computed from the other two at read time, so it always reflects exactly what PayPal captured even if fee logic changes later. Should equal `entry_fee_cents + convenience_fee_cents` at write time, but isn't derived from them after the fact.
- `payer_email` — from PayPal's payer info on the order/capture response. Nullable, useful for support lookups.
- All money in integer cents, per the house convention locked in #14.

## How `teams.paid` gets set — three paths, one column

1. **Client-side capture success (optimistic).** The browser's capture response immediately sets `teams.paid = true` and upserts the `payments` row to `completed`, for a snappy confirmation screen. Per #17, this is a nicety, not the source of truth.
2. **Webhook (authoritative).** Independently performs the same idempotent upsert — `ON CONFLICT (team_id) DO UPDATE` keyed by `team_id`, using the webhook event id for dedup against PayPal's documented retry behavior (up to 25 attempts over 3 days, per #15's research). This is what actually guarantees correctness if the buyer's browser vanishes right after paying.
3. **Admin manual toggle (cash, or anything outside PayPal).** Same `checked_in`-style PATCH allowlist entry on `teams.paid`. **No `payments` row is created or touched.**

## Distinguishing "paid online" from "admin marked paid"

Not a separate column — derived from whether a `payments` row exists:

- `teams.paid = true` **and** a `payments` row with `status = 'completed'` → paid online via PayPal.
- `teams.paid = true` with **no** `payments` row (or one not in `completed` status) → admin-marked (cash, or anything else outside the system).

## Implementation checklist for whoever picks this up

- Migration: the two DDL blocks above, numbered as the next migration at implementation time.
- Add `paid` to the allowlist in `src/app/api/admin/teams/[id]/route.ts` (the `"key" in body` checks).
- Add `paid: boolean` to the `Team` interface in `src/app/admin/tournament/[tournamentId]/types.ts`.
- Add the same to the **separate, duplicate** `Team` interface in `scripts/cli/menus/teams.ts` — this file declares its own copy and will not pick up the admin one's changes.
- `TeamRoster.tsx`: new column (desktop table + mobile card + the hardcoded `colSpan` group-header count), following the exact `checked_in` toggle pattern already there.
- Add `payments` to `ALL_TABLES` in `tests/helpers/db.ts` or the integration suite will leak state between test runs.
- RLS: enabled, zero policies — service-role access only via API routes (which carry their own `auth()` check) and the webhook route (which carries its own signature verification, per #19).

## Verdict for the map

Schema locked: `teams.paid` boolean (unchanged pattern) + a `payments` table, one row per team, distinguishing online vs. admin-marked payment by whether a completed `payments` row exists. Ready for #19 (webhook) and #20 (refunds) to build on.

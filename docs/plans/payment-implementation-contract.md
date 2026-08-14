# Payment Implementation Contract

**Read this first.** The other payment docs in this folder record *why* decisions were made. This one records *exactly what to build*, so no assumptions have to be invented at implementation time.

Companion docs (background, not instructions):
- [`payment-data-model.md`](./payment-data-model.md) — schema and its reasoning
- [`webhook-receiver-design.md`](./webhook-receiver-design.md) — webhook verification/idempotency reasoning
- [`processor-fee-decision.md`](./processor-fee-decision.md) — why a $3 convenience fee and not a surcharge (legal reasoning)
- [`paypal-integration-surface-decision.md`](./paypal-integration-surface-decision.md) — why Standard Checkout
- [`venmo-verification-findings.md`](./venmo-verification-findings.md) — Venmo constraints

---

## 0. The single most important thing: how an order maps back to a team

A PayPal webhook payload contains PayPal's own ids. It knows nothing about teams. The linkage must be established explicitly at order-creation time, two ways (belt and braces):

1. **`custom_id` on the purchase unit.** When creating the PayPal order, set `purchase_units[0].custom_id = <team_id>`. PayPal echoes this back on the capture resource in the webhook payload, so the handler can read the team id directly out of the event.
2. **`paypal_order_id` stored on the `payments` row** at creation time. This is the fallback lookup path if `custom_id` is ever missing from a payload.

**Webhook resolution order:** read `resource.custom_id` first; if absent, look up the `payments` row by the order id found at `resource.supplementary_data.related_ids.order_id`. If **neither** resolves to a known team, log loudly and return 200 (so PayPal stops retrying a message that will never succeed) — do not guess, and do not match on payer email or amount.

Do not attempt to derive the team from anything else. No email matching, no amount matching, no "most recent pending payment" heuristics.

---

## 1. Configuration

### New per-tournament flag

Add to the `Tournament` interface in `src/lib/tournaments.ts`, following `collectShirtSize` exactly:

```ts
onlinePaymentEnabled?: boolean;
```

Absent/false = today's behavior exactly (cash only, no payment UI, no PayPal SDK loaded). Set to `true` only on the specific tournaments that should offer it.

Also add `priceCents` per #14:

```ts
priceCents?: number;  // integer cents, e.g. 2500 for $25/player
```

Set `priceCents: 2500` on all existing entries to preserve current behavior. `onlinePaymentEnabled` stays absent on all of them until deliberately turned on.

**Remember the third declaration:** `scripts/cli/index.ts` declares its own duplicate `TournamentConfig` interface. It must be updated too or the CLI won't see these fields.

### The convenience fee constant

Create `src/lib/payments.ts` with a single source of truth:

```ts
/** Flat online-payment convenience fee, in integer cents. See docs/plans/processor-fee-decision.md */
export const ONLINE_CONVENIENCE_FEE_CENTS = 300;
```

**Do not duplicate this literal anywhere.** (Cautionary precedent in this repo: `SHIRT_SIZES` is independently declared in three separate files.) It is a flat amount by legal necessity — it must never scale with team size, or it stops being a convenience fee and becomes a surcharge, which carries an entirely different (and unmet) compliance burden. See `processor-fee-decision.md`.

### Environment variables

Already provisioned in `.env.development.local` (sandbox):
- `NEXT_PUBLIC_PAYPAL_CLIENT_ID` — public, used in the browser SDK script tag
- `PAYPAL_CLIENT_SECRET` — server-only, never exposed

Production keys are **not** provisioned yet — that's a known open item, not an oversight.

---

## 2. Database migration

Use **the next available migration number** — check `supabase/migrations/` for the highest existing and add one. (At planning time the highest was `018`, so `019` is likely, but verify rather than assume; other work may have landed since.)

```sql
-- teams: one new column, mirroring checked_in exactly
alter table teams add column paid boolean not null default false;

-- payments: one row per team
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

create index payments_paypal_order_id_idx on payments (paypal_order_id);

alter table payments enable row level security;
-- No policies. Service-role only, per migration 014's lockdown pattern.
```

The index on `paypal_order_id` exists specifically to support the webhook's fallback lookup path (§0).

`team_id` is `unique` — this is what makes `ON CONFLICT (team_id) DO UPDATE` work and enforces one-row-per-team structurally.

---

## 3. The three routes

### 3.1 `POST /api/payments/create-order`

**Public** (the buyer is not logged in). Creates a PayPal order and the `pending` payments row.

**Request:** `{ teamId: string }` — **and nothing else.**

**The security invariant, stated plainly:** the amount is computed entirely server-side from the tournament config. Never accept, read, or trust any amount, price, or fee value sent by the client. The existing shop route (`src/app/api/checkout/route.ts`) already does this correctly and is worth reading as a reference.

**Guards, in order — each returns an error, none proceed:**

| Check | Failure response |
|---|---|
| Team exists | 404 |
| `team.withdrawn_at` is null | 409 — withdrawn teams can't pay |
| `team.paid` is false | 409 — already paid, don't double-charge |
| Tournament exists for `team.tournament_id` | 404 |
| `tournament.onlinePaymentEnabled === true` | 403 |
| `tournament.priceCents` is set | 500 — misconfiguration, not user error |

**Amount computation:**

```
entryFeeCents       = tournament.teamSize * tournament.priceCents
convenienceFeeCents = ONLINE_CONVENIENCE_FEE_CENTS
amountCents         = entryFeeCents + convenienceFeeCents
```

**PayPal order creation** — Orders v2, with:
- `intent: "CAPTURE"` (not AUTHORIZE — this is immediate payment, no delayed fulfillment)
- `purchase_units[0].custom_id = teamId` ← **the linkage from §0, do not omit**
- `purchase_units[0].amount.currency_code = "USD"`
- `purchase_units[0].amount.value` = `amountCents` formatted as a decimal string (PayPal takes `"53.00"`, not cents — convert at the boundary, keep cents internally)
- An `amount.breakdown` splitting `item_total` (entry fee) from `handling` (convenience fee), so the buyer sees the $3 itemized rather than one opaque total. Per #16, the fee must be visible as its own line.

**Then upsert the payments row:**

```sql
insert into payments (team_id, status, paypal_order_id, entry_fee_cents, convenience_fee_cents, amount_cents)
values (...)
on conflict (team_id) do update set
  status = 'pending',
  paypal_order_id = excluded.paypal_order_id,
  entry_fee_cents = excluded.entry_fee_cents,
  convenience_fee_cents = excluded.convenience_fee_cents,
  amount_cents = excluded.amount_cents,
  paypal_capture_id = null,
  completed_at = null;
```

The upsert (rather than insert) matters: if a buyer's card is declined and they retry within the one-shot window, a second order is created for the same team and must replace the first row, not collide with the unique constraint.

**Response:** `{ orderId: string }` — nothing else. No amounts echoed back that the client could tamper with on a subsequent call.

**Note on exposure:** this route takes a team id and is unauthenticated, so someone could theoretically create an order for a team that isn't theirs. The impact is that they'd be paying someone else's entry fee, which is not a meaningful attack. Do not over-engineer against this. Light rate limiting mirroring the pattern already in `src/app/api/register/route.ts` is reasonable but optional.

### 3.2 `POST /api/payments/capture-order`

**Public.** The optimistic path — gives the buyer an instant confirmation screen. **Not the source of truth** (§4).

**Request:** `{ orderId: string }`

**Behavior:**
1. Find the `payments` row by `paypal_order_id`. 404 if unknown.
2. **If already `completed`, return success immediately without calling PayPal again.** This is the idempotency guard for a double-clicked button or a retried request.
3. Call PayPal's capture endpoint for that order.
4. On success, apply the same state transition as the webhook (§4): set `status = 'completed'`, `paypal_capture_id`, `completed_at`, `payer_email`, and `teams.paid = true`.
5. On PayPal reporting failure, set `status = 'failed'` and leave `teams.paid` alone (it stays false).

**Response:** enough for the confirmation screen to render — success/failure plus the amounts already stored on the row.

### 3.3 `POST /api/paypal/webhook`

**Public, and completely unprotected by the framework** — `src/middleware.ts`'s matcher excludes `api/`. The signature verification below **is** the entire auth story for this route.

**Order of operations — this sequence is not optional:**

1. **Read the raw body first:** `const rawBody = await req.text()`.
2. Verify by POSTing the raw body + the relevant PayPal headers to PayPal's `/v1/notifications/verify-webhook-signature` endpoint.
3. **Only after verification passes**, `JSON.parse(rawBody)`.

**Why the order matters:** parsing to JSON and re-serializing produces a different byte sequence than what PayPal signed, so verification will fail in ways that look mysterious. This is the single most common way this integration is gotten wrong.

If verification fails: return 401, touch nothing in the database.

**Then:** resolve the team per §0, apply the state transition per §4.

**Always return 2xx once the event has been handled or deliberately ignored** — including the "can't resolve a team" case. A non-2xx makes PayPal retry the same undeliverable message up to 25 times over 3 days.

**Events to subscribe:**
- `PAYMENT.CAPTURE.COMPLETED` — the primary one
- `PAYMENT.CAPTURE.DENIED` — mark failed
- `PAYMENT.CAPTURE.REFUNDED` — **receive and log only.** Refund handling was deliberately deferred (#20 chose manual refunds via PayPal's dashboard). Leave a `TODO` referencing #20. Do not implement refund state changes here, and do not silently drop the event either.

---

## 4. State transitions — the exact table

Both the capture route and the webhook apply these. Any transition not listed is a **no-op**: log it and move on, do not error, do not apply it.

| From | To | Trigger |
|---|---|---|
| *(no row)* | `pending` | create-order |
| `pending` | `completed` | successful capture, or `PAYMENT.CAPTURE.COMPLETED` |
| `pending` | `failed` | failed capture, or `PAYMENT.CAPTURE.DENIED` |
| `failed` | `pending` | create-order again (buyer retries in the same window) |
| `completed` | `refunded` | *(reserved — #20, not implemented now)* |

**Explicitly forbidden, and the reason the guard exists:** `completed → pending`, `refunded → completed`, `refunded → pending`. A delayed PayPal retry can deliver a stale `CAPTURE.COMPLETED` *after* a refund has already been recorded; without this guard, that stale event would silently un-refund the team.

**`teams.paid` follows `payments.status`:** `true` when `completed`, `false` in every other state.

---

## 5. What the "pay in person" path does

**Nothing.** No `payments` row is created, no PayPal order, no SDK loaded. The team is created exactly as today with `paid = false`, and an admin flips `teams.paid` manually at check-in.

This is what makes the "paid online vs. admin-marked paid" distinction work: a team with `paid = true` and **no** `payments` row was marked by a human; a team with `paid = true` **and** a `completed` payments row paid online.

---

## 6. Client-side

Use `@paypal/react-paypal-js` (v10.3.0, confirmed React 19-compatible) in a `"use client"` component, matching the existing pattern in the admin and checkout pages. There are no server actions anywhere in this repo — everything is `fetch()` to a route handler.

**The SDK script must include `enable-funding=venmo`** or the Venmo button will simply not appear — it is not shown by default. This single parameter is the entire reason PayPal was chosen over Stripe; omitting it silently defeats the purpose of this work.

**For sandbox testing, also add `buyer-country=US`** or Venmo won't render in the sandbox environment either.

Flow: registration submits as it does today → if the captain checked "pay online" **and** the tournament has `onlinePaymentEnabled`, reveal the payment step → the PayPal buttons call `create-order`, then `capture-order` on approval → show confirmation.

If the buyer abandons here, nothing further happens. Per #17 there is no pay-later link, no reminder, no retry token. The team simply remains unpaid and pays cash at check-in.

---

## 7. Admin surface

Add `paid` to the allowlist in `src/app/api/admin/teams/[id]/route.ts`:

```ts
if ("paid" in body) teamUpdates.paid = body.paid;
```

**If this line is missing, the admin toggle will silently do nothing** — the route drops unrecognized keys without erroring.

Then:
- `src/app/admin/tournament/[tournamentId]/types.ts` — add `paid: boolean` to `Team`
- `scripts/cli/menus/teams.ts` — add it to that file's **separate, duplicate** `Team` interface; it does not import the admin one
- `TeamRoster.tsx` — new column in **both** the desktop table and the mobile card (two parallel markup trees render the same data), and bump the hardcoded `colSpan={6}` on the group-header row to `7`
- Follow the existing `checked_in` toggle pattern exactly, including the optimistic `patchTeam` update

---

## 8. Tests

`tests/helpers/db.ts` — **add `payments` to `ALL_TABLES`** or integration tests will leak state between runs (`resetDb()` truncates only what's listed).

Mock PayPal the same way `resend` is already mocked in `tests/integration/register.test.ts` — `vi.mock` at the module boundary. Do not call the real sandbox from automated tests.

At minimum, cover:
- create-order computes the amount **server-side** and ignores any amount in the request body
- each guard in §3.1 (withdrawn team, already-paid team, payment-disabled tournament)
- capture-order is idempotent when the row is already `completed`
- webhook rejects a request whose signature fails verification, without any DB write
- webhook resolves the team via `custom_id`
- the forbidden transitions in §4 are no-ops — specifically, a stale `CAPTURE.COMPLETED` must not overwrite a `refunded` row
- a `pay in person` registration creates **no** `payments` row

Real end-to-end sandbox testing needs a tunnel (e.g. ngrok), since PayPal cannot reach `localhost`. That's a manual dev workflow, not an automated test.

---

## 9. Copy that becomes wrong the moment this ships

These currently hardcode `$25` and/or "Cash only" / "due at check-in". All must read from `priceCents` and account for the online option. Enumerated so they aren't rediscovered by grepping:

- `src/app/api/register/route.ts` — `const total = tournament.teamSize * 25`, plus the confirmation email in **both** HTML and plaintext
- `src/app/(tournament)/longvolleyball/register/page.tsx` — success-screen invoice table
- `src/app/(tournament)/TournamentPicker.tsx` — `getEntryFee(teamSize)`
- `src/app/(tournament)/longvolleyball/page.tsx` — landing page copy
- `src/app/(tournament)/longvolleyball/rules/page.tsx` — "Cash is preferred, but other payment methods will be available."

Where a team paid online, the receipt/confirmation must itemize the **$3 convenience fee as its own line**, separate from the entry fee — this is a compliance requirement from `processor-fee-decision.md`, not a formatting preference.

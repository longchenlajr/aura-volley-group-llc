# Design: The webhook receiver

**Ticket:** [Design the webhook receiver: verification, idempotency, auth](https://github.com/longchenlajr/aura-volley-group-llc/issues/19)

This is genuinely new infrastructure for this repo — no webhook route, cron, or queue exists today. Builds directly on #18's schema (`payments`, one row per team) and #17's decision that the webhook is the authoritative source of truth for `paid`.

## Verification: call PayPal's endpoint, don't reimplement it

POST the received headers + raw body to PayPal's `/v1/notifications/verify-webhook-signature` endpoint; trust its yes/no answer. Rejected: computing the CRC32 signature check locally — this route has **zero other protection** (see Auth below), so correctness here matters more than the cost of one extra API round-trip per delivery.

**Critical implementation gotcha:** the raw request body must be read **before** any JSON parsing. In a Next.js route handler, that means capturing `await req.text()` first, using that exact raw string for verification, and only calling `JSON.parse()` on it afterward. Parsing to JSON first and re-serializing for verification can produce a different byte sequence than what PayPal actually signed, silently breaking verification.

## Auth: the route guards itself entirely

`src/middleware.ts`'s matcher excludes `api/` — this route gets no automatic protection. Anyone can POST to it. The signature verification above **is** the auth; there is no session check, no API key, nothing else. A request that fails verification must be rejected (4xx) without touching the database at all.

## Idempotency: naturally idempotent, no new table

Per #18, `payments` has one row per team, upserted by `team_id`. Replaying the same event twice (PayPal retries up to 25 times over 3 days per its documented behavior) just re-sets the same `status` to the same value — a no-op, not a correctness problem. No dedup ledger needed.

**One explicit guard is still required:** a state-transition check in the handler so a *stale* event can't clobber a *later* one arriving out of order — e.g., a delayed `PAYMENT.CAPTURE.COMPLETED` retry must not overwrite a row that's already `refunded`. Concretely: only transition `pending → completed`/`failed`, and only transition `completed → refunded` (never the reverse, never skip backward). A handful of lines in the handler, not new infrastructure.

## Ordering: both paths converge on the same state

The buyer's browser may call the capture-confirmation route before or after the webhook fires for the same event — both are racing to upsert the identical `payments` row to the identical target state (per #17, the client path is optimistic, the webhook is authoritative). Whichever arrives first wins; whichever arrives second is a no-op given the idempotent upsert above. No ordering coordination needed between the two paths.

## Which events to subscribe

- **`PAYMENT.CAPTURE.COMPLETED`** — the primary event. Upserts `payments.status = 'completed'`, sets `paypal_capture_id`, `completed_at`, and `teams.paid = true`.
- **`PAYMENT.CAPTURE.DENIED`** — upserts `payments.status = 'failed'`. `teams.paid` stays `false`.
- **`PAYMENT.CAPTURE.REFUNDED`** — subscribed at the endpoint level now (one webhook URL receives all subscribed event types), but the exact handling logic (does `teams.paid` flip back to `false`? does the entry stay "registered" either way?) is **not decided here** — that's #20's job. For now this event should be received and logged, with a TODO pointing at #20 rather than silently ignored or guessed at.

## What it's permitted to mutate

Only `payments` and `teams.paid`. Never team name, contact info, players, seed, or anything else on the roster. The webhook has one job.

## Observability

This repo has no error tracking and no CI. Building either is out of scope for this ticket. Pragmatic answer given that constraint: log verification failures and processing errors to the function's console output (captured in Vercel's function logs), and rely on **PayPal's own Webhook Events dashboard** as the safety net — failed deliveries are visible there and can be manually resent. This is a known limitation, not a gap this ticket closes; flagged so it isn't mistaken for an oversight later.

## Local development and testing

- **Automated tests:** mock the `verify-webhook-signature` call the same way `resend` is already mocked in `tests/integration/register.test.ts` (`vi.mock` at the module boundary), and invoke the route handler directly with a hand-built `NextRequest` carrying a sample PayPal event payload — same pattern already established for `/api/register`.
- **Real sandbox testing:** PayPal cannot reach `localhost` directly, so exercising an actual webhook delivery end-to-end during local development requires a tunnel (e.g. ngrok) pointed at the dev server. This is a local dev workflow note, not an automated test requirement.

## Verdict for the map

Route design locked: verify via PayPal's API, guard the route entirely via that verification (no other auth exists), naturally idempotent via the existing one-row-per-team upsert plus a state-transition guard, subscribed to capture-completed/denied now with refund handling explicitly deferred to #20, and log-only observability given the repo's current constraints.

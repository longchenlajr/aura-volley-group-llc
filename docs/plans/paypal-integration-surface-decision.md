# Research: Choosing the PayPal integration surface

**Ticket:** [Choose the PayPal integration surface](https://github.com/longchenlajr/aura-volley-group-llc/issues/15)
**Sources:** developer.paypal.com (Checkout, Webhooks, Venmo docs), paypal.com/us/business/paypal-business-fees, npm registry (`@paypal/react-paypal-js`).

## Recommendation: Standard Checkout (PayPal Checkout via the JS SDK / `@paypal/react-paypal-js`, Orders v2 REST API server-side)

This confirms the account setup from #12 was the right call, rather than overriding it. Compared against the other two candidates:

## Comparison

| Criterion | **Standard Checkout** | Advanced Checkout | Braintree |
|---|---|---|---|
| **Venmo support** | **Yes — confirmed** ([#13](https://github.com/longchenlajr/aura-volley-group-llc/issues/13)), via `enable-funding=venmo` on the same JS SDK | Yes, same underlying account/SDK | Yes, but a separate integration entirely |
| **Setup friction** | None beyond what #12 already did | **Requires PayPal application/approval** — "Advanced Credit and Debit Card Payments" is listed under "PayPal Online Payment Services," explicitly "subject to eligibility, application, and approval by PayPal" per the fee schedule. Not a dashboard toggle. | Separate product, separate account linking, separate dashboard |
| **Fee (domestic)** | 3.49% + $0.49 (same for standard, guest checkout, and Venmo — verified, no premium for any of them) | 2.89% + fixed fee, but gated behind the approval above | Comparable, published separately on Braintree's own fee page |
| **Server/client split** | Client renders the button (`paypal.Buttons()` or the React wrapper); server creates and captures the order via the Orders v2 REST API from a route handler | Same REST API underneath, plus hosted card fields on the client | Own client SDK (`braintree-web`), own server SDK — not the Orders v2 API |
| **Webhooks** | Standard PayPal REST webhooks (`/v1/notifications/verify-webhook-signature` or CRC32) — same system whether Standard or Advanced | Same as Standard | **Braintree has its own separate webhook/notification format**, incompatible with PayPal's REST webhooks |
| **Refunds via API** | Yes, Orders v2 refund endpoint | Same | Yes, via Braintree's own API |
| **npm / React 19 / App Router fit** | `@paypal/react-paypal-js` v10.3.0 — peer deps explicitly include React 19. Used as a `"use client"` component, matching the existing pattern (checkout page, admin pages) | Same package, plus card-field components | Different package family (`react-braintree-fields`, etc.), not evaluated further given no material benefit |

## Why not the other two

**Advanced Checkout** buys inline, on-page card fields instead of PayPal's hosted card entry inside the Standard Checkout flow (guest checkout already lets non-PayPal-account buyers pay by card — it's just a popup/redirect rather than an embedded field). That's a UI polish tradeoff, not a functional gap, and it comes with a real cost: an approval process with PayPal before it can be used at all. Nothing about this registration flow needs that polish badly enough to accept an approval dependency and delay.

**Braintree** is PayPal-owned but architecturally a different product — separate SDKs on both client and server, and critically, a **separate webhook system** entirely incompatible with the PayPal REST webhooks that Standard Checkout uses. Adopting it would mean redoing the account linking from #12 and building the webhook receiver (#19) against a different spec, for no capability Standard Checkout doesn't already have for this use case.

## Implementation-relevant facts for later tickets

- **Webhook verification:** PayPal's REST webhooks support two verification methods — compute CRC32 yourself, or call PayPal's own `/v1/notifications/verify-webhook-signature` endpoint to check it for you. The latter is simpler and is what #19 should default to.
- **Webhook retry behavior:** PayPal retries a failed webhook delivery (non-2xx response) up to **25 times over 3 days**. This should inform the idempotency key design in #19 — dedupe on the webhook event id, since the same event can and will arrive more than once.
- **Server-side flow:** create the order via the Orders v2 API, capture via the same API — both from a Next.js route handler, consistent with this repo's existing pattern (no server actions anywhere in the app).

## Verdict for the map

Standard Checkout is confirmed as the integration surface. No change to the account/product setup already done in #12.

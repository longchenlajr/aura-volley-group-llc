# Research: Is Venmo actually available to our buyers?

**Ticket:** [Verify Venmo is actually available to our buyers](https://github.com/longchenlajr/aura-volley-group-llc/issues/13)
**Sources:** developer.paypal.com (Pay with Venmo overview + integration guide, current as of the page's "Last updated" dates below), paypal.com/us/business/paypal-business-fees (dated July 15, 2026).

## Bottom line

**Venmo works with Standard Checkout — no need for Braintree or Advanced Checkout.** It integrates through the exact same `paypal.Buttons()` JS SDK smart-button flow that Standard Checkout uses. This directly confirms the stated intent to use Standard Checkout was correct, and de-risks ticket #15's choice.

There is exactly one concrete implementation gotcha and one real (untested) risk. Both are actionable, neither is a blocker.

## How it actually works

- Venmo appears as an **additional button** next to the PayPal button(s) you already render — same page, same `paypal.Buttons()` call.
- **It does NOT appear by default.** You must add `enable-funding=venmo` as a query parameter to the JS SDK `<script>` tag:
  ```html
  <script src="https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&enable-funding=venmo"></script>
  ```
  This is the one concrete thing to not forget when #15/#17 get implemented.
- **Desktop:** clicking the Venmo button shows a **QR code**. The buyer scans it with their phone (Venmo app or camera), approves on their phone, and is redirected back to the site on desktop when done.
- **Mobile web:** clicking the Venmo button **switches directly to the Venmo app** to approve, then returns to the site.

## Eligibility (confirmed against official docs)

- US-based merchant and US-based consumer only. USD only. — matches this account, already confirmed eligible in ticket #12.
- Buyer **must have the Venmo app installed** — no fallback if they don't (they'd just use a different PayPal-supported method instead).
- **Mobile web buyers must use Safari on iOS or Chrome on Android.** Other mobile browsers are not listed as supported.

## The one real risk, not yet tested

Registration links for a beach volleyball community are plausibly shared via Instagram/Facebook DMs, group chats, or other apps that open links in an **embedded in-app browser** rather than actual Safari/Chrome. PayPal's docs only confirm Safari (iOS) and Chrome (Android) — in-app webviews aren't mentioned either way. If the Venmo button doesn't work correctly inside those embedded browsers, affected buyers would need to explicitly "open in Safari/Chrome" or fall back to a different payment method. This is worth a real device test before launch, but it's not a reason to abandon Venmo — the desktop QR fallback and normal mobile browser flow are both confirmed to work regardless.

## Fees (verified, not estimated)

From PayPal's current published merchant fee schedule:

| Payment type | Domestic rate |
|---|---|
| PayPal Checkout (standard) | 3.49% + $0.49 |
| **Pay with Venmo** | **3.49% + $0.49 — identical to standard PayPal Checkout** |
| Standard Credit/Debit Card | 2.99% + $0.49 |

**No Venmo premium.** Enabling Venmo costs nothing extra over standard PayPal Checkout. International transactions add +1.50%. For reference, this is meaningfully higher than Stripe's ~2.9% + $0.30 — a real number for ticket #16 (who absorbs the fee) to use, no longer a rough estimate.

## Other confirmed facts, useful downstream

- Refunds are supported via API (Orders v2 refund endpoint) — relevant to ticket #20.
- Sandbox testing requires adding `&buyer-country=US` to the JS SDK script to simulate the Venmo button appearing.
- Venmo does **not** support: multi-seller/marketplace payments, save-for-later, buy-online-pay-in-store. None of these apply to this registration use case.

## Verdict for the map

Venmo is genuinely available and works through the exact integration surface already chosen. The map's rationale for picking PayPal over Stripe holds. Proceed.

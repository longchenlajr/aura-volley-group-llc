# Decision: Who absorbs the processor fee

**Ticket:** [Decide who absorbs the processor fee](https://github.com/longchenlajr/aura-volley-group-llc/issues/16)
**Sources:** dealerpayments.com/surcharge-laws/pennsylvania (cross-referenced against the actual PA House Bill 1780 text at palegis.us), weaudit.com (Visa Core Rules summary for convenience fees), PayPal's published merchant fee schedule (verified in #13/#15's research).

## Decision: a flat $3 convenience fee on online payment, not a surcharge

Added to every online registration, regardless of team size. Cash at check-in remains exactly $25/player, no fee, unchanged.

## Pennsylvania law: not actually the binding constraint

Pennsylvania has **no enacted state statute** restricting or capping credit card surcharges as of this research. House Bill 1780 (the "Transparent Payment Fees Act") would create one — capping surcharges at actual processing cost and requiring disclosure — but it has only cleared committee (26–0, June 2026) and sits with the House Rules Committee. **Not law.** So PA itself doesn't block anything here.

What actually governs is the **card network rules**, which apply nationwide regardless of state statute:

- Visa caps a surcharge at **3%** of the transaction (or actual cost of acceptance, whichever is lower); Mastercard caps at 4%.
- **Debit, prepaid, and gift cards can never be surcharged — a card-network rule, not a state one, with no exceptions anywhere.**
- Surcharging requires **30 days' written notice to your acquirer** before the first surcharged transaction, plus disclosure at point of entry and point of sale, itemized on the receipt.

## Why a surcharge doesn't actually fit this system — the deciding fact

A **surcharge** and a **convenience fee** are legally distinct tools, not interchangeable labels:

| | Surcharge | Convenience fee |
|---|---|---|
| Prices | *the card* | *the channel* |
| Amount | percentage, capped (3–4%) | **flat dollar amount only** — a percentage disqualifies it, no matter what it's called |
| Applies to | **credit cards only** — never debit | every payment type in that channel, **including debit** |
| Requires | a real fee-free standard channel to exist alongside it | same |
| Network notice | 30 days written notice to acquirer | generally none |

**The fact that settles this: a surcharge is a credit-card-specific fee, and Venmo is not a credit card.** A surcharge program legally cannot touch a Venmo transaction at all — only card transactions. That means card payers would pay extra while Venmo payers pay nothing extra, despite Venmo costing the identical 3.49% + $0.49 to process. Given the entire reason PayPal was chosen over Stripe was Venmo, a surcharge would directly undercut that decision: the one payment method PayPal was picked for would be the one method the fee couldn't apply to.

A **convenience fee** has no such gap, because it isn't a card rule — it's a channel rule, and it must apply uniformly to every payment type accepted in that channel. Card, debit, PayPal balance, and Venmo would all carry the identical flat fee, because none of them are singled out.

## Does this org actually qualify for a convenience fee?

Checked against Visa's Core Rules requirements for a legitimate convenience fee — all must be true simultaneously:

1. **Genuine alternate channel exists.** ✅ Cash at check-in (in person) is the standard channel; online PayPal is the alternate. This is the textbook shape (a box office plus an online option "for a couple of dollars more").
2. **A standard, fee-free channel must exist alongside it.** ✅ Already locked in as a standing decision on this map — cash at check-in stays exactly as-is, no fee, always available. (This requirement is also why an online-only checkout could never legally charge a convenience fee — you'd have no alternate channel to compare against. Not a concern here.)
3. **Flat dollar amount, not scaled to transaction size.** This is the requirement — a fee that varies with team size becomes a surcharge again, with every surcharge rule attached. **$3 flat, same for doubles through sixes.**
4. **Applies to every payment type in the channel.** ✅ By construction — the fee attaches to "pay online," not to any specific funding source within that.
5. **Disclosed before payment, with a chance to back out.** Implementation requirement: show the $3 and the resulting total clearly before the buyer confirms, and let them cancel back to the cash-at-check-in option.
6. **Included in one transaction total** — a single PayPal capture for entry + fee combined, not two separate charges.
7. **One-time payment only.** ✅ Registration is inherently one-time; no recurring billing involved.
8. **Charged by the merchant providing the service.** ✅ Aura Volley Group LLC directly, not a third party.

All eight hold. This is a legitimate convenience fee, not a mislabeled surcharge.

## What $3 flat actually means against the real fee

The real PayPal fee (3.49% + $0.49) varies by team size — this is exactly why it can't be passed through as a scaled fee:

| Format | Team total | Real fee | $3 flat covers |
|---|---|---|---|
| Doubles | $50 | $2.24 | Slightly more than the actual cost |
| Triples | $75 | $3.11 | Almost exactly the actual cost |
| Quads | $100 | $3.98 | About 75% of the actual cost |
| Sixes | $150 | $5.73 | About half the actual cost |

This is expected and fine — a flat convenience fee is a rough offset, not a precise passthrough (in fact, a precise passthrough is exactly what would make it a surcharge). The org still absorbs part of the real cost on larger teams; $3 flat meaningfully reduces net cost across the board without becoming an illegal fee structure.

## Implementation-relevant facts for later tickets

- Total charged to the buyer = `teamSize × priceCents + 300` (the $3 in cents), captured as **one** PayPal transaction — never two separate charges.
- The $3 must be shown clearly, and the buyer must be able to back out to the cash-at-check-in path, before the PayPal payment is confirmed.
- Whatever confirmation/receipt copy exists must itemize the convenience fee as its own line, separate from the entry fee — feeds the copy-sites follow-up already flagged in #14's resolution.

## Verdict for the map

Convenience fee, $3 flat, applied uniformly to every online payment regardless of team size or funding source within PayPal. Cash at check-in remains fee-free and unchanged.

/**
 * Flat online-payment convenience fee, in integer cents.
 *
 * This is deliberately a FLAT amount, not a percentage of the entry fee.
 * A convenience fee must never scale with transaction size, or it legally
 * becomes a surcharge — a different fee category with different (and unmet)
 * compliance requirements, notably that a surcharge cannot apply to Venmo.
 * See docs/plans/processor-fee-decision.md for the full reasoning.
 *
 * Single source of truth: do not duplicate this literal anywhere else.
 */
export const ONLINE_CONVENIENCE_FEE_CENTS = 300;

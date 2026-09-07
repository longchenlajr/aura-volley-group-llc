/**
 * Money is handled as integer cents everywhere internally (tournament
 * `priceCents`, the online payment convenience fee, etc.) and converted to a
 * display string only here, at the point of rendering.
 *
 * This app never displays fractional cents — every price is a whole-dollar
 * amount — so this deliberately does not handle cents in the output.
 */
export function formatCents(cents: number): string {
  return `$${cents / 100}`;
}

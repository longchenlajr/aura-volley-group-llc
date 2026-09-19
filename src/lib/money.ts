/**
 * Money is handled as integer cents everywhere internally (tournament
 * `priceCents`, the online payment convenience fee, etc.) and converted to a
 * display string only here, at the point of rendering.
 *
 * Whole-dollar amounts render without a decimal part ("$25"); anything with
 * cents renders both places ("$25.50"). Every price is whole dollars today,
 * but a price that isn't must not silently render as "$25.5".
 *
 * Separate from `formatPriceUSD` in `./format` on purpose: that one takes
 * dollars and rounds to whole dollars (`maximumFractionDigits: 0`), which is
 * fine for merch listings but would turn $25.50 into "$26" on an invoice.
 */
export function formatCents(cents: number): string {
  const fractionDigits = cents % 100 === 0 ? 0 : 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(cents / 100);
}

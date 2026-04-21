import crypto from "crypto";

// Safe alphabet — no ambiguous chars (0/O, 1/l/I)
const SAFE_CHARS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/**
 * Generate a 12-character URL-safe token.
 * ~60 bits of entropy from a 30-char alphabet.
 */
export function generateMatchToken(): string {
  const bytes = crypto.randomBytes(12);
  return Array.from(bytes)
    .map((b) => SAFE_CHARS[b % SAFE_CHARS.length])
    .join("");
}

/**
 * Returns 11:59 PM ET on the tournament date.
 * Ensures tokens expire at end of tournament day.
 */
export function tokenExpiryForTournament(tournamentDate: string): Date {
  const d = new Date(tournamentDate);
  // Set to end of day in ET (UTC-4 or UTC-5 depending on DST)
  // Use a safe approach: set to next day midnight UTC, which covers any ET scenario
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();
  // 11:59 PM ET = 03:59 AM or 04:59 AM next day UTC
  // Use 05:59 AM next day UTC to be safe across DST
  return new Date(Date.UTC(year, month, day + 1, 5, 59, 59));
}

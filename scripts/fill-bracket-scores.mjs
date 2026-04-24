/**
 * fill-bracket-scores.mjs — Fill all unscored bracket matches with random scores.
 *
 * Processes matches in order (by match_order within each bracket) so winner
 * propagation and work-team assignment RPCs populate later rounds correctly.
 *
 * Usage:
 *   node scripts/fill-bracket-scores.mjs <tournament-id>
 *
 * Points per set is read from each bracket's config (no override needed).
 * Only matches with status "scheduled" or "in_progress" AND both teams
 * assigned are scored. Already-complete matches are skipped.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load env ──
let env = {};
for (const envFile of [".env.development.local", ".env.local"]) {
  try {
    const lines = readFileSync(resolve(__dirname, `../${envFile}`), "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq);
      if (!env[key]) env[key] = trimmed.slice(eq + 1);
    }
  } catch {
    // file not found, skip
  }
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Missing Supabase credentials in .env.development.local or .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ── Parse args ──
const args = process.argv.slice(2);
const tournamentId = args.find((a) => !a.startsWith("-"));

if (!tournamentId) {
  console.error("Usage: node scripts/fill-bracket-scores.mjs <tournament-id>");
  process.exit(1);
}

// ── Random score generation ──
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Playoffs: no cap, pure win-by-2. */
function generateSetScore(pointsPerSet) {
  const isOvertime = Math.random() < 0.2;

  if (isOvertime) {
    const extra = randomInt(0, 2);
    const winnerScore = pointsPerSet + 1 + extra;
    const loserScore = winnerScore - 2;
    return Math.random() < 0.5
      ? { team_a_score: winnerScore, team_b_score: loserScore }
      : { team_a_score: loserScore, team_b_score: winnerScore };
  }

  const winnerScore = pointsPerSet;
  const loserMin = Math.max(0, pointsPerSet - 10);
  const loserScore = randomInt(loserMin, pointsPerSet - 2);
  return Math.random() < 0.5
    ? { team_a_score: winnerScore, team_b_score: loserScore }
    : { team_a_score: loserScore, team_b_score: winnerScore };
}

// ── Main ──
async function main() {
  console.log(`\n🏆 Filling bracket scores for tournament: ${tournamentId}`);

  // 1. Get brackets
  const { data: brackets, error: bracketErr } = await supabase
    .from("brackets")
    .select("id, bracket_type, points_per_set")
    .eq("tournament_id", tournamentId)
    .order("bracket_type");

  if (bracketErr) {
    console.error(`❌ Failed to fetch brackets: ${bracketErr.message}`);
    process.exit(1);
  }
  if (!brackets?.length) {
    console.error("❌ No brackets found for this tournament.");
    process.exit(1);
  }

  let totalScored = 0;
  let totalSkipped = 0;

  for (const bracket of brackets) {
    const label = bracket.bracket_type === "gold" ? "Gold" : "Silver";
    console.log(`\n   ${label} Bracket — 1 set to ${bracket.points_per_set}`);

    // 2. Get all matches for this bracket, ordered by match_order
    const { data: matches, error: matchErr } = await supabase
      .from("bracket_matches")
      .select("id, round_number, match_position, match_order, status, team_a_id, team_b_id, court_number")
      .eq("bracket_id", bracket.id)
      .order("match_order", { ascending: true });

    if (matchErr) {
      console.error(`   ❌ Failed to fetch matches: ${matchErr.message}`);
      continue;
    }

    if (!matches?.length) {
      console.log(`   No matches found.`);
      continue;
    }

    const total = matches.length;
    const alreadyComplete = matches.filter((m) => m.status === "complete").length;
    console.log(`   ${total} matches total, ${alreadyComplete} already complete`);

    // 3. Process matches in order — must be sequential for propagation
    for (const match of matches) {
      // Skip already-complete
      if (match.status === "complete") continue;

      // Re-fetch to get propagated team assignments
      const { data: fresh } = await supabase
        .from("bracket_matches")
        .select("id, team_a_id, team_b_id, status")
        .eq("id", match.id)
        .single();

      if (!fresh || fresh.status === "complete") continue;

      // Skip if both teams aren't assigned yet (shouldn't happen if we process in order)
      if (!fresh.team_a_id || !fresh.team_b_id) {
        console.log(`     ⏭ Match #${match.match_order} Ct${match.court_number}: teams not yet assigned, skipping`);
        totalSkipped++;
        continue;
      }

      // Generate score
      const score = generateSetScore(bracket.points_per_set);
      const now = new Date().toISOString();

      // Insert score
      const { error: setErr } = await supabase
        .from("bracket_match_sets")
        .upsert({
          bracket_match_id: match.id,
          set_number: 1,
          team_a_score: score.team_a_score,
          team_b_score: score.team_b_score,
          submitted_by: "admin",
          submitted_at: now,
        }, { onConflict: "bracket_match_id,set_number" });

      if (setErr) {
        console.error(`     ❌ Match #${match.match_order}: ${setErr.message}`);
        continue;
      }

      // Mark complete
      const { error: statusErr } = await supabase
        .from("bracket_matches")
        .update({ status: "complete", end_time: now })
        .eq("id", match.id);

      if (statusErr) {
        console.error(`     ❌ Status update #${match.match_order}: ${statusErr.message}`);
        continue;
      }

      // Propagate winner + assign work team
      try {
        await supabase.rpc("propagate_bracket_winner", { completed_match_id: match.id });
      } catch (err) {
        console.error(`     ⚠ Winner propagation failed: ${err.message}`);
      }
      try {
        await supabase.rpc("assign_bracket_work_team", { completed_match_id: match.id });
      } catch (err) {
        // Non-fatal — work team assignment is optional
      }

      console.log(`     ✓ Match #${match.match_order} Ct${match.court_number}: ${score.team_a_score}-${score.team_b_score}`);
      totalScored++;
    }
  }

  console.log(`\n✅ Done! Scored ${totalScored} bracket matches.`);
  if (totalSkipped > 0) {
    console.log(`   ${totalSkipped} matches skipped (teams not assigned).`);
  }
  console.log();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

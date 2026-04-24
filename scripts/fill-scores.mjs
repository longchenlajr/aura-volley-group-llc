/**
 * fill-scores.mjs — Fill all unscored pool-play matches with random scores.
 *
 * Usage:
 *   node scripts/fill-scores.mjs <tournament-id>
 *   node scripts/fill-scores.mjs <tournament-id> --points=11
 *   node scripts/fill-scores.mjs <tournament-id> --points=15
 *
 * Without --points, the script auto-detects from pool size:
 *   3-4 teams → 2 sets to 15
 *   5 teams   → 2 sets to 11
 *   6 teams   → 1 set to 15
 *   7 teams   → 1 set to 11
 *   8+ teams  → 1 set to 15
 *
 * Only matches with status "scheduled" or "in_progress" are scored.
 * Already-complete matches are skipped.
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
const pointsFlag = args.find((a) => a.startsWith("--points="));
const pointsOverride = pointsFlag ? parseInt(pointsFlag.split("=")[1], 10) : null;

if (!tournamentId) {
  console.error("Usage: node scripts/fill-scores.mjs <tournament-id> [--points=11|15]");
  process.exit(1);
}

if (pointsOverride && pointsOverride !== 11 && pointsOverride !== 15) {
  console.error("❌ --points must be 11 or 15");
  process.exit(1);
}

// ── Match format from pool size (mirrors src/lib/score-format.ts) ──
function getMatchFormat(poolSize) {
  switch (poolSize) {
    case 3: return { sets: 2, pointsPerSet: 15, pointsCap: 17 };
    case 4: return { sets: 2, pointsPerSet: 15, pointsCap: 17 };
    case 5: return { sets: 2, pointsPerSet: 11, pointsCap: 13 };
    case 6: return { sets: 1, pointsPerSet: 15, pointsCap: 17 };
    case 7: return { sets: 1, pointsPerSet: 11, pointsCap: 13 };
    default: return { sets: 1, pointsPerSet: 15, pointsCap: 17 };
  }
}

// ── Random score generation ──
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a realistic completed set score.
 * Pool play: pointsCap limits max score (win by 1 at cap, e.g. 13-12).
 * Playoffs: no cap, pure win-by-2.
 */
function generateSetScore(pointsPerSet, pointsCap) {
  // ~20% chance of overtime
  const isOvertime = Math.random() < 0.2;

  if (isOvertime) {
    if (pointsCap) {
      // Pool play: overtime goes up to the cap, win by 1 at cap
      // e.g. to-11 cap-13: could be 12-10, 13-11, or 13-12
      const scenario = Math.random();
      let winnerScore, loserScore;
      if (scenario < 0.4) {
        // Win by 2 just past target (e.g. 12-10)
        winnerScore = pointsPerSet + 1;
        loserScore = winnerScore - 2;
      } else if (scenario < 0.7) {
        // Win by 2 at cap-1 (e.g. 13-11 when cap is 13... actually that's win by 2 at cap)
        winnerScore = pointsCap;
        loserScore = pointsCap - 2;
      } else {
        // Win by 1 at cap (e.g. 13-12)
        winnerScore = pointsCap;
        loserScore = pointsCap - 1;
      }
      return Math.random() < 0.5
        ? { team_a_score: winnerScore, team_b_score: loserScore }
        : { team_a_score: loserScore, team_b_score: winnerScore };
    } else {
      // Playoffs: no cap, win by 2 with no limit
      const extra = randomInt(0, 2);
      const winnerScore = pointsPerSet + 1 + extra;
      const loserScore = winnerScore - 2;
      return Math.random() < 0.5
        ? { team_a_score: winnerScore, team_b_score: loserScore }
        : { team_a_score: loserScore, team_b_score: winnerScore };
    }
  }

  // Clean win: winner hits exactly pointsPerSet
  const winnerScore = pointsPerSet;
  const loserMin = Math.max(0, pointsPerSet - 10);
  const loserScore = randomInt(loserMin, pointsPerSet - 2);
  return Math.random() < 0.5
    ? { team_a_score: winnerScore, team_b_score: loserScore }
    : { team_a_score: loserScore, team_b_score: winnerScore };
}

// ── Main ──
async function main() {
  console.log(`\n🏐 Filling scores for tournament: ${tournamentId}`);
  if (pointsOverride) {
    console.log(`   Points override: ${pointsOverride} (ignoring pool-size rules)`);
  }

  // 1. Get all pools for this tournament (need pool size to determine format)
  const { data: pools, error: poolErr } = await supabase
    .from("pools")
    .select("id, pool_label, court_number")
    .eq("tournament_id", tournamentId);

  if (poolErr) {
    console.error(`❌ Failed to fetch pools: ${poolErr.message}`);
    process.exit(1);
  }
  if (!pools?.length) {
    console.error("❌ No pools found for this tournament.");
    process.exit(1);
  }

  // Get team counts per pool
  const poolIds = pools.map((p) => p.id);
  const { data: poolTeams } = await supabase
    .from("pool_teams")
    .select("pool_id")
    .in("pool_id", poolIds);

  const poolSizeMap = new Map();
  for (const pt of poolTeams ?? []) {
    poolSizeMap.set(pt.pool_id, (poolSizeMap.get(pt.pool_id) ?? 0) + 1);
  }

  // 2. Get all unscored matches
  const { data: matches, error: matchErr } = await supabase
    .from("matches")
    .select("id, pool_id, match_order, status, team_a_id, team_b_id")
    .eq("tournament_id", tournamentId)
    .in("status", ["scheduled", "in_progress"])
    .order("pool_id")
    .order("match_order", { ascending: true });

  if (matchErr) {
    console.error(`❌ Failed to fetch matches: ${matchErr.message}`);
    process.exit(1);
  }
  if (!matches?.length) {
    console.log("✅ No unscored matches found — all matches are already complete.");
    process.exit(0);
  }

  console.log(`   Found ${matches.length} unscored matches across ${pools.length} pools\n`);

  // 3. Generate and insert scores
  let scored = 0;
  const poolLabel = new Map(pools.map((p) => [p.id, p.pool_label]));

  // Group matches by pool for cleaner output
  const byPool = new Map();
  for (const m of matches) {
    if (!byPool.has(m.pool_id)) byPool.set(m.pool_id, []);
    byPool.get(m.pool_id).push(m);
  }

  for (const [poolId, poolMatches] of byPool) {
    const poolSize = poolSizeMap.get(poolId) ?? 4;
    const format = pointsOverride
      ? { sets: getMatchFormat(poolSize).sets, pointsPerSet: pointsOverride }
      : getMatchFormat(poolSize);

    const label = poolLabel.get(poolId) ?? "?";
    console.log(
      `   Pool ${label}: ${poolMatches.length} matches — ${format.sets} set(s) to ${format.pointsPerSet}`,
    );

    for (const match of poolMatches) {
      const setRows = [];
      for (let s = 1; s <= format.sets; s++) {
        const score = generateSetScore(format.pointsPerSet, format.pointsCap);
        setRows.push({
          match_id: match.id,
          set_number: s,
          team_a_score: score.team_a_score,
          team_b_score: score.team_b_score,
          submitted_by: "admin",
        });
      }

      const { error: setErr } = await supabase.from("match_sets").insert(setRows);
      if (setErr) {
        console.error(`     ❌ Match #${match.match_order}: ${setErr.message}`);
        continue;
      }

      const { error: statusErr } = await supabase
        .from("matches")
        .update({ status: "complete" })
        .eq("id", match.id);

      if (statusErr) {
        console.error(`     ❌ Status update #${match.match_order}: ${statusErr.message}`);
        continue;
      }

      const scoreStr = setRows
        .map((s) => `${s.team_a_score}-${s.team_b_score}`)
        .join(", ");
      console.log(`     ✓ Match #${match.match_order}: ${scoreStr}`);
      scored++;
    }
  }

  console.log(`\n✅ Done! Scored ${scored}/${matches.length} matches.\n`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

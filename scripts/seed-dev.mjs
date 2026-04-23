/**
 * seed-dev.mjs — Populate the dev Supabase with a "live" tournament for today.
 *
 * Usage:
 *   node scripts/seed-dev.mjs              # 8 teams (default)
 *   node scripts/seed-dev.mjs 12           # 12 teams
 *   node scripts/seed-dev.mjs 6 --clean    # 6 teams, wipe first
 *
 * Teams are split evenly across pools (2 pools for ≤10, 3 for ≤15, 4 for ≤20).
 * Each pool gets a court. Round-robin matches + score tokens are generated.
 * First 2 matches per pool are scored as complete, 3rd is in-progress.
 *
 * Run with --clean to wipe all dev tournament data first.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load env from .env.development.local ──
const envPath = resolve(__dirname, "../.env.development.local");
const envLines = readFileSync(envPath, "utf-8").split("\n");
const env = {};
for (const line of envLines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || SUPABASE_URL.includes("YOUR-DEV")) {
  console.error("❌ Fill in .env.development.local with your dev Supabase keys first.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ── Token generation (mirrors src/lib/tokens.ts) ──
const SAFE_CHARS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
function generateMatchToken() {
  const bytes = crypto.randomBytes(12);
  return Array.from(bytes).map((b) => SAFE_CHARS[b % SAFE_CHARS.length]).join("");
}
function tokenExpiry() {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() + 1, 5, 59, 59)).toISOString();
}

// ── Config ──
const TOURNAMENT_ID = "dev-doubles-today";

// Parse team count from CLI args (skip --flags)
const numericArg = process.argv.slice(2).find((a) => !a.startsWith("-"));
const TEAM_COUNT = Math.max(4, Math.min(100, parseInt(numericArg, 10) || 8));

// Team name generation — named pool for first 50, generated beyond that
const TEAM_NAME_POOL = [
  "Wrecking Crew", "Net Gain", "Block Party", "Set to Kill",
  "Spike Force", "Sand Storm", "Ace Ventura", "Ball Busters",
  "Dig Deep", "Smash Bros", "Court Jesters", "Top Spin",
  "Side Out", "Net Result", "Power Surge", "Full Send",
  "Air Raid", "Kill Shot", "Bump Set", "No Mercy",
  "Hang Time", "Volley Llamas", "Ace Holes", "Pancake City",
  "Sky Hooks", "Tip Top", "Ground Zero", "Snap Attack",
  "Pass Kings", "Dig It", "Rally Caps", "Crossfire",
  "High Heat", "Rip Tide", "Line Drive", "Drop Shot",
  "Thunder Cats", "Fast Break", "Iron Fist", "Wild Card",
  "Coast Guard", "Flash Point", "Solar Flare", "Blackout",
  "Dream Team", "Point Blank", "Roll Call", "Night Shift",
  "Free Agents", "Aftershock",
];

const FIRST_NAMES = [
  "Jake","Mia","Chris","Jordan","Marcus","Tessa","Alex","Kai","Leo","Eli",
  "Owen","Nate","Caleb","Damon","Theo","Finn","Liam","Ryder","Gavin","Miles",
  "Tyler","Aiden","Sam","Casey","Devon","Ryan","Brooke","Reese","Dana","Jada",
  "Sienna","Harper","Lexi","Ava","Maya","Zoe","Isla","Chloe","Kira","Nina",
  "Jalen","Rowan","Quinn","Skyler","Blair","Phoenix","Sage","River","Eden","Ash",
];
const LAST_NAMES = [
  "Martinez","Chen","Delvalle","Price","Hall","Quinn","Kim","Johnson","Fernandez","Stone",
  "Marks","Russo","Tran","Vega","Grant","OBrien","Cho","Fox","Reese","Torres",
  "Brooks","Walsh","Nguyen","Rivera","Lee","Patel","Turner","Morgan","Cross","Wright",
  "Cole","Diaz","Monroe","Fischer","Singh","Nakamura","Bennett","Park","Lam","Shah",
  "Ortiz","Davis","Yang","Clark","Perry","Bell","Ward","Hayes","Reed","Mills",
];

function teamName(i) {
  return i < TEAM_NAME_POOL.length ? TEAM_NAME_POOL[i] : `Team ${i + 1}`;
}

function playerNames(i) {
  const fn = FIRST_NAMES[i % FIRST_NAMES.length];
  const ln = LAST_NAMES[i % LAST_NAMES.length];
  // Offset second player to avoid duplicates
  const fn2 = FIRST_NAMES[(i + 27) % FIRST_NAMES.length];
  const ln2 = LAST_NAMES[(i + 13) % LAST_NAMES.length];
  return [`${fn} ${ln}`, `${fn2} ${ln2}`];
}

// ── Helpers ──
function phone() {
  const n = () => String(Math.floor(Math.random() * 900) + 100);
  return `(${n()}) ${n()}-${Math.floor(Math.random() * 9000) + 1000}`;
}

/** Split N teams into pools as evenly as possible (3-7 teams per pool) */
function buildPoolConfigs(teamCount) {
  // Target ~4-5 teams per pool, min 3, max 7
  const poolCount = Math.max(2, Math.min(20, Math.round(teamCount / 4.5)));
  const base = Math.floor(teamCount / poolCount);
  const extra = teamCount % poolCount;
  const labels = "ABCDEFGHIJKLMNOPQRST".split("");

  const configs = [];
  let teamIdx = 0;
  for (let p = 0; p < poolCount; p++) {
    const size = base + (p < extra ? 1 : 0);
    const idxs = [];
    for (let i = 0; i < size; i++) idxs.push(teamIdx++);
    configs.push({ label: labels[p], court: p + 1, teamIdxs: idxs });
  }
  return configs;
}

// Round-robin schedules: [team_a_seed, team_b_seed, work_team_seed]
const SCHEDULES = {
  3: [[2,3,1],[1,3,2],[1,2,3]],
  4: [[2,3,4],[1,4,3],[2,4,1],[1,3,4],[3,4,2],[1,2,3]],
  5: [[2,5,3],[1,4,2],[3,5,1],[2,4,5],[1,3,4],[4,5,1],[2,3,4],[1,5,2],[3,4,5],[1,2,3]],
};

/** Generate round-robin matches for a pool. Falls back to circle method for 6+ */
function generateSchedule(poolSize) {
  if (SCHEDULES[poolSize]) return SCHEDULES[poolSize];
  // Circle method fallback
  const teams = Array.from({ length: poolSize }, (_, i) => i + 1);
  const fixed = teams[0];
  const rotating = teams.slice(1);
  const matches = [];
  for (let round = 0; round < poolSize - 1; round++) {
    matches.push([fixed, rotating[0], rotating[1] ?? fixed]);
    for (let i = 1; i <= (rotating.length - 1) / 2; i++) {
      const a = rotating[i];
      const b = rotating[rotating.length - i];
      const w = rotating[(i + 1) % rotating.length] ?? fixed;
      matches.push([a, b, w]);
    }
    rotating.unshift(rotating.pop());
  }
  return matches;
}

async function clean() {
  console.log("🧹 Cleaning existing dev tournament data...");
  await supabase.from("bracket_match_sets").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("bracket_match_tokens").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("bracket_matches").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("bracket_slots").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("brackets").delete().eq("tournament_id", TOURNAMENT_ID);
  await supabase.from("match_sets").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("match_tokens").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("matches").delete().eq("tournament_id", TOURNAMENT_ID);
  await supabase.from("pool_teams").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("pools").delete().eq("tournament_id", TOURNAMENT_ID);
  await supabase.from("teams").delete().eq("tournament_id", TOURNAMENT_ID);
  console.log("   Done.");
}

// ── Main ──
async function seed() {
  const doClean = process.argv.includes("--clean");
  if (doClean) await clean();

  const poolConfigs = buildPoolConfigs(TEAM_COUNT);

  console.log(`\n🏐 Seeding tournament: ${TOURNAMENT_ID}`);
  console.log(`   ${TEAM_COUNT} teams → ${poolConfigs.length} pools (${poolConfigs.map((p) => p.teamIdxs.length).join(", ")} teams)\n`);

  // 1. Create teams
  const teamIds = [];
  for (let i = 0; i < TEAM_COUNT; i++) {
    const name = teamName(i);
    const players = playerNames(i);
    const captainEmail = `team${i + 1}.${players[0].toLowerCase().replace(/ /g, ".")}@test.dev`;

    const { data: team, error: teamErr } = await supabase
      .from("teams")
      .insert({
        tournament_id: TOURNAMENT_ID,
        team_name: name,
        contact_email: captainEmail,
        contact_phone: phone(),
        seed: i + 1,
        checked_in: true,
      })
      .select("id")
      .single();

    if (teamErr) {
      console.error(`   ❌ Team "${name}": ${teamErr.message}`);
      continue;
    }

    teamIds.push(team.id);
    console.log(`   ✓ Team ${i + 1}: ${name} (${team.id.slice(0, 8)})`);

    const playerRows = players.map((pName, pi) => ({
      team_id: team.id,
      name: pName,
      email: `team${i + 1}.${pName.toLowerCase().replace(/ /g, ".")}@test.dev`,
      is_captain: pi === 0,
    }));
    await supabase.from("players").insert(playerRows);
  }

  if (teamIds.length < TEAM_COUNT) {
    console.error(`\n❌ Only ${teamIds.length}/${TEAM_COUNT} teams created. Run with --clean and retry.`);
    process.exit(1);
  }

  // 2. Create pools
  const poolIds = [];
  for (const pc of poolConfigs) {
    const { data: pool, error: poolErr } = await supabase
      .from("pools")
      .insert({
        tournament_id: TOURNAMENT_ID,
        pool_label: pc.label,
        court_number: pc.court,
      })
      .select("id")
      .single();

    if (poolErr) {
      console.error(`   ❌ Pool ${pc.label}: ${poolErr.message}`);
      continue;
    }

    poolIds.push(pool.id);
    console.log(`   ✓ Pool ${pc.label} — Court ${pc.court} — ${pc.teamIdxs.length} teams (${pool.id.slice(0, 8)})`);

    const poolTeams = pc.teamIdxs.map((idx, seed) => ({
      pool_id: pool.id,
      team_id: teamIds[idx],
      seed_in_pool: seed + 1,
    }));
    await supabase.from("pool_teams").insert(poolTeams);
  }

  // 3. Generate matches per pool
  for (let pi = 0; pi < poolConfigs.length; pi++) {
    const pc = poolConfigs[pi];
    const poolId = poolIds[pi];
    if (!poolId) continue;
    const poolTeamIds = pc.teamIdxs.map((idx) => teamIds[idx]);
    const schedule = generateSchedule(poolTeamIds.length);

    const matchRows = schedule.map(([a, b, w], i) => ({
      tournament_id: TOURNAMENT_ID,
      pool_id: poolId,
      team_a_id: poolTeamIds[a - 1],
      team_b_id: poolTeamIds[b - 1],
      work_team_id: poolTeamIds[w - 1] ?? null,
      court_number: pc.court,
      match_order: i + 1,
      status: "scheduled",
    }));

    const { data: matches, error: matchErr } = await supabase
      .from("matches")
      .insert(matchRows)
      .select("id, match_order");

    if (matchErr) {
      console.error(`   ❌ Matches Pool ${pc.label}: ${matchErr.message}`);
      continue;
    }

    console.log(`   ✓ Pool ${pc.label}: ${matches.length} matches created`);

    // Score tokens
    const tokenRows = matches.map((m) => ({
      match_id: m.id,
      token: generateMatchToken(),
      created_at: new Date().toISOString(),
      expires_at: tokenExpiry(),
    }));
    const { error: tokenErr } = await supabase.from("match_tokens").insert(tokenRows);
    if (tokenErr) {
      console.error(`   ❌ Tokens Pool ${pc.label}: ${tokenErr.message}`);
    } else {
      console.log(`   ✓ Pool ${pc.label}: ${tokenRows.length} score tokens`);
    }

    // Score first 2 matches as complete, 3rd as in-progress
    for (const m of matches.slice(0, 2)) {
      const scoreA = Math.floor(Math.random() * 6) + 15;
      const scoreB = Math.floor(Math.random() * 13) + 5;
      await supabase.from("match_sets").insert([
        { match_id: m.id, set_number: 1, team_a_score: scoreA, team_b_score: scoreB, submitted_by: "admin" },
        { match_id: m.id, set_number: 2, team_a_score: scoreB + 2, team_b_score: scoreA - 3, submitted_by: "admin" },
      ]);
      await supabase.from("matches").update({ status: "complete" }).eq("id", m.id);
    }
    if (matches.length >= 3) {
      await supabase.from("matches").update({ status: "in_progress" }).eq("id", matches[2].id);
    }

    const completedCount = Math.min(2, matches.length);
    const inProgressCount = matches.length >= 3 ? 1 : 0;
    console.log(`   ✓ Pool ${pc.label}: ${completedCount} complete, ${inProgressCount} in-progress, ${matches.length - completedCount - inProgressCount} scheduled`);
  }

  // ── Summary ──
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");

  console.log("\n✅ Seed complete!\n");
  console.log("Make sure tournaments.json includes:\n");
  console.log(`  {
    "id": "${TOURNAMENT_ID}",
    "name": "DEV Doubles",
    "date": "${yyyy}-${mm}-${dd}T09:00:00-04:00",
    "location": "Dev Court",
    "format": "doubles",
    "teamSize": 2,
    "registrationOpen": false
  }`);
  console.log("\nThen run: npm run dev");
}

seed().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

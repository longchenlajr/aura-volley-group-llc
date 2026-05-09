/**
 * seed-dev.mjs — Populate the dev Supabase with registered teams for testing.
 *
 * Usage:
 *   node scripts/seed-dev.mjs              # 8 teams (default)
 *   node scripts/seed-dev.mjs 12           # 12 teams
 *   node scripts/seed-dev.mjs 6 --clean    # 6 teams, wipe first
 *
 * Creates teams with players, seeds them, and checks them in.
 * Use the admin dashboard to generate pools, matches, and brackets.
 *
 * Run with --clean to wipe all dev tournament data first.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

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

// ── Config ──
const TOURNAMENT_ID = "dev-doubles-today";

// Parse team count from CLI args (skip --flags)
const numericArg = process.argv.slice(2).find((a) => !a.startsWith("-"));
const TEAM_COUNT = Math.max(4, Math.min(100, parseInt(numericArg, 10) || 8));

// Team name generation
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
  const fn2 = FIRST_NAMES[(i + 27) % FIRST_NAMES.length];
  const ln2 = LAST_NAMES[(i + 13) % LAST_NAMES.length];
  return [`${fn} ${ln}`, `${fn2} ${ln2}`];
}

function phone() {
  const n = () => String(Math.floor(Math.random() * 900) + 100);
  return `(${n()}) ${n()}-${Math.floor(Math.random() * 9000) + 1000}`;
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

  console.log(`\n🏐 Seeding tournament: ${TOURNAMENT_ID}`);
  console.log(`   ${TEAM_COUNT} teams — seeded and checked in\n`);

  // Create teams
  for (let i = 0; i < TEAM_COUNT; i++) {
    const name = teamName(i);
    const players = playerNames(i);
    const captainEmail = `team${i + 1}.${players[0].toLowerCase().replace(/ /g, ".")}@test.dev`;

    const { data: teams, error: teamErr } = await supabase
      .from("teams")
      .insert({
        tournament_id: TOURNAMENT_ID,
        team_name: name,
        contact_email: captainEmail,
        contact_phone: phone(),
        seed: i + 1,
        checked_in: true,
      })
      .select("id");

    const team = teams?.[0];

    if (teamErr || !team) {
      console.error(`   ❌ Team "${name}": error=${JSON.stringify(teamErr)}, team=${JSON.stringify(team)}`);
      continue;
    }

    console.log(`   ✓ Team ${i + 1}: ${name} (${team.id.slice(0, 8)})`);

    const playerRows = players.map((pName, pi) => ({
      team_id: team.id,
      name: pName,
      email: `team${i + 1}.${pName.toLowerCase().replace(/ /g, ".")}@test.dev`,
      is_captain: pi === 0,
    }));
    await supabase.from("players").insert(playerRows);
  }

  // ── Summary ──
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");

  console.log(`\n✅ ${TEAM_COUNT} teams created!\n`);
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
  console.log("Use the admin dashboard to generate pools, matches, and brackets.");
}

seed().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

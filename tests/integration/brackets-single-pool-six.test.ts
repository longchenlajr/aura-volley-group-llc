import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, resetDb, seedTeams } from "../helpers/db";

vi.mock("@/auth", () => ({ auth: vi.fn(async () => ({ user: { name: "Admin" } })) }));

const { POST: bracketsPOST } = await import("@/app/api/admin/brackets/route");

// Reproduces the shape of the 2026-09-20 doubles tournament as captured from
// production's public standings API: one pool of six, nobody withdrawn, all 15
// round-robin matches complete, final wins 5/4/3/1/1/1 with the three-way tie
// at one win broken on point differential. The admin "Generate brackets" button
// hung on that data and production still has zero brackets for it.
//
// The cause was the court split: one pool means court_count 1, and the old
// split gave that single court to whichever bracket had more R1 games, leaving
// the other bracket with no court at all — which generateBracket spun on.
const T = "six-one-pool";

/** Team index (0 = intended overall #1) -> seed_in_pool, mirroring prod. */
const POOL_SEEDS = [1, 2, 4, 5, 3, 6];

async function seedSixTeamPool(sb: SupabaseClient): Promise<void> {
  const teams = await seedTeams(sb, T, 6);
  const teamIds = teams.map((t) => t.id);

  // 6-team pool: 1 set to 15, cap 17 (getMatchFormat(6)).
  const { data: pool } = await sb
    .from("pools")
    .insert({ tournament_id: T, pool_label: "A", court_number: 1, sets_per_match: 1, points_per_set: 15, points_cap: 17 })
    .select("id")
    .single();
  const poolId = pool!.id as string;

  await sb.from("pool_teams").insert(teamIds.map((teamId, i) => ({ pool_id: poolId, team_id: teamId, seed_in_pool: POOL_SEEDS[i] })));

  // [winnerIdx, loserIdx, loserScore]. Winner always 15.
  // T0 beats everyone; T1 beats T2..T5; T2 beats T3..T5; T3/T4/T5 form a cycle
  // (T3>T4, T4>T5, T5>T3) so each has exactly one win, with T3's point
  // differential best and T5's worst — the same ordering prod produced.
  const results: Array<[number, number, number]> = [
    [0, 1, 11], [0, 2, 9], [0, 3, 13], [0, 4, 8], [0, 5, 5],
    [1, 2, 12], [1, 3, 13], [1, 4, 8], [1, 5, 5],
    [2, 3, 13], [2, 4, 8], [2, 5, 5],
    [3, 4, 13], [4, 5, 10], [5, 3, 14],
  ];

  let order = 1;
  for (const [w, l, loserScore] of results) {
    const { data: m } = await sb
      .from("matches")
      .insert({ tournament_id: T, pool_id: poolId, court_number: 1, match_order: order++, team_a_id: teamIds[w], team_b_id: teamIds[l], status: "complete" })
      .select("id")
      .single();
    await sb.from("match_sets").insert({ match_id: m!.id, set_number: 1, team_a_score: 15, team_b_score: loserScore, submitted_by: "work_team" });
  }
}

function generateRequest(goldCutoff: number) {
  return new NextRequest("http://localhost/api/admin/brackets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    // Exactly what PlayoffSetupModal sends for a non-AwesomeFest, single-pool event.
    body: JSON.stringify({ tournament_id: T, gold_cutoff: goldCutoff, gold_points_per_set: 15, silver_points_per_set: 11, court_count: 1 }),
  });
}

describe("generate brackets — single pool of six, pool play complete", () => {
  beforeEach(() => resetDb());

  // The modal's default for 6 teams / 1 pool is 2; the admin can drag it to 6.
  // Sweep every value so the loop goes red on whatever was chosen on the day.
  it.each([2, 3, 4, 5, 6])("generates on the one shared court with gold_cutoff=%i", async (cutoff) => {
    const sb = adminClient();
    await seedSixTeamPool(sb);

    const started = Date.now();
    const res = await bracketsPOST(generateRequest(cutoff));
    const ms = Date.now() - started;
    const text = await res.text();

    expect(res.status, `cutoff=${cutoff} took ${ms}ms, body: ${text.slice(0, 400)}`).toBe(200);
    expect(JSON.parse(text)).toEqual({ ok: true });

    // A silver bracket exists only when at least two teams miss the gold cutoff.
    const { data: brackets } = await sb.from("brackets").select("id, bracket_type").eq("tournament_id", T);
    const types = (brackets ?? []).map((b) => b.bracket_type).sort();
    expect(types).toEqual(6 - cutoff >= 2 ? ["gold", "silver"] : ["gold"]);

    // One pool means one court: every match plays on court 1, and the whole gold
    // bracket (all rounds) is ordered before silver's first match.
    const typeOf = new Map((brackets ?? []).map((b) => [b.id as string, b.bracket_type as string]));
    const { data: matches } = await sb
      .from("bracket_matches")
      .select("bracket_id, court_number, match_order")
      .in("bracket_id", [...typeOf.keys()])
      .order("match_order");
    expect(matches!.length).toBeGreaterThan(0);
    expect(matches!.every((m) => m.court_number === 1)).toBe(true);

    const orders = matches!.map((m) => m.match_order as number);
    expect(new Set(orders).size).toBe(orders.length);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));

    const goldOrders = matches!.filter((m) => typeOf.get(m.bracket_id) === "gold").map((m) => m.match_order as number);
    const silverOrders = matches!.filter((m) => typeOf.get(m.bracket_id) === "silver").map((m) => m.match_order as number);
    if (silverOrders.length > 0) {
      expect(Math.max(...goldOrders)).toBeLessThan(Math.min(...silverOrders));
    }
  }, 20_000);
});

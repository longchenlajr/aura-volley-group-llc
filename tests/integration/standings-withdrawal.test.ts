import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, resetDb, seedTeams } from "../helpers/db";

vi.mock("@/auth", () => ({ auth: vi.fn(async () => ({ user: { name: "Admin" } })) }));

const { GET: standingsGET } = await import("@/app/api/public/standings/route");
const { POST: bracketsPOST } = await import("@/app/api/admin/brackets/route");

async function insertPool(
  sb: SupabaseClient, tournamentId: string, sets: number, pps: number, cap: number,
) {
  const { data } = await sb.from("pools")
    .insert({ tournament_id: tournamentId, pool_label: "A", court_number: 1, sets_per_match: sets, points_per_set: pps, points_cap: cap })
    .select("id").single();
  return data!.id as string;
}

async function standingsFor(tournamentId: string) {
  const req = new NextRequest(`http://localhost/api/public/standings?tournament=${tournamentId}`);
  const res = await standingsGET(req);
  return res.json();
}

describe("standings after withdrawal (stored format)", () => {
  beforeEach(() => resetDb());

  it("keeps the frozen format so real + forfeit matches both count, withdrawn sinks last", async () => {
    const T = "stand-with";
    const sb = adminClient();
    const teams = await seedTeams(sb, T, 5);
    const ids = teams.map((t) => t.id);
    const [t1, t2, , , t5] = ids;
    const poolId = await insertPool(sb, T, 2, 11, 13); // 5-team format: 2 sets to 11
    await sb.from("pool_teams").insert(ids.map((id, i) => ({ pool_id: poolId, team_id: id, seed_in_pool: i + 1 })));

    // A real, completed 2x11 match: T1 beats T2.
    const { data: m1 } = await sb.from("matches")
      .insert({ tournament_id: T, pool_id: poolId, court_number: 1, match_order: 1, team_a_id: t1, team_b_id: t2, status: "complete" })
      .select("id").single();
    await sb.from("match_sets").insert([
      { match_id: m1!.id, set_number: 1, team_a_score: 11, team_b_score: 5, submitted_by: "work_team" },
      { match_id: m1!.id, set_number: 2, team_a_score: 11, team_b_score: 6, submitted_by: "work_team" },
    ]);
    // A scheduled match T1 vs T5 that the withdrawal will forfeit.
    await sb.from("matches").insert({ tournament_id: T, pool_id: poolId, court_number: 1, match_order: 2, team_a_id: t1, team_b_id: t5, status: "scheduled" });

    await sb.rpc("withdraw_team", { p_team_id: t5, p_points_per_set: 11, p_sets_per_match: 2 });

    const body = await standingsFor(T);
    const pool = body.pools[0];
    const standT1 = pool.standings.find((s: { team_id: string }) => s.team_id === t1);

    // 2 sets from the real 11-point match + 2 from the forfeit = 4. If the format had
    // shifted to 2x15, the 11-point sets would read as incomplete and count 0.
    expect(standT1.sets_won).toBe(4);
    expect(standT1.matches_won).toBe(2);

    const { data: m1row } = await sb.from("matches").select("status").eq("id", m1!.id).single();
    expect(m1row!.status).toBe("complete");

    // T5 still present, flagged withdrawn, ranked last.
    expect(pool.standings).toHaveLength(5);
    const last = pool.standings[pool.standings.length - 1];
    expect(last.team_id).toBe(t5);
    expect(last.withdrawn).toBe(true);
  });

  it("excludes a withdrawn team from bracket seeding (seeds N-1)", async () => {
    const T = "seed-test";
    const sb = adminClient();
    const teams = await seedTeams(sb, T, 4);
    const [u1, u2, u3, u4] = teams.map((t) => t.id);
    const poolId = await insertPool(sb, T, 2, 15, 17);
    await sb.from("pool_teams").insert(teams.map((t, i) => ({ pool_id: poolId, team_id: t.id, seed_in_pool: i + 1 })));

    await sb.rpc("withdraw_team", { p_team_id: u4, p_points_per_set: 15, p_sets_per_match: 2 });

    const req = new NextRequest("http://localhost/api/admin/brackets", {
      method: "POST",
      body: JSON.stringify({ tournament_id: T, gold_cutoff: 3, gold_points_per_set: 15, silver_points_per_set: 15, court_count: 1 }),
      headers: { "content-type": "application/json" },
    });
    const res = await bracketsPOST(req);
    expect(res.status).toBe(200);

    const { data: brk } = await sb.from("brackets").select("id").eq("tournament_id", T).eq("bracket_type", "gold").single();
    const { data: slots } = await sb.from("bracket_slots").select("team_id").eq("bracket_id", brk!.id);
    // A bye team legitimately appears in two slots (R1 + its auto-advanced R2 slot),
    // so dedupe before comparing the set of seeded teams.
    const distinctTeamIds = [...new Set((slots ?? []).map((s) => s.team_id).filter(Boolean))];

    expect(distinctTeamIds).not.toContain(u4);
    expect(distinctTeamIds.sort()).toEqual([u1, u2, u3].sort());
  });
});

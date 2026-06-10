import { describe, it, expect, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, resetDb, seedTeams, psqlExec } from "../helpers/db";

const T = "withdraw-test";

async function buildPool(sb: SupabaseClient, teamIds: string[]) {
  const { data: pool } = await sb
    .from("pools").insert({ tournament_id: T, pool_label: "A", court_number: 1 })
    .select("id").single();
  await sb.from("pool_teams").insert(
    teamIds.map((id, i) => ({ pool_id: pool!.id, team_id: id, seed_in_pool: i + 1 })),
  );
  return pool!.id;
}

async function insertMatch(
  sb: SupabaseClient, poolId: string, order: number, a: string, b: string, status = "scheduled",
) {
  const { data } = await sb.from("matches")
    .insert({ tournament_id: T, pool_id: poolId, court_number: 1, match_order: order, team_a_id: a, team_b_id: b, status })
    .select("id").single();
  return data!.id as string;
}

/** Two R1 matches feeding one final (R2). */
async function buildBracket(sb: SupabaseClient, ids: string[]) {
  const [a, b, c, d] = ids;
  const { data: br } = await sb
    .from("brackets").insert({ tournament_id: T, bracket_type: "gold", points_per_set: 15 })
    .select("id").single();
  const bid = br!.id;
  const { data: r1 } = await sb.from("bracket_slots").insert([
    { bracket_id: bid, round_number: 1, slot_position: 1, team_id: a },
    { bracket_id: bid, round_number: 1, slot_position: 2, team_id: b },
    { bracket_id: bid, round_number: 1, slot_position: 3, team_id: c },
    { bracket_id: bid, round_number: 1, slot_position: 4, team_id: d },
  ]).select("id, slot_position");
  const s = (p: number) => r1!.find((x) => x.slot_position === p)!.id;
  const { data: r2 } = await sb.from("bracket_slots").insert([
    { bracket_id: bid, round_number: 2, slot_position: 1, source_slot_ids: [s(1), s(2)] },
    { bracket_id: bid, round_number: 2, slot_position: 2, source_slot_ids: [s(3), s(4)] },
  ]).select("id, slot_position");
  const f = (p: number) => r2!.find((x) => x.slot_position === p)!.id;
  const { data: ms } = await sb.from("bracket_matches").insert([
    { bracket_id: bid, round_number: 1, match_position: 1, slot_a_id: s(1), slot_b_id: s(2), team_a_id: a, team_b_id: b, court_number: 1, match_order: 1 },
    { bracket_id: bid, round_number: 1, match_position: 2, slot_a_id: s(3), slot_b_id: s(4), team_a_id: c, team_b_id: d, court_number: 1, match_order: 2 },
    { bracket_id: bid, round_number: 2, match_position: 1, slot_a_id: f(1), slot_b_id: f(2), court_number: 1, match_order: 3 },
  ]).select("id, round_number, match_position");
  return {
    bid,
    m1: ms!.find((m) => m.round_number === 1 && m.match_position === 1)!.id,
    m2: ms!.find((m) => m.round_number === 1 && m.match_position === 2)!.id,
    final: ms!.find((m) => m.round_number === 2)!.id,
    f1: f(1),
  };
}

describe("withdraw_team — pool play", () => {
  beforeEach(() => resetDb());

  it("forfeits the withdrawn team's scheduled matches and leaves others alone", async () => {
    const sb = adminClient();
    const teams = await seedTeams(sb, T, 4);
    const [t1, t2, t3] = teams.map((t) => t.id);
    const poolId = await buildPool(sb, teams.map((t) => t.id));
    const ma = await insertMatch(sb, poolId, 1, t1, t2);
    const mb = await insertMatch(sb, poolId, 2, t3, t1);
    const mc = await insertMatch(sb, poolId, 3, t2, t3); // doesn't involve t1

    await sb.rpc("withdraw_team", { p_team_id: t1, p_points_per_set: 15, p_sets_per_match: 2 });

    // ma: t1 is team_a -> 0; t2 -> 15, two sets, complete
    const { data: maSets } = await sb.from("match_sets").select("*").eq("match_id", ma).order("set_number");
    expect(maSets).toHaveLength(2);
    expect(maSets!.every((s) => s.team_a_score === 0 && s.team_b_score === 15 && s.is_forfeit)).toBe(true);
    const { data: maRow } = await sb.from("matches").select("status").eq("id", ma).single();
    expect(maRow!.status).toBe("complete");

    // mb: t1 is team_b -> 0; t3 (team_a) -> 15
    const { data: mbSets } = await sb.from("match_sets").select("*").eq("match_id", mb).order("set_number");
    expect(mbSets!.every((s) => s.team_a_score === 15 && s.team_b_score === 0 && s.is_forfeit)).toBe(true);

    // mc: untouched
    const { data: mcRow } = await sb.from("matches").select("status").eq("id", mc).single();
    expect(mcRow!.status).toBe("scheduled");
    const { data: mcSets } = await sb.from("match_sets").select("id").eq("match_id", mc);
    expect(mcSets ?? []).toHaveLength(0);
  });

  it("forfeits an in-progress match, overwriting partial sets", async () => {
    const sb = adminClient();
    const teams = await seedTeams(sb, T, 4);
    const [t1, t2] = teams.map((t) => t.id);
    const poolId = await buildPool(sb, teams.map((t) => t.id));
    const ma = await insertMatch(sb, poolId, 1, t1, t2, "in_progress");
    await sb.from("match_sets").insert({
      match_id: ma, set_number: 1, team_a_score: 10, team_b_score: 8, submitted_by: "work_team",
    });

    await sb.rpc("withdraw_team", { p_team_id: t1, p_points_per_set: 15, p_sets_per_match: 2 });

    const { data: sets } = await sb.from("match_sets").select("*").eq("match_id", ma).order("set_number");
    expect(sets).toHaveLength(2);
    expect(sets!.every((s) => s.team_a_score === 0 && s.team_b_score === 15 && s.is_forfeit)).toBe(true);
    const { data: row } = await sb.from("matches").select("status").eq("id", ma).single();
    expect(row!.status).toBe("complete");
  });

  it("is idempotent — a second call is a no-op", async () => {
    const sb = adminClient();
    const teams = await seedTeams(sb, T, 4);
    const [t1, t2] = teams.map((t) => t.id);
    const poolId = await buildPool(sb, teams.map((t) => t.id));
    await insertMatch(sb, poolId, 1, t1, t2);

    const first = await sb.rpc("withdraw_team", { p_team_id: t1, p_points_per_set: 15, p_sets_per_match: 2 });
    expect((first.data as { pool_forfeits: number }).pool_forfeits).toBe(1);

    const second = await sb.rpc("withdraw_team", { p_team_id: t1, p_points_per_set: 15, p_sets_per_match: 2 });
    expect((second.data as { already_withdrawn: boolean }).already_withdrawn).toBe(true);
    expect((second.data as { pool_forfeits: number }).pool_forfeits).toBe(0);
  });

  it("is atomic — an injected failure rolls back everything (team stays in)", async () => {
    const sb = adminClient();
    const teams = await seedTeams(sb, T, 4);
    const [t1, t2, t3] = teams.map((t) => t.id);
    const poolId = await buildPool(sb, teams.map((t) => t.id));
    const ma = await insertMatch(sb, poolId, 1, t1, t2);
    const mb = await insertMatch(sb, poolId, 2, t3, t1);

    // Fail when the second pool match is completed, mid-RPC.
    psqlExec(`
      create function _test_fail() returns trigger language plpgsql as $f$
      begin
        if NEW.status = 'complete' and NEW.match_order = 2 then
          raise exception 'injected failure';
        end if;
        return NEW;
      end $f$;
      create trigger _test_fail_trg before update on matches for each row execute function _test_fail();
    `);

    try {
      const { error } = await sb.rpc("withdraw_team", { p_team_id: t1, p_points_per_set: 15, p_sets_per_match: 2 });
      expect(error).not.toBeNull();
    } finally {
      psqlExec("drop trigger _test_fail_trg on matches; drop function _test_fail();");
    }

    // Nothing persisted: team not withdrawn, no forfeit sets, matches still scheduled.
    const { data: team } = await sb.from("teams").select("withdrawn_at").eq("id", t1).single();
    expect(team!.withdrawn_at).toBeNull();
    for (const mid of [ma, mb]) {
      const { data: row } = await sb.from("matches").select("status").eq("id", mid).single();
      expect(row!.status).toBe("scheduled");
      const { data: sets } = await sb.from("match_sets").select("id").eq("match_id", mid);
      expect(sets ?? []).toHaveLength(0);
    }
  });
});

describe("withdraw_team — playoffs", () => {
  beforeEach(() => resetDb());

  it("forfeits a scheduled R1 bracket match and advances the opponent", async () => {
    const sb = adminClient();
    const teams = await seedTeams(sb, T, 4);
    const [a, b] = teams.map((t) => t.id);
    const { m1, f1 } = await buildBracket(sb, teams.map((t) => t.id));

    await sb.rpc("withdraw_team", { p_team_id: a, p_points_per_set: 15, p_sets_per_match: 2 });

    const { data: m1row } = await sb.from("bracket_matches").select("status, winner_slot_id, slot_b_id").eq("id", m1).single();
    expect(m1row!.status).toBe("complete");
    expect(m1row!.winner_slot_id).toBe(m1row!.slot_b_id); // B (team_b) wins
    const { data: m1set } = await sb.from("bracket_match_sets").select("is_forfeit").eq("bracket_match_id", m1).single();
    expect(m1set!.is_forfeit).toBe(true);
    // B advanced into the final's first feeder slot.
    const { data: slot } = await sb.from("bracket_slots").select("team_id").eq("id", f1).single();
    expect(slot!.team_id).toBe(b);
  });

  it("auto-forfeits a deferred match when the opponent's feeder later completes", async () => {
    const sb = adminClient();
    const teams = await seedTeams(sb, T, 4);
    const [a, , c, d] = teams.map((t) => t.id);
    const { m1, m2, final } = await buildBracket(sb, teams.map((t) => t.id));

    // A wins M1 first and advances into the final's slot.
    await sb.from("bracket_match_sets").insert({ bracket_match_id: m1, set_number: 1, team_a_score: 15, team_b_score: 10, submitted_by: "admin" });
    await sb.from("bracket_matches").update({ status: "complete" }).eq("id", m1);
    await sb.rpc("propagate_bracket_winner", { completed_match_id: m1 });

    // A withdraws while sitting in the final's feeder slot (final teams not populated).
    await sb.rpc("withdraw_team", { p_team_id: a, p_points_per_set: 15, p_sets_per_match: 2 });
    let { data: finalRow } = await sb.from("bracket_matches")
      .select("status, winner_slot_id, slot_b_id, team_a_id, team_b_id").eq("id", final).single();
    expect(finalRow!.status).toBe("scheduled"); // deferred — opponent unknown

    // Now C beats D in M2; propagation populates the final and auto-forfeits it to C.
    await sb.from("bracket_match_sets").insert({ bracket_match_id: m2, set_number: 1, team_a_score: 15, team_b_score: 9, submitted_by: "admin" });
    await sb.from("bracket_matches").update({ status: "complete" }).eq("id", m2);
    await sb.rpc("propagate_bracket_winner", { completed_match_id: m2 });

    ({ data: finalRow } = await sb.from("bracket_matches").select("status, winner_slot_id, slot_b_id, team_a_id, team_b_id").eq("id", final).single());
    expect(finalRow!.status).toBe("complete");
    expect(finalRow!.team_b_id).toBe(c);
    expect(finalRow!.winner_slot_id).toBe(finalRow!.slot_b_id); // C (the live team) wins
    const { data: finalSet } = await sb.from("bracket_match_sets").select("is_forfeit").eq("bracket_match_id", final).single();
    expect(finalSet!.is_forfeit).toBe(true);
    void d;
  });
});

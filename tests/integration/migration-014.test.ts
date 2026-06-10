import { describe, it, expect, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, anonClient, resetDb, seedTeams } from "../helpers/db";

const T = "mig014";

/** Build a one-round bracket with two matches (M1, M2) sharing a court.
 *  Returns ids needed by the work-team / undo tests. */
async function buildTwoMatchBracket(sb: SupabaseClient, teamIds: string[]) {
  const [a, b, c, d] = teamIds;
  const { data: bracket } = await sb
    .from("brackets")
    .insert({ tournament_id: T, bracket_type: "gold", points_per_set: 15 })
    .select("id")
    .single();
  const bracketId = bracket!.id;

  const { data: slots } = await sb
    .from("bracket_slots")
    .insert([
      { bracket_id: bracketId, round_number: 1, slot_position: 1, team_id: a },
      { bracket_id: bracketId, round_number: 1, slot_position: 2, team_id: b },
      { bracket_id: bracketId, round_number: 1, slot_position: 3, team_id: c },
      { bracket_id: bracketId, round_number: 1, slot_position: 4, team_id: d },
    ])
    .select("id, slot_position")
    .order("slot_position");
  const s = (pos: number) => slots!.find((x) => x.slot_position === pos)!.id;

  const { data: matches } = await sb
    .from("bracket_matches")
    .insert([
      {
        bracket_id: bracketId, round_number: 1, match_position: 1,
        slot_a_id: s(1), slot_b_id: s(2), team_a_id: a, team_b_id: b,
        court_number: 1, match_order: 1, status: "scheduled",
      },
      {
        bracket_id: bracketId, round_number: 1, match_position: 2,
        slot_a_id: s(3), slot_b_id: s(4), team_a_id: c, team_b_id: d,
        court_number: 1, match_order: 2, status: "scheduled",
      },
    ])
    .select("id, match_position")
    .order("match_position");

  return {
    bracketId,
    m1: matches!.find((m) => m.match_position === 1)!.id,
    m2: matches!.find((m) => m.match_position === 2)!.id,
    slotA: s(1),
    slotB: s(2),
  };
}

describe("migration 014 — RLS lockdown", () => {
  beforeEach(() => resetDb());

  it("anon cannot read teams (RLS denies, even with a row present)", async () => {
    const admin = adminClient();
    await admin.from("teams").insert({
      tournament_id: T, team_name: "Secret", contact_email: "x@y.z", contact_phone: "5550000000",
    });

    const { data } = await anonClient().from("teams").select("*");
    expect(data ?? []).toHaveLength(0);
  });

  it("anon cannot insert a team", async () => {
    const { error } = await anonClient().from("teams").insert({
      tournament_id: T, team_name: "Hacker", contact_email: "x@y.z", contact_phone: "5550000000",
    });
    expect(error).not.toBeNull();
  });

  it("anon cannot execute a privileged RPC", async () => {
    const { error } = await anonClient().rpc("swap_pool_teams", {
      a_team_id: "00000000-0000-0000-0000-000000000001",
      b_team_id: "00000000-0000-0000-0000-000000000002",
    });
    expect(error).not.toBeNull();
  });
});

describe("migration 014 — integrity constraints", () => {
  beforeEach(() => resetDb());

  it("rejects a tied bracket set", async () => {
    const sb = adminClient();
    const teams = await seedTeams(sb, T, 4);
    const { m1 } = await buildTwoMatchBracket(sb, teams.map((t) => t.id));
    const { error } = await sb.from("bracket_match_sets").insert({
      bracket_match_id: m1, set_number: 1, team_a_score: 15, team_b_score: 15, submitted_by: "admin",
    });
    expect(error).not.toBeNull();
  });

  it("rejects the same team on both sides of a bracket match", async () => {
    const sb = adminClient();
    const teams = await seedTeams(sb, T, 2);
    const { data: bracket } = await sb
      .from("brackets").insert({ tournament_id: T, bracket_type: "gold", points_per_set: 15 })
      .select("id").single();
    const { data: slots } = await sb.from("bracket_slots").insert([
      { bracket_id: bracket!.id, round_number: 1, slot_position: 1 },
      { bracket_id: bracket!.id, round_number: 1, slot_position: 2 },
    ]).select("id");
    const { error } = await sb.from("bracket_matches").insert({
      bracket_id: bracket!.id, round_number: 1, match_position: 1,
      slot_a_id: slots![0].id, slot_b_id: slots![1].id,
      team_a_id: teams[0].id, team_b_id: teams[0].id,
      court_number: 1, match_order: 1,
    });
    expect(error).not.toBeNull();
  });

  it("rejects a work team that is also playing the bracket match", async () => {
    const sb = adminClient();
    const teams = await seedTeams(sb, T, 2);
    const { data: bracket } = await sb
      .from("brackets").insert({ tournament_id: T, bracket_type: "gold", points_per_set: 15 })
      .select("id").single();
    const { data: slots } = await sb.from("bracket_slots").insert([
      { bracket_id: bracket!.id, round_number: 1, slot_position: 1 },
      { bracket_id: bracket!.id, round_number: 1, slot_position: 2 },
    ]).select("id");
    const { error } = await sb.from("bracket_matches").insert({
      bracket_id: bracket!.id, round_number: 1, match_position: 1,
      slot_a_id: slots![0].id, slot_b_id: slots![1].id,
      team_a_id: teams[0].id, team_b_id: teams[1].id, work_team_id: teams[0].id,
      court_number: 1, match_order: 1,
    });
    expect(error).not.toBeNull();
  });

  it("rejects a team being placed into a second pool", async () => {
    const sb = adminClient();
    const teams = await seedTeams(sb, T, 1);
    const { data: pools } = await sb.from("pools").insert([
      { tournament_id: T, pool_label: "A", court_number: 1 },
      { tournament_id: T, pool_label: "B", court_number: 2 },
    ]).select("id");
    const ok = await sb.from("pool_teams").insert({ pool_id: pools![0].id, team_id: teams[0].id, seed_in_pool: 1 });
    expect(ok.error).toBeNull();
    const dup = await sb.from("pool_teams").insert({ pool_id: pools![1].id, team_id: teams[0].id, seed_in_pool: 1 });
    expect(dup.error).not.toBeNull();
  });

  it("rejects a duplicate (pool, court, match_order) — guards double generation", async () => {
    const sb = adminClient();
    const teams = await seedTeams(sb, T, 4);
    const { data: pool } = await sb.from("pools")
      .insert({ tournament_id: T, pool_label: "A", court_number: 1 }).select("id").single();
    const base = {
      tournament_id: T, pool_id: pool!.id, court_number: 1, match_order: 1,
    };
    const first = await sb.from("matches").insert({ ...base, team_a_id: teams[0].id, team_b_id: teams[1].id });
    expect(first.error).toBeNull();
    const dup = await sb.from("matches").insert({ ...base, team_a_id: teams[2].id, team_b_id: teams[3].id });
    expect(dup.error).not.toBeNull();
  });
});

describe("migration 014 — RPC guards", () => {
  beforeEach(() => resetDb());

  it("propagate_bracket_winner errors on a match with no score", async () => {
    const sb = adminClient();
    const teams = await seedTeams(sb, T, 4);
    const { m1 } = await buildTwoMatchBracket(sb, teams.map((t) => t.id));
    const { error } = await sb.rpc("propagate_bracket_winner", { completed_match_id: m1 });
    expect(error).not.toBeNull();
  });

  it("assign_bracket_work_team makes no assignment when the winner is undecided", async () => {
    const sb = adminClient();
    const teams = await seedTeams(sb, T, 4);
    const { m1, m2 } = await buildTwoMatchBracket(sb, teams.map((t) => t.id));
    // winner_slot_id is null on m1 — the old code would have declared team A the loser.
    const { error } = await sb.rpc("assign_bracket_work_team", { completed_match_id: m1 });
    expect(error).toBeNull();
    const { data: m2row } = await sb.from("bracket_matches").select("work_team_id").eq("id", m2).single();
    expect(m2row!.work_team_id).toBeNull();
  });

  it("undo clears the sibling work assignment, and a re-flip reassigns the new loser", async () => {
    const sb = adminClient();
    const teams = await seedTeams(sb, T, 4);
    const teamIds = teams.map((t) => t.id);
    const [a, b] = teamIds;
    const { m1, m2 } = await buildTwoMatchBracket(sb, teamIds);

    // 1) A beats B in M1 → propagate + assign → loser B works M2.
    await sb.from("bracket_match_sets").insert({
      bracket_match_id: m1, set_number: 1, team_a_score: 15, team_b_score: 10, submitted_by: "admin",
    });
    await sb.from("bracket_matches").update({ status: "complete" }).eq("id", m1);
    await sb.rpc("propagate_bracket_winner", { completed_match_id: m1 });
    await sb.rpc("assign_bracket_work_team", { completed_match_id: m1 });

    let { data: m2row } = await sb.from("bracket_matches").select("work_team_id").eq("id", m2).single();
    expect(m2row!.work_team_id).toBe(b);

    // 2) Undo M1 → M2's work assignment (derived from M1) is cleared.
    await sb.rpc("undo_bracket_match", { target_match_id: m1 });
    ({ data: m2row } = await sb.from("bracket_matches").select("work_team_id").eq("id", m2).single());
    expect(m2row!.work_team_id).toBeNull();

    // 3) Re-enter with the opposite winner → loser A now works M2.
    await sb.from("bracket_match_sets").insert({
      bracket_match_id: m1, set_number: 1, team_a_score: 10, team_b_score: 15, submitted_by: "admin",
    });
    await sb.from("bracket_matches").update({ status: "complete" }).eq("id", m1);
    await sb.rpc("propagate_bracket_winner", { completed_match_id: m1 });
    await sb.rpc("assign_bracket_work_team", { completed_match_id: m1 });

    ({ data: m2row } = await sb.from("bracket_matches").select("work_team_id").eq("id", m2).single());
    expect(m2row!.work_team_id).toBe(a);
  });
});

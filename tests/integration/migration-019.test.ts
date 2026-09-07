import { describe, it, expect, beforeEach } from "vitest";
import { adminClient, anonClient, resetDb, seedTeams } from "../helpers/db";

const T = "mig019";

describe("migration 019 — teams.paid", () => {
  beforeEach(() => resetDb());

  it("defaults to false", async () => {
    const sb = adminClient();
    const [team] = await seedTeams(sb, T, 1);
    const { data } = await sb.from("teams").select("paid").eq("id", team.id).single();
    expect(data!.paid).toBe(false);
  });
});

describe("migration 019 — payments table", () => {
  beforeEach(() => resetDb());

  async function seedPayment(sb: ReturnType<typeof adminClient>, teamId: string, overrides = {}) {
    return sb
      .from("payments")
      .insert({
        team_id: teamId,
        status: "pending",
        paypal_order_id: "ORDER-1",
        entry_fee_cents: 5000,
        convenience_fee_cents: 300,
        amount_cents: 5300,
        ...overrides,
      })
      .select("id")
      .single();
  }

  it("RLS denies anon read and insert (deny-all, per migration 014's pattern)", async () => {
    const sb = adminClient();
    const [team] = await seedTeams(sb, T, 1);
    await seedPayment(sb, team.id);

    const { data } = await anonClient().from("payments").select("*");
    expect(data ?? []).toHaveLength(0);

    const { error } = await anonClient().from("payments").insert({
      team_id: team.id,
      status: "pending",
      paypal_order_id: "ORDER-HACK",
      entry_fee_cents: 0,
      convenience_fee_cents: 0,
      amount_cents: 0,
    });
    expect(error).not.toBeNull();
  });

  it("enforces one payment row per team", async () => {
    const sb = adminClient();
    const [team] = await seedTeams(sb, T, 1);
    const { error: first } = await seedPayment(sb, team.id);
    expect(first).toBeNull();

    const { error: second } = await seedPayment(sb, team.id, { paypal_order_id: "ORDER-2" });
    expect(second).not.toBeNull();
  });

  it("rejects a status outside the allowed set", async () => {
    const sb = adminClient();
    const [team] = await seedTeams(sb, T, 1);
    const { error } = await seedPayment(sb, team.id, { status: "bogus" });
    expect(error).not.toBeNull();
  });

  it("accepts each of the four allowed statuses", async () => {
    const sb = adminClient();
    const teams = await seedTeams(sb, T, 4);
    const statuses = ["pending", "completed", "failed", "refunded"];
    for (let i = 0; i < statuses.length; i++) {
      const { error } = await seedPayment(sb, teams[i].id, {
        status: statuses[i],
        paypal_order_id: `ORDER-${i}`,
      });
      expect(error).toBeNull();
    }
  });

  it("cascades delete when the team is deleted", async () => {
    const sb = adminClient();
    const [team] = await seedTeams(sb, T, 1);
    const { data: payment } = await seedPayment(sb, team.id);

    await sb.from("teams").delete().eq("id", team.id);

    const { data } = await sb.from("payments").select("id").eq("id", payment!.id);
    expect(data ?? []).toHaveLength(0);
  });
});

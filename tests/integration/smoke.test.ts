import { describe, it, expect, beforeEach } from "vitest";
import { adminClient, resetDb } from "../helpers/db";

describe("integration harness smoke", () => {
  beforeEach(() => {
    resetDb();
  });

  it("inserts and reads back a team through the service-role client", async () => {
    const sb = adminClient();
    const { data: inserted, error: insertErr } = await sb
      .from("teams")
      .insert({
        tournament_id: "smoke-test",
        team_name: "Smoke Team",
        contact_email: "smoke@example.com",
        contact_phone: "5551234567",
      })
      .select()
      .single();

    expect(insertErr).toBeNull();
    expect(inserted?.team_name).toBe("Smoke Team");

    const { data: read } = await sb
      .from("teams")
      .select("team_name")
      .eq("tournament_id", "smoke-test");

    expect(read).toHaveLength(1);
    expect(read?.[0].team_name).toBe("Smoke Team");
  });
});

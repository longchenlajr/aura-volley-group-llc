import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { adminClient, resetDb, seedTeams } from "../helpers/db";
import type { SupabaseClient } from "@supabase/supabase-js";

const TOURNAMENT = "doubles-10-25-2026";

// The admin PATCH route is session-gated; every test here acts as an admin
// unless it deliberately clears the session.
let mockSession: { user: { email: string } } | null = { user: { email: "admin@example.com" } };
vi.mock("@/auth", () => ({ auth: vi.fn(async () => mockSession) }));

const { PATCH } = await import("@/app/api/admin/teams/[id]/route");

async function patchTeam(id: string, body: Record<string, unknown>) {
  const req = new NextRequest(`http://localhost/api/admin/teams/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
  return PATCH(req, { params: Promise.resolve({ id }) });
}

async function readPaid(sb: SupabaseClient, id: string): Promise<boolean | undefined> {
  const { data } = await sb.from("teams").select("paid").eq("id", id).single();
  return data?.paid;
}

describe("admin PATCH /api/admin/teams/[id] — paid", () => {
  let sb: SupabaseClient;
  let teamId: string;

  beforeEach(async () => {
    mockSession = { user: { email: "admin@example.com" } };
    resetDb();
    sb = adminClient();
    [{ id: teamId }] = await seedTeams(sb, TOURNAMENT, 1);
  });

  it("defaults a newly registered team to unpaid", async () => {
    expect(await readPaid(sb, teamId)).toBe(false);
  });

  // The whole point of this ticket: the route drops unrecognized keys without
  // erroring, so a missing allowlist entry makes the toggle silently no-op.
  it("persists paid: true", async () => {
    const res = await patchTeam(teamId, { paid: true });
    expect(res.status).toBe(200);
    expect(await readPaid(sb, teamId)).toBe(true);
  });

  it("persists paid: false, so the toggle works in both directions", async () => {
    await sb.from("teams").update({ paid: true }).eq("id", teamId);

    const res = await patchTeam(teamId, { paid: false });
    expect(res.status).toBe(200);
    expect(await readPaid(sb, teamId)).toBe(false);
  });

  it("leaves paid alone when the request doesn't mention it", async () => {
    await sb.from("teams").update({ paid: true }).eq("id", teamId);

    const res = await patchTeam(teamId, { checked_in: true });
    expect(res.status).toBe(200);

    const { data } = await sb
      .from("teams")
      .select("paid, checked_in")
      .eq("id", teamId)
      .single();
    expect(data?.paid).toBe(true);
    expect(data?.checked_in).toBe(true);
  });

  it("rejects an unauthenticated caller without writing", async () => {
    mockSession = null;

    const res = await patchTeam(teamId, { paid: true });
    expect(res.status).toBe(401);
    expect(await readPaid(sb, teamId)).toBe(false);
  });
});

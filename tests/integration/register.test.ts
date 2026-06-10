import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { adminClient, resetDb } from "../helpers/db";

// A tournament safely in the future relative to the test clock (open, teamSize 2).
const TOURNAMENT = "doubles-10-25-2026";

// No admin session: exercise the public registration path.
vi.mock("@/auth", () => ({ auth: vi.fn(async () => null) }));
// Don't hit the email provider.
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: async () => ({ id: "mock" }) };
  },
}));

// Delegate to the real service-role client, but let a test force the players
// insert to fail so we can assert the orphan-team rollback.
let failPlayers = false;
vi.mock("@/lib/supabase-admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase-admin")>();
  return {
    getSupabaseAdmin() {
      const real = actual.getSupabaseAdmin();
      return new Proxy(real, {
        get(target, prop, receiver) {
          if (prop === "from") {
            return (table: string) => {
              if (table === "players" && failPlayers) {
                return { insert: async () => ({ error: { message: "forced failure" } }) };
              }
              return target.from(table);
            };
          }
          return Reflect.get(target, prop, receiver);
        },
      });
    },
  };
});

const { POST } = await import("@/app/api/register/route");

function registerRequest(teamName: string) {
  const payload = {
    tournamentId: TOURNAMENT,
    teamName,
    contactPhone: "5551230000",
    players: [
      { name: "Captain", email: "captain@example.com", phone: "5551230001" },
      { name: "Partner", email: "partner@example.com", phone: "5551230002" },
    ],
  };
  return new NextRequest("http://localhost/api/register", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.1" },
  });
}

describe("register route (service role, post RLS lockdown)", () => {
  beforeEach(() => {
    failPlayers = false;
    resetDb();
  });

  it("registers a team + roster end to end", async () => {
    const res = await POST(registerRequest("Spikers"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    const sb = adminClient();
    const { data: teams } = await sb.from("teams").select("id").eq("tournament_id", TOURNAMENT);
    expect(teams).toHaveLength(1);
    const { data: players } = await sb.from("players").select("id").eq("team_id", body.teamId);
    expect(players).toHaveLength(2);
  });

  it("rolls back the orphan team when the players insert fails", async () => {
    failPlayers = true;
    const res = await POST(registerRequest("Doomed"));
    expect(res.status).toBe(500);

    const sb = adminClient();
    const { data: teams } = await sb.from("teams").select("id").eq("tournament_id", TOURNAMENT);
    expect(teams ?? []).toHaveLength(0);
  });
});

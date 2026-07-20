import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { adminClient, resetDb } from "../helpers/db";

// A tournament safely in the future relative to the test clock (open, teamSize 2).
const TOURNAMENT = "doubles-10-25-2026";
// A real tournament with collectShirtSize enabled (open, teamSize 3).
const SHIRT_TOURNAMENT = "awesomefest-triples-07-24-2026";

// No admin session by default: exercise the public registration path. A test
// can flip this to simulate an authenticated admin walk-up registration.
let mockSession: { user: { email: string } } | null = null;
vi.mock("@/auth", () => ({ auth: vi.fn(async () => mockSession) }));
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

function registerRequest(
  teamName: string,
  opts: {
    tournamentId?: string;
    players?: { name: string; email?: string; phone?: string; shirtSize?: string }[];
    // Distinct per test so the module-level per-IP rate limiter (shared across
    // the whole file's test run) doesn't cross-contaminate unrelated tests.
    ip?: string;
  } = {},
) {
  const payload = {
    tournamentId: opts.tournamentId ?? TOURNAMENT,
    teamName,
    contactPhone: "5551230000",
    players: opts.players ?? [
      { name: "Captain", email: "captain@example.com", phone: "5551230001" },
      { name: "Partner", email: "partner@example.com", phone: "5551230002" },
    ],
  };
  return new NextRequest("http://localhost/api/register", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "content-type": "application/json", "x-forwarded-for": opts.ip ?? "10.0.0.1" },
  });
}

describe("register route (service role, post RLS lockdown)", () => {
  beforeEach(() => {
    failPlayers = false;
    mockSession = null;
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

describe("register route — shirt size collection (collectShirtSize tournaments)", () => {
  beforeEach(() => {
    failPlayers = false;
    mockSession = null;
    resetDb();
  });

  it("persists a shirt size per player when every player provides one", async () => {
    const res = await POST(
      registerRequest("Sand Slingers", {
        tournamentId: SHIRT_TOURNAMENT,
        ip: "10.0.1.1",
        players: [
          { name: "Captain", email: "captain@example.com", phone: "5551230001", shirtSize: "M" },
          { name: "Player 2", email: "p2@example.com", phone: "5551230002", shirtSize: "L" },
          { name: "Player 3", email: "p3@example.com", phone: "5551230003", shirtSize: "S" },
        ],
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();

    const sb = adminClient();
    const { data: players } = await sb
      .from("players")
      .select("name, shirt_size")
      .eq("team_id", body.teamId);
    expect(players).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Captain", shirt_size: "M" }),
        expect.objectContaining({ name: "Player 2", shirt_size: "L" }),
        expect.objectContaining({ name: "Player 3", shirt_size: "S" }),
      ]),
    );
  });

  it("rejects a submission missing a player's shirt size, inserting nothing", async () => {
    const res = await POST(
      registerRequest("No Size Squad", {
        tournamentId: SHIRT_TOURNAMENT,
        ip: "10.0.1.2",
        players: [
          { name: "Captain", email: "captain@example.com", phone: "5551230001", shirtSize: "M" },
          { name: "Player 2", email: "p2@example.com", phone: "5551230002" },
          { name: "Player 3", email: "p3@example.com", phone: "5551230003", shirtSize: "S" },
        ],
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Player 2.*shirt size/i);

    const sb = adminClient();
    const { data: teams } = await sb.from("teams").select("id").eq("tournament_id", SHIRT_TOURNAMENT);
    expect(teams ?? []).toHaveLength(0);
  });

  it("rejects an invalid shirt size value", async () => {
    const res = await POST(
      registerRequest("Bad Size Squad", {
        tournamentId: SHIRT_TOURNAMENT,
        ip: "10.0.1.3",
        players: [
          { name: "Captain", email: "captain@example.com", phone: "5551230001", shirtSize: "XXXL" },
          { name: "Player 2", email: "p2@example.com", phone: "5551230002", shirtSize: "L" },
          { name: "Player 3", email: "p3@example.com", phone: "5551230003", shirtSize: "S" },
        ],
      }),
    );
    expect(res.status).toBe(400);
  });

  it("does not require a shirt size on tournaments that don't collect it, and stores null even when the client sends an empty string (the form's unselected default)", async () => {
    const res = await POST(
      registerRequest("Spikers Two", {
        ip: "10.0.1.4",
        players: [
          { name: "Captain", email: "captain@example.com", phone: "5551230001", shirtSize: "" },
          { name: "Partner", email: "partner@example.com", phone: "5551230002", shirtSize: "" },
        ],
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();

    const sb = adminClient();
    const { data: players } = await sb.from("players").select("shirt_size").eq("team_id", body.teamId);
    expect(players).toEqual([{ shirt_size: null }, { shirt_size: null }]);
  });

  it("still requires a shirt size for an authenticated admin walk-up registration", async () => {
    mockSession = { user: { email: "admin@example.com" } };
    const res = await POST(
      registerRequest("Walkup Team", {
        tournamentId: SHIRT_TOURNAMENT,
        players: [
          { name: "Captain", email: "captain@example.com", phone: "5551230001", shirtSize: "M" },
          { name: "Player 2" },
          { name: "Player 3" },
        ],
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/shirt size/i);
  });
});

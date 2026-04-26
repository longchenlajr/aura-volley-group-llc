import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// GET /api/public/pools?tournament=X — public-safe pool structure (team names only, no PII)
export async function GET(req: NextRequest) {
  const tournamentId = req.nextUrl.searchParams.get("tournament");
  if (!tournamentId) {
    return NextResponse.json({ error: "Missing tournament" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  const { data: pools, error: poolsError } = await sb
    .from("pools")
    .select("id, pool_label, court_number")
    .eq("tournament_id", tournamentId)
    .order("court_number", { ascending: true });

  if (poolsError) return NextResponse.json({ error: poolsError.message }, { status: 500 });
  if (!pools || pools.length === 0) return NextResponse.json({ pools: [] });

  const poolIds = pools.map((p) => p.id);
  const { data: poolTeams, error: ptError } = await sb
    .from("pool_teams")
    .select("pool_id, seed_in_pool, teams(team_name)")
    .in("pool_id", poolIds)
    .order("seed_in_pool", { ascending: true });

  if (ptError) return NextResponse.json({ error: ptError.message }, { status: 500 });

  const result = pools.map((pool) => ({
    pool_label: pool.pool_label,
    court_number: pool.court_number,
    teams: (poolTeams ?? [])
      .filter((pt) => pt.pool_id === pool.id)
      .map((pt) => ({
        team_name: (pt.teams as unknown as { team_name: string })?.team_name ?? "Unknown",
        seed_in_pool: pt.seed_in_pool,
      })),
  }));

  return NextResponse.json({ pools: result });
}

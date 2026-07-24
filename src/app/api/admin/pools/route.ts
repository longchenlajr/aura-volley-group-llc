import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getMatchFormat } from "@/lib/score-format";
import { getTournament } from "@/lib/tournaments";

// GET /api/admin/pools?tournament=X — pools with team assignments
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tournamentId = req.nextUrl.searchParams.get("tournament");
  if (!tournamentId) return NextResponse.json({ error: "Missing tournament" }, { status: 400 });

  const sb = getSupabaseAdmin();

  const { data: pools, error: poolsError } = await sb
    .from("pools")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("court_number", { ascending: true });

  if (poolsError) return NextResponse.json({ error: poolsError.message }, { status: 500 });
  if (!pools || pools.length === 0) return NextResponse.json({ pools: [] });

  // Fetch pool_teams with team data
  const poolIds = pools.map((p) => p.id);
  const { data: poolTeams, error: ptError } = await sb
    .from("pool_teams")
    .select("pool_id, team_id, seed_in_pool, teams(team_name, seed)")
    .in("pool_id", poolIds)
    .order("seed_in_pool", { ascending: true });

  if (ptError) return NextResponse.json({ error: ptError.message }, { status: 500 });

  const result = pools.map((pool) => ({
    pool,
    teams: (poolTeams ?? [])
      .filter((pt) => pt.pool_id === pool.id)
      .map((pt) => ({
        team_id: pt.team_id,
        team_name: (pt.teams as unknown as { team_name: string })?.team_name ?? "Unknown",
        overall_seed: (pt.teams as unknown as { seed: number | null })?.seed ?? null,
        seed_in_pool: pt.seed_in_pool,
      })),
  }));

  return NextResponse.json({ pools: result });
}

// POST /api/admin/pools — create pools + assignments
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { tournament_id, pools } = body as {
    tournament_id: string;
    pools: Array<{ pool_label: string; court_number: number; team_ids: string[] }>;
  };

  if (!tournament_id || !pools?.length) {
    return NextResponse.json({ error: "Missing tournament_id or pools" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  // Check if pools already exist
  const { count } = await sb
    .from("pools")
    .select("*", { count: "exact", head: true })
    .eq("tournament_id", tournament_id);

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: "Pools already exist for this tournament. Delete them first or use the regenerate flow." },
      { status: 409 },
    );
  }

  // Insert pools. Freeze each pool's match format from its roster size now, so a
  // later withdrawal can't shift how its completed matches are interpreted.
  const awesomefest = getTournament(tournament_id)?.awesomefest ?? false;
  const poolRows = pools.map((p) => {
    const fmt = getMatchFormat(p.team_ids.length, awesomefest);
    return {
      tournament_id,
      pool_label: p.pool_label,
      court_number: p.court_number,
      sets_per_match: fmt.sets,
      points_per_set: fmt.pointsPerSet,
      points_cap: fmt.pointsCap ?? null,
    };
  });

  const { data: createdPools, error: poolError } = await sb
    .from("pools")
    .insert(poolRows)
    .select("id, pool_label");

  if (poolError || !createdPools) {
    return NextResponse.json({ error: poolError?.message ?? "Failed to create pools" }, { status: 500 });
  }

  // Map pool labels to IDs
  const labelToId = new Map(createdPools.map((p) => [p.pool_label, p.id]));

  // Insert pool_teams
  const ptRows: Array<{ pool_id: string; team_id: string; seed_in_pool: number }> = [];
  for (const p of pools) {
    const poolId = labelToId.get(p.pool_label);
    if (!poolId) continue;
    p.team_ids.forEach((teamId, idx) => {
      ptRows.push({ pool_id: poolId, team_id: teamId, seed_in_pool: idx + 1 });
    });
  }

  const { error: ptError } = await sb.from("pool_teams").insert(ptRows);
  if (ptError) {
    // Cleanup: delete the pools we just created
    await sb.from("pools").delete().eq("tournament_id", tournament_id);
    return NextResponse.json({ error: ptError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, poolCount: createdPools.length });
}

// DELETE /api/admin/pools?tournament=X — delete all pools for tournament
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tournamentId = req.nextUrl.searchParams.get("tournament");
  if (!tournamentId) return NextResponse.json({ error: "Missing tournament" }, { status: 400 });

  const { error } = await getSupabaseAdmin()
    .from("pools")
    .delete()
    .eq("tournament_id", tournamentId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// POST /api/admin/pool-teams/swap — atomic team swap via RPC
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { team_a_id, team_b_id } = body as { team_a_id: string; team_b_id: string };

  if (!team_a_id || !team_b_id) {
    return NextResponse.json({ error: "Missing team IDs" }, { status: 400 });
  }
  if (team_a_id === team_b_id) {
    return NextResponse.json({ error: "Cannot swap a team with itself" }, { status: 400 });
  }

  const { error } = await getSupabaseAdmin().rpc("swap_pool_teams", {
    a_team_id: team_a_id,
    b_team_id: team_b_id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

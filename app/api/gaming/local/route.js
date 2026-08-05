import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/requestAuth";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  try {
    const { user, error: authError } = await getRequestUser(request);
    if (authError || !user?.id) {
      return NextResponse.json({ error: "Sign in is required to view local games." }, { status: 401 });
    }

    const { data, error } = await getSupabaseAdminClient()
      .from("local_games")
      .select(
        "id, client_game_id, game_name, cover_image_url, metadata_provider, metadata, total_playtime_seconds, last_played_at, platforms, created_at, updated_at",
      )
      .eq("user_id", user.id)
      .order("last_played_at", { ascending: false, nullsFirst: false })
      .order("game_name", { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ games: data || [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load local games." },
      { status: 500 },
    );
  }
}

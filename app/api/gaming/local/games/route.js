import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/requestAuth";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_TEXT_LENGTH = 500;

function text(value, maxLength = MAX_TEXT_LENGTH) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : "";
}

function jsonError(status, error) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(request) {
  try {
    const { user, error: authError } = await getRequestUser(request);
    if (authError || !user?.id) {
      return jsonError(401, "Sign in is required to save local game metadata.");
    }

    const payload = await request.json().catch(() => ({}));
    const gameId = text(payload?.gameId, 255);
    const name = text(payload?.name);
    const coverImageUrl = text(payload?.coverImageUrl, 2000) || null;
    const metadataProvider = text(payload?.metadataProvider, 100) || "client";
    const metadata = payload?.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
      ? payload.metadata
      : {};

    if (!gameId || !name) {
      return jsonError(400, "gameId and name are required.");
    }

    const game = {
      user_id: user.id,
      client_game_id: gameId,
      game_name: name,
      cover_image_url: coverImageUrl,
      metadata_provider: metadataProvider,
      metadata,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await getSupabaseAdminClient()
      .from("local_games")
      .upsert(game, { onConflict: "user_id,client_game_id" })
      .select(
        "id, client_game_id, game_name, cover_image_url, metadata_provider, metadata, total_playtime_seconds, last_played_at, platforms, created_at, updated_at",
      )
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true, game: data });
  } catch (error) {
    return jsonError(500, error instanceof Error ? error.message : "Unable to save local game metadata.");
  }
}

export async function DELETE(request) {
  try {
    const { user, error: authError } = await getRequestUser(request);
    if (authError || !user?.id) return jsonError(401, "Sign in is required to delete a local game.");
    const gameId = text(new URL(request.url).searchParams.get("gameId"), 255);
    if (!gameId) return jsonError(400, "gameId is required.");
    const { error } = await getSupabaseAdminClient().from("local_games").delete().eq("user_id", user.id).eq("client_game_id", gameId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) { return jsonError(500, error instanceof Error ? error.message : "Unable to delete local game."); }
}

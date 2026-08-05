import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/requestAuth";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function text(value, maxLength = 255) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : "";
}

function jsonError(status, error) {
  return NextResponse.json({ ok: false, error }, { status });
}

function getDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(request) {
  try {
    const { user, error: authError } = await getRequestUser(request);
    if (authError || !user?.id) {
      return jsonError(401, "Sign in is required to save local game sessions.");
    }

    const payload = await request.json().catch(() => ({}));
    const gameId = text(payload?.gameId);
    const sessionId = text(payload?.sessionId);
    const platform = text(payload?.platform || payload?.device, 100);
    const startedAt = getDate(payload?.startTime);
    const endedAt = getDate(payload?.endTime);

    if (!gameId || !sessionId || !platform || !startedAt || !endedAt) {
      return jsonError(400, "gameId, sessionId, platform, startTime, and endTime are required.");
    }

    const durationSeconds = Math.round((endedAt.getTime() - startedAt.getTime()) / 1000);
    if (durationSeconds <= 0) {
      return jsonError(400, "endTime must be after startTime.");
    }

    const adminClient = getSupabaseAdminClient();
    const { data: game, error: gameError } = await adminClient
      .from("local_games")
      .select("id")
      .eq("user_id", user.id)
      .eq("client_game_id", gameId)
      .maybeSingle();

    if (gameError) {
      throw gameError;
    }
    if (!game?.id) {
      return jsonError(404, "No local game exists for gameId. Upsert its metadata first.");
    }

    const { data: session, error: insertError } = await adminClient
      .from("local_game_sessions")
      .insert({
        user_id: user.id,
        game_id: game.id,
        client_session_id: sessionId,
        platform,
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        duration_seconds: durationSeconds,
      })
      .select("id, client_session_id, duration_seconds")
      .single();

    if (insertError?.code === "23505") {
      return NextResponse.json({ ok: true, duplicate: true, sessionId });
    }
    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({ ok: true, duplicate: false, session });
  } catch (error) {
    return jsonError(500, error instanceof Error ? error.message : "Unable to save local game session.");
  }
}

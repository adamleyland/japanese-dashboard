import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_GAMES = 500;

function safeText(value, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function authorized(request) {
  const configuredToken = safeText(process.env.STEAM_DECK_SYNC_TOKEN, 500);
  const suppliedToken = safeText(request.headers.get("authorization"), 520).replace(/^Bearer\s+/i, "");
  if (!configuredToken || !suppliedToken) return false;
  const expected = Buffer.from(configuredToken);
  const supplied = Buffer.from(suppliedToken);
  return expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
}

function normalizeGame(game) {
  const shortcutId = safeText(game?.shortcutId, 255);
  const name = safeText(game?.name);
  const totalSeconds = Math.max(0, Math.round(Number(game?.totalPlaytimeSeconds) || 0));
  const lastPlayed = game?.lastPlayedAt ? new Date(game.lastPlayedAt) : null;
  if (!shortcutId || !name) return null;

  return {
    client_game_id: `steam-deck-shortcut:${shortcutId}`,
    game_name: name,
    total_playtime_seconds: totalSeconds,
    last_played_at: lastPlayed && !Number.isNaN(lastPlayed.getTime()) ? lastPlayed.toISOString() : null,
    platforms: ["Steam Deck"],
    metadata_provider: "steam-deck",
    metadata: {
      tracker_source: "steam-deck",
      steam_app_id: shortcutId,
      executable_path: safeText(game?.executablePath, 2000),
      start_directory: safeText(game?.startDirectory, 2000),
    },
  };
}

export async function POST(request) {
  try {
    if (!authorized(request)) {
      return NextResponse.json({ ok: false, error: "Invalid Steam Deck sync token." }, { status: 401 });
    }

    const userId = safeText(process.env.LOCAL_GAMES_USER_ID, 100);
    if (!userId) {
      return NextResponse.json({ ok: false, error: "LOCAL_GAMES_USER_ID is not configured." }, { status: 503 });
    }

    const payload = await request.json().catch(() => ({}));
    const candidates = Array.isArray(payload?.games) ? payload.games.slice(0, MAX_GAMES) : [];
    const games = candidates.map(normalizeGame).filter(Boolean);
    if (!games.length) {
      return NextResponse.json({ ok: false, error: "At least one valid game is required." }, { status: 400 });
    }

    const admin = getSupabaseAdminClient();
    const ids = games.map((game) => game.client_game_id);
    const { data: existing, error: readError } = await admin
      .from("local_games")
      .select("client_game_id, cover_image_url, metadata, total_playtime_seconds, last_played_at")
      .eq("user_id", userId)
      .in("client_game_id", ids);
    if (readError) throw readError;

    const existingById = new Map((existing || []).map((game) => [game.client_game_id, game]));
    const rows = games.map((game) => {
      const previous = existingById.get(game.client_game_id);
      const previousSeconds = Math.max(0, Number(previous?.total_playtime_seconds) || 0);
      const previousLastPlayed = previous?.last_played_at ? new Date(previous.last_played_at) : null;
      const incomingLastPlayed = game.last_played_at ? new Date(game.last_played_at) : null;
      return {
        ...game,
        user_id: userId,
        cover_image_url: previous?.cover_image_url || null,
        total_playtime_seconds: Math.max(previousSeconds, game.total_playtime_seconds),
        last_played_at:
          previousLastPlayed && (!incomingLastPlayed || previousLastPlayed > incomingLastPlayed)
            ? previousLastPlayed.toISOString()
            : game.last_played_at,
        metadata: { ...(previous?.metadata || {}), ...game.metadata },
        updated_at: new Date().toISOString(),
      };
    });

    const { error } = await admin
      .from("local_games")
      .upsert(rows, { onConflict: "user_id,client_game_id" });
    if (error) throw error;

    return NextResponse.json({ ok: true, synced: rows.length });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Steam Deck sync failed." },
      { status: 500 },
    );
  }
}

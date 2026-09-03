import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getLocalAchievementSnapshot } from "@/lib/achievements/local-provider";
import { persistAchievementSnapshot } from "@/lib/achievements/server-utils";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left || "");
  const rightBuffer = Buffer.from(right || "");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function text(value, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const isSteamDeck = payload?.source === "steam-deck";
    const provider = "local";
    const configuredSecret = String(
      isSteamDeck
        ? process.env.STEAM_DECK_SYNC_TOKEN
        : process.env.LOCAL_ACHIEVEMENT_SYNC_SECRET,
    ).trim();
    const suppliedSecret = text(request.headers.get("authorization")).replace(/^Bearer\s+/i, "");
    if (!configuredSecret || !safeEqual(configuredSecret, suppliedSecret)) {
      return NextResponse.json({ error: "Invalid companion sync credentials." }, { status: 401 });
    }

    const userId = text(process.env.LOCAL_GAMES_USER_ID, 100);
    const gameId = text(payload.gameId, 255);
    const updates = Array.isArray(payload.achievements) ? payload.achievements : [];
    if (!userId || !gameId || !updates.length) {
      return NextResponse.json({ error: "LOCAL_GAMES_USER_ID, gameId, and achievements are required." }, { status: 400 });
    }

    const admin = getSupabaseAdminClient();
    let { data: game, error: gameError } = await admin.from("achievement_games")
      .select("id, game_name")
      .eq("user_id", userId)
      .eq("provider", provider)
      .eq("provider_game_id", gameId)
      .maybeSingle();
    if (gameError) throw gameError;
    if (!game && isSteamDeck) {
      const snapshot = await getLocalAchievementSnapshot({ admin, userId, gameId });
      const gameRecordId = await persistAchievementSnapshot({
        admin,
        userId,
        provider,
        providerGameId: gameId,
        snapshot: { ...snapshot, trackingMode: "steam-deck-companion" },
      });
      const { data: createdGame, error: createdGameError } = await admin.from("achievement_games")
        .select("id, game_name")
        .eq("id", gameRecordId)
        .single();
      if (createdGameError) throw createdGameError;
      game = createdGame;
    }
    if (!game) return NextResponse.json({ error: "Sync this local game's achievement definitions first." }, { status: 404 });

    const ids = updates.map((item) => text(item?.id, 255)).filter(Boolean);
    const { data: rows, error: rowsError } = await admin.from("achievements")
      .select("id, provider_achievement_id, name, description, icon_url, rarity_percentage, unlocked, progress_current, progress_target")
      .eq("achievement_game_id", game.id)
      .in("provider_achievement_id", ids);
    if (rowsError) throw rowsError;
    const rowByProviderId = new Map((rows || []).map((item) => [item.provider_achievement_id, item]));
    const now = new Date().toISOString();
    const unlockEvents = [];
    const newlyUnlockedAchievements = [];
    const resultRows = [];

    for (const update of updates) {
      const providerId = text(update?.id, 255);
      const existing = rowByProviderId.get(providerId);
      if (!existing) continue;
      const unlocked = Boolean(update?.unlocked);
      const unlockedAt = unlocked ? text(update?.unlockedAt, 100) || now : null;
      const progressCurrent = Number.isFinite(Number(update?.progressCurrent)) ? Number(update.progressCurrent) : existing.progress_current;
      const progressTarget = Number.isFinite(Number(update?.progressTarget)) ? Number(update.progressTarget) : existing.progress_target;
      const { data: updated, error } = await admin.from("achievements")
        .update({ unlocked, unlocked_at: unlockedAt, progress_current: progressCurrent, progress_target: progressTarget, updated_at: now })
        .eq("id", existing.id)
        .select("id, provider_achievement_id, unlocked")
        .single();
      if (error) throw error;
      resultRows.push(updated);
      if (unlocked && !existing.unlocked) {
        unlockEvents.push({ achievement_id: existing.id, user_id: userId, source: text(payload.source, 100) || "local-companion", unlocked_at: unlockedAt, metadata: update.metadata || {} });
        newlyUnlockedAchievements.push({
          achievementId: existing.provider_achievement_id,
          achievementName: existing.name,
          description: existing.description,
          gameTitle: game.game_name,
          iconUrl: existing.icon_url,
          rarityPercentage: existing.rarity_percentage,
          unlockedAt,
        });
      }
    }

    if (unlockEvents.length) {
      const { error } = await admin.from("achievement_unlock_events").upsert(unlockEvents, { onConflict: "achievement_id,unlocked_at" });
      if (error) throw error;
    }
    await admin.from("achievement_games").update({ last_synced_at: now, last_sync_error: null, updated_at: now }).eq("id", game.id);
    return NextResponse.json({
      ok: true,
      updated: resultRows.length,
      newlyUnlocked: unlockEvents.length,
      newlyUnlockedAchievements,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to ingest local achievements." }, { status: 500 });
  }
}

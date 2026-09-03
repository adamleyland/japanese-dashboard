import { NextResponse } from "next/server";
import { getLocalAchievementSnapshot } from "@/lib/achievements/local-provider";
import {
  persistAchievementSnapshot,
  recordAchievementSyncError,
  sortAchievements,
} from "@/lib/achievements/server-utils";
import { getSteamAchievementSnapshot } from "@/lib/achievements/steam-provider";
import { getXboxAchievementSnapshot } from "@/lib/achievements/xbox-provider";
import { getRequestUser } from "@/lib/requestAuth";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_MS = 30 * 60 * 1000;
const SUPPORTED_PROVIDERS = new Set(["steam", "xbox", "local", "steam-deck"]);

function storageProvider(provider) {
  // The existing database constraint predates the visible Deck source. Deck
  // records are safely namespaced by provider_game_id, so reuse local storage.
  return provider === "steam-deck" ? "local" : provider;
}

function errorMessage(error, fallback = "Unable to sync achievements.") {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && typeof error.message === "string") {
    return error.message;
  }
  if (typeof error === "string" && error) return error;
  return fallback;
}

async function readAchievementGame(admin, userId, provider, providerGameId) {
  const { data, error } = await admin.from("achievement_games")
    .select("*, achievements(*)")
    .eq("user_id", userId)
    .eq("provider", provider)
    .eq("provider_game_id", providerGameId)
    .maybeSingle();
  if (error) throw error;
  return data ? { ...data, achievements: sortAchievements(data.achievements) } : null;
}

async function createSnapshot({ admin, userId, provider, gameId, title }) {
  if (provider === "steam") {
    return getSteamAchievementSnapshot({ appId: gameId, includePlayerProgress: true, fallbackTitle: title });
  }
  if (provider === "xbox") {
    return getXboxAchievementSnapshot({ titleId: gameId, fallbackTitle: title });
  }
  return getLocalAchievementSnapshot({ admin, userId, gameId });
}

async function syncAchievements({ admin, userId, provider, gameId, title }) {
  const snapshot = await createSnapshot({ admin, userId, provider, gameId, title });
  const persistedProvider = storageProvider(provider);
  await persistAchievementSnapshot({ admin, userId, provider: persistedProvider, providerGameId: gameId, snapshot });
  return readAchievementGame(admin, userId, persistedProvider, gameId);
}

export async function GET(request) {
  try {
    const { user, error: authError } = await getRequestUser(request);
    if (authError || !user?.id) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const admin = getSupabaseAdminClient();

    if (searchParams.get("mode") === "summaries") {
      const { data, error } = await admin.from("achievement_games")
        .select("provider, provider_game_id, last_synced_at, tracking_mode, achievements(unlocked)")
        .eq("user_id", user.id);
      if (error) throw error;
      return NextResponse.json({
        summaries: (data || []).map((game) => ({
          key: `${game.provider === "local" && game.provider_game_id.startsWith("steam-deck-shortcut:") ? "steam-deck" : game.provider}:${game.provider_game_id}`,
          unlocked: (game.achievements || []).filter((item) => item.unlocked).length,
          total: (game.achievements || []).length,
          lastSyncedAt: game.last_synced_at,
          trackingMode: game.tracking_mode,
        })),
      });
    }

    const provider = searchParams.get("provider");
    const gameId = searchParams.get("gameId");
    const title = searchParams.get("title") || "";
    const forceRefresh = searchParams.get("refresh") === "1";
    if (!provider || !gameId) return NextResponse.json({ error: "provider and gameId are required." }, { status: 400 });
    if (!SUPPORTED_PROVIDERS.has(provider)) return NextResponse.json({ error: `Achievement provider ${provider} is not supported yet.` }, { status: 400 });

    const persistedProvider = storageProvider(provider);
    const cached = await readAchievementGame(admin, user.id, persistedProvider, gameId);
    const stale = !cached?.last_synced_at || Date.now() - new Date(cached.last_synced_at).getTime() > CACHE_MS;
    if (!forceRefresh && cached && !stale) return NextResponse.json({ game: cached, cached: true });

    try {
      const game = await syncAchievements({ admin, userId: user.id, provider, gameId, title });
      return NextResponse.json({ game, cached: false });
    } catch (syncError) {
      await recordAchievementSyncError({ admin, userId: user.id, provider: persistedProvider, providerGameId: gameId, error: syncError });
      if (cached) {
        return NextResponse.json({ game: cached, cached: true, warning: syncError instanceof Error ? syncError.message : "Achievement refresh failed." });
      }
      throw syncError;
    }
  } catch (error) {
    console.error("Achievement sync failed", error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

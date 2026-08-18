const DEFAULT_HEADERS = { Accept: "application/json" };

export function normalizeGameTitle(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[™®©]/g, "")
    .replace(/\b(game of the year|goty|complete|definitive|deluxe|ultimate) edition\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function toNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function toIsoDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    cache: "no-store",
    headers: { ...DEFAULT_HEADERS, ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    const message = payload?.error?.message || payload?.error || payload?.message;
    throw new Error(typeof message === "string" && message ? message : `Achievement provider returned ${response.status}.`);
  }
  return payload;
}

function achievementRow(gameId, achievement, existing) {
  const preserveUnlock = achievement.preserveExistingProgress && existing?.unlocked;
  return {
    achievement_game_id: gameId,
    provider_achievement_id: String(achievement.id),
    name: achievement.name || String(achievement.id),
    description: achievement.description || null,
    icon_url: achievement.iconUrl || null,
    icon_locked_url: achievement.iconLockedUrl || null,
    unlocked: preserveUnlock || Boolean(achievement.unlocked),
    unlocked_at: preserveUnlock ? existing.unlocked_at : achievement.unlockedAt || null,
    rarity_percentage: achievement.rarityPercentage ?? null,
    gamerscore: achievement.gamerscore ?? null,
    progress_current: preserveUnlock ? existing.progress_target || 1 : achievement.progressCurrent ?? 0,
    progress_target: achievement.progressTarget ?? 1,
    metadata: achievement.metadata || {},
    updated_at: new Date().toISOString(),
  };
}

export async function persistAchievementSnapshot({ admin, userId, provider, providerGameId, snapshot }) {
  const now = new Date().toISOString();
  const { data: game, error: gameError } = await admin.from("achievement_games").upsert({
    user_id: userId,
    provider,
    provider_game_id: providerGameId,
    source_game_key: `${provider}:${providerGameId}`,
    game_name: snapshot.gameName,
    platform: snapshot.platform || null,
    cover_artwork_url: snapshot.coverArtworkUrl || null,
    definition_provider: snapshot.definitionProvider || provider,
    definition_game_id: snapshot.definitionGameId || providerGameId,
    tracking_mode: snapshot.trackingMode || "provider",
    last_sync_error: null,
    last_synced_at: now,
    updated_at: now,
  }, { onConflict: "user_id,provider,provider_game_id" }).select("id").single();
  if (gameError) throw gameError;

  const { data: existingRows, error: existingError } = await admin
    .from("achievements")
    .select("id, provider_achievement_id, unlocked, unlocked_at, progress_target")
    .eq("achievement_game_id", game.id);
  if (existingError) throw existingError;
  const existingById = new Map((existingRows || []).map((item) => [item.provider_achievement_id, item]));
  const rows = snapshot.achievements.map((item) => achievementRow(game.id, item, existingById.get(String(item.id))));

  if (rows.length) {
    const { error } = await admin.from("achievements").upsert(rows, { onConflict: "achievement_game_id,provider_achievement_id" });
    if (error) throw error;
  }

  const incomingIds = new Set(rows.map((item) => item.provider_achievement_id));
  const staleIds = (existingRows || []).filter((item) => !incomingIds.has(item.provider_achievement_id)).map((item) => item.id);
  if (staleIds.length) {
    const { error } = await admin.from("achievements").delete().in("id", staleIds);
    if (error) throw error;
  }

  return game.id;
}

export async function recordAchievementSyncError({ admin, userId, provider, providerGameId, error }) {
  await admin.from("achievement_games")
    .update({ last_sync_error: error instanceof Error ? error.message : String(error), updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("provider", provider)
    .eq("provider_game_id", providerGameId);
}

export function sortAchievements(achievements = []) {
  return [...achievements].sort((left, right) => {
    if (left.unlocked !== right.unlocked) return left.unlocked ? -1 : 1;
    const dateDifference = new Date(right.unlocked_at || 0).getTime() - new Date(left.unlocked_at || 0).getTime();
    if (dateDifference) return dateDifference;
    return String(left.name || "").localeCompare(String(right.name || ""));
  });
}

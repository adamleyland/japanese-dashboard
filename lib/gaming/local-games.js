import { toFiniteNumber, toIsoDate, toSafeString } from "@/lib/gaming/gaming-utils";

export function normalizeLocalGame(game = {}) {
  const totalSeconds = Math.max(0, toFiniteNumber(game?.total_playtime_seconds));
  const platforms = Array.isArray(game?.platforms)
    ? game.platforms.filter((platform) => toSafeString(platform))
    : [];

  return {
    source: "local",
    sourceGameId: toSafeString(game?.client_game_id),
    localGameId: toSafeString(game?.id),
    title: toSafeString(game?.game_name, "Untitled local game"),
    artworkUrl: toSafeString(game?.cover_image_url) || null,
    headerArtworkUrl: toSafeString(game?.cover_image_url) || null,
    portraitArtworkUrl: toSafeString(game?.cover_image_url) || null,
    iconArtworkUrl: toSafeString(game?.cover_image_url) || null,
    minutesPlayedTotal: totalSeconds / 60,
    minutesPlayedRecent: 0,
    lastPlayedAt: toIsoDate(game?.last_played_at),
    includeInOverallTotal: true,
    launchUrl: null,
    platform: platforms[0] || "Local",
    devices: platforms,
    metadataProvider: toSafeString(game?.metadata_provider, "client"),
    raw: game,
  };
}

export function normalizeLocalGamesResponse(payload = {}) {
  const games = Array.isArray(payload?.games) ? payload.games : [];
  return games.map(normalizeLocalGame).filter((game) => game.sourceGameId);
}

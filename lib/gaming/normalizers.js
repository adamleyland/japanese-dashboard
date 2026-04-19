import {
  clampMinutes,
  getGameStorageKey,
  getPlatformLabel,
  toIdentifier,
  toFiniteNumber,
  toIsoDate,
  toSafeString,
} from "@/lib/gaming/gaming-utils";
import { buildSteamLaunchUrl, buildXboxLaunchUrl } from "@/lib/gaming/launchers";

function getSteamArtworkUrl(appId, game = {}) {
  if (!appId) {
    return null;
  }

  const explicitArtwork =
    toSafeString(game.artworkUrl) ||
    toSafeString(game.header_image) ||
    toSafeString(game.capsule_image);

  if (explicitArtwork) {
    return explicitArtwork;
  }

  if (game.img_logo_url) {
    return `https://media.steampowered.com/steamcommunity/public/images/apps/${appId}/${game.img_logo_url}.jpg`;
  }

  return `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`;
}

function extractSteamOwnedGames(payload) {
  if (Array.isArray(payload?.games)) {
    return payload.games;
  }

  if (Array.isArray(payload?.response?.games)) {
    return payload.response.games;
  }

  return [];
}

function extractSteamRecentGames(payload) {
  if (Array.isArray(payload?.recentGames)) {
    return payload.recentGames;
  }

  if (Array.isArray(payload?.recent?.games)) {
    return payload.recent.games;
  }

  if (Array.isArray(payload?.recent?.response?.games)) {
    return payload.recent.response.games;
  }

  return [];
}

export function normalizeSteamGame(ownedGame = {}, recentGame = null) {
  const appId = toIdentifier(ownedGame.appid || recentGame?.appid);
  const title = toSafeString(ownedGame.name || recentGame?.name, "Untitled Steam game");

  if (!appId) {
    return null;
  }

  return {
    source: "steam",
    sourceGameId: appId,
    title,
    artworkUrl: getSteamArtworkUrl(appId, { ...recentGame, ...ownedGame }),
    minutesPlayedTotal: clampMinutes(ownedGame.playtime_forever),
    minutesPlayedRecent: clampMinutes(recentGame?.playtime_2weeks ?? ownedGame.playtime_2weeks),
    lastPlayedAt: toIsoDate(ownedGame.rtime_last_played ?? recentGame?.rtime_last_played),
    includeInOverallTotal: true,
    launchUrl: buildSteamLaunchUrl(appId),
    platform: "PC",
    raw: {
      owned: ownedGame,
      recent: recentGame,
    },
  };
}

export function normalizeSteamGamesResponse(payload) {
  const recentGames = extractSteamRecentGames(payload);
  const recentById = new Map(
    recentGames.map((game) => [toIdentifier(game?.appid), game]).filter(([gameId]) => Boolean(gameId)),
  );

  return extractSteamOwnedGames(payload)
    .map((game) => normalizeSteamGame(game, recentById.get(toIdentifier(game?.appid)) || null))
    .filter(Boolean);
}

function pickXboxArtwork(game = {}) {
  return (
    toSafeString(game.artworkUrl) ||
    toSafeString(game.displayImage) ||
    toSafeString(game.imageUrl) ||
    toSafeString(game.boxArt?.tileUrl) ||
    toSafeString(game.boxArt?.largeUrl) ||
    toSafeString(game.images?.[0]?.url) ||
    null
  );
}

function pickXboxSourceId(game = {}) {
  return toIdentifier(game.productId || game.titleId || game.id || game.scid || game.slug);
}

function pickXboxTitle(game = {}) {
  return toSafeString(game.title || game.name || game.productTitle || game.localizedName);
}

function pickXboxLastPlayedAt(game = {}) {
  return toIsoDate(
    game.lastPlayedAt ||
      game.lastTimePlayed ||
      game.lastActivityAt ||
      game.activity?.lastPlayedAt ||
      game.history?.lastPlayedAt,
  );
}

function pickXboxMinutesPlayedTotal(game = {}) {
  return clampMinutes(
    game.minutesPlayedTotal ||
      game.totalMinutesPlayed ||
      game.stats?.minutesPlayedTotal ||
      game.stats?.totalMinutesPlayed ||
      game.stats?.playTimeMinutes ||
      game.usage?.minutesPlayedTotal,
  );
}

function pickXboxMinutesPlayedRecent(game = {}) {
  return clampMinutes(
    game.minutesPlayedRecent ||
      game.recentMinutesPlayed ||
      game.stats?.minutesPlayedRecent ||
      game.stats?.last30DaysMinutes ||
      game.usage?.minutesPlayedRecent,
  );
}

export function normalizeXboxGame(game = {}) {
  const sourceGameId = pickXboxSourceId(game);
  const title = pickXboxTitle(game);

  if (!sourceGameId || !title) {
    return null;
  }

  return {
    source: "xbox",
    sourceGameId,
    title,
    artworkUrl: pickXboxArtwork(game),
    minutesPlayedTotal: pickXboxMinutesPlayedTotal(game),
    minutesPlayedRecent: pickXboxMinutesPlayedRecent(game),
    // TODO: Replace this best-effort timestamp mapping when authenticated Xbox play-history data is available.
    lastPlayedAt: pickXboxLastPlayedAt(game),
    includeInOverallTotal: true,
    launchUrl: toSafeString(game.launchUrl) || buildXboxLaunchUrl(game),
    platform: getPlatformLabel(game.platform || game.deviceType || "Xbox"),
    raw: game,
  };
}

export function normalizeXboxGamesResponse(payload) {
  const candidateArrays = [
    payload?.games,
    payload?.titles,
    payload?.items,
    payload?.results,
    payload?.data?.games,
    payload?.data?.titles,
  ];
  const games = candidateArrays.find((value) => Array.isArray(value)) || [];

  return games.map((game) => normalizeXboxGame(game)).filter(Boolean);
}

export function mergeNormalizedGames(...sourceLists) {
  const mergedGames = new Map();

  sourceLists.flat().forEach((game) => {
    if (!game) {
      return;
    }

    const key = getGameStorageKey(game);
    const existingGame = mergedGames.get(key);

    if (!existingGame) {
      mergedGames.set(key, game);
      return;
    }

    mergedGames.set(key, {
      ...existingGame,
      ...game,
      minutesPlayedTotal: Math.max(
        toFiniteNumber(existingGame.minutesPlayedTotal),
        toFiniteNumber(game.minutesPlayedTotal),
      ),
      minutesPlayedRecent: Math.max(
        toFiniteNumber(existingGame.minutesPlayedRecent),
        toFiniteNumber(game.minutesPlayedRecent),
      ),
      artworkUrl: game.artworkUrl || existingGame.artworkUrl || null,
      lastPlayedAt: game.lastPlayedAt || existingGame.lastPlayedAt || null,
      raw: {
        existing: existingGame.raw,
        incoming: game.raw,
      },
    });
  });

  return [...mergedGames.values()];
}

import {
  clampMinutes,
  getGameStorageKey,
  getPlatformLabel,
  toIdentifier,
  toFiniteNumber,
  toIsoDate,
  toSafeString,
} from "@/lib/gaming/gaming-utils";
import { buildSteamLaunchUrl } from "@/lib/gaming/launchers";

function getSteamArtworkUrl(appId, game = {}) {
  if (!appId) {
    return null;
  }

  const explicitArtwork =
    toSafeString(game.artworkUrl) ||
    toSafeString(game.headerArtworkUrl) ||
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

function getSteamIconArtworkUrl(appId, game = {}) {
  if (!appId || !game.img_icon_url) {
    return null;
  }

  return `https://media.steampowered.com/steamcommunity/public/images/apps/${appId}/${game.img_icon_url}.jpg`;
}

function getSteamPortraitArtworkUrl(appId) {
  if (!appId) {
    return null;
  }

  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900_2x.jpg`;
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
    appId: Number(appId),
    title,
    portraitArtworkUrl: getSteamPortraitArtworkUrl(appId),
    artworkUrl: getSteamArtworkUrl(appId, { ...recentGame, ...ownedGame }),
    headerArtworkUrl: getSteamArtworkUrl(appId, { ...recentGame, ...ownedGame }),
    iconArtworkUrl: getSteamIconArtworkUrl(appId, { ...recentGame, ...ownedGame }),
    minutesPlayedTotal: clampMinutes(ownedGame.playtime_forever),
    minutesPlayedRecent: clampMinutes(recentGame?.playtime_2weeks ?? ownedGame.playtime_2weeks),
    lastPlayedAt: toIsoDate(ownedGame.rtime_last_played ?? recentGame?.rtime_last_played),
    includeInOverallTotal: true,
    launchUrl: buildSteamLaunchUrl(appId),
    platform: "pc",
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

function getXboxImageCandidates(game = {}, keys = []) {
  const directCandidates = keys.map((key) => toSafeString(game?.[key]));
  const nestedCandidates = [
    toSafeString(game?.displayImage),
    toSafeString(game?.imageUrl),
    toSafeString(game?.tileImageUrl),
    toSafeString(game?.boxArt?.tileUrl),
    toSafeString(game?.boxArt?.largeUrl),
    toSafeString(game?.boxArt?.posterUrl),
    toSafeString(game?.boxArt?.heroUrl),
    ...(Array.isArray(game?.images)
      ? game.images.flatMap((image) => [
          toSafeString(image?.url),
          toSafeString(image?.uri),
          toSafeString(image?.imageUrl),
        ])
      : []),
  ];

  return [...directCandidates, ...nestedCandidates].filter(
    (value, index, values) => value && values.indexOf(value) === index,
  );
}

function pickXboxArtwork(game = {}) {
  return (
    getXboxImageCandidates(game, ["artworkUrl", "headerArtworkUrl", "iconArtworkUrl"])[0] || null
  );
}

function pickXboxPortraitArtwork(game = {}) {
  return (
    getXboxImageCandidates(game, ["portraitArtworkUrl", "posterArtworkUrl", "heroArtworkUrl"])[0] ||
    pickXboxArtwork(game)
  );
}

function pickXboxHeaderArtwork(game = {}) {
  return (
    getXboxImageCandidates(game, ["headerArtworkUrl", "artworkUrl", "heroArtworkUrl"])[0] ||
    pickXboxArtwork(game)
  );
}

function pickXboxIconArtwork(game = {}) {
  return (
    getXboxImageCandidates(game, ["iconArtworkUrl", "tileImageUrl", "artworkUrl"])[0] ||
    pickXboxArtwork(game)
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
  return clampMinutes(game.minutesPlayedTotal);
}

function pickXboxMinutesPlayedRecent(game = {}) {
  return clampMinutes(game.minutesPlayedRecent);
}

function pickXboxDevices(game = {}) {
  const devices = game.devices || game.availableOn || game.platforms || [];
  return Array.isArray(devices) ? devices.filter(Boolean) : [];
}

function pickXboxStreamable(game = {}) {
  if (typeof game.isStreamable === "boolean") {
    return game.isStreamable;
  }

  if (typeof game.isGamePassStreamable === "boolean") {
    return game.isGamePassStreamable;
  }

  return false;
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
    portraitArtworkUrl: pickXboxPortraitArtwork(game),
    artworkUrl: pickXboxArtwork(game),
    headerArtworkUrl: pickXboxHeaderArtwork(game),
    iconArtworkUrl: pickXboxIconArtwork(game),
    minutesPlayedTotal: pickXboxMinutesPlayedTotal(game),
    minutesPlayedRecent: pickXboxMinutesPlayedRecent(game),
    // TODO: Replace this best-effort timestamp mapping when authenticated Xbox play-history data is available.
    lastPlayedAt: pickXboxLastPlayedAt(game),
    includeInOverallTotal: true,
    launchUrl: toSafeString(game.launchUrl) || null,
    platform: getPlatformLabel(game.platform || "Xbox"),
    devices: pickXboxDevices(game),
    isStreamable: pickXboxStreamable(game),
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
      portraitArtworkUrl: game.portraitArtworkUrl || existingGame.portraitArtworkUrl || null,
      headerArtworkUrl: game.headerArtworkUrl || existingGame.headerArtworkUrl || null,
      iconArtworkUrl: game.iconArtworkUrl || existingGame.iconArtworkUrl || null,
      lastPlayedAt: game.lastPlayedAt || existingGame.lastPlayedAt || null,
      raw: {
        existing: existingGame.raw,
        incoming: game.raw,
      },
    });
  });

  return [...mergedGames.values()];
}

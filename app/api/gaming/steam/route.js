import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/requestAuth";

const STEAM_OWNED_GAMES_ENDPOINT =
  "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/";
const STEAM_RECENT_GAMES_ENDPOINT =
  "https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function buildSteamImageUrl(appId, imageKey) {
  if (!appId || !imageKey) {
    return null;
  }

  return `https://media.steampowered.com/steamcommunity/public/images/apps/${appId}/${imageKey}.jpg`;
}

function buildSteamHeaderArtworkUrl(appId) {
  return `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`;
}

function buildSteamPortraitArtworkUrl(appId) {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900_2x.jpg`;
}

function buildSteamLaunchUrl(appId) {
  return `steam://run/${appId}`;
}

async function fetchSteamJson(url) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      ok: false,
      status: response.status,
      errorText: errorText || "Steam API request failed.",
      data: null,
    };
  }

  return {
    ok: true,
    status: response.status,
    errorText: null,
    data: await response.json(),
  };
}

function createRecentGamesMap(recentGames) {
  return new Map(
    recentGames
      .filter((game) => Number.isFinite(Number(game?.appid)))
      .map((game) => [Number(game.appid), game]),
  );
}

function normalizeSteamGame(game, recentGame) {
  const appId = Number(game?.appid);
  const headerArtworkUrl = buildSteamHeaderArtworkUrl(appId);
  const iconArtworkUrl = buildSteamImageUrl(appId, game?.img_icon_url);
  const portraitArtworkUrl = buildSteamPortraitArtworkUrl(appId);

  return {
    source: "steam",
    sourceGameId: String(appId),
    appId,
    title: game?.name || "Unknown Steam Game",
    portraitArtworkUrl,
    artworkUrl: headerArtworkUrl || iconArtworkUrl,
    headerArtworkUrl,
    iconArtworkUrl,
    minutesPlayedTotal: Number(game?.playtime_forever || 0),
    minutesPlayedRecent: Number(recentGame?.playtime_2weeks || 0),
    lastPlayedAt: game?.rtime_last_played
      ? new Date(Number(game.rtime_last_played) * 1000).toISOString()
      : null,
    includeInOverallTotal: true,
    launchUrl: buildSteamLaunchUrl(appId),
    platform: "pc",
    raw: {
      owned: game,
      recent: recentGame || null,
    },
  };
}

function normalizeSteamGames(ownedGames, recentGames) {
  const recentGamesMap = createRecentGamesMap(recentGames);

  return ownedGames
    .filter((game) => Number.isFinite(Number(game?.appid)))
    .map((game) => normalizeSteamGame(game, recentGamesMap.get(Number(game.appid)) || null));
}

export async function GET(request) {
  const { user, error: authError } = await getRequestUser(request);
  if (authError || !user?.id) {
    return NextResponse.json({ error: "Sign in is required to view Steam games." }, { status: 401 });
  }

  const apiKey = process.env.STEAM_API_KEY;
  const steamUserId = process.env.STEAM_USER_ID;

  if (!apiKey || !steamUserId) {
    return NextResponse.json(
      {
        error: "Missing STEAM_API_KEY or STEAM_USER_ID environment variables.",
      },
      { status: 500 },
    );
  }

  const ownedGamesParams = new URLSearchParams({
    key: apiKey,
    steamid: steamUserId,
    include_appinfo: "true",
    include_played_free_games: "true",
  });

  const recentGamesParams = new URLSearchParams({
    key: apiKey,
    steamid: steamUserId,
    count: "50",
  });

  try {
    const [ownedGamesResult, recentGamesResult] = await Promise.all([
      fetchSteamJson(`${STEAM_OWNED_GAMES_ENDPOINT}?${ownedGamesParams.toString()}`),
      fetchSteamJson(`${STEAM_RECENT_GAMES_ENDPOINT}?${recentGamesParams.toString()}`),
    ]);

    if (!ownedGamesResult.ok) {
      return NextResponse.json(
        {
          error: ownedGamesResult.errorText,
        },
        { status: ownedGamesResult.status },
      );
    }

    if (!recentGamesResult.ok) {
      return NextResponse.json(
        {
          error: recentGamesResult.errorText,
        },
        { status: recentGamesResult.status },
      );
    }

    const ownedGames = ownedGamesResult.data?.response?.games || [];
    const recentGames = recentGamesResult.data?.response?.games || [];
    const normalizedGames = normalizeSteamGames(ownedGames, recentGames);

    return NextResponse.json({
      games: normalizedGames,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load Steam library.",
      },
      { status: 500 },
    );
  }
}

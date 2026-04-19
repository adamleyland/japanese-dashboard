import { NextResponse } from "next/server";

const STEAM_OWNED_GAMES_ENDPOINT =
  "https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/";
const STEAM_RECENT_GAMES_ENDPOINT =
  "https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function fetchSteamJson(url) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Steam request failed with status ${response.status}.`);
  }

  return response.json();
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const apiKey = process.env.STEAM_API_KEY || process.env.NEXT_PUBLIC_STEAM_API_KEY;
  const steamId =
    searchParams.get("steamId") || process.env.STEAM_ID || process.env.NEXT_PUBLIC_STEAM_ID;

  if (!apiKey || !steamId) {
    return NextResponse.json({
      configured: false,
      games: [],
      recentGames: [],
      message: "Steam configuration is missing.",
    });
  }

  const ownedGamesParams = new URLSearchParams({
    key: apiKey,
    steamid: steamId,
    include_appinfo: "1",
    include_played_free_games: "1",
    format: "json",
  });

  const recentGamesParams = new URLSearchParams({
    key: apiKey,
    steamid: steamId,
    format: "json",
  });

  try {
    const [ownedGamesResponse, recentGamesResponse] = await Promise.all([
      fetchSteamJson(`${STEAM_OWNED_GAMES_ENDPOINT}?${ownedGamesParams.toString()}`),
      fetchSteamJson(`${STEAM_RECENT_GAMES_ENDPOINT}?${recentGamesParams.toString()}`),
    ]);

    return NextResponse.json({
      configured: true,
      games: ownedGamesResponse?.response?.games || [],
      recentGames: recentGamesResponse?.response?.games || [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        configured: true,
        games: [],
        recentGames: [],
        message:
          error instanceof Error ? error.message : "Unable to load Steam owned games.",
      },
      { status: 500 },
    );
  }
}

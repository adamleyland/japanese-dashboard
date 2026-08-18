import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/requestAuth";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

const BASE_URL = "https://www.steamgriddb.com/api/v2";

async function steamGrid(endpoint, apiKey) {
  const response = await fetch(`${BASE_URL}${endpoint}`, { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) throw new Error(payload?.error || "SteamGridDB artwork lookup failed.");
  return payload?.data || [];
}

const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export async function GET(request) {
  try {
    const { user, error } = await getRequestUser(request);
    if (error || !user?.id) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    const url = new URL(request.url); const provider = url.searchParams.get("provider"); const gameId = url.searchParams.get("gameId"); const title = url.searchParams.get("title");
    if (!provider || !gameId || !title) return NextResponse.json({ error: "provider, gameId, and title are required." }, { status: 400 });
    const admin = getSupabaseAdminClient();
    const { data: cached } = await admin.from("achievement_games").select("hero_artwork_url, logo_artwork_url").eq("user_id", user.id).eq("provider", provider).eq("provider_game_id", gameId).maybeSingle();
    if (cached?.hero_artwork_url || cached?.logo_artwork_url) return NextResponse.json({ heroArtworkUrl: cached.hero_artwork_url, logoArtworkUrl: cached.logo_artwork_url }, { headers: { "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800" } });
    const apiKey = String(process.env.STEAMGRIDDB_API_KEY || "").trim();
    if (!apiKey) return NextResponse.json({ heroArtworkUrl: null, logoArtworkUrl: null });
    const results = await steamGrid(`/search/autocomplete/${encodeURIComponent(title)}`, apiKey);
    const game = results.find((entry) => normalize(entry?.name) === normalize(title)) || results[0];
    if (!game?.id) return NextResponse.json({ heroArtworkUrl: null, logoArtworkUrl: null });
    const [heroes, logos] = await Promise.all([steamGrid(`/heroes/game/${game.id}`, apiKey), steamGrid(`/logos/game/${game.id}`, apiKey)]);
    const heroArtworkUrl = (heroes.find((item) => Number(item?.width) > Number(item?.height)) || heroes[0])?.url || null;
    const logoArtworkUrl = logos[0]?.url || null;
    await admin.from("achievement_games").upsert({ user_id: user.id, provider, provider_game_id: gameId, game_name: title, hero_artwork_url: heroArtworkUrl, logo_artwork_url: logoArtworkUrl }, { onConflict: "user_id,provider,provider_game_id" });
    return NextResponse.json({ heroArtworkUrl, logoArtworkUrl }, { headers: { "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800" } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load game artwork." }, { status: 500 }); }
}

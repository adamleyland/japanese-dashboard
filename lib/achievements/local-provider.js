import { findSteamAppByTitle, getSteamAchievementSnapshot } from "@/lib/achievements/steam-provider";

export async function getLocalAchievementSnapshot({ admin, userId, gameId }) {
  const { data: localGame, error } = await admin.from("local_games")
    .select("client_game_id, game_name, cover_image_url, metadata")
    .eq("user_id", userId)
    .eq("client_game_id", gameId)
    .maybeSingle();
  if (error) throw error;
  if (!localGame) throw new Error("The local game could not be found.");

  const metadata = localGame.metadata || {};
  const configuredProvider = metadata.achievementProvider;
  const configuredGameId = metadata.achievementProviderGameId;

  if (configuredProvider === "steam" && configuredGameId) {
    return getSteamAchievementSnapshot({ appId: configuredGameId, includePlayerProgress: false, fallbackTitle: localGame.game_name });
  }

  const steamMatch = await findSteamAppByTitle(localGame.game_name);
  if (!steamMatch?.id) throw new Error(`No automatic achievement match was found for ${localGame.game_name}.`);
  const snapshot = await getSteamAchievementSnapshot({ appId: steamMatch.id, includePlayerProgress: false, fallbackTitle: localGame.game_name });
  return { ...snapshot, coverArtworkUrl: localGame.cover_image_url || snapshot.coverArtworkUrl };
}

import { findSteamAppsByTitle, getSteamAchievementSnapshot } from "@/lib/achievements/steam-provider";

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

  const steamMatches = await findSteamAppsByTitle(localGame.game_name);
  let lastError = null;
  for (const steamMatch of steamMatches) {
    try {
      const snapshot = await getSteamAchievementSnapshot({ appId: steamMatch.id, includePlayerProgress: false, fallbackTitle: localGame.game_name });
      await admin.from("local_games").update({
        metadata: {
          ...metadata,
          achievementProvider: "steam",
          achievementProviderGameId: String(steamMatch.id),
          achievementMatchSource: "automatic-title-and-schema",
          achievementMatchedTitle: steamMatch.name || localGame.game_name,
        },
        updated_at: new Date().toISOString(),
      }).eq("user_id", userId).eq("client_game_id", gameId);
      return { ...snapshot, coverArtworkUrl: localGame.cover_image_url || snapshot.coverArtworkUrl };
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    lastError
      ? `No compatible Steam achievement schema was found for ${localGame.game_name}.`
      : `No automatic Steam title match was found for ${localGame.game_name}.`,
  );
}

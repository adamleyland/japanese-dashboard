import { supabase } from "@/lib/supabase";

const EXCLUDED_GAMES_TABLE = "excluded_games";
const EXCLUDED_YOUTUBE_CHANNELS_TABLE = "excluded_youtube_channels";

export async function fetchExcludedGames(userId) {
  if (!userId) {
    return [];
  }

  const { data, error } = await supabase
    .from(EXCLUDED_GAMES_TABLE)
    .select("source, source_game_id")
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function addExcludedGame(userId, source, sourceGameId) {
  if (!userId || !source || !sourceGameId) {
    return null;
  }

  await removeExcludedGame(userId, source, sourceGameId);

  const { data, error } = await supabase
    .from(EXCLUDED_GAMES_TABLE)
    .insert({
      user_id: userId,
      source,
      source_game_id: sourceGameId,
    })
    .select("user_id, source, source_game_id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function removeExcludedGame(userId, source, sourceGameId) {
  if (!userId || !source || !sourceGameId) {
    return null;
  }

  const { error } = await supabase
    .from(EXCLUDED_GAMES_TABLE)
    .delete()
    .eq("user_id", userId)
    .eq("source", source)
    .eq("source_game_id", sourceGameId);

  if (error) {
    throw error;
  }

  return true;
}

export async function fetchExcludedYoutubeChannels(userId) {
  if (!userId) {
    return [];
  }

  const { data, error } = await supabase
    .from(EXCLUDED_YOUTUBE_CHANNELS_TABLE)
    .select("channel_id")
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function addExcludedYoutubeChannel(userId, channelId) {
  if (!userId || !channelId) {
    return null;
  }

  await removeExcludedYoutubeChannel(userId, channelId);

  const { data, error } = await supabase
    .from(EXCLUDED_YOUTUBE_CHANNELS_TABLE)
    .insert({
      user_id: userId,
      channel_id: channelId,
    })
    .select("user_id, channel_id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function removeExcludedYoutubeChannel(userId, channelId) {
  if (!userId || !channelId) {
    return null;
  }

  const { error } = await supabase
    .from(EXCLUDED_YOUTUBE_CHANNELS_TABLE)
    .delete()
    .eq("user_id", userId)
    .eq("channel_id", channelId);

  if (error) {
    throw error;
  }

  return true;
}

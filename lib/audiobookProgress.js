import { supabase } from "@/lib/supabase";

const AUDIOBOOK_PROGRESS_COLUMNS =
  "audiobook_id, progress_seconds, duration_seconds, last_listened_at, is_current";

export async function fetchUserAudiobookProgress(userId) {
  if (!userId) {
    return [];
  }

  const { data, error } = await supabase
    .from("user_audiobook_progress")
    .select(AUDIOBOOK_PROGRESS_COLUMNS)
    .eq("user_id", userId)
    .order("last_listened_at", { ascending: false, nullsFirst: false });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function clearOtherCurrentAudiobooks(userId, audiobookId) {
  if (!userId || !audiobookId) {
    return;
  }

  const { error } = await supabase
    .from("user_audiobook_progress")
    .update({
      is_current: false,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("is_current", true)
    .neq("audiobook_id", audiobookId);

  if (error) {
    throw error;
  }
}

export async function upsertUserAudiobookProgress({
  userId,
  audiobookId,
  progressSeconds,
  durationSeconds,
  lastListenedAt,
  isCurrent = true,
}) {
  if (!userId || !audiobookId) {
    return;
  }

  const timestamp = lastListenedAt || new Date().toISOString();
  const { error } = await supabase.from("user_audiobook_progress").upsert(
    {
      user_id: userId,
      audiobook_id: audiobookId,
      progress_seconds: Math.max(0, Math.floor(progressSeconds || 0)),
      duration_seconds: Math.max(0, Math.floor(durationSeconds || 0)),
      last_listened_at: timestamp,
      is_current: isCurrent,
      updated_at: timestamp,
    },
    {
      onConflict: "user_id,audiobook_id",
    },
  );

  if (error) {
    throw error;
  }
}

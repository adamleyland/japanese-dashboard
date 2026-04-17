import { supabase } from "@/lib/supabase";

const LISTENING_EVENTS_TABLE = "listening_events";

async function getCurrentUserId({ logMissingUser = true } = {}) {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    console.error("Failed to resolve the current Supabase user for listening events", error);
    return null;
  }

  if (!data.user?.id) {
    if (logMissingUser) {
      console.error("No signed-in Supabase user is available for listening event tracking");
    }
    return null;
  }

  return data.user.id;
}

async function insertListeningEvent(minutes, metadata = {}) {
  const safeMinutes = Number(minutes);
  if (!Number.isFinite(safeMinutes) || safeMinutes === 0) {
    return false;
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    return false;
  }

  const { error } = await supabase.from(LISTENING_EVENTS_TABLE).insert({
    user_id: userId,
    minutes: safeMinutes,
    kind: metadata.kind || (safeMinutes < 0 ? "adjustment" : "session"),
    source: metadata.source || (safeMinutes < 0 ? "adjustment" : "manual"),
    video_id: metadata.videoId || null,
    channel_id: metadata.channelId || null,
  });

  if (error) {
    console.error("Failed to insert listening event", error);
    return false;
  }

  return true;
}

export async function addListeningMinutes(minutes, metadata = {}) {
  return insertListeningEvent(Math.abs(Number(minutes) || 0), metadata);
}

export async function reduceListeningMinutes(minutes, metadata = {}) {
  return insertListeningEvent(-Math.abs(Number(minutes) || 0), metadata);
}

export async function fetchListeningTotal() {
  const userId = await getCurrentUserId({ logMissingUser: false });
  if (!userId) {
    return null;
  }

  const { data, error } = await supabase
    .from(LISTENING_EVENTS_TABLE)
    .select("minutes")
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to fetch listening total", error);
    return null;
  }

  return (data || []).reduce((total, event) => total + Number(event.minutes || 0), 0);
}

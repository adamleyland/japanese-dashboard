import { supabase } from "@/lib/supabase";

const PREFERRED_YOUTUBE_VIDEOS_TABLE = "preferred_youtube_videos";

export function normalizePreferredYoutubeVideos(value) {
  const entries = Array.isArray(value) ? value : [];
  const seenVideoIds = new Set();

  return entries
    .map((entry) => {
      const videoId = String(entry?.id || entry?.videoId || entry?.video_id || "").trim();
      if (!videoId || seenVideoIds.has(videoId)) {
        return null;
      }
      seenVideoIds.add(videoId);

      return {
        id: videoId,
        channelId: String(entry?.channelId || entry?.channel_id || "").trim(),
        title: String(entry?.title || "").trim(),
        channel: String(entry?.channel || "").trim(),
        likedAt: Number(entry?.likedAt || Date.parse(entry?.liked_at || "") || Date.now()),
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.likedAt - left.likedAt);
}

function toPreferredVideoRow(userId, video) {
  return {
    user_id: userId,
    video_id: video.id,
    channel_id: video.channelId || null,
    title: video.title || null,
    channel: video.channel || null,
    liked_at: new Date(video.likedAt || Date.now()).toISOString(),
  };
}

function fromPreferredVideoRow(row) {
  return {
    id: row.video_id,
    channelId: row.channel_id || "",
    title: row.title || "",
    channel: row.channel || "",
    likedAt: Date.parse(row.liked_at || "") || Date.now(),
  };
}

export async function fetchPreferredYoutubeVideos(userId) {
  if (!userId) {
    return [];
  }

  const { data, error } = await supabase
    .from(PREFERRED_YOUTUBE_VIDEOS_TABLE)
    .select("video_id, channel_id, title, channel, liked_at")
    .eq("user_id", userId)
    .order("liked_at", { ascending: false });

  if (error) {
    throw error;
  }

  return normalizePreferredYoutubeVideos((data ?? []).map(fromPreferredVideoRow));
}

export async function upsertPreferredYoutubeVideo(userId, video) {
  if (!userId || !video?.id) {
    return null;
  }

  const normalizedVideo = normalizePreferredYoutubeVideos([
    {
      ...video,
      likedAt: video.likedAt || Date.now(),
    },
  ])[0];

  if (!normalizedVideo) {
    return null;
  }

  const { data, error } = await supabase
    .from(PREFERRED_YOUTUBE_VIDEOS_TABLE)
    .upsert(toPreferredVideoRow(userId, normalizedVideo), {
      onConflict: "user_id,video_id",
    })
    .select("video_id, channel_id, title, channel, liked_at")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? fromPreferredVideoRow(data) : normalizedVideo;
}

export async function upsertPreferredYoutubeVideos(userId, videos) {
  const normalizedVideos = normalizePreferredYoutubeVideos(videos);
  if (!userId || !normalizedVideos.length) {
    return [];
  }

  const { data, error } = await supabase
    .from(PREFERRED_YOUTUBE_VIDEOS_TABLE)
    .upsert(
      normalizedVideos.map((video) => toPreferredVideoRow(userId, video)),
      {
        onConflict: "user_id,video_id",
      },
    )
    .select("video_id, channel_id, title, channel, liked_at");

  if (error) {
    throw error;
  }

  return normalizePreferredYoutubeVideos((data ?? []).map(fromPreferredVideoRow));
}

export async function removePreferredYoutubeVideo(userId, videoId) {
  if (!userId || !videoId) {
    return null;
  }

  const { error } = await supabase
    .from(PREFERRED_YOUTUBE_VIDEOS_TABLE)
    .delete()
    .eq("user_id", userId)
    .eq("video_id", videoId);

  if (error) {
    throw error;
  }

  return true;
}

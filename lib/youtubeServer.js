import "server-only";

import {
  MINIMUM_VIDEO_LENGTH_SECONDS,
  normalizeSeededChannels,
} from "@/lib/youtubeDefaults";

function parseYouTubeErrorText(bodyText = "") {
  try {
    const parsedBody = JSON.parse(bodyText || "{}");
    const parsedError = parsedBody?.error;

    return {
      parsedBody,
      code: parsedError?.code ?? null,
      message: parsedError?.message || bodyText || "",
      domain: parsedError?.errors?.[0]?.domain || "",
      reason: parsedError?.errors?.[0]?.reason || "",
    };
  } catch {
    return {
      parsedBody: null,
      code: null,
      message: bodyText || "",
      domain: "",
      reason: "",
    };
  }
}

async function readYouTubeErrorResponse(response, contextLabel) {
  const bodyText = await response.text();
  const parsedError = parseYouTubeErrorText(bodyText);

  return {
    status: response.status,
    code: parsedError.code ?? response.status,
    message: parsedError.message || response.statusText || bodyText,
    domain: parsedError.domain,
    reason: parsedError.reason,
    bodyText,
    parsedBody: parsedError.parsedBody,
    contextLabel,
  };
}

function createRequestError(message, status, extra = {}) {
  const error = new Error(message);
  error.status = status;
  Object.assign(error, extra);
  return error;
}

function isQuotaExceededError(errorInfo) {
  return (
    errorInfo?.status === 403 &&
    errorInfo?.domain === "youtube.quota" &&
    errorInfo?.reason === "quotaExceeded"
  );
}

function parseDurationToSeconds(duration) {
  if (!duration || typeof duration !== "string") {
    return 0;
  }

  const hours = Number(duration.match(/(\d+)H/)?.[1] || 0);
  const minutes = Number(duration.match(/(\d+)M/)?.[1] || 0);
  const seconds = Number(duration.match(/(\d+)S/)?.[1] || 0);

  return hours * 3600 + minutes * 60 + seconds;
}

function formatDurationLabel(seconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function chunkItems(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function shuffleVideos(videos) {
  const nextVideos = [...videos];

  for (let index = nextVideos.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [nextVideos[index], nextVideos[swapIndex]] = [nextVideos[swapIndex], nextVideos[index]];
  }

  return nextVideos;
}

function extractAccountProfile(data) {
  const primaryChannel = data?.items?.[0];
  if (!primaryChannel?.id) {
    return null;
  }

  const customUrl = primaryChannel?.snippet?.customUrl || "";

  return {
    channelId: primaryChannel.id,
    title: primaryChannel?.snippet?.title || "YouTube",
    thumbnail:
      primaryChannel?.snippet?.thumbnails?.default?.url ||
      primaryChannel?.snippet?.thumbnails?.medium?.url ||
      "",
    handle: customUrl ? `@${customUrl.replace(/^@/, "")}` : "",
  };
}

async function fetchYouTubeJson(requestUrl, accessToken, contextLabel) {
  const response = await fetch(requestUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorInfo = await readYouTubeErrorResponse(response, contextLabel);
    console.error(`[YouTube] ${contextLabel} failed`, {
      requestUrl,
      status: errorInfo.status,
      body: errorInfo.parsedBody || errorInfo.bodyText || null,
    });

    throw createRequestError(
      `${contextLabel} failed: ${errorInfo.status}`,
      errorInfo.status,
      { errorInfo },
    );
  }

  return response.json();
}

async function verifyYoutubeAccountAccess(accessToken) {
  const requestUrl =
    "https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&mine=true";
  const data = await fetchYouTubeJson(requestUrl, accessToken, "YouTube account verification");

  return {
    data,
    accountProfile: extractAccountProfile(data),
  };
}

function normalizePersistedChannels(channels) {
  if (!Array.isArray(channels) || !channels.length) {
    return normalizeSeededChannels();
  }

  return channels
    .map((channel) => {
      const channelId = channel?.channelId || channel?.id;
      if (!channelId) {
        return null;
      }

      return {
        id: channelId,
        channelId,
        name: channel?.name || "Unnamed channel",
        category: channel?.category || "Subscribed",
        thumbnail: channel?.thumbnail || "",
        handle: channel?.handle || "",
        subscriberCount: Math.max(0, Number(channel?.subscriberCount || 0)),
        enabled: channel?.enabled !== false,
      };
    })
    .filter(Boolean);
}

function buildChannelPreferences(channels) {
  return normalizePersistedChannels(channels).reduce((preferences, channel) => {
    preferences[channel.channelId || channel.id] = channel.enabled !== false;
    return preferences;
  }, {});
}

function applyChannelPreferences(channels, preferences) {
  return channels.map((channel) => {
    const channelId = channel.channelId || channel.id;

    return {
      ...channel,
      enabled: preferences[channelId] ?? channel.enabled ?? true,
    };
  });
}

async function fetchSubscribedChannels(accessToken, currentChannels = []) {
  const verificationResult = await verifyYoutubeAccountAccess(accessToken);
  const currentChannelPreferences = buildChannelPreferences(currentChannels);
  const allSubscriptions = [];
  let nextPageToken = "";

  do {
    const params = new URLSearchParams({
      part: "snippet",
      mine: "true",
      maxResults: "50",
    });

    if (nextPageToken) {
      params.set("pageToken", nextPageToken);
    }

    const subscriptionsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/subscriptions?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      },
    );

    if (!subscriptionsResponse.ok) {
      const errorInfo = await readYouTubeErrorResponse(
        subscriptionsResponse,
        "Subscriptions fetch",
      );

      if (isQuotaExceededError(errorInfo)) {
        return {
          ok: false,
          reason: "quotaExceeded",
          errorInfo,
          accountProfile: verificationResult.accountProfile,
          fetchedChannels: [],
          channelDetailsMap: new Map(),
        };
      }

      throw createRequestError(`Subscriptions fetch failed: ${errorInfo.status}`, errorInfo.status, {
        errorInfo,
      });
    }

    const subscriptionsData = await subscriptionsResponse.json();
    allSubscriptions.push(...(subscriptionsData.items || []));
    nextPageToken = subscriptionsData.nextPageToken || "";
  } while (nextPageToken);

  const channelIdsForDetails = [
    ...new Set(
      allSubscriptions.map((item) => item?.snippet?.resourceId?.channelId).filter(Boolean),
    ),
  ];

  const channelDetailsMap = new Map();

  for (const channelIdChunk of chunkItems(channelIdsForDetails, 50)) {
    const channelsData = await fetchYouTubeJson(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelIdChunk.join(",")}`,
      accessToken,
      "Channel details fetch",
    );

    for (const channel of channelsData.items || []) {
      const channelId = channel?.id;
      const customUrl = channel?.snippet?.customUrl || "";
      const handle = customUrl ? `@${customUrl.replace(/^@/, "")}` : "";
      const subscriberCount = Number(channel?.statistics?.subscriberCount || 0);

      channelDetailsMap.set(channelId, {
        thumbnail:
          channel?.snippet?.thumbnails?.default?.url ||
          channel?.snippet?.thumbnails?.medium?.url ||
          "",
        handle,
        subscriberCount,
      });
    }
  }

  const fetchedChannels = applyChannelPreferences(
    Array.from(
      new Map(
        allSubscriptions
          .map((item) => {
            const channelId = item?.snippet?.resourceId?.channelId;
            if (!channelId) {
              return null;
            }

            const details = channelDetailsMap.get(channelId);

            return [
              channelId,
              {
                id: channelId,
                channelId,
                name: item?.snippet?.title || "Unnamed channel",
                category: "Subscribed",
                thumbnail: details?.thumbnail || item?.snippet?.thumbnails?.default?.url || "",
                handle: details?.handle || "",
                subscriberCount: details?.subscriberCount || 0,
                enabled: true,
              },
            ];
          })
          .filter(Boolean),
      ).values(),
    ),
    currentChannelPreferences,
  );

  return {
    ok: true,
    accountProfile: verificationResult.accountProfile,
    fetchedChannels,
    channelDetailsMap,
  };
}

async function fetchVideoDetailsMap(videoIds, accessToken) {
  const detailsMap = new Map();

  for (const videoIdChunk of chunkItems(videoIds, 50)) {
    const detailsData = await fetchYouTubeJson(
      `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${videoIdChunk.join(",")}&maxResults=${videoIdChunk.length}`,
      accessToken,
      "Video details fetch",
    );

    for (const item of detailsData.items || []) {
      const durationSeconds = parseDurationToSeconds(item?.contentDetails?.duration);

      detailsMap.set(item.id, {
        durationSeconds,
        durationLabel: formatDurationLabel(durationSeconds),
        snippet: item?.snippet || null,
      });
    }
  }

  return detailsMap;
}

async function fetchAccountQueueVideos(accessToken, fetchedChannels, channelDetailsMap) {
  const channelIds = fetchedChannels.map((channel) => channel.channelId).slice(0, 5);
  if (!channelIds.length) {
    return [];
  }

  const channelVideoGroups = await Promise.all(
    channelIds.map(async (channelId) => {
      try {
        const requestUrl =
          `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&maxResults=5&order=date&type=video`;
        const videosData = await fetchYouTubeJson(requestUrl, accessToken, "Channel video fetch");
        const channelDetails = channelDetailsMap.get(channelId);

        return (
          videosData.items
            ?.filter((item) => item?.id?.videoId && item?.snippet)
            .map((item) => ({
              id: item.id.videoId,
              channelId,
              channelThumbnail: channelDetails?.thumbnail || "",
              title: item.snippet.title || "Untitled video",
              channel: item.snippet.channelTitle || "YouTube",
              published: item.snippet.publishedAt || "",
            })) || []
        );
      } catch (error) {
        console.error("[YouTube] Unable to fetch recent channel videos", {
          channelId,
          errorMessage: error?.message || String(error || ""),
          status: error?.status || 0,
        });
        return [];
      }
    }),
  );

  const queueCandidates = Array.from(
    new Map(
      channelVideoGroups
        .flat()
        .filter((video) => video?.id)
        .map((video) => [video.id, video]),
    ).values(),
  );

  const queueVideoDetails = await fetchVideoDetailsMap(
    queueCandidates.map((video) => video.id),
    accessToken,
  );

  return shuffleVideos(
    queueCandidates
      .map((video) => {
        const videoDetails = queueVideoDetails.get(video.id);

        return {
          ...video,
          duration: videoDetails?.durationLabel || "Recent upload",
          durationSeconds: videoDetails?.durationSeconds || 0,
        };
      })
      .filter((video) => video.durationSeconds >= MINIMUM_VIDEO_LENGTH_SECONDS),
  ).slice(0, 15);
}

export async function fetchYouTubeAccountBundle(accessToken, currentChannels = []) {
  const subscriptionResult = await fetchSubscribedChannels(accessToken, currentChannels);

  if (!subscriptionResult?.ok && subscriptionResult?.reason === "quotaExceeded") {
    return {
      quotaExceeded: true,
      accountProfile: subscriptionResult.accountProfile || null,
      subscribedChannels: currentChannels,
      accountVideos: [],
    };
  }

  const fetchedChannels = subscriptionResult?.fetchedChannels || [];
  const accountVideos = await fetchAccountQueueVideos(
    accessToken,
    fetchedChannels,
    subscriptionResult?.channelDetailsMap || new Map(),
  );

  return {
    quotaExceeded: false,
    accountProfile: subscriptionResult.accountProfile || null,
    subscribedChannels: fetchedChannels,
    accountVideos,
  };
}

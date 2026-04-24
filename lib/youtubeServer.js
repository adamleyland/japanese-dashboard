import "server-only";

import {
  MINIMUM_VIDEO_LENGTH_SECONDS,
  normalizeSeededChannels,
} from "@/lib/youtubeDefaults";
import { logYoutubeApiCall } from "@/lib/youtubeDiagnostics";

const ACCOUNT_QUEUE_TARGET_SIZE = 15;
const ACCOUNT_QUEUE_MAX_CHANNELS = 12;
const ACCOUNT_QUEUE_UPLOADS_PER_CHANNEL = 4;

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

function normalizeIdSet(values) {
  if (!Array.isArray(values)) {
    return new Set();
  }

  return new Set(values.map((value) => String(value || "").trim()).filter(Boolean));
}

function isUnavailableVideo(video, videoDetails) {
  const title = String(video?.title || videoDetails?.snippet?.title || "").trim().toLowerCase();
  const privacyStatus = videoDetails?.status?.privacyStatus || "";
  const uploadStatus = videoDetails?.status?.uploadStatus || "";

  return (
    !videoDetails ||
    title === "private video" ||
    title === "deleted video" ||
    privacyStatus === "private" ||
    privacyStatus === "privacyStatusUnspecified" ||
    uploadStatus === "deleted" ||
    videoDetails?.status?.embeddable === false
  );
}

function buildBalancedQueue({
  candidates = [],
  selectedChannelIds = [],
  excludeVideoIds = [],
  recentVideoIds = [],
  targetSize = ACCOUNT_QUEUE_TARGET_SIZE,
  reason = "account-bundle",
} = {}) {
  const selectedChannelIdSet = normalizeIdSet(selectedChannelIds);
  const excludedVideoIdSet = normalizeIdSet(excludeVideoIds);
  const recentVideoIdSet = normalizeIdSet(recentVideoIds);
  const skipped = {
    duplicate: 0,
    currentQueue: 0,
    recent: 0,
    missingChannel: 0,
  };
  const videosByChannel = new Map();
  const seenVideoIds = new Set();

  for (const video of candidates) {
    if (!video?.id) {
      continue;
    }

    if (seenVideoIds.has(video.id)) {
      skipped.duplicate += 1;
      continue;
    }
    seenVideoIds.add(video.id);

    if (excludedVideoIdSet.has(video.id)) {
      skipped.currentQueue += 1;
      continue;
    }

    if (recentVideoIdSet.has(video.id)) {
      skipped.recent += 1;
      continue;
    }

    if (!video.channelId) {
      skipped.missingChannel += 1;
      continue;
    }

    if (selectedChannelIdSet.size && !selectedChannelIdSet.has(video.channelId)) {
      continue;
    }

    const channelVideos = videosByChannel.get(video.channelId) || [];
    channelVideos.push(video);
    videosByChannel.set(video.channelId, channelVideos);
  }

  const selectedChannelCount = selectedChannelIdSet.size || videosByChannel.size;
  const perChannelCap = selectedChannelCount >= targetSize ? 1 : 2;
  const availablePerSelectedChannel = Object.fromEntries(
    [...videosByChannel.entries()].map(([channelId, videos]) => [channelId, videos.length]),
  );
  const channelOrder = shuffleVideos([...videosByChannel.keys()]);
  const chosen = [];
  const chosenIds = new Set();
  const chosenPerChannel = new Map();
  let round = 0;

  while (chosen.length < targetSize && channelOrder.length) {
    let addedThisRound = 0;

    for (const channelId of channelOrder) {
      if (chosen.length >= targetSize) {
        break;
      }

      const channelVideos = videosByChannel.get(channelId) || [];
      const chosenCount = chosenPerChannel.get(channelId) || 0;
      if (!channelVideos.length || chosenCount >= perChannelCap) {
        continue;
      }

      const lastVideo = chosen[chosen.length - 1];
      if (lastVideo?.channelId === channelId && channelOrder.length > 1) {
        continue;
      }

      const nextVideo = channelVideos.shift();
      if (!nextVideo) {
        continue;
      }

      chosen.push(nextVideo);
      chosenIds.add(nextVideo.id);
      chosenPerChannel.set(channelId, chosenCount + 1);
      addedThisRound += 1;
    }

    round += 1;
    if (!addedThisRound || round > perChannelCap + 1) {
      break;
    }
  }

  if (chosen.length < targetSize) {
    const fillCandidates = shuffleVideos(
      [...videosByChannel.entries()]
        .flatMap(([channelId, videos]) =>
          videos.map((video) => ({
            ...video,
            channelId,
          })),
        )
        .filter((video) => !chosenIds.has(video.id)),
    );

    for (const video of fillCandidates) {
      if (chosen.length >= targetSize) {
        break;
      }
      if (chosenIds.has(video.id)) {
        continue;
      }

      if (chosen[chosen.length - 1]?.channelId === video.channelId && channelOrder.length > 1) {
        const alternate = fillCandidates.find(
          (candidate) =>
            candidate.id !== video.id &&
            candidate.channelId !== video.channelId &&
            !chosenIds.has(candidate.id),
        );
        if (alternate) {
          chosen.push(alternate);
          chosenIds.add(alternate.id);
          chosenPerChannel.set(alternate.channelId, (chosenPerChannel.get(alternate.channelId) || 0) + 1);
          continue;
        }
      }

      chosen.push(video);
      chosenIds.add(video.id);
      chosenPerChannel.set(video.channelId, (chosenPerChannel.get(video.channelId) || 0) + 1);
    }
  }

  const chosenVideosPerChannel = Object.fromEntries(chosenPerChannel.entries());

  console.info("[YouTube Queue] Generated balanced queue", {
    reason,
    selectedChannelCount,
    channelsWithAvailableVideos: videosByChannel.size,
    availablePerSelectedChannel,
    chosenVideosPerChannel,
    skipped,
    finalQueueChannelDistribution: chosen.reduce((distribution, video) => {
      distribution[video.channelId] = (distribution[video.channelId] || 0) + 1;
      return distribution;
    }, {}),
    finalQueueLength: chosen.length,
    perChannelCap,
  });

  return chosen.slice(0, targetSize);
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

function getEndpointLabel(requestUrl) {
  try {
    const url = new URL(requestUrl);
    return `${url.pathname}${url.search}`;
  } catch {
    return String(requestUrl || "");
  }
}

async function fetchYouTubeJson(requestUrl, accessToken, options = {}) {
  const {
    caller = "unknown",
    contextLabel = "YouTube request",
    reason = "account-bundle",
  } = options;
  const endpoint = getEndpointLabel(requestUrl);

  logYoutubeApiCall({
    phase: "request",
    endpoint,
    reason,
    caller,
    transport: "server",
  });

  const response = await fetch(requestUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorInfo = await readYouTubeErrorResponse(response, contextLabel);
    logYoutubeApiCall({
      phase: "fail",
      endpoint,
      reason,
      caller,
      transport: "server",
      status: errorInfo.status,
      details: {
        domain: errorInfo.domain,
        errorReason: errorInfo.reason,
      },
    });
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

  logYoutubeApiCall({
    phase: "success",
    endpoint,
    reason,
    caller,
    transport: "server",
    status: response.status,
  });

  return response.json();
}

async function verifyYoutubeAccountAccess(accessToken, reason = "account-bundle") {
  const requestUrl =
    "https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&mine=true";
  const data = await fetchYouTubeJson(requestUrl, accessToken, {
    contextLabel: "YouTube account verification",
    caller: "verifyYoutubeAccountAccess",
    reason,
  });

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

async function fetchSubscribedChannels(accessToken, currentChannels = [], reason = "account-bundle") {
  const verificationResult = await verifyYoutubeAccountAccess(accessToken, reason);
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

    const requestUrl = `https://www.googleapis.com/youtube/v3/subscriptions?${params.toString()}`;
    const endpoint = getEndpointLabel(requestUrl);

    logYoutubeApiCall({
      phase: "request",
      endpoint,
      reason,
      caller: "fetchSubscribedChannels",
      transport: "server",
    });

    const subscriptionsResponse = await fetch(requestUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!subscriptionsResponse.ok) {
      const errorInfo = await readYouTubeErrorResponse(
        subscriptionsResponse,
        "Subscriptions fetch",
      );

      logYoutubeApiCall({
        phase: "fail",
        endpoint,
        reason,
        caller: "fetchSubscribedChannels",
        transport: "server",
        status: errorInfo.status,
        details: {
          domain: errorInfo.domain,
          errorReason: errorInfo.reason,
        },
      });

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
    logYoutubeApiCall({
      phase: "success",
      endpoint,
      reason,
      caller: "fetchSubscribedChannels",
      transport: "server",
      status: subscriptionsResponse.status,
      details: {
        pageToken: nextPageToken || "",
        itemCount: Array.isArray(subscriptionsData.items) ? subscriptionsData.items.length : 0,
      },
    });
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
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${channelIdChunk.join(",")}`,
      accessToken,
      {
        contextLabel: "Channel details fetch",
        caller: "fetchSubscribedChannels",
        reason,
      },
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
        uploadsPlaylistId: channel?.contentDetails?.relatedPlaylists?.uploads || "",
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

async function fetchVideoDetailsMap(videoIds, accessToken, reason = "account-bundle") {
  const detailsMap = new Map();

  for (const videoIdChunk of chunkItems(videoIds, 50)) {
    const detailsData = await fetchYouTubeJson(
      `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet,status&id=${videoIdChunk.join(",")}&maxResults=${videoIdChunk.length}`,
      accessToken,
      {
        contextLabel: "Video details fetch",
        caller: "fetchVideoDetailsMap",
        reason,
      },
    );

    for (const item of detailsData.items || []) {
      const durationSeconds = parseDurationToSeconds(item?.contentDetails?.duration);

      detailsMap.set(item.id, {
        durationSeconds,
        durationLabel: formatDurationLabel(durationSeconds),
        snippet: item?.snippet || null,
        status: item?.status || null,
      });
    }
  }

  return detailsMap;
}

async function fetchAccountQueueVideos(
  accessToken,
  fetchedChannels,
  channelDetailsMap,
  options = {},
) {
  const {
    reason = "account-bundle",
    selectedChannelIds = [],
    excludeVideoIds = [],
    recentVideoIds = [],
  } = options;
  const selectedChannelIdSet = normalizeIdSet(selectedChannelIds);
  const eligibleChannels = fetchedChannels.filter((channel) => {
    const channelId = channel.channelId || channel.id;
    if (!channelId || channel.enabled === false) {
      return false;
    }

    return !selectedChannelIdSet.size || selectedChannelIdSet.has(channelId);
  });
  const channelIds = shuffleVideos(eligibleChannels.map((channel) => channel.channelId || channel.id))
    .filter(Boolean)
    .slice(0, ACCOUNT_QUEUE_MAX_CHANNELS);

  console.info("[YouTube Queue] Preparing account queue candidates", {
    reason,
    selectedChannelCount: selectedChannelIdSet.size || eligibleChannels.length,
    eligibleChannelCount: eligibleChannels.length,
    fetchedUploadChannelCount: channelIds.length,
    excludeVideoCount: normalizeIdSet(excludeVideoIds).size,
    recentVideoCount: normalizeIdSet(recentVideoIds).size,
  });

  if (!channelIds.length) {
    return [];
  }

  const channelVideoGroups = await Promise.all(
    channelIds.map(async (channelId) => {
      try {
        const channelDetails = channelDetailsMap.get(channelId);
        const uploadsPlaylistId = channelDetails?.uploadsPlaylistId || "";

        if (!uploadsPlaylistId) {
          return [];
        }

        const requestUrl =
          `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=${ACCOUNT_QUEUE_UPLOADS_PER_CHANNEL}`;
        const videosData = await fetchYouTubeJson(requestUrl, accessToken, {
          contextLabel: "Channel uploads fetch",
          caller: "fetchAccountQueueVideos",
          reason,
        });

        return (
          videosData.items
            ?.filter((item) => item?.contentDetails?.videoId && item?.snippet)
            .map((item) => ({
              id: item.contentDetails.videoId,
              channelId,
              channelThumbnail: channelDetails?.thumbnail || "",
              title: item.snippet.title || "Untitled video",
              channel: item.snippet.channelTitle || "YouTube",
              published: item.snippet.publishedAt || "",
            })) || []
        );
      } catch (error) {
        console.error("[YouTube] Unable to fetch recent channel uploads", {
          channelId,
          errorMessage: error?.message || String(error || ""),
          status: error?.status || 0,
        });
        return [];
      }
    }),
  );

  const queueCandidates = channelVideoGroups.flat().filter((video) => video?.id);

  const queueVideoDetails = await fetchVideoDetailsMap(
    queueCandidates.map((video) => video.id),
    accessToken,
    reason,
  );

  const playableCandidates = queueCandidates
    .map((video) => {
      const videoDetails = queueVideoDetails.get(video.id);
      if (isUnavailableVideo(video, videoDetails)) {
        return null;
      }

      return {
        ...video,
        duration: videoDetails?.durationLabel || "Recent upload",
        durationSeconds: videoDetails?.durationSeconds || 0,
        privacyStatus: videoDetails?.status?.privacyStatus || "",
        embeddable: videoDetails?.status?.embeddable !== false,
      };
    })
    .filter((video) => video?.durationSeconds >= MINIMUM_VIDEO_LENGTH_SECONDS);

  return buildBalancedQueue({
    candidates: playableCandidates,
    selectedChannelIds: channelIds,
    excludeVideoIds,
    recentVideoIds,
    reason,
  });
}

export async function fetchYouTubeAccountBundle(
  accessToken,
  currentChannels = [],
  options = {},
) {
  const reason = options.reason || "account-bundle";
  const subscriptionResult = await fetchSubscribedChannels(accessToken, currentChannels, reason);

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
    {
      reason,
      selectedChannelIds: options.selectedChannelIds || [],
      excludeVideoIds: options.excludeVideoIds || [],
      recentVideoIds: options.recentVideoIds || [],
    },
  );

  return {
    quotaExceeded: false,
    accountProfile: subscriptionResult.accountProfile || null,
    subscribedChannels: fetchedChannels,
    accountVideos,
  };
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ListeningWorkspace from "@/components/features/listening/ListeningWorkspace";
import TimerStopwatch from "@/components/features/listening/TimerStopwatch";
import ListeningVisualization from "@/components/features/listening/ListeningVisualization";

const DISCOVER_FILTERS = {
  ゲーム: "日本 ゲーム 実況",
  旅行: "日本 旅行 vlog",
  日本語: "日本語 勉強",
};

export default function ListeningTab({
  styles,
  listeningHours,
  adjustListeningHours,
  isMobile,
  isCompact,
  seededChannels,
  seededVideos,
  formatClock,
}) {
  const DEFAULT_VIDEO_ID = "M7lc1UVf-VE";
  const MINIMUM_VIDEO_LENGTH_SECONDS = 90;
  const SESSION_STORAGE_KEY = "jp_dashboard_youtube_session";
  const DAILY_QUEUE_STORAGE_KEY = "jp_daily_video_queue";
  const CHANNEL_PREFERENCES_STORAGE_KEY = "jp_youtube_channel_preferences";
  const DISCOVER_CACHE_STORAGE_KEY = "jp_youtube_discover_cache_v1";
  const DISCOVER_QUOTA_COOLDOWN_STORAGE_KEY = "jp_youtube_discover_quota_cooldown_v1";
  const DISCOVER_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
  const DISCOVER_QUOTA_COOLDOWN_MS = 6 * 60 * 60 * 1000;

  const normalizeSeededChannels = useCallback(
    () =>
      seededChannels.map((channel) => ({
        ...channel,
        channelId: channel.id,
        thumbnail: channel.thumbnail || "",
        enabled: true,
      })),
    [seededChannels],
  );

  const [youtubeConnected, setYoutubeConnected] = useState(false);
  const [youtubeAccessToken, setYoutubeAccessToken] = useState("");
  const [subscribedChannels, setSubscribedChannels] = useState(() => normalizeSeededChannels());
  const [videoFeed] = useState(seededVideos);
  const [accountVideos, setAccountVideos] = useState([]);
  const [discoverFilter, setDiscoverFilter] = useState("ゲーム");
  const [discoverVideos, setDiscoverVideos] = useState([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [selectedVideoId, setSelectedVideoId] = useState(DEFAULT_VIDEO_ID);
  const [workspaceTab, setWorkspaceTab] = useState(null);
  const [focusMode, setFocusMode] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isPlayerPlaying, setIsPlayerPlaying] = useState(false);

  const [clockMode, setClockMode] = useState("stopwatch");
  const [stopwatchSeconds, setStopwatchSeconds] = useState(0);
  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  const [timerDurationSeconds, setTimerDurationSeconds] = useState(300);
  const [timerSeconds, setTimerSeconds] = useState(300);
  const [timerRunning, setTimerRunning] = useState(false);

  const [listeningGoal, setListeningGoal] = useState(1200);
  const [showVisualization] = useState(true);
  const [vizMode, setVizMode] = useState("bar");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const sessionRef = useRef(0);
  const playerRef = useRef(null);
  const playerHostRef = useRef(null);
  const focusPlayerHostRef = useRef(null);
  const activePlayerHostRef = useRef(null);
  const initRef = useRef(false);
  const playerReadyRef = useRef(false);
  const googleTokenClientRef = useRef(null);
  const pendingRestoreRef = useRef(null);
  const pendingSelectionPlaybackRef = useRef(null);
  const discoverInFlightFiltersRef = useRef(new Set());
  const discoverLoadedFiltersRef = useRef(new Set());

  const safeVideoId = selectedVideoId || DEFAULT_VIDEO_ID;
  const roundToTenth = useCallback((value) => Math.round(value * 10) / 10, []);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const youtubeApiKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
  const browserOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const maskSecret = useCallback((value) => {
    if (!value) return "missing";
    if (value.length <= 10) return value;
    return `${value.slice(0, 6)}...${value.slice(-4)}`;
  }, []);
  const logYouTubeDebug = useCallback((message, payload) => {
    if (payload === undefined) {
      console.log(`[ListeningTab:YouTube] ${message}`);
      return;
    }

    console.log(`[ListeningTab:YouTube] ${message}`, payload);
  }, []);

  const parseYouTubeErrorText = useCallback((bodyText = "") => {
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
  }, []);

  const readYouTubeErrorResponse = useCallback(
    async (response, contextLabel) => {
      const bodyText = await response.text();
      const parsedError = parseYouTubeErrorText(bodyText);
      const errorInfo = {
        status: response.status,
        code: parsedError.code ?? response.status,
        message: parsedError.message || response.statusText || bodyText,
        domain: parsedError.domain,
        reason: parsedError.reason,
        bodyText,
        parsedBody: parsedError.parsedBody,
      };

      logYouTubeDebug(`${contextLabel} parsed YouTube API error response.`, errorInfo);
      return errorInfo;
    },
    [logYouTubeDebug, parseYouTubeErrorText],
  );

  const isQuotaExceededError = useCallback(
    (errorInfo) =>
      errorInfo?.status === 403 &&
      errorInfo?.domain === "youtube.quota" &&
      errorInfo?.reason === "quotaExceeded",
    [],
  );

  const parseDurationToSeconds = useCallback((duration) => {
    if (!duration || typeof duration !== "string") return 0;

    const hours = Number(duration.match(/(\d+)H/)?.[1] || 0);
    const minutes = Number(duration.match(/(\d+)M/)?.[1] || 0);
    const seconds = Number(duration.match(/(\d+)S/)?.[1] || 0);

    return hours * 3600 + minutes * 60 + seconds;
  }, []);

  const formatDurationLabel = useCallback((seconds) => {
    const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const remainingSeconds = safeSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
    }

    return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
  }, []);

  const getTodayKey = useCallback(() => new Date().toISOString().slice(0, 10), []);
  const chunkItems = useCallback((items, size) => {
    const chunks = [];

    for (let index = 0; index < items.length; index += size) {
      chunks.push(items.slice(index, index + size));
    }

    return chunks;
  }, []);

  const fetchVideoDetailsMap = useCallback(
    async (videoIds, options = {}) => {
      const uniqueVideoIds = [...new Set(videoIds.filter(Boolean))];
      const detailsMap = new Map();
      const useApiKey = Boolean(options.useApiKey && youtubeApiKey);
      const requestAccessToken = options.accessToken || youtubeAccessToken;

      if (!uniqueVideoIds.length) {
        logYouTubeDebug("Skipping video details fetch because there are no video IDs.", options);
        return detailsMap;
      }

      if (!useApiKey && !requestAccessToken) {
        console.error(
          "[ListeningTab:YouTube] Cannot fetch video details without an OAuth token or API key.",
          options,
        );
        return detailsMap;
      }

      logYouTubeDebug("Fetching video details.", {
        videoCount: uniqueVideoIds.length,
        authMode: useApiKey ? "apiKey" : "oauth",
        requestLabel: options.requestLabel || "unspecified",
      });

      for (const videoIdChunk of chunkItems(uniqueVideoIds, 50)) {
        const params = new URLSearchParams({
          part: "contentDetails",
          id: videoIdChunk.join(","),
          maxResults: String(videoIdChunk.length),
        });
        if (useApiKey) {
          params.set("key", youtubeApiKey);
        }

        const response = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`,
          useApiKey
            ? undefined
            : {
                headers: {
                  Authorization: `Bearer ${requestAccessToken}`,
                },
              },
        );

        if (!response.ok) {
          const errorInfo = await readYouTubeErrorResponse(response, "Video details fetch");
          console.error("[ListeningTab:YouTube] Video details fetch failed.", {
            status: errorInfo.status,
            requestLabel: options.requestLabel || "unspecified",
            errorInfo,
          });
          if (isQuotaExceededError(errorInfo)) {
            console.error(
              "[ListeningTab:YouTube] Video details request hit YouTube API quotaExceeded.",
            );
          }
          throw new Error(`Video details fetch failed: ${errorInfo.status}`);
        }

        const data = await response.json();
        logYouTubeDebug("Video details fetch succeeded.", {
          requestLabel: options.requestLabel || "unspecified",
          receivedItems: data.items?.length || 0,
        });

        for (const item of data.items || []) {
          const durationSeconds = parseDurationToSeconds(item?.contentDetails?.duration);

          detailsMap.set(item.id, {
            durationSeconds,
            durationLabel: formatDurationLabel(durationSeconds),
          });
        }
      }

      return detailsMap;
    },
    [
      chunkItems,
      formatDurationLabel,
      isQuotaExceededError,
      logYouTubeDebug,
      parseDurationToSeconds,
      readYouTubeErrorResponse,
      youtubeAccessToken,
      youtubeApiKey,
    ],
  );

  const shuffleVideos = useCallback((videos) => {
    const nextVideos = [...videos];

    for (let index = nextVideos.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [nextVideos[index], nextVideos[swapIndex]] = [nextVideos[swapIndex], nextVideos[index]];
    }

    return nextVideos;
  }, []);

  const readJsonStorage = useCallback((storageKey) => {
    if (typeof window === "undefined") return null;

    try {
      return JSON.parse(localStorage.getItem(storageKey) || "null");
    } catch (error) {
      console.error(`Failed to parse localStorage for ${storageKey}`, error);
      return null;
    }
  }, []);

  const readStoredWatchState = useCallback(
    () => readJsonStorage(SESSION_STORAGE_KEY),
    [readJsonStorage],
  );

  const persistWatchState = useCallback(
    (videoId = safeVideoId, currentTime = 0) => {
      if (typeof window === "undefined" || !videoId) return;

      localStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({
          selectedVideoId: videoId,
          currentTime: Math.max(0, Math.floor(currentTime || 0)),
          updatedAt: Date.now(),
        }),
      );
    },
    [safeVideoId],
  );

  const readStoredDailyQueue = useCallback(
    () => readJsonStorage(DAILY_QUEUE_STORAGE_KEY),
    [readJsonStorage],
  );

  const persistDailyQueue = useCallback((videos) => {
    if (typeof window === "undefined") return;

    localStorage.setItem(
      DAILY_QUEUE_STORAGE_KEY,
      JSON.stringify({
        date: getTodayKey(),
        videos,
      }),
    );
  }, [getTodayKey]);

  const readStoredChannelPreferences = useCallback(() => {
    const storedPreferences = readJsonStorage(CHANNEL_PREFERENCES_STORAGE_KEY);
    return storedPreferences && typeof storedPreferences === "object" ? storedPreferences : {};
  }, [readJsonStorage]);

  const readStoredDiscoverCache = useCallback(
    (filter) => {
      const discoverCache = readJsonStorage(DISCOVER_CACHE_STORAGE_KEY);
      const cacheEntry = discoverCache?.[filter];

      if (!cacheEntry || !Array.isArray(cacheEntry.videos) || !cacheEntry.timestamp) {
        return null;
      }

      const ageMs = Date.now() - Number(cacheEntry.timestamp || 0);
      if (ageMs > DISCOVER_CACHE_TTL_MS) {
        return null;
      }

      return cacheEntry;
    },
    [DISCOVER_CACHE_TTL_MS, DISCOVER_CACHE_STORAGE_KEY, readJsonStorage],
  );

  const persistDiscoverCache = useCallback(
    (filter, videos) => {
      if (typeof window === "undefined") return;

      const existingCache = readJsonStorage(DISCOVER_CACHE_STORAGE_KEY);
      const nextCache =
        existingCache && typeof existingCache === "object" ? existingCache : {};

      nextCache[filter] = {
        timestamp: Date.now(),
        videos,
      };

      localStorage.setItem(DISCOVER_CACHE_STORAGE_KEY, JSON.stringify(nextCache));
    },
    [DISCOVER_CACHE_STORAGE_KEY, readJsonStorage],
  );

  const readDiscoverQuotaCooldown = useCallback(() => {
    const cooldown = readJsonStorage(DISCOVER_QUOTA_COOLDOWN_STORAGE_KEY);
    const expiresAt = Number(cooldown?.expiresAt || 0);

    if (!expiresAt) {
      return null;
    }

    if (Date.now() >= expiresAt) {
      if (typeof window !== "undefined") {
        localStorage.removeItem(DISCOVER_QUOTA_COOLDOWN_STORAGE_KEY);
      }
      return null;
    }

    return cooldown;
  }, [DISCOVER_QUOTA_COOLDOWN_STORAGE_KEY, readJsonStorage]);

  const persistDiscoverQuotaCooldown = useCallback(
    (errorInfo) => {
      if (typeof window === "undefined") return;

      localStorage.setItem(
        DISCOVER_QUOTA_COOLDOWN_STORAGE_KEY,
        JSON.stringify({
          timestamp: Date.now(),
          expiresAt: Date.now() + DISCOVER_QUOTA_COOLDOWN_MS,
          status: errorInfo?.status || 403,
          code: errorInfo?.code || 403,
          message: errorInfo?.message || "YouTube API quota exceeded",
          domain: errorInfo?.domain || "",
          reason: errorInfo?.reason || "",
        }),
      );
    },
    [DISCOVER_QUOTA_COOLDOWN_MS, DISCOVER_QUOTA_COOLDOWN_STORAGE_KEY],
  );

  const persistChannelPreferences = useCallback((channels) => {
    if (typeof window === "undefined") return;

    const nextPreferences = channels.reduce((preferences, channel) => {
      const channelId = channel.channelId || channel.id;
      if (!channelId) return preferences;

      preferences[channelId] = channel.enabled !== false;
      return preferences;
    }, {});

    localStorage.setItem(CHANNEL_PREFERENCES_STORAGE_KEY, JSON.stringify(nextPreferences));
  }, []);

  const applyChannelPreferences = useCallback((channels, preferences) => {
    return channels.map((channel) => {
      const channelId = channel.channelId || channel.id;
      return {
        ...channel,
        enabled: preferences[channelId] ?? channel.enabled ?? true,
      };
    });
  }, []);

  const clearYoutubeDataState = useCallback(() => {
    logYouTubeDebug("Clearing YouTube account data state.");
    discoverInFlightFiltersRef.current.clear();
    discoverLoadedFiltersRef.current.clear();
    setYoutubeConnected(false);
    setAccountVideos([]);
    setDiscoverVideos([]);
    setDiscoverLoading(false);
    setSubscribedChannels(normalizeSeededChannels());
    setSelectedVideoId(DEFAULT_VIDEO_ID);
  }, [DEFAULT_VIDEO_ID, logYouTubeDebug, normalizeSeededChannels]);

  const verifyYoutubeAccountAccess = useCallback(
    async (accessToken) => {
      logYouTubeDebug("Starting YouTube account verification request.", {
        youtubeAccessToken: maskSecret(accessToken),
      });

      const response = await fetch(
        "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      logYouTubeDebug("YouTube account verification response received.", {
        status: response.status,
      });

      if (!response.ok) {
        const errorInfo = await readYouTubeErrorResponse(
          response,
          "YouTube account verification",
        );
        console.error("[ListeningTab:YouTube] YouTube account verification failed.", {
          status: errorInfo.status,
          errorInfo,
        });
        if (isQuotaExceededError(errorInfo)) {
          console.error(
            "[ListeningTab:YouTube] YouTube account verification hit quotaExceeded. Skipping account-data initialization without treating this as an auth failure.",
          );
          return {
            ok: false,
            reason: "quotaExceeded",
            errorInfo,
          };
        }
        console.error(
          "[ListeningTab:YouTube] OAuth token/account is not usable for YouTube account data. Skipping subscriptions initialization.",
        );
        throw new Error(`YouTube account verification failed: ${errorInfo.status}`);
      }

      const data = await response.json();
      logYouTubeDebug("YouTube account verification succeeded.", {
        itemCount: data.items?.length || 0,
      });

      return {
        ok: true,
        data,
      };
    },
    [isQuotaExceededError, logYouTubeDebug, maskSecret, readYouTubeErrorResponse],
  );

  const fetchSubscribedChannels = useCallback(
    async (accessToken) => {
      logYouTubeDebug("Starting subscriptions initialization.", {
        youtubeAccessToken: maskSecret(accessToken),
      });

      const verificationResult = await verifyYoutubeAccountAccess(accessToken);
      if (!verificationResult?.ok) {
        return {
          ok: false,
          reason: verificationResult?.reason || "unknown",
          errorInfo: verificationResult?.errorInfo || null,
          fetchedChannels: [],
          channelDetailsMap: new Map(),
        };
      }

      const channelPreferences = readStoredChannelPreferences();
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

        logYouTubeDebug("Fetching YouTube subscriptions page.", {
          pageToken: nextPageToken || null,
        });

        const subscriptionsResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/subscriptions?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );

        if (!subscriptionsResponse.ok) {
          const errorInfo = await readYouTubeErrorResponse(
            subscriptionsResponse,
            "Subscriptions fetch",
          );
          console.error("[ListeningTab:YouTube] Subscriptions fetch failed.", {
            status: errorInfo.status,
            errorInfo,
          });
          if (isQuotaExceededError(errorInfo)) {
            console.error(
              "[ListeningTab:YouTube] Subscriptions fetch returned quotaExceeded. This is a YouTube API quota issue, not an auth/access failure.",
            );
            return {
              ok: false,
              reason: "quotaExceeded",
              errorInfo,
              fetchedChannels: [],
              channelDetailsMap: new Map(),
            };
          } else if (subscriptionsResponse.status === 403) {
            console.error(
              "[ListeningTab:YouTube] Subscriptions fetch returned 403. This is a YouTube subscriptions authorization/access issue for the current OAuth token/account.",
            );
          }
          throw new Error(`Subscriptions fetch failed: ${errorInfo.status}`);
        }

        const subscriptionsData = await subscriptionsResponse.json();
        logYouTubeDebug("Subscriptions fetch succeeded.", {
          receivedItems: subscriptionsData.items?.length || 0,
          nextPageToken: subscriptionsData.nextPageToken || null,
        });

        allSubscriptions.push(...(subscriptionsData.items || []));
        nextPageToken = subscriptionsData.nextPageToken || "";
      } while (nextPageToken);

      const channelIdsForDetails = [
        ...new Set(
          allSubscriptions.map((item) => item?.snippet?.resourceId?.channelId).filter(Boolean),
        ),
      ];

      logYouTubeDebug("Resolved subscribed channel IDs.", {
        subscriptionCount: allSubscriptions.length,
        usableChannelIds: channelIdsForDetails.length,
      });

      if (!channelIdsForDetails.length) {
        console.warn(
          "[ListeningTab:YouTube] Subscriptions fetch succeeded but returned no usable channels.",
        );
      }

      const channelDetailsMap = new Map();

      for (const channelIdChunk of chunkItems(channelIdsForDetails, 50)) {
        const channelsResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelIdChunk.join(",")}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );

        if (!channelsResponse.ok) {
          const errorInfo = await readYouTubeErrorResponse(
            channelsResponse,
            "Subscribed channel details fetch",
          );
          console.error("[ListeningTab:YouTube] Channel details fetch failed.", {
            status: errorInfo.status,
            errorInfo,
          });
          continue;
        }

        const channelsData = await channelsResponse.json();

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
                if (!channelId) return null;

                const details = channelDetailsMap.get(channelId);

                return [
                  channelId,
                  {
                    id: channelId,
                    channelId,
                    name: item?.snippet?.title || "Unnamed channel",
                    category: "Subscribed",
                    thumbnail:
                      details?.thumbnail || item?.snippet?.thumbnails?.default?.url || "",
                    handle: details?.handle || "",
                    subscriberCount: details?.subscriberCount || 0,
                    enabled: true,
                  },
                ];
              })
              .filter(Boolean),
          ).values(),
        ),
        channelPreferences,
      );

      if (fetchedChannels.length) {
        persistChannelPreferences(fetchedChannels);
      }

      return {
        ok: true,
        fetchedChannels,
        channelDetailsMap,
      };
    },
    [
      applyChannelPreferences,
      chunkItems,
      isQuotaExceededError,
      logYouTubeDebug,
      maskSecret,
      persistChannelPreferences,
      readYouTubeErrorResponse,
      readStoredChannelPreferences,
      verifyYoutubeAccountAccess,
    ],
  );

  const fetchAccountQueueVideos = useCallback(
    async (accessToken, fetchedChannels, channelDetailsMap) => {
      const storedDailyQueue = readStoredDailyQueue();
      if (
        storedDailyQueue?.date === getTodayKey() &&
        Array.isArray(storedDailyQueue.videos) &&
        storedDailyQueue.videos.length &&
        storedDailyQueue.videos.every(
          (video) => Number(video?.durationSeconds || 0) >= MINIMUM_VIDEO_LENGTH_SECONDS,
        )
      ) {
        logYouTubeDebug("Using stored daily queue from localStorage.", {
          queueLength: storedDailyQueue.videos.length,
        });
        return storedDailyQueue.videos;
      }

      const channelIds = fetchedChannels.map((channel) => channel.channelId).slice(0, 5);
      if (!channelIds.length) {
        console.warn(
          "[ListeningTab:YouTube] No usable subscribed channel IDs were available for the account queue fetch.",
        );
        return [];
      }

      const channelVideoGroups = await Promise.all(
        channelIds.map(async (channelId) => {
          try {
            logYouTubeDebug("Fetching recent videos for subscribed channel.", { channelId });
            const videosResponse = await fetch(
              `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&maxResults=5&order=date&type=video`,
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              },
            );

            if (!videosResponse.ok) {
              const errorInfo = await readYouTubeErrorResponse(
                videosResponse,
                "Channel video fetch",
              );
              console.error("[ListeningTab:YouTube] Channel video fetch failed.", {
                channelId,
                status: errorInfo.status,
                errorInfo,
              });
              if (isQuotaExceededError(errorInfo)) {
                console.error(
                  "[ListeningTab:YouTube] Channel video fetch hit quotaExceeded. Failing gracefully without retrying in this initialization flow.",
                );
              }
              throw new Error(`Video fetch failed for ${channelId}: ${errorInfo.status}`);
            }

            const videosData = await videosResponse.json();
            logYouTubeDebug("Channel video fetch succeeded.", {
              channelId,
              receivedItems: videosData.items?.length || 0,
            });

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
            console.error("Unable to fetch recent channel videos", error);
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

      const queueVideoDetails = await fetchVideoDetailsMap(queueCandidates.map((video) => video.id), {
        requestLabel: "account queue",
        accessToken,
        useApiKey: false,
      });

      const filteredQueueVideos = queueCandidates
        .map((video) => {
          const videoDetails = queueVideoDetails.get(video.id);

          return {
            ...video,
            duration: videoDetails?.durationLabel || "Recent upload",
            durationSeconds: videoDetails?.durationSeconds || 0,
          };
        })
        .filter((video) => video.durationSeconds >= MINIMUM_VIDEO_LENGTH_SECONDS);

      const shuffledVideos = shuffleVideos(filteredQueueVideos).slice(0, 15);

      logYouTubeDebug("Account queue video fetch completed.", {
        candidateVideos: queueCandidates.length,
        filteredQueueVideos: filteredQueueVideos.length,
        finalQueueVideos: shuffledVideos.length,
      });

      if (!shuffledVideos.length) {
        console.warn(
          "[ListeningTab:YouTube] Channel video fetch completed but no usable queue videos were found.",
        );
      }

      persistDailyQueue(shuffledVideos);
      return shuffledVideos;
    },
    [
      MINIMUM_VIDEO_LENGTH_SECONDS,
      fetchVideoDetailsMap,
      getTodayKey,
      isQuotaExceededError,
      logYouTubeDebug,
      persistDailyQueue,
      readYouTubeErrorResponse,
      readStoredDailyQueue,
      shuffleVideos,
    ],
  );

  const fetchDiscoverVideosForToken = useCallback(
    async (accessToken, filter) => {
      const discoverQuery = DISCOVER_FILTERS[filter] || DISCOVER_FILTERS.ゲーム;
      const cachedEntry = readStoredDiscoverCache(filter);
      const cooldownEntry = readDiscoverQuotaCooldown();
      const requestKey = filter;

      logYouTubeDebug("Running discover fetch.", {
        discoverFilter: filter,
        discoverQuery,
        youtubeAccessToken: maskSecret(accessToken),
        hasApiKey: Boolean(youtubeApiKey),
        hasCachedEntry: Boolean(cachedEntry),
        hasCooldown: Boolean(cooldownEntry),
      });

      if (cachedEntry) {
        logYouTubeDebug("Using cached discover results.", {
          discoverFilter: filter,
          cachedVideoCount: cachedEntry.videos.length,
          cachedAt: cachedEntry.timestamp,
        });
        discoverLoadedFiltersRef.current.add(requestKey);
        return cachedEntry.videos;
      }

      if (cooldownEntry) {
        console.error(
          "[ListeningTab:YouTube] Skipping discover fetch because a quotaExceeded cooldown is active.",
          cooldownEntry,
        );
        return [];
      }

      if (discoverInFlightFiltersRef.current.has(requestKey)) {
        logYouTubeDebug("Skipping duplicate discover fetch because one is already in flight.", {
          discoverFilter: filter,
        });
        return [];
      }

      if (discoverLoadedFiltersRef.current.has(requestKey)) {
        logYouTubeDebug(
          "Skipping discover network fetch because this filter has already been loaded in the current session.",
          { discoverFilter: filter },
        );
        return [];
      }

      if (!youtubeApiKey && !accessToken) {
        console.error(
          "[ListeningTab:YouTube] Discover fetch cannot start because both NEXT_PUBLIC_YOUTUBE_API_KEY and youtubeAccessToken are missing.",
        );
        return [];
      }

      if (!youtubeApiKey) {
        console.error(
          "[ListeningTab:YouTube] NEXT_PUBLIC_YOUTUBE_API_KEY is missing. Discover will fall back to the OAuth access token.",
        );
      }

      discoverInFlightFiltersRef.current.add(requestKey);

      try {
        const authModes = youtubeApiKey
          ? ["apiKey", ...(accessToken ? ["oauth"] : [])]
          : accessToken
            ? ["oauth"]
            : [];

        for (const authMode of authModes) {
          const searchParams = new URLSearchParams({
            part: "snippet",
            maxResults: "12",
            type: "video",
            relevanceLanguage: "ja",
            regionCode: "JP",
            videoEmbeddable: "true",
            videoSyndicated: "true",
            q: discoverQuery,
          });

          if (authMode === "apiKey") {
            searchParams.set("key", youtubeApiKey);
          }

          logYouTubeDebug("Starting discover search request.", {
            discoverFilter: filter,
            authMode,
            params: searchParams.toString(),
          });

          const searchResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`,
            authMode === "apiKey"
              ? undefined
              : {
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                  },
                },
          );

          if (!searchResponse.ok) {
            const errorInfo = await readYouTubeErrorResponse(searchResponse, "Discover search");
            console.error("[ListeningTab:YouTube] Discover search request failed.", {
              discoverFilter: filter,
              authMode,
              errorInfo,
            });

            if (isQuotaExceededError(errorInfo)) {
              console.error(
                "[ListeningTab:YouTube] Discover search hit quotaExceeded. Applying cooldown and skipping further discover requests in this session.",
              );
              persistDiscoverQuotaCooldown(errorInfo);
              return [];
            }

            continue;
          }

          const searchData = await searchResponse.json();
          logYouTubeDebug("Discover raw YouTube search response.", {
            discoverFilter: filter,
            authMode,
            response: searchData,
          });

          const discoverResults =
            searchData.items?.filter((item) => item?.id?.videoId && item?.snippet) || [];

          logYouTubeDebug("Discover search results filtered to valid video rows.", {
            discoverFilter: filter,
            authMode,
            resultCount: discoverResults.length,
          });

          if (!discoverResults.length) {
            persistDiscoverCache(filter, []);
            discoverLoadedFiltersRef.current.add(requestKey);
            return [];
          }

          const discoverVideoIds = discoverResults.map((item) => item.id.videoId).filter(Boolean);
          const discoverDetailsMap = new Map();

          for (const videoIdChunk of chunkItems(discoverVideoIds, 50)) {
            const detailsParams = new URLSearchParams({
              part: "contentDetails,snippet",
              id: videoIdChunk.join(","),
              maxResults: String(videoIdChunk.length),
            });

            if (authMode === "apiKey") {
              detailsParams.set("key", youtubeApiKey);
            }

            const detailsResponse = await fetch(
              `https://www.googleapis.com/youtube/v3/videos?${detailsParams.toString()}`,
              authMode === "apiKey"
                ? undefined
                : {
                    headers: {
                      Authorization: `Bearer ${accessToken}`,
                    },
                  },
            );

            if (!detailsResponse.ok) {
              const errorInfo = await readYouTubeErrorResponse(
                detailsResponse,
                "Discover videos.list",
              );
              console.error("[ListeningTab:YouTube] Discover videos.list request failed.", {
                discoverFilter: filter,
                authMode,
                errorInfo,
              });

              if (isQuotaExceededError(errorInfo)) {
                console.error(
                  "[ListeningTab:YouTube] Discover videos.list hit quotaExceeded. Applying cooldown and skipping further discover requests in this session.",
                );
                persistDiscoverQuotaCooldown(errorInfo);
                return [];
              }

              throw new Error(`Discover videos.list failed: ${errorInfo.status}`);
            }

            const detailsData = await detailsResponse.json();
            logYouTubeDebug("Discover raw YouTube videos.list response.", {
              discoverFilter: filter,
              authMode,
              response: detailsData,
            });

            for (const item of detailsData.items || []) {
              const durationSeconds = parseDurationToSeconds(item?.contentDetails?.duration);
              discoverDetailsMap.set(item.id, {
                durationSeconds,
                durationLabel: formatDurationLabel(durationSeconds),
                snippet: item?.snippet || null,
              });
            }
          }

          const nextDiscoverVideos = discoverResults
            .map((item) => {
              const videoId = item.id.videoId;
              const detailEntry = discoverDetailsMap.get(videoId);
              const detailSnippet = detailEntry?.snippet;

              return {
                id: videoId,
                channelId: detailSnippet?.channelId || item.snippet.channelId || "",
                channelThumbnail: "",
                title: detailSnippet?.title || item.snippet.title || "Untitled video",
                channel:
                  detailSnippet?.channelTitle ||
                  item.snippet.channelTitle ||
                  "YouTube",
                thumbnail:
                  detailSnippet?.thumbnails?.medium?.url ||
                  detailSnippet?.thumbnails?.default?.url ||
                  item.snippet.thumbnails?.medium?.url ||
                  item.snippet.thumbnails?.default?.url ||
                  "",
                duration: detailEntry?.durationLabel || "Discover",
                durationSeconds: detailEntry?.durationSeconds || 0,
              };
            })
            .filter((video) => video.durationSeconds >= MINIMUM_VIDEO_LENGTH_SECONDS);

          logYouTubeDebug("Discover results after short-video filtering.", {
            discoverFilter: filter,
            authMode,
            keptVideos: nextDiscoverVideos.length,
            sourceResults: discoverResults.length,
          });

          persistDiscoverCache(filter, nextDiscoverVideos);
          discoverLoadedFiltersRef.current.add(requestKey);
          return nextDiscoverVideos;
        }

        return [];
      } catch (error) {
        console.error("[ListeningTab:YouTube] Discover fetch failed unexpectedly.", {
          discoverFilter: filter,
          error,
        });
        throw error;
      } finally {
        discoverInFlightFiltersRef.current.delete(requestKey);
      }
    },
    [
      MINIMUM_VIDEO_LENGTH_SECONDS,
      chunkItems,
      formatDurationLabel,
      isQuotaExceededError,
      logYouTubeDebug,
      maskSecret,
      parseDurationToSeconds,
      persistDiscoverCache,
      persistDiscoverQuotaCooldown,
      readDiscoverQuotaCooldown,
      readStoredDiscoverCache,
      readYouTubeErrorResponse,
      youtubeApiKey,
    ],
  );

  const getPreferredSelectedVideoId = useCallback(
    (videos, fallbackReason) => {
      const storedWatchState = readStoredWatchState();
      const restoredVideo = videos.find((video) => video.id === storedWatchState?.selectedVideoId);

      if (restoredVideo?.id) {
        logYouTubeDebug("Using stored watch state to restore selected video.", {
          selectedVideoId: restoredVideo.id,
          fallbackReason,
        });
        return restoredVideo.id;
      }

      if (videos[0]?.id) {
        logYouTubeDebug("Using the first available fetched video as the selected video.", {
          selectedVideoId: videos[0].id,
          fallbackReason,
        });
        return videos[0].id;
      }

      console.warn("[ListeningTab:YouTube] No usable fetched videos were available. Falling back to DEFAULT_VIDEO_ID.", {
        fallbackReason,
        defaultVideoId: DEFAULT_VIDEO_ID,
      });
      return DEFAULT_VIDEO_ID;
    },
    [DEFAULT_VIDEO_ID, logYouTubeDebug, readStoredWatchState],
  );

  const initializeYoutubeData = useCallback(
    async (accessToken) => {
      logYouTubeDebug("Initializing YouTube data.", {
        youtubeAccessToken: maskSecret(accessToken),
      });

      try {
        const subscriptionResult = await fetchSubscribedChannels(accessToken);
        const cachedDiscoverVideos = readStoredDiscoverCache(discoverFilter)?.videos || [];
        logYouTubeDebug("Skipping automatic discover network fetch during initialization.", {
          discoverFilter,
          cachedDiscoverVideos: cachedDiscoverVideos.length,
        });

        if (!subscriptionResult?.ok && subscriptionResult?.reason === "quotaExceeded") {
          logYouTubeDebug(
            "Stopping YouTube account-data initialization cleanly because the API quota is exhausted.",
            {
              discoverFilter,
              cachedDiscoverVideos: cachedDiscoverVideos.length,
              errorInfo: subscriptionResult?.errorInfo || null,
            },
          );
          setYoutubeConnected(false);
          setDiscoverLoading(false);
          setSubscribedChannels(normalizeSeededChannels());
          setAccountVideos([]);
          setDiscoverVideos(cachedDiscoverVideos);
          setSelectedVideoId(DEFAULT_VIDEO_ID);
          return false;
        }

        const fetchedChannels = subscriptionResult?.fetchedChannels || [];
        const queueVideos = await fetchAccountQueueVideos(
          accessToken,
          fetchedChannels,
          subscriptionResult?.channelDetailsMap || new Map(),
        );

        setSubscribedChannels(fetchedChannels.length ? fetchedChannels : normalizeSeededChannels());
        setAccountVideos(queueVideos);
        setDiscoverVideos(cachedDiscoverVideos);

        const nextSelectedVideoId = getPreferredSelectedVideoId(
          queueVideos,
          "youtube initialization",
        );

        setSelectedVideoId(nextSelectedVideoId);

        const hasUsableData =
          fetchedChannels.length > 0 || queueVideos.length > 0 || cachedDiscoverVideos.length > 0;

        if (!hasUsableData) {
          console.warn(
            "[ListeningTab:YouTube] Initialization completed without usable YouTube data. Keeping the feature disconnected and falling back to DEFAULT_VIDEO_ID.",
          );
          setYoutubeAccessToken("");
          setYoutubeConnected(false);
          setSelectedVideoId(DEFAULT_VIDEO_ID);
          return false;
        }

        if (nextSelectedVideoId === DEFAULT_VIDEO_ID) {
          console.warn(
            "[ListeningTab:YouTube] Initialization finished with DEFAULT_VIDEO_ID because no real account queue video could be selected.",
          );
        }

        setYoutubeConnected(true);
        logYouTubeDebug("YouTube initialization succeeded.", {
          subscribedChannels: fetchedChannels.length,
          queueVideos: queueVideos.length,
          discoverVideos: cachedDiscoverVideos.length,
          selectedVideoId: nextSelectedVideoId,
        });
        return true;
      } catch (error) {
        console.error("Failed to initialize YouTube data", error);
        setYoutubeConnected(false);
        setDiscoverLoading(false);
        setSubscribedChannels(normalizeSeededChannels());
        setAccountVideos([]);
        setDiscoverVideos([]);
        setSelectedVideoId(DEFAULT_VIDEO_ID);
        setYoutubeAccessToken("");
        return false;
      }
    },
    [
      DEFAULT_VIDEO_ID,
      discoverFilter,
      fetchAccountQueueVideos,
      fetchSubscribedChannels,
      getPreferredSelectedVideoId,
      logYouTubeDebug,
      maskSecret,
      normalizeSeededChannels,
      readStoredDiscoverCache,
    ],
  );

  const enabledChannels = useMemo(
    () => subscribedChannels.filter((channel) => channel.enabled !== false),
    [subscribedChannels],
  );
  const enabledChannelNames = useMemo(
    () => new Set(enabledChannels.map((channel) => channel.name)),
    [enabledChannels],
  );
  const enabledChannelIds = useMemo(
    () => new Set(enabledChannels.map((channel) => channel.channelId || channel.id)),
    [enabledChannels],
  );

  const approvedFeed = useMemo(
    () => videoFeed.filter((video) => enabledChannelNames.has(video.channel)),
    [videoFeed, enabledChannelNames],
  );
  const filteredAccountVideos = useMemo(() => {
    if (!accountVideos.length) return accountVideos;
    if (!subscribedChannels.length) return accountVideos;

    return accountVideos.filter((video) => enabledChannelIds.has(video.channelId));
  }, [accountVideos, enabledChannelIds, subscribedChannels.length]);
  const activeFeed = useMemo(() => {
    if (youtubeConnected && accountVideos.length) {
      return filteredAccountVideos;
    }

    return approvedFeed;
  }, [youtubeConnected, accountVideos.length, filteredAccountVideos, approvedFeed]);
  const isDiscoverVideoSelected = useMemo(
    () => discoverVideos.some((video) => video.id === selectedVideoId),
    [discoverVideos, selectedVideoId],
  );
  const playbackList = useMemo(
    () => (isDiscoverVideoSelected ? discoverVideos : activeFeed),
    [activeFeed, discoverVideos, isDiscoverVideoSelected],
  );

  const selectedVideo = useMemo(
    () =>
      discoverVideos.find((video) => video.id === selectedVideoId) ||
      activeFeed.find((video) => video.id === selectedVideoId) ||
      playbackList.find((video) => video.id === selectedVideoId) ||
      playbackList[0],
    [activeFeed, discoverVideos, playbackList, selectedVideoId],
  );
  const selectedDiscoverVideo = useMemo(
    () => discoverVideos.find((video) => video.id === selectedVideoId) || null,
    [discoverVideos, selectedVideoId],
  );
  const selectedChannelAvatar = useMemo(() => {
    if (!selectedVideo) return "";
    if (selectedVideo.channelThumbnail) return selectedVideo.channelThumbnail;

    if (selectedVideo.channelId) {
      const matchedChannel = subscribedChannels.find(
        (channel) => (channel.channelId || channel.id) === selectedVideo.channelId,
      );
      if (matchedChannel?.thumbnail) return matchedChannel.thumbnail;
    }

    const matchedChannel = subscribedChannels.find((channel) => channel.name === selectedVideo.channel);
    return matchedChannel?.thumbnail || "";
  }, [selectedVideo, subscribedChannels]);
  const queueTotal = playbackList.length;
  const queueIndex = Math.max(0, playbackList.findIndex((item) => item.id === selectedVideo?.id));

  const handleListeningHoursUpdate = useCallback(
    (nextValueOrUpdater, metadata = {}) => {
      const resolvedValue =
        typeof nextValueOrUpdater === "function"
          ? nextValueOrUpdater(listeningHours)
          : nextValueOrUpdater;
      const nextHours = Math.max(0, Number(resolvedValue) || 0);
      const deltaHours = nextHours - listeningHours;

      if (!deltaHours) return;

      adjustListeningHours(deltaHours, metadata);
    },
    [adjustListeningHours, listeningHours],
  );

  useEffect(() => {
    logYouTubeDebug("selectedVideoId updated.", { selectedVideoId });
  }, [logYouTubeDebug, selectedVideoId]);

  const getPlayerCurrentTime = useCallback(() => {
    const player = playerRef.current;
    if (!player || !playerReadyRef.current || typeof player.getCurrentTime !== "function") {
      return 0;
    }

    return player.getCurrentTime() || 0;
  }, []);

  const isPlayerCurrentlyPlaying = useCallback(() => {
    const player = playerRef.current;
    const YTRef = window.YT?.PlayerState;

    if (
      !player ||
      !playerReadyRef.current ||
      !YTRef ||
      typeof player.getPlayerState !== "function"
    ) {
      return false;
    }

    return player.getPlayerState() === YTRef.PLAYING;
  }, []);

  const capturePlaybackSnapshot = useCallback(
    ({ videoId = safeVideoId, currentTime, shouldPlay } = {}) => ({
      videoId: videoId || DEFAULT_VIDEO_ID,
      currentTime: currentTime ?? getPlayerCurrentTime(),
      shouldPlay: shouldPlay ?? isPlayerCurrentlyPlaying(),
    }),
    [DEFAULT_VIDEO_ID, getPlayerCurrentTime, isPlayerCurrentlyPlaying, safeVideoId],
  );

  const applyPlaybackSnapshot = useCallback(
    (snapshot) => {
      const player = playerRef.current;
      if (!player || !snapshot?.videoId) return;

      const payload = {
        videoId: snapshot.videoId,
        startSeconds: Math.max(0, snapshot.currentTime || 0),
      };

      persistWatchState(snapshot.videoId, payload.startSeconds);

      if (snapshot.shouldPlay && typeof player.loadVideoById === "function") {
        player.loadVideoById(payload);
        return;
      }

      if (typeof player.cueVideoById === "function") {
        player.cueVideoById(payload);
        return;
      }

      if (typeof player.loadVideoById === "function") {
        player.loadVideoById(payload);
        queueMicrotask(() => {
          player.pauseVideo?.();
        });
      }
    },
    [persistWatchState],
  );

  const bankSession = useCallback(() => {
    if (!sessionRef.current) return;

    const gained = (Date.now() - sessionRef.current) / 3600000;
    if (gained > 0) {
      adjustListeningHours(gained, {
        kind: "session",
        source: "youtube",
        videoId: safeVideoId,
        channelId: selectedVideo?.channelId,
      });
    }

    sessionRef.current = 0;
  }, [adjustListeningHours, safeVideoId, selectedVideo?.channelId]);

  const persistCurrentPlayerState = useCallback(() => {
    const snapshot = capturePlaybackSnapshot();
    persistWatchState(snapshot.videoId, snapshot.currentTime);
    return snapshot;
  }, [capturePlaybackSnapshot, persistWatchState]);

  const togglePlayerPlayback = useCallback(() => {
    const player = playerRef.current;
    if (!player || !playerReadyRef.current) return;

    if (isPlayerCurrentlyPlaying()) {
      player.pauseVideo?.();
      return;
    }

    player.playVideo?.();
  }, [isPlayerCurrentlyPlaying]);

  const selectVideo = useCallback(
    (videoId) => {
      pendingSelectionPlaybackRef.current = {
        shouldPlay: isPlayerCurrentlyPlaying(),
      };
      logYouTubeDebug("Selecting queue video.", { videoId });
      setSelectedVideoId(videoId);
    },
    [isPlayerCurrentlyPlaying, logYouTubeDebug],
  );
  const selectDiscoverVideo = useCallback((videoId) => {
    pendingSelectionPlaybackRef.current = {
      shouldPlay: false,
    };
    logYouTubeDebug("Selecting discover video.", { videoId });
    setSelectedVideoId(videoId);
  }, [logYouTubeDebug]);
  const openSelectedDiscoverChannel = useCallback(() => {
    if (typeof window === "undefined" || !selectedDiscoverVideo?.channelId) return;

    window.open(
      `https://www.youtube.com/channel/${selectedDiscoverVideo.channelId}`,
      "_blank",
      "noopener,noreferrer",
    );
  }, [selectedDiscoverVideo]);

  const toggleChannelEnabled = useCallback(
    (channelId) => {
      setSubscribedChannels((currentChannels) => {
        const nextChannels = currentChannels.map((channel) => {
          const currentChannelId = channel.channelId || channel.id;
          if (currentChannelId !== channelId) return channel;

          return {
            ...channel,
            enabled: !(channel.enabled !== false),
          };
        });

        persistChannelPreferences(nextChannels);
        return nextChannels;
      });
    },
    [persistChannelPreferences],
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!focusMode) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [focusMode]);

  useEffect(() => {
    const storedWatchState = readStoredWatchState();
    if (storedWatchState?.selectedVideoId) {
      setSelectedVideoId(storedWatchState.selectedVideoId);
    }
  }, [readStoredWatchState]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const isTypingTarget = (target) => {
      if (!(target instanceof HTMLElement)) return false;
      const tagName = target.tagName;

      return (
        target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(tagName)
      );
    };

    const handleKeyDown = (event) => {
      if (isTypingTarget(event.target)) return;

      if (event.code === "Space" && !event.repeat) {
        event.preventDefault();
        togglePlayerPlayback();
      }

      if (event.key === "Escape" && focusMode) {
        event.preventDefault();
        setFocusMode(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusMode, togglePlayerPlayback]);

  useEffect(() => {
    if (googleClientId) return;

    console.error(
      "Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID. Set it in both local env and Vercel project env vars before using YouTube OAuth.",
    );
  }, [googleClientId]);

  const loadGoogleIdentityScript = useCallback(() => {
    if (typeof window === "undefined") {
      return Promise.reject(new Error("Window is not available"));
    }

    if (window.google?.accounts?.oauth2) {
      return Promise.resolve();
    }

    const existingScript = document.querySelector(
      "script[src='https://accounts.google.com/gsi/client']",
    );

    if (existingScript) {
      return new Promise((resolve, reject) => {
        const onLoad = () => {
          existingScript.removeEventListener("load", onLoad);
          existingScript.removeEventListener("error", onError);
          resolve();
        };
        const onError = () => {
          existingScript.removeEventListener("load", onLoad);
          existingScript.removeEventListener("error", onError);
          reject(new Error("Failed to load Google Identity Services"));
        };

        existingScript.addEventListener("load", onLoad);
        existingScript.addEventListener("error", onError);
      });
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Google Identity Services"));
      document.body.appendChild(script);
    });
  }, []);

  const getGoogleTokenClient = useCallback(() => {
    if (googleTokenClientRef.current) return googleTokenClientRef.current;
    if (typeof window === "undefined" || !window.google?.accounts?.oauth2?.initTokenClient) {
      return null;
    }
    if (!googleClientId) {
      console.error(
        `Google OAuth is unavailable because NEXT_PUBLIC_GOOGLE_CLIENT_ID is missing. Current origin: ${browserOrigin || "unknown"}.`,
      );
      return null;
    }

    googleTokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      // Google Identity Services validates the current browser origin for this popup flow.
      // Google Cloud Authorized JavaScript origins must include:
      // - http://localhost:3000
      // - https://japanese-dashboard.vercel.app
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      scope: "https://www.googleapis.com/auth/youtube.readonly",
      error_callback: (error) => {
        console.error("Google OAuth popup failed", error);
      },
      callback: (response) => {
        logYouTubeDebug("Google OAuth callback received.", {
          hasAccessToken: Boolean(response?.access_token),
          grantedScopes: response?.scope || "",
          expiresIn: response?.expires_in,
        });

        if (response?.access_token) {
          logYouTubeDebug("Google OAuth callback succeeded. Setting youtubeAccessToken.", {
            youtubeAccessToken: maskSecret(response.access_token),
          });
          logYouTubeDebug("Starting YouTube initialization immediately after token receipt.", {
            hasAccessToken: true,
            grantedScopes: response?.scope || "",
            expiresIn: response?.expires_in,
          });
          setYoutubeAccessToken(response.access_token);
          void initializeYoutubeData(response.access_token);
        } else {
          console.error("Google OAuth did not return an access token", response);
        }
      },
    });

    return googleTokenClientRef.current;
  }, [browserOrigin, googleClientId, initializeYoutubeData, logYouTubeDebug, maskSecret]);

  const connectYoutube = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!googleClientId) {
      console.error(
        `Cannot start Google OAuth because NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured. Current origin: ${browserOrigin || "unknown"}.`,
      );
      return;
    }
    if (!browserOrigin) {
      console.error("Cannot start Google OAuth because window.location.origin is unavailable.");
      return;
    }

    try {
      await loadGoogleIdentityScript();
      const client = getGoogleTokenClient();
      if (!client) {
        console.error("Google Identity Services token client is unavailable");
        return;
      }
      logYouTubeDebug("Requesting Google OAuth access token.", {
        origin: browserOrigin,
        googleClientId: maskSecret(googleClientId),
      });
      client.requestAccessToken({ prompt: "consent" });
    } catch (error) {
      console.error("Unable to connect YouTube via Google OAuth", error);
    }
  }, [browserOrigin, getGoogleTokenClient, googleClientId, loadGoogleIdentityScript, logYouTubeDebug, maskSecret]);

  const disconnectYoutube = useCallback(() => {
    if (typeof window !== "undefined") {
      if (youtubeAccessToken) {
        window.google?.accounts?.oauth2?.revoke?.(youtubeAccessToken, () => {});
      }
    }

    setYoutubeAccessToken("");
    clearYoutubeDataState();
    googleTokenClientRef.current = null;
  }, [clearYoutubeDataState, youtubeAccessToken]);

  useEffect(() => {
    const discoverTabOpen = workspaceTab === "discover";
    if (!discoverTabOpen) return;
    if (!youtubeConnected || !youtubeAccessToken) return;

    let cancelled = false;
    const cachedDiscoverVideos = readStoredDiscoverCache(discoverFilter)?.videos || [];

    const refreshDiscoverVideos = async () => {
      logYouTubeDebug("Discover effect triggered.", {
        workspaceTab,
        discoverFilter,
        youtubeConnected,
        hasCachedDiscoverVideos: cachedDiscoverVideos.length > 0,
        cooldownActive: Boolean(readDiscoverQuotaCooldown()),
      });

      if (cachedDiscoverVideos.length) {
        setDiscoverVideos(cachedDiscoverVideos);
      }

      setDiscoverLoading(true);

      try {
        const nextDiscoverVideos = await fetchDiscoverVideosForToken(
          youtubeAccessToken,
          discoverFilter,
        );

        if (!cancelled) {
          logYouTubeDebug("Updating discover video state from filter change.", {
            discoverFilter,
            discoverVideos: nextDiscoverVideos.length,
          });
          if (nextDiscoverVideos.length || !cachedDiscoverVideos.length) {
            setDiscoverVideos(nextDiscoverVideos);
          }
        }
      } catch (error) {
        console.error("Unable to fetch discover videos", error);
        if (!cancelled) {
          if (!cachedDiscoverVideos.length) {
            setDiscoverVideos([]);
          }
        }
      } finally {
        if (!cancelled) {
          setDiscoverLoading(false);
        }
      }
    };

    refreshDiscoverVideos();

    return () => {
      cancelled = true;
    };
  }, [
    discoverFilter,
    fetchDiscoverVideosForToken,
    logYouTubeDebug,
    readDiscoverQuotaCooldown,
    readStoredDiscoverCache,
    workspaceTab,
    youtubeAccessToken,
    youtubeConnected,
  ]);

  useEffect(() => {
    if (isDiscoverVideoSelected) return;
    if (!activeFeed.length) return;
    if (activeFeed.some((video) => video.id === selectedVideoId)) return;

    const storedWatchState = readStoredWatchState();
    const restoredVideo = activeFeed.find((video) => video.id === storedWatchState?.selectedVideoId);
    const nextSelectedVideoId = restoredVideo?.id || activeFeed[0].id || DEFAULT_VIDEO_ID;

    logYouTubeDebug("Updating selectedVideoId from active feed fallback.", {
      nextSelectedVideoId,
      activeFeedSize: activeFeed.length,
      restoredFromWatchState: Boolean(restoredVideo?.id),
    });
    setSelectedVideoId(nextSelectedVideoId);
  }, [
    DEFAULT_VIDEO_ID,
    activeFeed,
    isDiscoverVideoSelected,
    logYouTubeDebug,
    readStoredWatchState,
    selectedVideoId,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handlePersist = () => {
      persistCurrentPlayerState();
    };

    window.addEventListener("beforeunload", handlePersist);

    return () => {
      handlePersist();
      window.removeEventListener("beforeunload", handlePersist);
    };
  }, [persistCurrentPlayerState]);

  useEffect(() => {
    const activeHost = focusMode ? focusPlayerHostRef.current : playerHostRef.current;

    if (playerRef.current && activeHost !== activePlayerHostRef.current) {
      pendingRestoreRef.current = persistCurrentPlayerState();
      playerRef.current.destroy?.();
      playerRef.current = null;
      initRef.current = false;
      playerReadyRef.current = false;
    }

    const syncVideoProgress = (videoId = safeVideoId) => {
      persistWatchState(videoId, getPlayerCurrentTime());
    };

    const goNextVideo = () => {
      if (!playbackList.length) return;

      const index = playbackList.findIndex((video) => video.id === selectedVideoId);
      const next = playbackList[(index + 1) % playbackList.length];

      if (next?.id) {
        pendingSelectionPlaybackRef.current = { shouldPlay: true };
        setSelectedVideoId(next.id);
      }
    };

    const onPlayerState = (event) => {
      const state = event?.data;
      const YTRef = window.YT?.PlayerState;

      if (!YTRef) return;

      if (state === YTRef.PLAYING) {
        setIsPlayerPlaying(true);
        setStopwatchRunning(true);
        if (!sessionRef.current) {
          sessionRef.current = Date.now();
        }
      }

      if (state === YTRef.PAUSED) {
        setIsPlayerPlaying(false);
        setStopwatchRunning(false);
        syncVideoProgress();
      }

      if (state === YTRef.CUED || state === YTRef.UNSTARTED) {
        setIsPlayerPlaying(false);
        syncVideoProgress();
      }

      if (state === YTRef.ENDED) {
        setIsPlayerPlaying(false);
        setStopwatchRunning(false);
        syncVideoProgress();
        bankSession();
        goNextVideo();
      }
    };

    const onPlayerReady = () => {
      playerReadyRef.current = true;

      const storedWatchState = readStoredWatchState();
      const nextSnapshot = pendingRestoreRef.current || {
        videoId: safeVideoId,
        currentTime:
          storedWatchState?.selectedVideoId === safeVideoId ? storedWatchState.currentTime || 0 : 0,
        shouldPlay: false,
      };

      pendingRestoreRef.current = null;
      applyPlaybackSnapshot(nextSnapshot);
    };

    const mountPlayer = () => {
      const host = focusMode ? focusPlayerHostRef.current : playerHostRef.current;
      if (initRef.current || !window.YT?.Player || !host) return;

      playerRef.current = new window.YT.Player(host, {
        videoId: safeVideoId,
        playerVars: {
          controls: 1,
          rel: 0,
          playsinline: 1,
        },
        events: {
          onReady: onPlayerReady,
          onStateChange: onPlayerState,
        },
      });

      initRef.current = true;
      activePlayerHostRef.current = host;
    };

    const mountWhenReady = () => {
      const host = focusMode ? focusPlayerHostRef.current : playerHostRef.current;
      if (initRef.current) return;
      if (!window.YT?.Player || !host) {
        requestAnimationFrame(mountWhenReady);
        return;
      }
      mountPlayer();
    };

    if (window.YT?.Player) {
      mountWhenReady();
      return undefined;
    }

    const existingScript = document.querySelector(
      "script[src='https://www.youtube.com/iframe_api']",
    );

    if (!existingScript) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
    }

    const priorReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof priorReady === "function") priorReady();
      mountWhenReady();
    };

    return () => {
      window.onYouTubeIframeAPIReady = priorReady;
    };
  }, [
    applyPlaybackSnapshot,
    bankSession,
    focusMode,
    getPlayerCurrentTime,
    playbackList,
    persistCurrentPlayerState,
    persistWatchState,
    readStoredWatchState,
    safeVideoId,
    selectedVideoId,
  ]);

  useEffect(() => {
    if (!safeVideoId) return;

    const storedWatchState = readStoredWatchState();
    const resumeAt =
      storedWatchState?.selectedVideoId === safeVideoId ? storedWatchState.currentTime || 0 : 0;

    persistWatchState(safeVideoId, resumeAt);

    const player = playerRef.current;
    if (!player || !playerReadyRef.current) return;

    const shouldPlay =
      pendingSelectionPlaybackRef.current?.shouldPlay ?? isPlayerCurrentlyPlaying();

    pendingSelectionPlaybackRef.current = null;

    applyPlaybackSnapshot({
      videoId: safeVideoId,
      currentTime: resumeAt,
      shouldPlay,
    });
  }, [
    applyPlaybackSnapshot,
    isPlayerCurrentlyPlaying,
    persistWatchState,
    readStoredWatchState,
    safeVideoId,
  ]);

  useEffect(() => {
    if (!stopwatchRunning) return;

    const timer = setInterval(() => {
      setStopwatchSeconds((seconds) => roundToTenth(seconds + 0.1));
    }, 100);

    return () => clearInterval(timer);
  }, [stopwatchRunning, roundToTenth]);

  useEffect(() => {
    if (clockMode !== "timer" || !timerRunning) return;

    const timer = setInterval(() => {
      let shouldBankTimerSession = false;

      setTimerSeconds((seconds) => {
        if (seconds <= 0.1) {
          shouldBankTimerSession = true;
          setTimerRunning(false);
          return 0;
        }
        return roundToTenth(seconds - 0.1);
      });

      if (shouldBankTimerSession) {
        adjustListeningHours(timerDurationSeconds / 3600, {
          kind: "session",
          source: "timer",
        });
      }
    }, 100);

    return () => clearInterval(timer);
  }, [adjustListeningHours, clockMode, roundToTenth, timerDurationSeconds, timerRunning]);

  const bankStopwatch = () => {
    if (!stopwatchSeconds) return;
    const bankedHours = stopwatchSeconds / 3600;
    adjustListeningHours(bankedHours, {
      kind: "session",
      source: "timer",
    });
    setStopwatchSeconds(0);
  };

  const toggleTimerStart = () => {
    if (clockMode === "stopwatch") {
      setStopwatchRunning((running) => !running);
    } else {
      setTimerRunning((running) => !running);
    }
  };

  const skipCurrentVideo = () => {
    if (!playbackList.length) return;

    bankSession();

    const index = playbackList.findIndex((video) => video.id === selectedVideoId);
    const next = playbackList[(index + 1) % playbackList.length];

    if (next?.id) {
      pendingSelectionPlaybackRef.current = {
        shouldPlay: isPlayerCurrentlyPlaying(),
      };
      setSelectedVideoId(next.id);
    }
  };

  const totalBlocks = Math.max(12, Math.ceil(Math.max(listeningGoal, listeningHours) / 10));
  const listeningProgress = Math.min(100, (listeningHours / Math.max(1, listeningGoal)) * 100);

  return (
    <div
      style={{
        ...styles.listeningMainGrid,
        gridTemplateColumns: isMobile ? "1fr" : "1.6fr 1fr",
      }}
    >
      <ListeningWorkspace
        styles={styles}
        isCompact={isCompact}
        focusMode={focusMode}
        setFocusMode={setFocusMode}
        isMounted={isMounted}
        youtubeConnected={youtubeConnected}
        subscribedChannels={subscribedChannels}
        approvedFeed={activeFeed}
        discoverVideos={discoverVideos}
        discoverFilter={discoverFilter}
        setDiscoverFilter={setDiscoverFilter}
        discoverLoading={discoverLoading}
        selectedVideo={selectedVideo}
        selectedChannelAvatar={selectedChannelAvatar}
        showDiscoverSubscribe={Boolean(selectedDiscoverVideo?.channelId)}
        queueTotal={queueTotal}
        queueIndex={queueIndex}
        skipCurrentVideo={skipCurrentVideo}
        workspaceTab={workspaceTab}
        setWorkspaceTab={setWorkspaceTab}
        playerHostRef={playerHostRef}
        focusPlayerHostRef={focusPlayerHostRef}
        onToggleYoutubeConnection={() => {
          if (youtubeConnected) {
            disconnectYoutube();
          } else {
            connectYoutube();
          }
        }}
        onTogglePlayback={togglePlayerPlayback}
        isPlayerPlaying={isPlayerPlaying}
        onSelectVideo={selectVideo}
        onSelectDiscoverVideo={selectDiscoverVideo}
        onOpenSelectedDiscoverChannel={openSelectedDiscoverChannel}
        onToggleChannelEnabled={toggleChannelEnabled}
      />

      <div style={styles.sideColumn}>
        <TimerStopwatch
          styles={styles}
          clockMode={clockMode}
          stopwatchSeconds={stopwatchSeconds}
          stopwatchRunning={stopwatchRunning}
          timerSeconds={timerSeconds}
          timerDurationSeconds={timerDurationSeconds}
          timerRunning={timerRunning}
          toggleTimerStart={toggleTimerStart}
          bankStopwatch={bankStopwatch}
          setClockMode={setClockMode}
          setStopwatchRunning={setStopwatchRunning}
          setStopwatchSeconds={setStopwatchSeconds}
          setTimerRunning={setTimerRunning}
          setTimerSeconds={setTimerSeconds}
          setTimerDurationSeconds={setTimerDurationSeconds}
          liveSessionDisplay={formatClock(
            Math.floor(clockMode === "timer" ? timerSeconds : stopwatchSeconds),
          )
            .split(":")
            .slice(1)
            .join(":")}
        />

        <ListeningVisualization
          styles={styles}
          listeningHours={listeningHours}
          setListeningHours={handleListeningHoursUpdate}
          listeningGoal={listeningGoal}
          setListeningGoal={setListeningGoal}
          showVisualization={showVisualization}
          vizMode={vizMode}
          setVizMode={setVizMode}
          settingsOpen={settingsOpen}
          setSettingsOpen={setSettingsOpen}
          totalBlocks={totalBlocks}
          listeningProgress={listeningProgress}
        />
      </div>
    </div>
  );
}

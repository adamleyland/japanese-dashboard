"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DEFAULT_DISCOVER_FILTER,
  DEFAULT_VIDEO_ID,
  DISCOVER_FILTERS,
  MINIMUM_VIDEO_LENGTH_SECONDS,
  SEEDED_VIDEOS,
  normalizeSeededChannels,
} from "@/lib/youtubeDefaults";

const YOUTUBE_SESSION_STORAGE_KEY = "jp_dashboard_youtube_session_v2";
const LEGACY_WATCH_STATE_STORAGE_KEY = "jp_dashboard_youtube_session";
const DAILY_QUEUE_STORAGE_KEY = "jp_daily_video_queue";
const DISCOVER_CACHE_STORAGE_KEY = "jp_youtube_discover_cache_v1";
const DISCOVER_QUOTA_COOLDOWN_STORAGE_KEY = "jp_youtube_discover_quota_cooldown_v1";
const DISCOVER_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DISCOVER_QUOTA_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const ACCOUNT_DATA_TTL_MS = 30 * 60 * 1000;
const TOKEN_EXPIRY_SKEW_MS = 60 * 1000;
const GOOGLE_GSI_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube.readonly";

let googleIdentityScriptPromise = null;
let googleTokenClient = null;
let googleTokenClientId = "";
let googleTokenResponseHandler = null;
let googleTokenErrorHandler = null;

const YoutubeSessionContext = createContext(null);

function createDefaultState() {
  return {
    hydrated: false,
    connectionStatus: "disconnected",
    wasConnected: false,
    accessToken: "",
    tokenMeta: null,
    accountProfile: null,
    subscribedChannels: normalizeSeededChannels(),
    accountVideos: [],
    discoverFilter: DEFAULT_DISCOVER_FILTER,
    discoverVideosByFilter: {},
    discoverLoading: false,
    selectedVideoId: DEFAULT_VIDEO_ID,
    playbackState: {
      selectedVideoId: DEFAULT_VIDEO_ID,
      currentTime: 0,
      updatedAt: 0,
    },
    workspaceTab: null,
    lastSyncedAt: 0,
    lastError: "",
  };
}

function readJsonStorage(storageKey) {
  if (typeof window === "undefined") return null;

  try {
    return JSON.parse(window.localStorage.getItem(storageKey) || "null");
  } catch (error) {
    console.error(`Failed to parse localStorage for ${storageKey}`, error);
    return null;
  }
}

function writeJsonStorage(storageKey, value) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(value));
}

function removeStorageKey(storageKey) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey);
}

function normalizePlaybackState(playbackState) {
  const selectedVideoId = playbackState?.selectedVideoId || DEFAULT_VIDEO_ID;

  return {
    selectedVideoId,
    currentTime: Math.max(0, Number(playbackState?.currentTime || 0)),
    updatedAt: Number(playbackState?.updatedAt || 0),
  };
}

function normalizeVideo(video) {
  if (!video?.id) return null;

  return {
    id: video.id,
    channelId: video.channelId || "",
    channelThumbnail: video.channelThumbnail || "",
    title: video.title || "Untitled video",
    channel: video.channel || "YouTube",
    thumbnail: video.thumbnail || "",
    duration: video.duration || "",
    durationSeconds: Math.max(0, Number(video.durationSeconds || 0)),
    level: video.level || "",
    published: video.published || "",
  };
}

function normalizeVideoList(videos) {
  if (!Array.isArray(videos)) return [];

  return videos.map(normalizeVideo).filter(Boolean);
}

function normalizePersistedChannels(channels) {
  if (!Array.isArray(channels) || !channels.length) {
    return normalizeSeededChannels();
  }

  return channels
    .map((channel) => {
      const channelId = channel?.channelId || channel?.id;
      if (!channelId) return null;

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

function readPersistedSessionSnapshot() {
  const snapshot = readJsonStorage(YOUTUBE_SESSION_STORAGE_KEY);
  if (snapshot?.version === 2) {
    return snapshot;
  }

  const legacyWatchState = readJsonStorage(LEGACY_WATCH_STATE_STORAGE_KEY);
  if (!legacyWatchState?.selectedVideoId) {
    return null;
  }

  return {
    version: 2,
    wasConnected: false,
    selectedVideoId: legacyWatchState.selectedVideoId,
    playbackState: legacyWatchState,
  };
}

function readStoredDailyQueue() {
  return readJsonStorage(DAILY_QUEUE_STORAGE_KEY);
}

function persistDailyQueue(videos) {
  writeJsonStorage(DAILY_QUEUE_STORAGE_KEY, {
    date: new Date().toISOString().slice(0, 10),
    videos,
  });
}

function readDiscoverCache() {
  const discoverCache = readJsonStorage(DISCOVER_CACHE_STORAGE_KEY);
  if (!discoverCache || typeof discoverCache !== "object") {
    return {};
  }

  const now = Date.now();
  const nextCache = {};

  Object.entries(discoverCache).forEach(([filter, entry]) => {
    if (!Array.isArray(entry?.videos) || !entry?.timestamp) {
      return;
    }

    if (now - Number(entry.timestamp) > DISCOVER_CACHE_TTL_MS) {
      return;
    }

    nextCache[filter] = normalizeVideoList(entry.videos);
  });

  return nextCache;
}

function persistDiscoverCache(filter, videos) {
  const currentCache = readJsonStorage(DISCOVER_CACHE_STORAGE_KEY);
  const nextCache =
    currentCache && typeof currentCache === "object" ? { ...currentCache } : {};

  nextCache[filter] = {
    timestamp: Date.now(),
    videos,
  };

  writeJsonStorage(DISCOVER_CACHE_STORAGE_KEY, nextCache);
}

function readDiscoverQuotaCooldown() {
  const cooldown = readJsonStorage(DISCOVER_QUOTA_COOLDOWN_STORAGE_KEY);
  const expiresAt = Number(cooldown?.expiresAt || 0);

  if (!expiresAt) {
    return null;
  }

  if (Date.now() >= expiresAt) {
    removeStorageKey(DISCOVER_QUOTA_COOLDOWN_STORAGE_KEY);
    return null;
  }

  return cooldown;
}

function persistDiscoverQuotaCooldown(errorInfo) {
  writeJsonStorage(DISCOVER_QUOTA_COOLDOWN_STORAGE_KEY, {
    timestamp: Date.now(),
    expiresAt: Date.now() + DISCOVER_QUOTA_COOLDOWN_MS,
    status: errorInfo?.status || 403,
    code: errorInfo?.code || 403,
    message: errorInfo?.message || "YouTube API quota exceeded",
    domain: errorInfo?.domain || "",
    reason: errorInfo?.reason || "",
  });
}

function clearPersistedYoutubeSession() {
  removeStorageKey(YOUTUBE_SESSION_STORAGE_KEY);
  removeStorageKey(LEGACY_WATCH_STATE_STORAGE_KEY);
  removeStorageKey(DAILY_QUEUE_STORAGE_KEY);
}

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
  const errorInfo = {
    status: response.status,
    code: parsedError.code ?? response.status,
    message: parsedError.message || response.statusText || bodyText,
    domain: parsedError.domain,
    reason: parsedError.reason,
    bodyText,
    parsedBody: parsedError.parsedBody,
    contextLabel,
  };

  return errorInfo;
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
  if (!duration || typeof duration !== "string") return 0;

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

function toTokenMeta(response) {
  const issuedAt = Date.now();
  const expiresInSeconds = Number(response?.expires_in || 0);
  const expiresAt = expiresInSeconds ? issuedAt + expiresInSeconds * 1000 : 0;

  return {
    issuedAt,
    expiresAt,
    expiresInSeconds,
    scope: response?.scope || YOUTUBE_SCOPE,
    tokenType: response?.token_type || "Bearer",
  };
}

function loadGoogleIdentityScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Window is not available"));
  }

  if (window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }

  if (googleIdentityScriptPromise) {
    return googleIdentityScriptPromise;
  }

  googleIdentityScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src='${GOOGLE_GSI_SCRIPT_SRC}']`);

    if (existingScript) {
      const onLoad = () => {
        existingScript.removeEventListener("load", onLoad);
        existingScript.removeEventListener("error", onError);
        resolve();
      };
      const onError = () => {
        existingScript.removeEventListener("load", onLoad);
        existingScript.removeEventListener("error", onError);
        googleIdentityScriptPromise = null;
        reject(new Error("Failed to load Google Identity Services"));
      };

      existingScript.addEventListener("load", onLoad);
      existingScript.addEventListener("error", onError);
      return;
    }

    const script = document.createElement("script");
    script.src = GOOGLE_GSI_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      googleIdentityScriptPromise = null;
      reject(new Error("Failed to load Google Identity Services"));
    };
    document.body.appendChild(script);
  });

  return googleIdentityScriptPromise;
}

function getGoogleTokenClient(clientId) {
  if (typeof window === "undefined" || !window.google?.accounts?.oauth2?.initTokenClient) {
    return null;
  }

  if (!googleTokenClient || googleTokenClientId !== clientId) {
    googleTokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: YOUTUBE_SCOPE,
      callback: (response) => {
        googleTokenResponseHandler?.(response);
      },
      error_callback: (error) => {
        googleTokenErrorHandler?.(error);
      },
    });
    googleTokenClientId = clientId;
  }

  return googleTokenClient;
}

export function YoutubeSessionProvider({ children }) {
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
  const youtubeApiKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY || "";
  const [state, setState] = useState(createDefaultState);
  const stateRef = useRef(state);
  const silentRestoreAttemptedRef = useRef(false);
  const tokenRequestPromiseRef = useRef(null);
  const initializationPromiseRef = useRef(null);
  const discoverInFlightFiltersRef = useRef(new Set());
  const discoverLoadedFiltersRef = useRef(new Set());

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const setSelectedVideoId = useCallback((videoId) => {
    const nextVideoId = videoId || DEFAULT_VIDEO_ID;

    setState((currentState) => {
      if (currentState.selectedVideoId === nextVideoId) {
        return currentState;
      }

      return {
        ...currentState,
        selectedVideoId: nextVideoId,
        playbackState: {
          ...currentState.playbackState,
          selectedVideoId: nextVideoId,
          currentTime:
            currentState.playbackState.selectedVideoId === nextVideoId
              ? currentState.playbackState.currentTime
              : 0,
        },
      };
    });
  }, []);

  const setPlaybackState = useCallback((payload) => {
    const nextVideoId = payload?.videoId || payload?.selectedVideoId || DEFAULT_VIDEO_ID;
    const nextCurrentTime = Math.max(0, Number(payload?.currentTime || 0));

    setState((currentState) => {
      const currentPlaybackState = currentState.playbackState;
      const sameSelectedVideo = currentState.selectedVideoId === nextVideoId;
      const samePlaybackVideo = currentPlaybackState.selectedVideoId === nextVideoId;
      const samePlaybackTime = Math.abs(currentPlaybackState.currentTime - nextCurrentTime) < 0.01;

      if (sameSelectedVideo && samePlaybackVideo && samePlaybackTime) {
        return currentState;
      }

      return {
        ...currentState,
        selectedVideoId: nextVideoId,
        playbackState: {
          selectedVideoId: nextVideoId,
          currentTime: nextCurrentTime,
          updatedAt: Date.now(),
        },
      };
    });
  }, []);

  const setWorkspaceTab = useCallback((nextTabOrUpdater) => {
    setState((currentState) => {
      const nextWorkspaceTab =
        typeof nextTabOrUpdater === "function"
          ? nextTabOrUpdater(currentState.workspaceTab)
          : nextTabOrUpdater;

      if (currentState.workspaceTab === nextWorkspaceTab) {
        return currentState;
      }

      return {
        ...currentState,
        workspaceTab: nextWorkspaceTab,
      };
    });
  }, []);

  const setDiscoverFilter = useCallback((nextFilter) => {
    setState((currentState) => {
      const resolvedFilter = nextFilter || DEFAULT_DISCOVER_FILTER;

      if (currentState.discoverFilter === resolvedFilter) {
        return currentState;
      }

      return {
        ...currentState,
        discoverFilter: resolvedFilter,
      };
    });
  }, []);

  const toggleChannelEnabled = useCallback((channelId) => {
    setState((currentState) => ({
      ...currentState,
      subscribedChannels: currentState.subscribedChannels.map((channel) => {
        const currentChannelId = channel.channelId || channel.id;
        if (currentChannelId !== channelId) {
          return channel;
        }

        return {
          ...channel,
          enabled: !(channel.enabled !== false),
        };
      }),
    }));
  }, []);

  const fetchVideoDetailsMap = useCallback(
    async (videoIds, options = {}) => {
      const uniqueVideoIds = [...new Set(videoIds.filter(Boolean))];
      const detailsMap = new Map();
      const useApiKey = Boolean(options.useApiKey && youtubeApiKey);
      const requestAccessToken = options.accessToken;

      if (!uniqueVideoIds.length) {
        return detailsMap;
      }

      if (!useApiKey && !requestAccessToken) {
        return detailsMap;
      }

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
          throw createRequestError(
            `Video details fetch failed: ${errorInfo.status}`,
            errorInfo.status,
            { errorInfo },
          );
        }

        const data = await response.json();

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
    [youtubeApiKey],
  );

  const requestAccessToken = useCallback(
    async ({ prompt }) => {
      if (!googleClientId) {
        throw new Error("Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID");
      }

      if (tokenRequestPromiseRef.current) {
        return tokenRequestPromiseRef.current;
      }

      tokenRequestPromiseRef.current = (async () => {
        await loadGoogleIdentityScript();
        const client = getGoogleTokenClient(googleClientId);

        if (!client) {
          throw new Error("Google Identity Services token client is unavailable");
        }

        return new Promise((resolve, reject) => {
          const cleanup = () => {
            googleTokenResponseHandler = null;
            googleTokenErrorHandler = null;
          };

          googleTokenResponseHandler = (response) => {
            cleanup();

            if (response?.error) {
              reject(
                createRequestError(
                  response.error_description || response.error,
                  401,
                  {
                    isOAuthError: true,
                    response,
                  },
                ),
              );
              return;
            }

            resolve(response);
          };

          googleTokenErrorHandler = (error) => {
            cleanup();
            reject(
              createRequestError(error?.message || "Google OAuth popup failed", 500, {
                isGooglePopupError: true,
                googleError: error,
              }),
            );
          };

          client.requestAccessToken({
            prompt,
            include_granted_scopes: true,
          });
        });
      })().finally(() => {
        tokenRequestPromiseRef.current = null;
      });

      return tokenRequestPromiseRef.current;
    },
    [googleClientId],
  );

  const markSessionDisconnected = useCallback(
    ({ clearPersistentConnection = false } = {}) => {
      setState((currentState) => ({
        ...currentState,
        connectionStatus: "disconnected",
        wasConnected: clearPersistentConnection ? false : currentState.wasConnected,
        accessToken: "",
        tokenMeta: null,
        accountProfile: clearPersistentConnection ? null : currentState.accountProfile,
        subscribedChannels: clearPersistentConnection
          ? normalizeSeededChannels()
          : currentState.subscribedChannels,
        accountVideos: clearPersistentConnection ? [] : currentState.accountVideos,
        lastError: clearPersistentConnection ? "reconnect-required" : currentState.lastError,
      }));
    },
    [],
  );

  const ensureFreshAccessToken = useCallback(
    async ({ interactive = false } = {}) => {
      const currentState = stateRef.current;
      const tokenMeta = currentState.tokenMeta;
      const hasFreshToken =
        currentState.accessToken &&
        tokenMeta?.expiresAt &&
        tokenMeta.expiresAt - Date.now() > TOKEN_EXPIRY_SKEW_MS;

      if (hasFreshToken) {
        return currentState.accessToken;
      }

      if (!interactive && !currentState.wasConnected) {
        return "";
      }

      const response = await requestAccessToken({
        prompt: interactive ? (currentState.wasConnected ? "" : "consent") : "none",
      });
      const tokenMetaFromResponse = toTokenMeta(response);

      setState((prevState) => ({
        ...prevState,
        accessToken: response.access_token,
        tokenMeta: tokenMetaFromResponse,
        connectionStatus: "connected",
        wasConnected: true,
        lastError: "",
      }));

      return response.access_token;
    },
    [requestAccessToken],
  );

  const verifyYoutubeAccountAccess = useCallback(async (accessToken) => {
    const response = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      const errorInfo = await readYouTubeErrorResponse(response, "YouTube account verification");
      if (isQuotaExceededError(errorInfo)) {
        return {
          ok: false,
          reason: "quotaExceeded",
          errorInfo,
          accountProfile: stateRef.current.accountProfile,
        };
      }

      throw createRequestError(
        `YouTube account verification failed: ${errorInfo.status}`,
        errorInfo.status,
        { errorInfo },
      );
    }

    const data = await response.json();

    return {
      ok: true,
      data,
      accountProfile: extractAccountProfile(data),
    };
  }, []);

  const fetchSubscribedChannels = useCallback(async (accessToken) => {
    const verificationResult = await verifyYoutubeAccountAccess(accessToken);

    if (!verificationResult?.ok) {
      return {
        ok: false,
        reason: verificationResult?.reason || "unknown",
        errorInfo: verificationResult?.errorInfo || null,
        accountProfile: verificationResult?.accountProfile || null,
        fetchedChannels: [],
        channelDetailsMap: new Map(),
      };
    }

    const currentChannelPreferences = buildChannelPreferences(stateRef.current.subscribedChannels);
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
      const channelsResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelIdChunk.join(",")}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!channelsResponse.ok) {
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
      currentChannelPreferences,
    );

    return {
      ok: true,
      accountProfile: verificationResult.accountProfile,
      fetchedChannels,
      channelDetailsMap,
    };
  }, [verifyYoutubeAccountAccess]);

  const fetchAccountQueueVideos = useCallback(
    async (accessToken, fetchedChannels, channelDetailsMap) => {
      const storedDailyQueue = readStoredDailyQueue();
      const todayKey = new Date().toISOString().slice(0, 10);

      if (
        storedDailyQueue?.date === todayKey &&
        Array.isArray(storedDailyQueue.videos) &&
        storedDailyQueue.videos.length &&
        storedDailyQueue.videos.every(
          (video) => Number(video?.durationSeconds || 0) >= MINIMUM_VIDEO_LENGTH_SECONDS,
        )
      ) {
        return normalizeVideoList(storedDailyQueue.videos);
      }

      const channelIds = fetchedChannels.map((channel) => channel.channelId).slice(0, 5);
      if (!channelIds.length) {
        return [];
      }

      const channelVideoGroups = await Promise.all(
        channelIds.map(async (channelId) => {
          try {
            const videosResponse = await fetch(
              `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&maxResults=5&order=date&type=video`,
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              },
            );

            if (!videosResponse.ok) {
              const errorInfo = await readYouTubeErrorResponse(videosResponse, "Channel video fetch");
              throw createRequestError(
                `Video fetch failed for ${channelId}: ${errorInfo.status}`,
                errorInfo.status,
                { errorInfo },
              );
            }

            const videosData = await videosResponse.json();
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
      persistDailyQueue(shuffledVideos);
      return shuffledVideos;
    },
    [fetchVideoDetailsMap],
  );

  const choosePreferredVideoId = useCallback((videos) => {
    const currentState = stateRef.current;
    const candidateIds = [
      currentState.selectedVideoId,
      currentState.playbackState.selectedVideoId,
    ].filter(Boolean);

    for (const candidateId of candidateIds) {
      const restoredVideo = videos.find((video) => video.id === candidateId);
      if (restoredVideo?.id) {
        return restoredVideo.id;
      }
    }

    return videos[0]?.id || DEFAULT_VIDEO_ID;
  }, []);

  const refreshYoutubeAccountData = useCallback(
    async (accessToken, options = {}) => {
      if (initializationPromiseRef.current) {
        return initializationPromiseRef.current;
      }

      initializationPromiseRef.current = (async () => {
        try {
          const subscriptionResult = await fetchSubscribedChannels(accessToken);

          if (!subscriptionResult?.ok && subscriptionResult?.reason === "quotaExceeded") {
            setState((currentState) => ({
              ...currentState,
              connectionStatus: "connected",
              wasConnected: true,
              accessToken,
              lastError: "quotaExceeded",
              accountProfile: subscriptionResult.accountProfile || currentState.accountProfile,
            }));
            return true;
          }

          const fetchedChannels = subscriptionResult?.fetchedChannels || [];
          const queueVideos = await fetchAccountQueueVideos(
            accessToken,
            fetchedChannels,
            subscriptionResult?.channelDetailsMap || new Map(),
          );

          setState((currentState) => {
            const nextSelectedVideoId =
              options.preserveSelectedVideo && currentState.selectedVideoId
                ? currentState.selectedVideoId
                : choosePreferredVideoId(queueVideos);

            return {
              ...currentState,
              connectionStatus: "connected",
              wasConnected: true,
              accessToken,
              accountProfile: subscriptionResult.accountProfile || currentState.accountProfile,
              subscribedChannels: fetchedChannels.length
                ? fetchedChannels
                : currentState.subscribedChannels,
              accountVideos: queueVideos,
              selectedVideoId: nextSelectedVideoId,
              playbackState: {
                ...currentState.playbackState,
                selectedVideoId: nextSelectedVideoId,
                currentTime:
                  currentState.playbackState.selectedVideoId === nextSelectedVideoId
                    ? currentState.playbackState.currentTime
                    : 0,
              },
              lastSyncedAt: Date.now(),
              lastError: "",
            };
          });

          return true;
        } catch (error) {
          const status = Number(error?.status || 0);
          const authInvalid = status === 401 || status === 403;

          if (authInvalid) {
            markSessionDisconnected({ clearPersistentConnection: true });
          } else {
            setState((currentState) => ({
              ...currentState,
              connectionStatus: currentState.wasConnected ? "connected" : "disconnected",
              lastError: error?.message || "youtube-refresh-failed",
            }));
          }

          return false;
        } finally {
          initializationPromiseRef.current = null;
        }
      })();

      return initializationPromiseRef.current;
    },
    [choosePreferredVideoId, fetchAccountQueueVideos, fetchSubscribedChannels, markSessionDisconnected],
  );

  const restoreYoutubeSession = useCallback(async () => {
    if (silentRestoreAttemptedRef.current) {
      return;
    }

    silentRestoreAttemptedRef.current = true;

    try {
      const accessToken = await ensureFreshAccessToken({ interactive: false });
      if (!accessToken) {
        markSessionDisconnected();
        return;
      }

      const currentState = stateRef.current;
      const hasFreshAccountData =
        currentState.lastSyncedAt &&
        Date.now() - currentState.lastSyncedAt < ACCOUNT_DATA_TTL_MS &&
        (currentState.accountProfile || currentState.accountVideos.length || currentState.subscribedChannels.length);

      if (!hasFreshAccountData) {
        await refreshYoutubeAccountData(accessToken, {
          preserveSelectedVideo: true,
        });
      }
    } catch (error) {
      if (error?.isOAuthError) {
        markSessionDisconnected({ clearPersistentConnection: true });
      } else {
        markSessionDisconnected();
      }
    }
  }, [ensureFreshAccessToken, markSessionDisconnected, refreshYoutubeAccountData]);

  const connectYoutube = useCallback(async () => {
    setState((currentState) => ({
      ...currentState,
      connectionStatus: "connecting",
      lastError: "",
    }));

    try {
      const accessToken = await ensureFreshAccessToken({ interactive: true });
      if (!accessToken) {
        setState((currentState) => ({
          ...currentState,
          connectionStatus: "disconnected",
        }));
        return;
      }

      await refreshYoutubeAccountData(accessToken, {
        preserveSelectedVideo: false,
      });
    } catch (error) {
      console.error("Unable to connect YouTube via Google OAuth", error);
      setState((currentState) => ({
        ...currentState,
        connectionStatus: "disconnected",
        lastError: error?.message || "youtube-connect-failed",
      }));
    }
  }, [ensureFreshAccessToken, refreshYoutubeAccountData]);

  const disconnectYoutube = useCallback(() => {
    const currentAccessToken = stateRef.current.accessToken;

    if (typeof window !== "undefined" && currentAccessToken) {
      window.google?.accounts?.oauth2?.revoke?.(currentAccessToken, () => {});
    }

    clearPersistedYoutubeSession();
    setState((currentState) => ({
      ...createDefaultState(),
      hydrated: currentState.hydrated,
    }));
    discoverInFlightFiltersRef.current.clear();
    discoverLoadedFiltersRef.current = new Set(Object.keys(readDiscoverCache()));
    silentRestoreAttemptedRef.current = false;
  }, []);

  const fetchDiscoverVideos = useCallback(
    async (accessToken, filter) => {
      const discoverQuery = DISCOVER_FILTERS[filter] || DISCOVER_FILTERS[DEFAULT_DISCOVER_FILTER];
      const cachedVideos = stateRef.current.discoverVideosByFilter[filter] || [];
      const cooldownEntry = readDiscoverQuotaCooldown();
      const requestKey = filter;

      if (cachedVideos.length) {
        discoverLoadedFiltersRef.current.add(requestKey);
        return cachedVideos;
      }

      if (cooldownEntry) {
        return [];
      }

      if (discoverInFlightFiltersRef.current.has(requestKey)) {
        return [];
      }

      if (discoverLoadedFiltersRef.current.has(requestKey)) {
        return [];
      }

      if (!youtubeApiKey && !accessToken) {
        return [];
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

            if (isQuotaExceededError(errorInfo)) {
              persistDiscoverQuotaCooldown(errorInfo);
              return [];
            }

            continue;
          }

          const searchData = await searchResponse.json();
          const discoverResults =
            searchData.items?.filter((item) => item?.id?.videoId && item?.snippet) || [];

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

              if (isQuotaExceededError(errorInfo)) {
                persistDiscoverQuotaCooldown(errorInfo);
                return [];
              }

              throw createRequestError(
                `Discover videos.list failed: ${errorInfo.status}`,
                errorInfo.status,
                { errorInfo },
              );
            }

            const detailsData = await detailsResponse.json();

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

          persistDiscoverCache(filter, nextDiscoverVideos);
          discoverLoadedFiltersRef.current.add(requestKey);
          return nextDiscoverVideos;
        }

        return [];
      } finally {
        discoverInFlightFiltersRef.current.delete(requestKey);
      }
    },
    [youtubeApiKey],
  );

  const ensureDiscoverVideos = useCallback(
    async (filter) => {
      const nextFilter = filter || stateRef.current.discoverFilter;

      setState((currentState) => ({
        ...currentState,
        discoverLoading: true,
      }));

      try {
        const accessToken = await ensureFreshAccessToken({ interactive: false });
        const nextDiscoverVideos = await fetchDiscoverVideos(accessToken, nextFilter);

        setState((currentState) => ({
          ...currentState,
          discoverVideosByFilter: {
            ...currentState.discoverVideosByFilter,
            [nextFilter]: nextDiscoverVideos,
          },
        }));
      } catch (error) {
        if (error?.isOAuthError) {
          markSessionDisconnected({ clearPersistentConnection: true });
        } else {
          console.error("Unable to fetch discover videos", error);
        }
      } finally {
        setState((currentState) => ({
          ...currentState,
          discoverLoading: false,
        }));
      }
    },
    [ensureFreshAccessToken, fetchDiscoverVideos, markSessionDisconnected],
  );

  useEffect(() => {
    if (googleClientId) {
      return;
    }

    console.error(
      "Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID. Set it in both local env and Vercel project env vars before using YouTube OAuth.",
    );
  }, [googleClientId]);

  useEffect(() => {
    const persistedSnapshot = readPersistedSessionSnapshot();
    const cachedDiscoverVideosByFilter = readDiscoverCache();

    discoverLoadedFiltersRef.current = new Set(Object.keys(cachedDiscoverVideosByFilter));

    setState((currentState) => {
      const playbackState = normalizePlaybackState(
        persistedSnapshot?.playbackState ||
          persistedSnapshot || {
            selectedVideoId: DEFAULT_VIDEO_ID,
            currentTime: 0,
          },
      );
      const selectedVideoId =
        persistedSnapshot?.selectedVideoId || playbackState.selectedVideoId || DEFAULT_VIDEO_ID;

      return {
        ...currentState,
        hydrated: true,
        connectionStatus: persistedSnapshot?.wasConnected ? "restoring" : "disconnected",
        wasConnected: Boolean(persistedSnapshot?.wasConnected),
        tokenMeta: persistedSnapshot?.tokenMeta || null,
        accountProfile: persistedSnapshot?.accountProfile || null,
        subscribedChannels: normalizePersistedChannels(persistedSnapshot?.subscribedChannels),
        accountVideos: normalizeVideoList(persistedSnapshot?.accountVideos),
        discoverFilter: persistedSnapshot?.discoverFilter || DEFAULT_DISCOVER_FILTER,
        discoverVideosByFilter: cachedDiscoverVideosByFilter,
        selectedVideoId,
        playbackState: {
          ...playbackState,
          selectedVideoId,
        },
        workspaceTab:
          typeof persistedSnapshot?.workspaceTab === "string"
            ? persistedSnapshot.workspaceTab
            : null,
        lastSyncedAt: Number(persistedSnapshot?.lastSyncedAt || 0),
      };
    });
  }, []);

  useEffect(() => {
    if (!state.hydrated || !state.wasConnected) {
      return;
    }

    void restoreYoutubeSession();
  }, [restoreYoutubeSession, state.hydrated, state.wasConnected]);

  useEffect(() => {
    if (!state.hydrated) {
      return;
    }

    writeJsonStorage(YOUTUBE_SESSION_STORAGE_KEY, {
      version: 2,
      wasConnected: state.wasConnected,
      tokenMeta: state.tokenMeta,
      accountProfile: state.accountProfile,
      subscribedChannels: state.subscribedChannels,
      accountVideos: state.accountVideos,
      discoverFilter: state.discoverFilter,
      selectedVideoId: state.selectedVideoId,
      playbackState: state.playbackState,
      workspaceTab: state.workspaceTab,
      lastSyncedAt: state.lastSyncedAt,
    });
  }, [
    state.accountProfile,
    state.accountVideos,
    state.discoverFilter,
    state.hydrated,
    state.lastSyncedAt,
    state.playbackState,
    state.selectedVideoId,
    state.subscribedChannels,
    state.tokenMeta,
    state.wasConnected,
    state.workspaceTab,
  ]);

  const discoverVideos = useMemo(
    () => state.discoverVideosByFilter[state.discoverFilter] || [],
    [state.discoverVideosByFilter, state.discoverFilter],
  );
  const enabledChannels = useMemo(
    () => state.subscribedChannels.filter((channel) => channel.enabled !== false),
    [state.subscribedChannels],
  );
  const enabledChannelNames = useMemo(
    () => new Set(enabledChannels.map((channel) => channel.name)),
    [enabledChannels],
  );
  const enabledChannelIds = useMemo(
    () => new Set(enabledChannels.map((channel) => channel.channelId || channel.id)),
    [enabledChannels],
  );

  const youtubeConnected =
    state.connectionStatus === "connected" || state.connectionStatus === "restoring";

  const approvedFeed = useMemo(() => {
    if (!youtubeConnected) {
      return SEEDED_VIDEOS;
    }

    return SEEDED_VIDEOS.filter((video) => enabledChannelNames.has(video.channel));
  }, [enabledChannelNames, youtubeConnected]);
  const filteredAccountVideos = useMemo(() => {
    if (!state.accountVideos.length || !state.subscribedChannels.length) {
      return state.accountVideos;
    }

    return state.accountVideos.filter((video) => enabledChannelIds.has(video.channelId));
  }, [enabledChannelIds, state.accountVideos, state.subscribedChannels.length]);
  const activeFeed = useMemo(() => {
    if (youtubeConnected && filteredAccountVideos.length) {
      return filteredAccountVideos;
    }

    return approvedFeed;
  }, [approvedFeed, filteredAccountVideos, youtubeConnected]);
  const isDiscoverVideoSelected = useMemo(
    () => discoverVideos.some((video) => video.id === state.selectedVideoId),
    [discoverVideos, state.selectedVideoId],
  );
  const playbackList = useMemo(
    () => (isDiscoverVideoSelected ? discoverVideos : activeFeed),
    [activeFeed, discoverVideos, isDiscoverVideoSelected],
  );

  const selectedVideo = useMemo(
    () =>
      discoverVideos.find((video) => video.id === state.selectedVideoId) ||
      activeFeed.find((video) => video.id === state.selectedVideoId) ||
      playbackList.find((video) => video.id === state.selectedVideoId) ||
      playbackList[0] ||
      null,
    [activeFeed, discoverVideos, playbackList, state.selectedVideoId],
  );
  const selectedDiscoverVideo = useMemo(
    () => discoverVideos.find((video) => video.id === state.selectedVideoId) || null,
    [discoverVideos, state.selectedVideoId],
  );
  const selectedChannelAvatar = useMemo(() => {
    if (!selectedVideo) return "";
    if (selectedVideo.channelThumbnail) return selectedVideo.channelThumbnail;

    if (selectedVideo.channelId) {
      const matchedChannel = state.subscribedChannels.find(
        (channel) => (channel.channelId || channel.id) === selectedVideo.channelId,
      );
      if (matchedChannel?.thumbnail) {
        return matchedChannel.thumbnail;
      }
    }

    const matchedChannel = state.subscribedChannels.find(
      (channel) => channel.name === selectedVideo.channel,
    );
    return matchedChannel?.thumbnail || "";
  }, [selectedVideo, state.subscribedChannels]);
  const queueIndex = Math.max(
    0,
    playbackList.findIndex((item) => item.id === selectedVideo?.id),
  );
  const queueTotal = playbackList.length;

  useEffect(() => {
    if (state.workspaceTab !== "discover") {
      return;
    }

    if (state.connectionStatus !== "connected") {
      return;
    }

    void ensureDiscoverVideos(state.discoverFilter);
  }, [ensureDiscoverVideos, state.connectionStatus, state.discoverFilter, state.workspaceTab]);

  useEffect(() => {
    if (!activeFeed.length) {
      return;
    }

    if (discoverVideos.some((video) => video.id === state.selectedVideoId)) {
      return;
    }

    if (activeFeed.some((video) => video.id === state.selectedVideoId)) {
      return;
    }

    const restoredVideo = activeFeed.find(
      (video) => video.id === state.playbackState.selectedVideoId,
    );
    const nextSelectedVideoId = restoredVideo?.id || activeFeed[0]?.id || DEFAULT_VIDEO_ID;

    if (nextSelectedVideoId && nextSelectedVideoId !== state.selectedVideoId) {
      setSelectedVideoId(nextSelectedVideoId);
    }
  }, [
    activeFeed,
    discoverVideos,
    setSelectedVideoId,
    state.playbackState.selectedVideoId,
    state.selectedVideoId,
  ]);

  const value = useMemo(
    () => ({
      accountProfile: state.accountProfile,
      activeFeed,
      connectYoutube,
      connectionStatus: state.connectionStatus,
      disconnectYoutube,
      discoverFilter: state.discoverFilter,
      discoverLoading: state.discoverLoading,
      discoverVideos,
      ensureDiscoverVideos,
      playbackList,
      playbackState: state.playbackState,
      queueIndex,
      queueTotal,
      selectedChannelAvatar,
      selectedDiscoverVideo,
      selectedVideo,
      selectedVideoId: state.selectedVideoId,
      setDiscoverFilter,
      setPlaybackState,
      setSelectedVideoId,
      setWorkspaceTab,
      subscribedChannels: state.subscribedChannels,
      toggleChannelEnabled,
      workspaceTab: state.workspaceTab,
      youtubeConnected,
    }),
    [
      activeFeed,
      connectYoutube,
      discoverVideos,
      disconnectYoutube,
      ensureDiscoverVideos,
      playbackList,
      queueIndex,
      queueTotal,
      selectedChannelAvatar,
      selectedDiscoverVideo,
      selectedVideo,
      setDiscoverFilter,
      setPlaybackState,
      setSelectedVideoId,
      setWorkspaceTab,
      state.accountProfile,
      state.connectionStatus,
      state.discoverFilter,
      state.discoverLoading,
      state.playbackState,
      state.selectedVideoId,
      state.subscribedChannels,
      state.workspaceTab,
      toggleChannelEnabled,
      youtubeConnected,
    ],
  );

  return <YoutubeSessionContext.Provider value={value}>{children}</YoutubeSessionContext.Provider>;
}

export function useYoutubeSessionContext() {
  const context = useContext(YoutubeSessionContext);

  if (!context) {
    throw new Error("useYoutubeSession must be used within a YoutubeSessionProvider");
  }

  return context;
}

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
  SEEDED_VIDEOS,
  normalizeSeededChannels,
} from "@/lib/youtubeDefaults";
import {
  getSafeAuthUser,
  linkGoogleIdentity,
  signInWithGoogle,
} from "@/lib/auth";
import { logAuthInfo, summarizeSupabaseSession } from "@/lib/authLogging";
import { supabase } from "@/lib/supabase";
import {
  addExcludedYoutubeChannel,
  fetchExcludedYoutubeChannels,
  removeExcludedYoutubeChannel,
} from "@/lib/exclusions";

const YOUTUBE_SESSION_STORAGE_KEY = "jp_dashboard_youtube_session_v2";
const LEGACY_WATCH_STATE_STORAGE_KEY = "jp_dashboard_youtube_session";
const DAILY_QUEUE_STORAGE_KEY = "jp_daily_video_queue";
const DISCOVER_CACHE_STORAGE_KEY = "jp_youtube_discover_cache_v1";
const DISCOVER_QUOTA_COOLDOWN_STORAGE_KEY = "jp_youtube_discover_quota_cooldown_v1";
const YOUTUBE_CONNECT_INTENT_STORAGE_KEY = "jp_youtube_connect_intent_v1";
const ACCOUNT_DATA_TTL_MS = 30 * 60 * 1000;

const YoutubeSessionContext = createContext(null);

function createDefaultState() {
  return {
    hydrated: false,
    connectionStatus: "disconnected",
    wasConnected: false,
    accessToken: "",
    tokenMeta: null,
    accountProfile: null,
    excludedChannelIds: [],
    subscribedChannels: normalizeSeededChannels(),
    accountVideos: [],
    discoverFilter: DEFAULT_DISCOVER_FILTER,
    discoverVideosByFilter: {},
    discoverLoading: false,
    selectedVideoId: DEFAULT_VIDEO_ID,
    playbackState: {
      selectedVideoId: DEFAULT_VIDEO_ID,
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      playbackStatus: "unstarted",
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
    duration: Math.max(0, Number(playbackState?.duration || 0)),
    isPlaying: Boolean(playbackState?.isPlaying),
    playbackStatus:
      typeof playbackState?.playbackStatus === "string"
        ? playbackState.playbackStatus
        : "unstarted",
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

function normalizeExcludedChannelIds(excludedChannelIds, context = "") {
  if (!Array.isArray(excludedChannelIds)) {
    if (excludedChannelIds != null) {
      console.info("[YouTube] Invalid excludedChannelIds shape normalized", {
        context,
        valueType: typeof excludedChannelIds,
        isArray: false,
      });
    }

    return [];
  }

  return [
    ...new Set(excludedChannelIds.map((channelId) => String(channelId || "").trim()).filter(Boolean)),
  ];
}

function deriveExcludedChannelIdsFromChannels(channels) {
  return normalizePersistedChannels(channels)
    .filter((channel) => channel.enabled === false)
    .map((channel) => channel.channelId || channel.id)
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

function buildChannelPreferencesFromExcludedRows(rows) {
  return normalizeExcludedChannelIds(
    rows?.map((row) => row?.channel_id),
    "supabase-excluded-rows",
  );
}

function applyExcludedChannelIds(channels, excludedChannelIds) {
  const normalizedChannels = normalizePersistedChannels(channels);
  const excludedChannelIdSet = new Set(
    normalizeExcludedChannelIds(excludedChannelIds, "apply-excluded-channel-ids"),
  );

  return normalizedChannels.map((channel) => {
    const channelId = channel.channelId || channel.id;

    return {
      ...channel,
      enabled: !excludedChannelIdSet.has(channelId),
    };
  });
}

function logExcludedChannelDiagnostics({
  context,
  excludedChannelIds = [],
  fetchedChannelIds = [],
}) {
  const normalizedExcludedIds = normalizeExcludedChannelIds(
    excludedChannelIds,
    `${context}-excluded-channel-ids`,
  );
  const normalizedFetchedIds = normalizeExcludedChannelIds(
    fetchedChannelIds,
    `${context}-fetched-channel-ids`,
  );
  const fetchedChannelIdSet = new Set(normalizedFetchedIds);
  const missingExcludedIds = normalizedExcludedIds.filter((channelId) => !fetchedChannelIdSet.has(channelId));
  const appliedCount = normalizedExcludedIds.length - missingExcludedIds.length;

  console.info("[YouTube] Excluded channel restore diagnostics", {
    context,
    excludedChannelIds: normalizedExcludedIds,
    fetchedChannelIds: normalizedFetchedIds,
    appliedExclusionCount: appliedCount,
    mismatchExcludedChannelIds: missingExcludedIds,
  });

  return {
    appliedCount,
    missingExcludedIds,
  };
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

function clearPersistedYoutubeSession() {
  removeStorageKey(YOUTUBE_SESSION_STORAGE_KEY);
  removeStorageKey(LEGACY_WATCH_STATE_STORAGE_KEY);
  removeStorageKey(DAILY_QUEUE_STORAGE_KEY);
  removeStorageKey(DISCOVER_CACHE_STORAGE_KEY);
  removeStorageKey(DISCOVER_QUOTA_COOLDOWN_STORAGE_KEY);
}

function rememberYoutubeConnectIntent() {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(YOUTUBE_CONNECT_INTENT_STORAGE_KEY, "true");
}

function clearYoutubeConnectIntent() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(YOUTUBE_CONNECT_INTENT_STORAGE_KEY);
}

function hasYoutubeConnectIntent() {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(YOUTUBE_CONNECT_INTENT_STORAGE_KEY) === "true";
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

function parseDurationToSeconds(duration) {
  if (!duration || typeof duration !== "string") return 0;

  const hours = Number(duration.match(/(\d+)H/)?.[1] || 0);
  const minutes = Number(duration.match(/(\d+)M/)?.[1] || 0);
  const seconds = Number(duration.match(/(\d+)S/)?.[1] || 0);

  return hours * 3600 + minutes * 60 + seconds;
}

function getYoutubeStatusMessage(lastError) {
  if (!lastError) {
    return "";
  }

  if (lastError === "quotaExceeded") {
    return "YouTube is connected, but fresh data is temporarily unavailable right now.";
  }

  if (lastError === "reconnect-required") {
    return "Reconnect your Google account to refresh YouTube access.";
  }

  if (lastError === "youtube-connect-failed") {
    return "Google sign-in worked, but YouTube could not be connected yet.";
  }

  return "Google sign-in worked, but YouTube data could not be loaded yet.";
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

export function YoutubeSessionProvider({ children }) {
  const youtubeApiKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY || "";
  const [authUserId, setAuthUserId] = useState("");
  const [authResolved, setAuthResolved] = useState(false);
  const [state, setState] = useState(createDefaultState);
  const stateRef = useRef(state);
  const silentRestoreAttemptedRef = useRef(false);
  const initializationPromiseRef = useRef(null);
  const pendingAuthBootstrapRef = useRef(null);
  const restoreYoutubeSessionRef = useRef(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    let isActive = true;

    const resolveAuthUser = async () => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error("[YouTube] Failed to restore Supabase session on load", sessionError);
      } else {
        logAuthInfo("YouTube", "Supabase session restored for YouTube provider", {
          session: summarizeSupabaseSession(sessionData?.session ?? null),
        });
      }

      const user = await getSafeAuthUser();

      if (!isActive) {
        return;
      }

      setAuthUserId(user?.id || "");
      setAuthResolved(true);
    };

    void resolveAuthUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isActive) {
        return;
      }

      logAuthInfo("YouTube", "Supabase auth state changed for YouTube provider", {
        event,
        session: summarizeSupabaseSession(session),
      });

      setAuthUserId(session?.user?.id || "");
      setAuthResolved(true);

      void (async () => {
        const nextUserId = session?.user?.id || "";
        const shouldAttemptBootstrap =
          event === "SIGNED_IN" ||
          (event === "INITIAL_SESSION" &&
            (stateRef.current.wasConnected || hasYoutubeConnectIntent()));

        if (!nextUserId) {
          pendingAuthBootstrapRef.current = null;
          if (event === "SIGNED_OUT") {
            console.info("[YouTube] Supabase signed out, clearing persisted YouTube restore state");
            clearPersistedYoutubeSession();
            clearYoutubeConnectIntent();
            setState((currentState) => ({
              ...createDefaultState(),
              hydrated: currentState.hydrated,
            }));
          }
          return;
        }

        if (!shouldAttemptBootstrap) {
          return;
        }

        pendingAuthBootstrapRef.current = {
          event,
          userId: nextUserId,
        };
        silentRestoreAttemptedRef.current = false;

        const canRunBootstrap =
          stateRef.current.hydrated &&
          stateRef.current.connectionStatus !== "connecting" &&
          typeof restoreYoutubeSessionRef.current === "function";

        if (canRunBootstrap) {
          pendingAuthBootstrapRef.current = null;
          void restoreYoutubeSessionRef.current({ forceRefresh: true });
        }
      })();
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, []);

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
    const nextDuration = Math.max(0, Number(payload?.duration || 0));
    const nextIsPlaying = Boolean(payload?.isPlaying);
    const nextPlaybackStatus =
      typeof payload?.playbackStatus === "string" ? payload.playbackStatus : "unknown";

    setState((currentState) => {
      const currentPlaybackState = currentState.playbackState;
      const sameSelectedVideo = currentState.selectedVideoId === nextVideoId;
      const samePlaybackVideo = currentPlaybackState.selectedVideoId === nextVideoId;
      const samePlaybackTime = Math.abs(currentPlaybackState.currentTime - nextCurrentTime) < 0.25;
      const sameDuration = Math.abs((currentPlaybackState.duration || 0) - nextDuration) < 0.25;
      const sameIsPlaying = Boolean(currentPlaybackState.isPlaying) === nextIsPlaying;
      const samePlaybackStatus =
        (currentPlaybackState.playbackStatus || "unknown") === nextPlaybackStatus;

      if (
        sameSelectedVideo &&
        samePlaybackVideo &&
        samePlaybackTime &&
        sameDuration &&
        sameIsPlaying &&
        samePlaybackStatus
      ) {
        return currentState;
      }

      return {
        ...currentState,
        selectedVideoId: nextVideoId,
        playbackState: {
          selectedVideoId: nextVideoId,
          currentTime: nextCurrentTime,
          duration: nextDuration,
          isPlaying: nextIsPlaying,
          playbackStatus: nextPlaybackStatus,
          updatedAt: Date.now(),
        },
      };
    });
  }, []);

  const setWorkspaceTab = useCallback((nextTabOrUpdater) => {
    setState((currentState) => {
      const requestedWorkspaceTab =
        typeof nextTabOrUpdater === "function"
          ? nextTabOrUpdater(currentState.workspaceTab)
          : nextTabOrUpdater;
      const nextWorkspaceTab =
        requestedWorkspaceTab === "discover" ? null : requestedWorkspaceTab;

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

  const ensureDiscoverVideos = useCallback(async () => {
    console.info("[YouTube] Discover requests are disabled; skipping discover fetch.");
    return [];
  }, []);

  const toggleChannelEnabled = useCallback((channelId) => {
    const currentChannel = stateRef.current.subscribedChannels.find(
      (channel) => (channel.channelId || channel.id) === channelId,
    );
    const previousEnabled = currentChannel?.enabled !== false;
    const nextEnabled = !previousEnabled;

    setState((currentState) => {
      const currentExcludedChannelIds = normalizeExcludedChannelIds(
        currentState.excludedChannelIds,
        "toggle-channel-enabled-current-state",
      );
      const nextExcludedChannelIds = nextEnabled
        ? currentExcludedChannelIds.filter((excludedChannelId) => excludedChannelId !== channelId)
        : normalizeExcludedChannelIds(
            [...currentExcludedChannelIds, channelId],
            "toggle-channel-enabled-next-state",
          );

      return {
        ...currentState,
        excludedChannelIds: nextExcludedChannelIds,
        subscribedChannels: applyExcludedChannelIds(
          currentState.subscribedChannels,
          nextExcludedChannelIds,
        ),
      };
    });

    if (!authUserId) {
      return;
    }

    const syncExcludedChannel = async () => {
      try {
        if (nextEnabled) {
          await removeExcludedYoutubeChannel(authUserId, channelId);
        } else {
          await addExcludedYoutubeChannel(authUserId, channelId);
        }
      } catch (error) {
        console.error("Failed to sync excluded YouTube channel to Supabase", error);
        setState((currentState) => {
          const currentExcludedChannelIds = normalizeExcludedChannelIds(
            currentState.excludedChannelIds,
            "toggle-channel-enabled-rollback-current-state",
          );
          const rollbackExcludedChannelIds = previousEnabled
            ? normalizeExcludedChannelIds(
                [...currentExcludedChannelIds, channelId],
                "toggle-channel-enabled-rollback-add",
              )
            : currentExcludedChannelIds.filter(
                (excludedChannelId) => excludedChannelId !== channelId,
              );

          return {
            ...currentState,
            excludedChannelIds: rollbackExcludedChannelIds,
            subscribedChannels: applyExcludedChannelIds(
              currentState.subscribedChannels,
              rollbackExcludedChannelIds,
            ),
          };
        });
      }
    };

    void syncExcludedChannel();
  }, [authUserId]);

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

  const markSessionDisconnected = useCallback(
    ({ clearPersistentConnection = false, nextError, cause = "" } = {}) => {
      if (cause) {
        console.info("[YouTube] Session marked disconnected", {
          clearPersistentConnection,
          nextError,
          cause,
        });
      }

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
        lastError:
          nextError ??
          (clearPersistentConnection ? "reconnect-required" : currentState.lastError),
      }));
    },
    [],
  );

  const fetchYoutubeAccountSnapshot = useCallback(async (reason = "refresh") => {
    const requestUrl = new URL("/api/youtube/account", window.location.origin);
    requestUrl.searchParams.set("reason", reason);

    console.info("[YouTube] Requesting server-side account snapshot", {
      reason,
      wasConnected: stateRef.current.wasConnected,
    });

    const response = await fetch(requestUrl.toString(), {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const error = createRequestError(
        payload?.message || "Failed to load YouTube account snapshot.",
        response.status,
        {
          code: payload?.code || "youtube_account_failed",
          source: payload?.source || "youtube",
        },
      );
      console.error("[YouTube] Server-side account snapshot failed", {
        reason,
        status: response.status,
        code: error.code,
        source: error.source,
        message: error.message,
      });
      throw error;
    }

    if (payload?.tokenMeta?.refreshed) {
      console.info("[YouTube] Google access token refreshed server-side", {
        expiresAt: payload?.tokenMeta?.expiresAt || null,
      });
    }

    return payload;
  }, []);

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
    async (options = {}) => {
      if (initializationPromiseRef.current) {
        return initializationPromiseRef.current;
      }

      initializationPromiseRef.current = (async () => {
        try {
          const snapshot = await fetchYoutubeAccountSnapshot(options.reason || "refresh");

          if (snapshot?.quotaExceeded) {
            setState((currentState) => ({
              ...currentState,
              connectionStatus: "connected",
              wasConnected: true,
              lastError: "quotaExceeded",
              accountProfile: snapshot.accountProfile || currentState.accountProfile,
              tokenMeta: snapshot.tokenMeta || currentState.tokenMeta,
              lastSyncedAt: Number(snapshot.lastSyncedAt || Date.now()),
            }));
            return true;
          }

          const fetchedChannels = snapshot?.subscribedChannels || [];
          const queueVideos = snapshot?.accountVideos || [];

          setState((currentState) => {
            const currentExcludedChannelIds = normalizeExcludedChannelIds(
              currentState.excludedChannelIds,
              "youtube-account-refresh-current-state",
            );
            const nextSubscribedChannels = applyExcludedChannelIds(
              fetchedChannels.length ? fetchedChannels : currentState.subscribedChannels,
              currentExcludedChannelIds,
            );
            logExcludedChannelDiagnostics({
              context: "youtube-account-refresh",
              excludedChannelIds: currentExcludedChannelIds,
              fetchedChannelIds: nextSubscribedChannels.map(
                (channel) => channel.channelId || channel.id,
              ),
            });
            const nextSelectedVideoId =
              options.preserveSelectedVideo && currentState.selectedVideoId
                ? currentState.selectedVideoId
                : choosePreferredVideoId(queueVideos);

            return {
              ...currentState,
              connectionStatus: "connected",
              wasConnected: true,
              accessToken: "",
              tokenMeta: snapshot?.tokenMeta || null,
              accountProfile: snapshot.accountProfile || currentState.accountProfile,
              excludedChannelIds: currentExcludedChannelIds,
              subscribedChannels: nextSubscribedChannels,
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
              lastSyncedAt: Number(snapshot?.lastSyncedAt || Date.now()),
              lastError: "",
            };
          });
          clearYoutubeConnectIntent();

          return true;
        } catch (error) {
          console.error("Failed to refresh YouTube account data", {
            message: error?.message || "youtube-refresh-failed",
            status: error?.status || 0,
            body: error?.errorInfo?.parsedBody || error?.errorInfo?.bodyText || null,
          });
          const status = Number(error?.status || 0);
          const code = error?.code || "";

          if (code === "supabase_session_missing") {
            markSessionDisconnected({
              clearPersistentConnection: true,
              nextError: "youtube-refresh-failed",
              cause: "supabase-session-missing",
            });
          } else if (
            code === "google_refresh_token_missing" ||
            code === "google_refresh_failed" ||
            code === "google_refresh_not_configured"
          ) {
            markSessionDisconnected({
              clearPersistentConnection: true,
              nextError: "reconnect-required",
              cause: code,
            });
          } else if (status >= 500 || !status) {
            markSessionDisconnected({
              clearPersistentConnection: false,
              nextError: "youtube-refresh-failed",
              cause: code || "temporary-youtube-failure",
            });
          } else {
            setState((currentState) => ({
              ...currentState,
              connectionStatus: currentState.wasConnected ? "connected" : "disconnected",
              lastError: "youtube-refresh-failed",
            }));
          }

          return false;
        } finally {
          initializationPromiseRef.current = null;
        }
      })();

      return initializationPromiseRef.current;
    },
    [choosePreferredVideoId, fetchYoutubeAccountSnapshot, markSessionDisconnected],
  );

  const restoreYoutubeSession = useCallback(async ({ forceRefresh = false } = {}) => {
    if (silentRestoreAttemptedRef.current) {
      return;
    }

    silentRestoreAttemptedRef.current = true;

    try {
      const currentState = stateRef.current;
      const hasFreshAccountData =
        currentState.lastSyncedAt &&
        Date.now() - currentState.lastSyncedAt < ACCOUNT_DATA_TTL_MS &&
        (currentState.accountProfile || currentState.accountVideos.length);

      if (forceRefresh || !hasFreshAccountData) {
        console.info("[YouTube] Restoring persisted YouTube session", {
          forceRefresh,
          hasFreshAccountData,
          wasConnected: currentState.wasConnected,
        });
        await refreshYoutubeAccountData({
          preserveSelectedVideo: true,
          reason: forceRefresh ? "auth-bootstrap" : "session-restore",
        });
      }
    } catch (error) {
      markSessionDisconnected({
        clearPersistentConnection: false,
        nextError: "youtube-refresh-failed",
        cause: error?.code || "session-restore-failed",
      });
    }
  }, [markSessionDisconnected, refreshYoutubeAccountData]);

  useEffect(() => {
    restoreYoutubeSessionRef.current = restoreYoutubeSession;
  }, [restoreYoutubeSession]);

  useEffect(() => {
    if (!state.hydrated || !authResolved || !authUserId) {
      return;
    }

    const pendingBootstrap = pendingAuthBootstrapRef.current;
    if (!pendingBootstrap || pendingBootstrap.userId !== authUserId) {
      return;
    }

    pendingAuthBootstrapRef.current = null;
    silentRestoreAttemptedRef.current = false;
    void restoreYoutubeSession({ forceRefresh: true });
  }, [authResolved, authUserId, restoreYoutubeSession, state.hydrated]);

  const connectYoutube = useCallback(async () => {
    setState((currentState) => ({
      ...currentState,
      connectionStatus: "connecting",
      lastError: "",
    }));

    try {
      await refreshYoutubeAccountData({
        preserveSelectedVideo: false,
        reason: "manual-connect",
      });
    } catch (error) {
      if (error?.code === "google_refresh_token_missing") {
        rememberYoutubeConnectIntent();

        try {
          const user = await getSafeAuthUser();
          const { error: authError } = user?.id
            ? await linkGoogleIdentity()
            : await signInWithGoogle();

          if (authError) {
            throw authError;
          }

          return;
        } catch (authError) {
          console.error("Unable to start Google OAuth for YouTube connect", authError);
        }
      }

      console.error("Unable to connect YouTube via server-side Google OAuth", error);
      setState((currentState) => ({
        ...currentState,
        connectionStatus: "disconnected",
        lastError: "youtube-connect-failed",
      }));
    }
  }, [refreshYoutubeAccountData]);

  const disconnectYoutube = useCallback(async () => {
    try {
      await fetch("/api/youtube/account", {
        method: "DELETE",
        credentials: "same-origin",
      });
    } catch (error) {
      console.error("Failed to disconnect stored YouTube authorization on the server", error);
    }

    clearPersistedYoutubeSession();
    clearYoutubeConnectIntent();
    setState((currentState) => ({
      ...createDefaultState(),
      hydrated: currentState.hydrated,
    }));
    silentRestoreAttemptedRef.current = false;
  }, []);

  useEffect(() => {
    if (!state.hydrated || !authResolved || !authUserId) {
      return;
    }

    let isActive = true;

    const loadExcludedChannels = async () => {
      try {
        const excludedChannels = await fetchExcludedYoutubeChannels(authUserId);

        if (!isActive) {
          return;
        }

        const excludedChannelIds = buildChannelPreferencesFromExcludedRows(excludedChannels);
        console.info("[YouTube] Fetched excluded channel ids", {
          userId: authUserId,
          excludedChannelIds,
        });

        setState((currentState) => {
          const currentExcludedChannelIds = normalizeExcludedChannelIds(
            excludedChannelIds,
            "supabase-exclusions-load-state-merge",
          );

          return {
            ...currentState,
            excludedChannelIds: currentExcludedChannelIds,
            subscribedChannels: applyExcludedChannelIds(
              currentState.subscribedChannels,
              currentExcludedChannelIds,
            ),
          };
        });

        logExcludedChannelDiagnostics({
          context: "supabase-exclusions-load",
          excludedChannelIds,
          fetchedChannelIds: stateRef.current.subscribedChannels.map(
            (channel) => channel.channelId || channel.id,
          ),
        });
      } catch (error) {
        console.error("Failed to load excluded YouTube channels from Supabase", error);
      }
    };

    void loadExcludedChannels();

    return () => {
      isActive = false;
    };
  }, [authResolved, authUserId, state.hydrated]);

  useEffect(() => {
    const persistedSnapshot = readPersistedSessionSnapshot();

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
      const excludedChannelIds = normalizeExcludedChannelIds(
        persistedSnapshot?.excludedChannelIds ||
          deriveExcludedChannelIdsFromChannels(persistedSnapshot?.subscribedChannels),
        "persisted-session-snapshot",
      );
      const subscribedChannels = applyExcludedChannelIds(
        persistedSnapshot?.subscribedChannels,
        excludedChannelIds,
      );

      return {
        ...currentState,
        hydrated: true,
        connectionStatus: persistedSnapshot?.wasConnected ? "restoring" : "disconnected",
        wasConnected: Boolean(persistedSnapshot?.wasConnected),
        tokenMeta: persistedSnapshot?.tokenMeta || null,
        accountProfile: persistedSnapshot?.accountProfile || null,
        excludedChannelIds,
        subscribedChannels,
        accountVideos: normalizeVideoList(persistedSnapshot?.accountVideos),
        discoverFilter: persistedSnapshot?.discoverFilter || DEFAULT_DISCOVER_FILTER,
        discoverVideosByFilter: {},
        discoverLoading: false,
        selectedVideoId,
        playbackState: {
          ...playbackState,
          selectedVideoId,
        },
        workspaceTab:
          typeof persistedSnapshot?.workspaceTab === "string"
            ? persistedSnapshot.workspaceTab === "discover"
              ? null
              : persistedSnapshot.workspaceTab
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
      excludedChannelIds: normalizeExcludedChannelIds(
        state.excludedChannelIds,
        "persisted-session-write",
      ),
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
    state.excludedChannelIds,
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
    () => [],
    [],
  );
  const enabledChannels = useMemo(() => {
    const excludedChannelIdSet = new Set(
      normalizeExcludedChannelIds(state.excludedChannelIds, "enabled-channels-selector"),
    );

    return state.subscribedChannels.filter((channel) => {
      const channelId = channel.channelId || channel.id;
      return !excludedChannelIdSet.has(channelId);
    });
  }, [state.excludedChannelIds, state.subscribedChannels]);
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
  const youtubeStatusMessage = getYoutubeStatusMessage(state.lastError);

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
  const playbackList = useMemo(() => activeFeed, [activeFeed]);

  const selectedVideo = useMemo(
    () =>
      activeFeed.find((video) => video.id === state.selectedVideoId) ||
      playbackList.find((video) => video.id === state.selectedVideoId) ||
      playbackList[0] ||
      null,
    [activeFeed, playbackList, state.selectedVideoId],
  );
  const selectedDiscoverVideo = null;
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
    if (!activeFeed.length) {
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
      youtubeStatusMessage,
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
      youtubeStatusMessage,
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

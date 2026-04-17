"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ListeningWorkspace from "@/components/features/listening/ListeningWorkspace";
import TimerStopwatch from "@/components/features/listening/TimerStopwatch";
import ListeningVisualization from "@/components/features/listening/ListeningVisualization";
import { fetchListeningTotal } from "@/lib/listeningEvents";

const DISCOVER_FILTERS = {
  ゲーム: "日本 ゲーム 実況",
  旅行: "日本 旅行 vlog",
  日本語: "日本語 勉強",
};

export default function ListeningTab({
  styles,
  listeningHours,
  setListeningHours,
  adjustListeningHours,
  authUserId,
  isMobile,
  isCompact,
  seededChannels,
  seededVideos,
  formatClock,
}) {
  const DEFAULT_VIDEO_ID = "M7lc1UVf-VE";
  const MINIMUM_VIDEO_LENGTH_SECONDS = 90;
  const ACCESS_TOKEN_STORAGE_KEY = "jp_dashboard_youtube_access_token";
  const CONNECTED_STORAGE_KEY = "jp_dashboard_youtube_connected";
  const LEGACY_AUTH_STORAGE_KEY = "jp_dashboard_youtube_auth";
  const SESSION_STORAGE_KEY = "jp_dashboard_youtube_session";
  const DAILY_QUEUE_STORAGE_KEY = "jp_daily_video_queue";
  const CHANNEL_PREFERENCES_STORAGE_KEY = "jp_youtube_channel_preferences";

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

  const safeVideoId = selectedVideoId || DEFAULT_VIDEO_ID;
  const roundToTenth = useCallback((value) => Math.round(value * 10) / 10, []);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const browserOrigin = typeof window !== "undefined" ? window.location.origin : "";

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
    async (videoIds) => {
      const uniqueVideoIds = [...new Set(videoIds.filter(Boolean))];
      const detailsMap = new Map();

      for (const videoIdChunk of chunkItems(uniqueVideoIds, 50)) {
        const params = new URLSearchParams({
          part: "contentDetails",
          id: videoIdChunk.join(","),
          maxResults: String(videoIdChunk.length),
        });
        const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${youtubeAccessToken}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Video details fetch failed: ${response.status}`);
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
    [chunkItems, formatDurationLabel, parseDurationToSeconds, youtubeAccessToken],
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
    let cancelled = false;

    const hydrateListeningHours = async () => {
      if (!authUserId) return;

      const totalMinutes = await fetchListeningTotal();
      if (cancelled || typeof totalMinutes !== "number") return;

      setListeningHours(totalMinutes / 60);
    };

    hydrateListeningHours();

    return () => {
      cancelled = true;
    };
  }, [authUserId, setListeningHours]);

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
      setSelectedVideoId(videoId);
    },
    [isPlayerCurrentlyPlaying],
  );
  const selectDiscoverVideo = useCallback((videoId) => {
    pendingSelectionPlaybackRef.current = {
      shouldPlay: false,
    };
    setSelectedVideoId(videoId);
  }, []);
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
        if (response?.access_token) {
          setYoutubeAccessToken(response.access_token);
          setYoutubeConnected(true);
          if (typeof window !== "undefined") {
            localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, response.access_token);
            localStorage.setItem(CONNECTED_STORAGE_KEY, "true");
            localStorage.setItem(
              LEGACY_AUTH_STORAGE_KEY,
              JSON.stringify({ youtubeAccessToken: response.access_token, youtubeConnected: true }),
            );
          }
        } else {
          console.error("Google OAuth did not return an access token", response);
        }
      },
    });

    return googleTokenClientRef.current;
  }, [browserOrigin, googleClientId]);

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
      client.requestAccessToken({ prompt: "consent" });
    } catch (error) {
      console.error("Unable to connect YouTube via Google OAuth", error);
    }
  }, [browserOrigin, getGoogleTokenClient, googleClientId, loadGoogleIdentityScript]);

  const disconnectYoutube = useCallback(() => {
    if (typeof window !== "undefined") {
      if (youtubeAccessToken) {
        window.google?.accounts?.oauth2?.revoke?.(youtubeAccessToken, () => {});
      }
      localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
      localStorage.removeItem(CONNECTED_STORAGE_KEY);
      localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
    }

    setYoutubeAccessToken("");
    setYoutubeConnected(false);
    setAccountVideos([]);
    setSubscribedChannels(normalizeSeededChannels());
    setSelectedVideoId((currentVideoId) =>
      approvedFeed.some((video) => video.id === currentVideoId) ? currentVideoId : DEFAULT_VIDEO_ID,
    );
    googleTokenClientRef.current = null;
  }, [youtubeAccessToken, normalizeSeededChannels, approvedFeed]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const storedAccessToken = localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
      const storedConnected = localStorage.getItem(CONNECTED_STORAGE_KEY);

      if (storedAccessToken && storedConnected === "true") {
        setYoutubeAccessToken(storedAccessToken);
        setYoutubeConnected(true);
        return;
      }

      const legacyStored = JSON.parse(localStorage.getItem(LEGACY_AUTH_STORAGE_KEY) || "null");
      if (legacyStored?.youtubeAccessToken && legacyStored?.youtubeConnected) {
        setYoutubeAccessToken(legacyStored.youtubeAccessToken);
        setYoutubeConnected(true);
        localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, legacyStored.youtubeAccessToken);
        localStorage.setItem(CONNECTED_STORAGE_KEY, "true");
      }
    } catch (error) {
      console.error("Failed to restore YouTube auth state", error);
    }
  }, []);

  useEffect(() => {
    if (!youtubeAccessToken || !youtubeConnected) return;

    let cancelled = false;

    const fetchAccountVideos = async () => {
      try {
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

          const subscriptionsResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/subscriptions?${params.toString()}`,
            {
              headers: {
                Authorization: `Bearer ${youtubeAccessToken}`,
              },
            },
          );

          if (!subscriptionsResponse.ok) {
            throw new Error(`Subscriptions fetch failed: ${subscriptionsResponse.status}`);
          }

          const subscriptionsData = await subscriptionsResponse.json();
          allSubscriptions.push(...(subscriptionsData.items || []));
          nextPageToken = subscriptionsData.nextPageToken || "";
        } while (nextPageToken);

        const channelIdsForDetails = [
          ...new Set(
            allSubscriptions
              .map((item) => item?.snippet?.resourceId?.channelId)
              .filter(Boolean),
          ),
        ];
        const channelDetailsMap = new Map();

        for (const channelIdChunk of chunkItems(channelIdsForDetails, 50)) {
          const channelsResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelIdChunk.join(",")}`,
            {
              headers: {
                Authorization: `Bearer ${youtubeAccessToken}`,
              },
            },
          );

          if (!channelsResponse.ok) {
            console.error("Unable to fetch YouTube channel details", channelsResponse.status);
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

        if (!cancelled) {
          setSubscribedChannels(fetchedChannels.length ? fetchedChannels : normalizeSeededChannels());
        }

        if (fetchedChannels.length) {
          persistChannelPreferences(fetchedChannels);
        }

        const storedDailyQueue = readStoredDailyQueue();
        if (
          storedDailyQueue?.date === getTodayKey() &&
          Array.isArray(storedDailyQueue.videos) &&
          storedDailyQueue.videos.length &&
          storedDailyQueue.videos.every(
            (video) => Number(video?.durationSeconds || 0) >= MINIMUM_VIDEO_LENGTH_SECONDS,
          )
        ) {
          if (!cancelled) {
            setAccountVideos(storedDailyQueue.videos);
          }
          return;
        }

        const channelIds = fetchedChannels.map((channel) => channel.channelId).slice(0, 5);
        if (!channelIds.length) {
          if (!cancelled) {
            setAccountVideos([]);
          }
          return;
        }

        const channelVideoGroups = await Promise.all(
          channelIds.map(async (channelId) => {
            try {
              const videosResponse = await fetch(
                `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&maxResults=5&order=date&type=video`,
                {
                  headers: {
                    Authorization: `Bearer ${youtubeAccessToken}`,
                  },
                },
              );

              if (!videosResponse.ok) {
                throw new Error(`Video fetch failed for ${channelId}: ${videosResponse.status}`);
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
        const queueVideoDetails = await fetchVideoDetailsMap(
          queueCandidates.map((video) => video.id),
        );
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

        if (!cancelled) {
          setAccountVideos(shuffledVideos);
        }
      } catch (error) {
        console.error("Unable to fetch YouTube account videos", error);
        if (!cancelled) {
          setAccountVideos([]);
        }
      }
    };

    fetchAccountVideos();

    return () => {
      cancelled = true;
    };
  }, [
    applyChannelPreferences,
    chunkItems,
    getTodayKey,
    normalizeSeededChannels,
    persistChannelPreferences,
    persistDailyQueue,
    fetchVideoDetailsMap,
    readStoredChannelPreferences,
    readStoredDailyQueue,
    shuffleVideos,
    youtubeAccessToken,
    youtubeConnected,
    MINIMUM_VIDEO_LENGTH_SECONDS,
  ]);

  useEffect(() => {
    if (!youtubeAccessToken || !youtubeConnected) {
      setDiscoverVideos([]);
      setDiscoverLoading(false);
      return;
    }

    let cancelled = false;

    const fetchDiscoverVideos = async () => {
      try {
        setDiscoverLoading(true);

        const params = new URLSearchParams({
          part: "snippet",
          maxResults: "12",
          type: "video",
          relevanceLanguage: "ja",
          regionCode: "JP",
          videoEmbeddable: "true",
          q: DISCOVER_FILTERS[discoverFilter] || DISCOVER_FILTERS.ゲーム,
        });

        const response = await fetch(
          `https://www.googleapis.com/youtube/v3/search?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${youtubeAccessToken}`,
            },
          },
        );

        if (!response.ok) {
          throw new Error(`Discover fetch failed: ${response.status}`);
        }

        const data = await response.json();
        const discoverResults =
          data.items?.filter((item) => item?.id?.videoId && item?.snippet) || [];
        const discoverVideoDetails = await fetchVideoDetailsMap(
          discoverResults.map((item) => item?.id?.videoId),
        );
        const discoverChannelIds = [
          ...new Set(discoverResults.map((item) => item?.snippet?.channelId).filter(Boolean)),
        ];
        const discoverChannelMap = new Map();

        for (const channelIdChunk of chunkItems(discoverChannelIds, 50)) {
          const channelsResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelIdChunk.join(",")}`,
            {
              headers: {
                Authorization: `Bearer ${youtubeAccessToken}`,
              },
            },
          );

          if (!channelsResponse.ok) {
            console.error("Unable to fetch Discover channel details", channelsResponse.status);
            continue;
          }

          const channelsData = await channelsResponse.json();
          for (const channel of channelsData.items || []) {
            discoverChannelMap.set(channel?.id, {
              thumbnail:
                channel?.snippet?.thumbnails?.default?.url ||
                channel?.snippet?.thumbnails?.medium?.url ||
                "",
            });
          }
        }

        const videos = discoverResults
          .map((item) => {
            const videoId = item.id.videoId;
            const videoDetails = discoverVideoDetails.get(videoId);

            return {
              id: videoId,
              channelId: item.snippet.channelId || "",
              channelThumbnail:
                discoverChannelMap.get(item.snippet.channelId || "")?.thumbnail || "",
              title: item.snippet.title || "Untitled video",
              channel: item.snippet.channelTitle || "YouTube",
              thumbnail:
                item.snippet.thumbnails?.medium?.url ||
                item.snippet.thumbnails?.default?.url ||
                "",
              duration: videoDetails?.durationLabel || "Discover",
              durationSeconds: videoDetails?.durationSeconds || 0,
            };
          })
          .filter((video) => video.durationSeconds >= MINIMUM_VIDEO_LENGTH_SECONDS);

        if (!cancelled) {
          setDiscoverVideos(videos);
        }
      } catch (error) {
        console.error("Unable to fetch discover videos", error);
        if (!cancelled) {
          setDiscoverVideos([]);
        }
      } finally {
        if (!cancelled) {
          setDiscoverLoading(false);
        }
      }
    };

    fetchDiscoverVideos();

    return () => {
      cancelled = true;
    };
  }, [
    chunkItems,
    discoverFilter,
    fetchVideoDetailsMap,
    youtubeAccessToken,
    youtubeConnected,
    MINIMUM_VIDEO_LENGTH_SECONDS,
  ]);

  useEffect(() => {
    if (isDiscoverVideoSelected) return;
    if (!activeFeed.length) return;
    if (activeFeed.some((video) => video.id === selectedVideoId)) return;

    const storedWatchState = readStoredWatchState();
    const restoredVideo = activeFeed.find((video) => video.id === storedWatchState?.selectedVideoId);
    setSelectedVideoId(restoredVideo?.id || activeFeed[0].id);
  }, [activeFeed, isDiscoverVideoSelected, readStoredWatchState, selectedVideoId]);

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

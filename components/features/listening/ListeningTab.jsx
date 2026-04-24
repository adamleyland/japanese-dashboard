"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ListeningWorkspace from "@/components/features/listening/ListeningWorkspace";
import TimerStopwatch from "@/components/features/listening/TimerStopwatch";
import ListeningVisualization from "@/components/features/listening/ListeningVisualization";
import {
  fetchProfileListeningGoal,
  persistProfileListeningGoal,
} from "@/lib/profiles";
import { useYoutubeSession } from "@/hooks/useYoutubeSession";
import { DEFAULT_VIDEO_ID } from "@/lib/youtubeDefaults";

const DEFAULT_LISTENING_GOAL = 1200;
const LISTENING_GOAL_STORAGE_KEY = "jp_listening_goal_hours";
const LISTENING_SOURCE_STORAGE_KEY = "jp_listening_workspace_source";
const LISTENING_GOAL_SETTINGS_STORAGE_KEY = "jp_listening_goal_settings_open";
const YOUTUBE_WORKSPACE_RESUME_STORAGE_KEY = "jp_youtube_workspace_resume_v1";
const YOUTUBE_IFRAME_API_SRC = "https://www.youtube.com/iframe_api";

function normalizeListeningGoalInput(value, fallback = DEFAULT_LISTENING_GOAL) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return fallback;
  }

  return numericValue;
}

function parseStoredListeningGoal(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null;
  }

  return numericValue;
}

function getListeningGoalStorageKey(userId = "") {
  return userId ? `${LISTENING_GOAL_STORAGE_KEY}:${userId}` : LISTENING_GOAL_STORAGE_KEY;
}

function readCachedListeningGoal(userId = "") {
  if (typeof window === "undefined") {
    return null;
  }

  return parseStoredListeningGoal(
    window.localStorage.getItem(getListeningGoalStorageKey(userId)),
  );
}

function writeCachedListeningGoal(value, userId = "") {
  if (typeof window === "undefined") {
    return;
  }

  const storageKey = getListeningGoalStorageKey(userId);
  const normalizedValue = normalizeListeningGoalInput(value, DEFAULT_LISTENING_GOAL);

  window.localStorage.setItem(storageKey, String(normalizedValue));
}

function readYoutubeWorkspaceResumeSnapshot() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return JSON.parse(window.sessionStorage.getItem(YOUTUBE_WORKSPACE_RESUME_STORAGE_KEY) || "null");
  } catch (error) {
    console.warn("[YouTube Player] Failed to parse workspace resume snapshot", {
      errorMessage: error?.message || String(error || ""),
    });
    return null;
  }
}

function writeYoutubeWorkspaceResumeSnapshot(snapshot) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    YOUTUBE_WORKSPACE_RESUME_STORAGE_KEY,
    JSON.stringify(snapshot),
  );
}

export default function ListeningTab({
  styles,
  listeningHours,
  adjustListeningHours,
  isMobile,
  isCompact,
  formatClock,
  authUserId,
  authResolved,
  audiobooksData,
  audiobooksLoading,
  audiobooksError,
  onAudiobookPlaybackStateChange,
  audiobookLaunchRequest,
  onAudiobookLaunchResult,
}) {
  const {
    activeFeed,
    connectYoutube,
    connectionStatus,
    disconnectYoutube,
    discoverFilter,
    discoverLoading,
    discoverVideos,
    playbackList,
    playbackState,
    queueIndex,
    queueTotal,
    selectedChannelAvatar,
    selectedDiscoverVideo,
    selectedVideo,
    selectedVideoId,
    setDiscoverFilter,
    setPlaybackState,
    setSelectedVideoId,
    setWorkspaceTab,
    subscribedChannels,
    toggleChannelEnabled,
    workspaceTab,
    youtubeConnected,
    youtubeStatusMessage,
  } = useYoutubeSession();

  const [focusMode, setFocusMode] = useState(false);
  const [isPlayerPlaying, setIsPlayerPlaying] = useState(false);
  const [clockMode, setClockMode] = useState("stopwatch");
  const [stopwatchSeconds, setStopwatchSeconds] = useState(0);
  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  const [timerDurationSeconds, setTimerDurationSeconds] = useState(300);
  const [timerSeconds, setTimerSeconds] = useState(300);
  const [timerRunning, setTimerRunning] = useState(false);
  const [listeningGoal, setListeningGoalState] = useState(DEFAULT_LISTENING_GOAL);
  const [youtubeVideoProgress, setYoutubeVideoProgress] = useState(0);
  const [workspaceSource, setWorkspaceSource] = useState("youtube");
  const [showVisualization] = useState(true);
  const [vizMode, setVizMode] = useState("bar");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const isYoutubeMode = workspaceSource === "youtube";
  const playerCanMount = !isYoutubeMode || (connectionStatus !== "connecting" && connectionStatus !== "restoring" && playbackList.length > 0 && Boolean(selectedVideo?.id));

  const safeVideoId = selectedVideo?.id || selectedVideoId || DEFAULT_VIDEO_ID;
  const playbackResumeVideoId = playbackState?.selectedVideoId || safeVideoId;
  const playbackResumeTime = playbackState?.currentTime || 0;
  const audiobookPlaybackSnapshotRef = useRef({
    bookId: null,
    isPlaying: false,
    currentTime: 0,
    durationSeconds: 0,
    isPlayerOpen: false,
    isPlayerMinimized: false,
  });
  const playerRef = useRef(null);
  const playerHostRef = useRef(null);
  const focusPlayerHostRef = useRef(null);
  const activePlayerHostRef = useRef(null);
  const wakeLockRef = useRef(null);
  const playerVideoIdRef = useRef("");
  const previousFocusModeRef = useRef(focusMode);
  const initRef = useRef(false);
  const playerReadyRef = useRef(false);
  const pendingRestoreRef = useRef(null);
  const pendingSelectionPlaybackRef = useRef(null);
  const playbackIntentRef = useRef(false);
  const failedVideoIdsRef = useRef(new Set());
  const currentQueueIndexRef = useRef(queueIndex);
  const lastQueueTransitionRef = useRef({
    triggerReason: "",
    fromVideoId: "",
    toVideoId: "",
    at: 0,
  });
  const previousWorkspaceSourceRef = useRef(workspaceSource);
  const playbackListRef = useRef(playbackList);
  const selectedVideoIdRef = useRef(safeVideoId);
  const selectedChannelIdRef = useRef(selectedVideo?.channelId || null);
  const authUserIdRef = useRef(authUserId);
  const listeningGoalRef = useRef(listeningGoal);
  const listeningGoalRequestRef = useRef(0);
  const listeningGoalEditVersionRef = useRef(0);
  const resolvedListeningGoalUserRef = useRef(null);
  const youtubeVideoProgressRef = useRef(0);
  const playbackResumeRef = useRef({
    videoId: playbackResumeVideoId,
    currentTime: playbackResumeTime,
  });

  const roundToTenth = useCallback((value) => Math.round(value * 10) / 10, []);

  const setYoutubeVideoProgressSafely = useCallback((nextValue) => {
    const normalizedProgress = Math.max(0, Math.min(1, Number(nextValue) || 0));

    if (Math.abs(youtubeVideoProgressRef.current - normalizedProgress) < 0.002) {
      return;
    }

    youtubeVideoProgressRef.current = normalizedProgress;
    setYoutubeVideoProgress(normalizedProgress);
  }, []);

  const setListeningGoal = useCallback(
    (nextValueOrUpdater, { source = "user", userIdOverride } = {}) => {
      const previousGoal = listeningGoalRef.current;
      const rawNextGoal =
        typeof nextValueOrUpdater === "function"
          ? nextValueOrUpdater(previousGoal)
          : nextValueOrUpdater;
      const nextGoal = normalizeListeningGoalInput(rawNextGoal, previousGoal);

      if (Math.abs(previousGoal - nextGoal) < 0.000001) {
        return;
      }

      listeningGoalRef.current = nextGoal;
      setListeningGoalState(nextGoal);

      const targetUserId =
        typeof userIdOverride === "string" ? userIdOverride : authUserIdRef.current || "";
      writeCachedListeningGoal(nextGoal, targetUserId);

      if (source !== "hydrate") {
        listeningGoalEditVersionRef.current += 1;
      }

      if (source === "user" && authResolved && targetUserId) {
        void persistProfileListeningGoal(targetUserId, nextGoal);
      }
    },
    [authResolved],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedWorkspaceSource = window.localStorage.getItem(LISTENING_SOURCE_STORAGE_KEY);
    const storedSettingsOpen =
      window.localStorage.getItem(LISTENING_GOAL_SETTINGS_STORAGE_KEY) === "true";

    if (storedWorkspaceSource === "audiobooks") {
      setWorkspaceSource("audiobooks");
    }

    setSettingsOpen(storedSettingsOpen);
    setIsMounted(true);
  }, []);

  useEffect(() => {
    authUserIdRef.current = authUserId;
  }, [authUserId]);

  useEffect(() => {
    listeningGoalRef.current = listeningGoal;
  }, [listeningGoal]);

  useEffect(() => {
    if (!authResolved) {
      return undefined;
    }

    let isActive = true;
    const requestId = ++listeningGoalRequestRef.current;
    const startingEditVersion = listeningGoalEditVersionRef.current;
    const previousResolvedUserId = resolvedListeningGoalUserRef.current;

    resolvedListeningGoalUserRef.current = authUserId || null;

    if (!authUserId) {
      const anonymousGoal = readCachedListeningGoal("") ?? DEFAULT_LISTENING_GOAL;
      setListeningGoal(anonymousGoal, {
        source: "hydrate",
        userIdOverride: "",
      });
      return () => {
        isActive = false;
      };
    }

    const cachedListeningGoal = readCachedListeningGoal(authUserId);
    const isUserSwitch =
      Boolean(previousResolvedUserId) && previousResolvedUserId !== authUserId;

    if (cachedListeningGoal !== null) {
      setListeningGoal(cachedListeningGoal, {
        source: "hydrate",
        userIdOverride: authUserId,
      });
    } else if (isUserSwitch) {
      setListeningGoal(DEFAULT_LISTENING_GOAL, {
        source: "hydrate",
        userIdOverride: authUserId,
      });
    }

    const hydrateListeningGoal = async () => {
      const profileListeningGoal = await fetchProfileListeningGoal(authUserId);

      if (!isActive || listeningGoalRequestRef.current !== requestId) {
        return;
      }

      if (listeningGoalEditVersionRef.current !== startingEditVersion) {
        console.info("[Listening Goal] Skipping stale profile hydration after a newer local edit", {
          userId: authUserId,
          requestId,
          startingEditVersion,
          latestEditVersion: listeningGoalEditVersionRef.current,
        });
        return;
      }

      if (profileListeningGoal !== null) {
        setListeningGoal(profileListeningGoal, {
          source: "hydrate",
          userIdOverride: authUserId,
        });
        return;
      }

      if (cachedListeningGoal === null) {
        console.info("[Listening Goal] No saved profile goal found; keeping current fallback", {
          userId: authUserId,
          fallbackGoal: listeningGoalRef.current,
        });
      }
    };

    void hydrateListeningGoal();

    return () => {
      isActive = false;
    };
  }, [authResolved, authUserId, setListeningGoal]);

  useEffect(() => {
    playbackListRef.current = playbackList;
  }, [playbackList]);

  useEffect(() => {
    failedVideoIdsRef.current.clear();
  }, [playbackList]);

  useEffect(() => {
    console.info("[YouTube Player] Queue restore result", {
      connectionStatus,
      youtubeConnected,
      playerCanMount,
      playbackListCount: playbackList.length,
      firstVideoId: playbackList[0]?.id || "",
      selectedVideoId: selectedVideoId || "",
      resolvedVideoId: safeVideoId || "",
    });
  }, [connectionStatus, playbackList, playerCanMount, safeVideoId, selectedVideoId, youtubeConnected]);

  useEffect(() => {
    selectedVideoIdRef.current = safeVideoId;
  }, [safeVideoId]);

  useEffect(() => {
    currentQueueIndexRef.current = queueIndex;
  }, [queueIndex]);

  const resolvedVideoSource = useMemo(() => {
    if (selectedVideo?.id && selectedVideo?.id === selectedVideoId) {
      return "selected-video-state";
    }

    if (selectedVideo?.id && selectedVideoId && selectedVideo.id !== selectedVideoId) {
      return "active-feed-fallback";
    }

    if (selectedVideo?.id) {
      return "selected-video-fallback";
    }

    if (selectedVideoId) {
      return "raw-selected-video-id";
    }

    return "default-video-id";
  }, [selectedVideo?.id, selectedVideoId]);

  useEffect(() => {
    selectedChannelIdRef.current = selectedVideo?.channelId || null;
  }, [selectedVideo?.channelId]);

  useEffect(() => {
    playbackResumeRef.current = {
      videoId: playbackResumeVideoId,
      currentTime: playbackResumeTime,
    };
  }, [playbackResumeTime, playbackResumeVideoId]);

  useEffect(() => {
    console.info("[YouTube Player] Current video selection", {
      connectionStatus,
      playerCanMount,
      youtubeConnected,
      selectedVideoId: selectedVideoId || "",
      resolvedVideoId: safeVideoId || "",
      selectedVideoSource: resolvedVideoSource,
      selectedVideoTitle: selectedVideo?.title || "",
      playbackVideoId: playbackState?.selectedVideoId || "",
      playbackListCount: playbackList.length,
    });
  }, [
    connectionStatus,
    playerCanMount,
    playbackList.length,
    playbackState?.selectedVideoId,
    resolvedVideoSource,
    safeVideoId,
    selectedVideo?.title,
    selectedVideoId,
    youtubeConnected,
  ]);

  const releaseWakeLock = useCallback(async () => {
    const sentinel = wakeLockRef.current;
    if (!sentinel) {
      return;
    }

    wakeLockRef.current = null;

    try {
      await sentinel.release();
    } catch (error) {
      console.info("[Wake Lock] Failed to release screen wake lock", {
        errorMessage: error?.message || String(error || ""),
      });
    }
  }, []);

  const requestWakeLock = useCallback(async () => {
    if (
      typeof navigator === "undefined" ||
      typeof document === "undefined" ||
      !isMobile ||
      document.visibilityState !== "visible" ||
      !navigator.wakeLock?.request
    ) {
      return;
    }

    if (wakeLockRef.current) {
      return;
    }

    try {
      const sentinel = await navigator.wakeLock.request("screen");
      wakeLockRef.current = sentinel;
      sentinel.addEventListener("release", () => {
        if (wakeLockRef.current === sentinel) {
          wakeLockRef.current = null;
        }
      });
    } catch (error) {
      console.info("[Wake Lock] Screen wake lock unavailable", {
        errorMessage: error?.message || String(error || ""),
      });
    }
  }, [isMobile]);

  const getPlayerCurrentTime = useCallback(() => {
    const player = playerRef.current;
    if (!player || !playerReadyRef.current || typeof player.getCurrentTime !== "function") {
      return 0;
    }

    return player.getCurrentTime() || 0;
  }, []);

  const syncYoutubeVideoProgress = useCallback(() => {
    const player = playerRef.current;
    if (
      !player ||
      !playerReadyRef.current ||
      typeof player.getCurrentTime !== "function" ||
      typeof player.getDuration !== "function"
    ) {
      setYoutubeVideoProgressSafely(0);
      return 0;
    }

    const duration = Math.max(0, Number(player.getDuration() || 0));
    if (!duration) {
      setYoutubeVideoProgressSafely(0);
      return 0;
    }

    const currentTime = Math.max(0, Number(player.getCurrentTime() || 0));
    const progressRatio = Math.max(0, Math.min(1, currentTime / duration));
    setYoutubeVideoProgressSafely(progressRatio);
    return progressRatio;
  }, [setYoutubeVideoProgressSafely]);

  useEffect(() => {
    if (!isYoutubeMode || !playerCanMount) {
      setYoutubeVideoProgressSafely(0);
      return undefined;
    }

    syncYoutubeVideoProgress();

    const progressTimer = window.setInterval(
      syncYoutubeVideoProgress,
      isPlayerPlaying ? 200 : 500,
    );

    return () => {
      window.clearInterval(progressTimer);
    };
  }, [
    isPlayerPlaying,
    isYoutubeMode,
    playerCanMount,
    safeVideoId,
    setYoutubeVideoProgressSafely,
    syncYoutubeVideoProgress,
  ]);

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
    [getPlayerCurrentTime, isPlayerCurrentlyPlaying, safeVideoId],
  );

  const applyPlaybackSnapshot = useCallback(
    (snapshot) => {
      const player = playerRef.current;
      if (!player || !snapshot?.videoId || !playerReadyRef.current) return;
      playbackIntentRef.current = Boolean(snapshot.shouldPlay);

      const payload = {
        videoId: snapshot.videoId,
        startSeconds: Math.max(0, snapshot.currentTime || 0),
      };

      console.info("[YouTube Player] Applying playback snapshot", {
        videoId: payload.videoId,
        startSeconds: payload.startSeconds,
        shouldPlay: Boolean(snapshot.shouldPlay),
        selectedVideoSource: resolvedVideoSource,
      });

      setPlaybackState({
        videoId: snapshot.videoId,
        currentTime: payload.startSeconds,
        duration:
          typeof player.getDuration === "function" ? Number(player.getDuration() || 0) : 0,
        isPlaying: Boolean(snapshot.shouldPlay),
        playbackStatus: snapshot.shouldPlay ? "playing" : "paused",
      });

      if (playerVideoIdRef.current === snapshot.videoId) {
        const currentTime = getPlayerCurrentTime();
        if (Math.abs(currentTime - payload.startSeconds) > 1.5) {
          player.seekTo?.(payload.startSeconds, true);
        }

        if (snapshot.shouldPlay) {
          player.playVideo?.();
        } else {
          player.pauseVideo?.();
        }

        return;
      }

      playerVideoIdRef.current = snapshot.videoId;

      if (snapshot.shouldPlay && typeof player.loadVideoById === "function") {
        player.loadVideoById(payload);
        window.setTimeout(() => {
          if (
            playbackIntentRef.current &&
            playerRef.current === player &&
            typeof player.playVideo === "function"
          ) {
            player.playVideo();
          }
        }, 150);
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
    [getPlayerCurrentTime, resolvedVideoSource, setPlaybackState],
  );

  const syncPlaybackSession = useCallback(
    ({ isPlaying, playerPlaying = null }) => {
      if (typeof playerPlaying === "boolean") {
        setIsPlayerPlaying((currentValue) =>
          currentValue === playerPlaying ? currentValue : playerPlaying,
        );
      }

      if (isPlaying) {
        setStopwatchRunning((currentValue) => (currentValue ? currentValue : true));
        return;
      }

      setStopwatchRunning((currentValue) => (currentValue ? false : currentValue));
    },
    [],
  );

  const buildPlaybackPayload = useCallback(
    ({ videoId, currentTime, shouldPlay } = {}) => {
      const player = playerRef.current;
      const resolvedVideoId = videoId || safeVideoId || DEFAULT_VIDEO_ID;
      const resolvedCurrentTime = Math.max(
        0,
        Number((currentTime ?? getPlayerCurrentTime()) || 0),
      );
      const resolvedDuration =
        player && playerReadyRef.current && typeof player.getDuration === "function"
          ? Math.max(0, Number(player.getDuration() || 0))
          : 0;
      const resolvedIsPlaying = shouldPlay ?? isPlayerCurrentlyPlaying();
      const playerStateCode =
        player && playerReadyRef.current && typeof player.getPlayerState === "function"
          ? player.getPlayerState()
          : null;

      return {
        videoId: resolvedVideoId,
        currentTime: resolvedCurrentTime,
        duration: resolvedDuration,
        isPlaying: Boolean(resolvedIsPlaying),
        playbackStatus: typeof playerStateCode === "number" ? String(playerStateCode) : "unknown",
      };
    },
    [getPlayerCurrentTime, isPlayerCurrentlyPlaying, safeVideoId],
  );

  const persistCurrentPlayerState = useCallback(() => {
    const snapshot = capturePlaybackSnapshot();
    setPlaybackState(buildPlaybackPayload(snapshot));
    return snapshot;
  }, [buildPlaybackPayload, capturePlaybackSnapshot, setPlaybackState]);

  const advanceYoutubeQueue = useCallback(
    ({
      triggerReason = "unknown",
      shouldPlay = isPlayerCurrentlyPlaying(),
      skipFailedVideos = false,
    } = {}) => {
      const currentPlaybackList = playbackListRef.current;
      const currentVideoId = selectedVideoIdRef.current || "";
      if (!currentPlaybackList.length) {
        console.warn("[YouTube Player] Queue transition skipped", {
          triggerReason,
          previousIndex: -1,
          nextIndex: -1,
          currentVideoId,
          nextVideoId: "",
          queueLength: 0,
          skipReason: "empty-queue",
        });
        return false;
      }

      const now = Date.now();
      const lastTransition = lastQueueTransitionRef.current;
      if (
        triggerReason === "natural-end" &&
        now - lastTransition.at < 1500 &&
        (lastTransition.fromVideoId === currentVideoId ||
          lastTransition.toVideoId === currentVideoId)
      ) {
        console.info("[YouTube Player] Duplicate queue transition ignored", {
          triggerReason,
          currentVideoId,
          lastTransition,
        });
        return false;
      }

      const foundIndex = currentPlaybackList.findIndex((video) => video.id === currentVideoId);
      const previousIndex = foundIndex >= 0 ? foundIndex : currentQueueIndexRef.current;
      let nextIndex = previousIndex + 1;

      if (skipFailedVideos) {
        while (
          nextIndex < currentPlaybackList.length &&
          failedVideoIdsRef.current.has(currentPlaybackList[nextIndex]?.id)
        ) {
          nextIndex += 1;
        }
      }

      const nextVideo = currentPlaybackList[nextIndex] || null;
      console.info("[YouTube Player] Queue transition", {
        triggerReason,
        previousIndex,
        nextIndex: nextVideo?.id ? nextIndex : -1,
        currentVideoId,
        nextVideoId: nextVideo?.id || "",
        queueLength: currentPlaybackList.length,
        skipFailedVideos,
      });

      if (!nextVideo?.id) {
        playbackIntentRef.current = false;
        return false;
      }

      // The selected video drives currentIndex everywhere else, so update the ref
      // immediately to keep player callbacks from advancing from stale state.
      selectedVideoIdRef.current = nextVideo.id;
      currentQueueIndexRef.current = nextIndex;
      lastQueueTransitionRef.current = {
        triggerReason,
        fromVideoId: currentVideoId,
        toVideoId: nextVideo.id,
        at: now,
      };
      pendingSelectionPlaybackRef.current = { shouldPlay };
      setSelectedVideoId(nextVideo.id);
      return true;
    },
    [isPlayerCurrentlyPlaying, setSelectedVideoId],
  );

  useEffect(() => {
    const previousWorkspaceSource = previousWorkspaceSourceRef.current;
    previousWorkspaceSourceRef.current = workspaceSource;

    if (previousWorkspaceSource === workspaceSource) {
      return;
    }

    if (previousWorkspaceSource === "youtube" && workspaceSource !== "youtube") {
      const snapshot = {
        videoId: selectedVideoIdRef.current || safeVideoId || DEFAULT_VIDEO_ID,
        currentTime: getPlayerCurrentTime(),
        shouldPlay: isPlayerCurrentlyPlaying(),
        queueVideoIds: playbackListRef.current.map((video) => video.id),
        capturedAt: Date.now(),
      };

      pendingRestoreRef.current = snapshot;
      writeYoutubeWorkspaceResumeSnapshot(snapshot);
      console.info("[YouTube Player] Saved workspace resume snapshot", snapshot);
      return;
    }

    if (previousWorkspaceSource !== "youtube" && workspaceSource === "youtube") {
      const resumeSnapshot = pendingRestoreRef.current || readYoutubeWorkspaceResumeSnapshot();
      if (!resumeSnapshot?.videoId) {
        return;
      }

      const hasMatchingVideo = playbackListRef.current.some(
        (video) => video.id === resumeSnapshot.videoId,
      );

      console.info("[YouTube Player] Restoring workspace resume snapshot", {
        videoId: resumeSnapshot.videoId,
        currentTime: resumeSnapshot.currentTime || 0,
        hasMatchingVideo,
        queueLength: playbackListRef.current.length,
      });

      if (hasMatchingVideo) {
        pendingRestoreRef.current = {
          videoId: resumeSnapshot.videoId,
          currentTime: Math.max(0, Number(resumeSnapshot.currentTime || 0)),
          shouldPlay: false,
        };
        pendingSelectionPlaybackRef.current = { shouldPlay: false };
        setSelectedVideoId(resumeSnapshot.videoId);
        setPlaybackState({
          videoId: resumeSnapshot.videoId,
          currentTime: Math.max(0, Number(resumeSnapshot.currentTime || 0)),
          duration: playbackState?.duration || 0,
          isPlaying: false,
          playbackStatus: "paused",
        });
      }
    }
  }, [
    getPlayerCurrentTime,
    isPlayerCurrentlyPlaying,
    playbackState?.duration,
    safeVideoId,
    setPlaybackState,
    setSelectedVideoId,
    workspaceSource,
  ]);

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
    [isPlayerCurrentlyPlaying, setSelectedVideoId],
  );

  const selectDiscoverVideo = useCallback(
    (videoId) => {
      pendingSelectionPlaybackRef.current = {
        shouldPlay: false,
      };
      setSelectedVideoId(videoId);
    },
    [setSelectedVideoId],
  );

  const openSelectedDiscoverChannel = useCallback(() => {
    if (typeof window === "undefined" || !selectedDiscoverVideo?.channelId) return;

    window.open(
      `https://www.youtube.com/channel/${selectedDiscoverVideo.channelId}`,
      "_blank",
      "noopener,noreferrer",
    );
  }, [selectedDiscoverVideo]);

  useEffect(() => {
    if (!focusMode) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [focusMode]);

  useEffect(() => {
    const shouldKeepScreenAwake = isMobile && isYoutubeMode && isPlayerPlaying;

    if (!shouldKeepScreenAwake) {
      void releaseWakeLock();
      return undefined;
    }

    void requestWakeLock();

    return () => {
      void releaseWakeLock();
    };
  }, [isMobile, isPlayerPlaying, isYoutubeMode, releaseWakeLock, requestWakeLock]);

  useEffect(() => {
    if (typeof document === "undefined" || !isMobile) {
      return undefined;
    }

    const handleWakeLockVisibility = () => {
      if (document.visibilityState === "visible") {
        if (isYoutubeMode && isPlayerPlaying) {
          void requestWakeLock();
        }
        return;
      }

      void releaseWakeLock();
    };

    document.addEventListener("visibilitychange", handleWakeLockVisibility);
    return () => document.removeEventListener("visibilitychange", handleWakeLockVisibility);
  }, [isMobile, isPlayerPlaying, isYoutubeMode, releaseWakeLock, requestWakeLock]);

  useEffect(
    () => () => {
      void releaseWakeLock();
    },
    [releaseWakeLock],
  );

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
    const wasFocusMode = previousFocusModeRef.current;
    previousFocusModeRef.current = focusMode;

    if (!isMobile || !isYoutubeMode || !wasFocusMode || focusMode) {
      return;
    }

    const shouldResumePlayback = isPlayerPlaying || playbackIntentRef.current;
    const resyncTimer = window.setTimeout(() => {
      const player = playerRef.current;
      if (!player || !playerReadyRef.current) {
        syncPlaybackSession({
          isPlaying: false,
          playerPlaying: false,
        });
        return;
      }

      const actualPlaying = isPlayerCurrentlyPlaying();
      if (shouldResumePlayback && !actualPlaying && typeof player.playVideo === "function") {
        playbackIntentRef.current = true;
        player.playVideo();

        window.setTimeout(() => {
          const resumed = isPlayerCurrentlyPlaying();
          syncPlaybackSession({
            isPlaying: resumed,
            playerPlaying: resumed,
          });
        }, 180);
        return;
      }

      syncPlaybackSession({
        isPlaying: actualPlaying,
        playerPlaying: actualPlaying,
      });
    }, 120);

    return () => window.clearTimeout(resyncTimer);
  }, [
    focusMode,
    isMobile,
    isPlayerCurrentlyPlaying,
    isPlayerPlaying,
    isYoutubeMode,
    syncPlaybackSession,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handlePersist = () => {
      persistCurrentPlayerState();
    };

    window.addEventListener("beforeunload", handlePersist);

    const handlePageHide = () => {
      persistCurrentPlayerState();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        persistCurrentPlayerState();
        return;
      }

      if (isYoutubeMode && isPlayerCurrentlyPlaying()) {
        syncPlaybackSession({
          isPlaying: true,
          playerPlaying: true,
        });
      }
    };

    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handlePersist);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    isPlayerCurrentlyPlaying,
    isYoutubeMode,
    persistCurrentPlayerState,
    syncPlaybackSession,
  ]);

  useEffect(() => {
    if (!isYoutubeMode) {
      if (playerRef.current) {
        pendingRestoreRef.current = persistCurrentPlayerState();
        playerRef.current.pauseVideo?.();
        playerRef.current.destroy?.();
        playerRef.current = null;
        playerVideoIdRef.current = "";
        initRef.current = false;
        playerReadyRef.current = false;
        activePlayerHostRef.current = null;
      }

      return undefined;
    }

    if (!playerCanMount) {
      console.info("[YouTube Player] Skipping mount until a playable video is ready", {
        connectionStatus,
        youtubeConnected,
        playbackListCount: playbackList.length,
        selectedVideoId: selectedVideoId || "",
        resolvedVideoId: safeVideoId || "",
      });

      if (playerRef.current) {
        playerRef.current.pauseVideo?.();
        playerRef.current.destroy?.();
        playerRef.current = null;
        playerVideoIdRef.current = "";
        playerReadyRef.current = false;
        initRef.current = false;
        activePlayerHostRef.current = null;
      }
      pendingRestoreRef.current = null;

      return undefined;
    }

    const activeHost = isMobile
      ? playerHostRef.current
      : focusMode
      ? focusPlayerHostRef.current
      : playerHostRef.current;

    if (playerRef.current && activeHost !== activePlayerHostRef.current) {
      pendingRestoreRef.current = persistCurrentPlayerState();
      playerRef.current.destroy?.();
      playerRef.current = null;
      playerVideoIdRef.current = "";
      initRef.current = false;
      playerReadyRef.current = false;
      activePlayerHostRef.current = null;
    }

    const syncVideoProgress = (videoId = selectedVideoIdRef.current || DEFAULT_VIDEO_ID) => {
      const player = playerRef.current;
      const playerStateCode =
        player && playerReadyRef.current && typeof player.getPlayerState === "function"
          ? player.getPlayerState()
          : null;

      setPlaybackState({
        videoId,
        currentTime: getPlayerCurrentTime(),
        duration:
          player && playerReadyRef.current && typeof player.getDuration === "function"
            ? Number(player.getDuration() || 0)
            : 0,
        isPlaying: isPlayerCurrentlyPlaying(),
        playbackStatus: typeof playerStateCode === "number" ? String(playerStateCode) : "unknown",
      });
      syncYoutubeVideoProgress();
    };

    const goNextVideo = ({ triggerReason, skipFailedVideos = false } = {}) => {
      const advanced = advanceYoutubeQueue({
        triggerReason,
        shouldPlay: true,
        skipFailedVideos,
      });

      if (!advanced && skipFailedVideos) {
        console.warn("[YouTube Player] No playable fallback video remains in the queue", {
          triggerReason,
          failedVideoCount: failedVideoIdsRef.current.size,
          playbackListCount: playbackListRef.current.length,
          lastFailedVideoId: selectedVideoIdRef.current || "",
        });
      }
    };

    const onPlayerState = (event) => {
      const currentPlayerState = event?.data;
      const YTRef = window.YT?.PlayerState;

      if (!YTRef) return;

      console.info("[YouTube Player] State change", {
        playerState: currentPlayerState,
        videoId: selectedVideoIdRef.current || "",
        playbackIntent: playbackIntentRef.current,
      });

      if (currentPlayerState === YTRef.PLAYING) {
        failedVideoIdsRef.current.delete(selectedVideoIdRef.current || "");
        playbackIntentRef.current = false;
        syncPlaybackSession({
          isPlaying: true,
          playerPlaying: true,
        });
      }

      if (currentPlayerState === YTRef.PAUSED) {
        playbackIntentRef.current = false;
        syncPlaybackSession({
          isPlaying: false,
          playerPlaying: false,
        });
        syncVideoProgress();
      }

      if (currentPlayerState === YTRef.CUED || currentPlayerState === YTRef.UNSTARTED) {
        if (playbackIntentRef.current) {
          window.setTimeout(() => {
            if (
              playbackIntentRef.current &&
              playerRef.current &&
              playerReadyRef.current &&
              typeof playerRef.current.playVideo === "function"
            ) {
              playerRef.current.playVideo();
            }
          }, 120);
          return;
        }

        syncPlaybackSession({
          isPlaying: false,
          playerPlaying: false,
        });
        syncVideoProgress();
      }

      if (currentPlayerState === YTRef.ENDED) {
        syncPlaybackSession({
          isPlaying: false,
          playerPlaying: false,
        });
        syncVideoProgress();
        goNextVideo({ triggerReason: "natural-end" });
      }
    };

    const onPlayerError = (event) => {
      const errorCode = Number(event?.data || 0);
      const failedVideoId = selectedVideoIdRef.current || "";
      failedVideoIdsRef.current.add(failedVideoId);

      playbackIntentRef.current = false;
      console.warn("[YouTube Player] Player error", {
        errorCode,
        videoId: failedVideoId,
        selectedVideoSource: resolvedVideoSource,
        playbackListCount: playbackListRef.current.length,
        fromRestoredPlaybackState:
          Boolean(playbackState?.selectedVideoId) &&
          playbackState.selectedVideoId === failedVideoId,
      });

      if ([2, 5, 100, 101, 150].includes(errorCode) && playbackListRef.current.length > 1) {
        goNextVideo({ triggerReason: `player-error-${errorCode}`, skipFailedVideos: true });
      }
    };

    const onPlayerReady = () => {
      playerReadyRef.current = true;

      const resumeState = playbackResumeRef.current;
      const nextSnapshot = pendingRestoreRef.current || {
        videoId: selectedVideoIdRef.current || DEFAULT_VIDEO_ID,
        currentTime:
          resumeState.videoId === (selectedVideoIdRef.current || DEFAULT_VIDEO_ID)
            ? resumeState.currentTime || 0
            : 0,
        shouldPlay: false,
      };

      console.info("[YouTube Player] Ready", {
        videoId: selectedVideoIdRef.current || "",
        resumeVideoId: resumeState.videoId || "",
        pendingRestoreVideoId: pendingRestoreRef.current?.videoId || "",
        selectedVideoSource: resolvedVideoSource,
      });
      pendingRestoreRef.current = null;
      applyPlaybackSnapshot(nextSnapshot);
      queueMicrotask(() => {
        syncYoutubeVideoProgress();
      });
    };

    const mountPlayer = () => {
      const host = isMobile
        ? playerHostRef.current
        : focusMode
        ? focusPlayerHostRef.current
        : playerHostRef.current;
      if (initRef.current || !window.YT?.Player || !host) return;
      const playerOrigin = window.location.origin;

      if (playerRef.current) {
        playerRef.current.destroy?.();
        playerRef.current = null;
        playerVideoIdRef.current = "";
        playerReadyRef.current = false;
        activePlayerHostRef.current = null;
      }

      playerRef.current = new window.YT.Player(host, {
        videoId: selectedVideoIdRef.current || DEFAULT_VIDEO_ID,
        playerVars: {
          controls: 1,
          rel: 0,
          playsinline: 1,
          origin: playerOrigin,
        },
        events: {
          onReady: onPlayerReady,
          onError: onPlayerError,
          onStateChange: onPlayerState,
        },
      });

      console.info("[YouTube Player] Mounting iframe player", {
        videoId: selectedVideoIdRef.current || DEFAULT_VIDEO_ID,
        connectionStatus,
        selectedVideoSource: resolvedVideoSource,
      });

      initRef.current = true;
      activePlayerHostRef.current = host;
    };

    const mountWhenReady = () => {
      const host = isMobile
        ? playerHostRef.current
        : focusMode
        ? focusPlayerHostRef.current
        : playerHostRef.current;
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

    const existingScript = document.querySelector(`script[src='${YOUTUBE_IFRAME_API_SRC}']`);

    if (!existingScript) {
      const tag = document.createElement("script");
      tag.src = YOUTUBE_IFRAME_API_SRC;
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
    advanceYoutubeQueue,
    applyPlaybackSnapshot,
    connectionStatus,
    focusMode,
    getPlayerCurrentTime,
    isMobile,
    isPlayerCurrentlyPlaying,
    isYoutubeMode,
    playerCanMount,
    playbackList.length,
    persistCurrentPlayerState,
    playbackState?.selectedVideoId,
    resolvedVideoSource,
    safeVideoId,
    selectedVideo?.id,
    selectedVideoId,
    setPlaybackState,
    syncPlaybackSession,
    syncYoutubeVideoProgress,
    youtubeConnected,
  ]);

  useEffect(() => {
    if (!isYoutubeMode) {
      return;
    }

    if (!safeVideoId) return;

    const resumeState = playbackResumeRef.current;
    const resumeAt = resumeState.videoId === safeVideoId ? resumeState.currentTime : 0;

    if (resumeState.videoId !== safeVideoId) {
      setPlaybackState({
        videoId: safeVideoId,
        currentTime: resumeAt,
        duration: 0,
        isPlaying: false,
        playbackStatus: "cued",
      });
    }

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
    isYoutubeMode,
    safeVideoId,
    setPlaybackState,
  ]);

  useEffect(() => {
    if (!stopwatchRunning) return;

    const timer = setInterval(() => {
      setStopwatchSeconds((seconds) => roundToTenth(seconds + 0.1));
    }, 100);

    return () => clearInterval(timer);
  }, [roundToTenth, stopwatchRunning]);

  useEffect(() => {
    if (!isMounted) return;
    window.localStorage.setItem(LISTENING_GOAL_SETTINGS_STORAGE_KEY, String(settingsOpen));
  }, [isMounted, settingsOpen]);

  useEffect(() => {
    if (!isMounted) return;
    window.localStorage.setItem(LISTENING_SOURCE_STORAGE_KEY, workspaceSource);
  }, [isMounted, workspaceSource]);

  useEffect(() => {
    if (audiobookLaunchRequest && workspaceSource !== "audiobooks") {
      setWorkspaceSource("audiobooks");
    }
  }, [audiobookLaunchRequest, setWorkspaceSource, workspaceSource]);

  useEffect(() => {
    if (workspaceSource === "audiobooks" && focusMode) {
      setFocusMode(false);
    }
  }, [focusMode, workspaceSource]);

  useEffect(() => {
    if (clockMode !== "timer" || !timerRunning) return;

    const timer = setInterval(() => {
      setTimerSeconds((seconds) => {
        if (seconds <= 0.1) {
          setTimerRunning(false);
          return 0;
        }
        return roundToTenth(seconds - 0.1);
      });
    }, 100);

    return () => clearInterval(timer);
  }, [clockMode, roundToTenth, timerRunning]);

  const handleBankStopwatchTime = useCallback(() => {
    if (!stopwatchSeconds) return;

    const bankedHours = stopwatchSeconds / 3600;

    // BANK is the only persistence path for listening totals in this screen.
    adjustListeningHours(bankedHours, {
      kind: "session",
      source: "stopwatch-bank",
    });
    setStopwatchSeconds(0);
  }, [adjustListeningHours, stopwatchSeconds]);

  const toggleTimerStart = () => {
    if (clockMode === "stopwatch") {
      setStopwatchRunning((running) => !running);
    } else {
      setTimerRunning((running) => !running);
    }
  };

  const skipCurrentVideo = () => {
    advanceYoutubeQueue({
      triggerReason: "manual-skip",
      shouldPlay: isPlayerCurrentlyPlaying(),
    });
  };

  const totalBlocks = Math.max(12, Math.ceil(Math.max(listeningGoal, listeningHours) / 10));
  const listeningProgress = Math.min(100, (listeningHours / Math.max(1, listeningGoal)) * 100);

  const handleAudiobookPlaybackStateChange = useCallback(
    ({
      isPlaying,
      book,
      currentTime = 0,
      durationSeconds = 0,
      playbackState: nextPlaybackState = "idle",
      isPlayerOpen = false,
      isPlayerMinimized = false,
    }) => {
      const nextSnapshot = {
        bookId: book?.id || null,
        isPlaying: Boolean(isPlaying),
        currentTime: Math.round(Math.max(0, Number(currentTime || 0)) * 10) / 10,
        durationSeconds: Math.round(Math.max(0, Number(durationSeconds || 0)) * 10) / 10,
        isPlayerOpen: Boolean(isPlayerOpen),
        isPlayerMinimized: Boolean(isPlayerMinimized),
      };
      const previousSnapshot = audiobookPlaybackSnapshotRef.current;

      if (
        previousSnapshot.bookId === nextSnapshot.bookId &&
        previousSnapshot.isPlaying === nextSnapshot.isPlaying &&
        Math.abs(previousSnapshot.currentTime - nextSnapshot.currentTime) < 0.1 &&
        Math.abs(previousSnapshot.durationSeconds - nextSnapshot.durationSeconds) < 0.1 &&
        previousSnapshot.isPlayerOpen === nextSnapshot.isPlayerOpen &&
        previousSnapshot.isPlayerMinimized === nextSnapshot.isPlayerMinimized
      ) {
        return;
      }

      audiobookPlaybackSnapshotRef.current = nextSnapshot;
      syncPlaybackSession({ isPlaying });
      onAudiobookPlaybackStateChange?.({
        ...nextSnapshot,
        book,
        playbackState: nextPlaybackState,
      });
    },
    [onAudiobookPlaybackStateChange, syncPlaybackSession],
  );

  return (
    <div
      style={{
        ...styles.listeningMainGrid,
        gridTemplateColumns: isMobile ? "1fr" : "1.6fr 1fr",
        minWidth: 0,
      }}
    >
      <ListeningWorkspace
        styles={styles}
        isMobile={isMobile}
        isCompact={isCompact}
        workspaceSource={workspaceSource}
        setWorkspaceSource={setWorkspaceSource}
        authUserId={authUserId}
        onAudiobookPlaybackStateChange={handleAudiobookPlaybackStateChange}
        focusMode={focusMode}
        setFocusMode={setFocusMode}
        youtubeConnected={youtubeConnected}
        youtubeStatusMessage={youtubeStatusMessage}
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
        youtubeVideoProgress={youtubeVideoProgress}
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
        audiobooksData={audiobooksData}
        audiobooksLoading={audiobooksLoading}
        audiobooksError={audiobooksError}
        audiobookLaunchRequest={audiobookLaunchRequest}
        onAudiobookLaunchResult={onAudiobookLaunchResult}
      />

      {isMobile ? (
        <div style={{ ...styles.sideColumn, minWidth: 0 }}>
          <TimerStopwatch
            styles={styles}
            clockMode={clockMode}
            stopwatchSeconds={stopwatchSeconds}
            stopwatchRunning={stopwatchRunning}
            timerSeconds={timerSeconds}
            timerDurationSeconds={timerDurationSeconds}
            timerRunning={timerRunning}
            toggleTimerStart={toggleTimerStart}
            bankStopwatch={handleBankStopwatchTime}
            setClockMode={setClockMode}
            setStopwatchRunning={setStopwatchRunning}
            setStopwatchSeconds={setStopwatchSeconds}
            setTimerRunning={setTimerRunning}
            setTimerSeconds={setTimerSeconds}
            setTimerDurationSeconds={setTimerDurationSeconds}
            liveSessionDisplay={formatClock(Math.floor(stopwatchSeconds))}
            variant="mobileCondensed"
          />

          <ListeningVisualization
            styles={styles}
            isMobile={isMobile}
            isCompact={isCompact}
            listeningHours={listeningHours}
            listeningGoal={listeningGoal}
            setListeningGoal={setListeningGoal}
            showVisualization={showVisualization}
            vizMode={vizMode}
            setVizMode={setVizMode}
            settingsOpen={settingsOpen}
            setSettingsOpen={setSettingsOpen}
            totalBlocks={totalBlocks}
            listeningProgress={listeningProgress}
            variant="mobileCondensed"
          />
        </div>
      ) : (
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
            bankStopwatch={handleBankStopwatchTime}
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
            isMobile={isMobile}
            isCompact={isCompact}
            listeningHours={listeningHours}
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
      )}
    </div>
  );
}

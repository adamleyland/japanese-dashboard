"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ListeningWorkspace from "@/components/features/listening/ListeningWorkspace";
import TimerStopwatch from "@/components/features/listening/TimerStopwatch";
import ListeningVisualization from "@/components/features/listening/ListeningVisualization";
import { useYoutubeSession } from "@/hooks/useYoutubeSession";
import { DEFAULT_VIDEO_ID } from "@/lib/youtubeDefaults";

const LISTENING_GOAL_STORAGE_KEY = "jp_listening_goal_hours";
const LISTENING_SOURCE_STORAGE_KEY = "jp_listening_workspace_source";
const LISTENING_GOAL_SETTINGS_STORAGE_KEY = "jp_listening_goal_settings_open";
const YOUTUBE_WORKSPACE_RESUME_STORAGE_KEY = "jp_youtube_workspace_resume_v1";
const YOUTUBE_IFRAME_API_SRC = "https://www.youtube.com/iframe_api";
const LISTENING_PROGRESS_FLUSH_INTERVAL_MS = 30 * 1000;

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
  audiobooksData,
  audiobooksLoading,
  audiobooksError,
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
  const [listeningGoal, setListeningGoal] = useState(1200);
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
  const sessionRef = useRef(0);
  const sessionCheckpointRef = useRef(0);
  const sessionMetaRef = useRef(null);
  const lastSessionMetaRef = useRef(null);
  const audiobookPlaybackSnapshotRef = useRef({
    bookId: null,
    isPlaying: false,
    currentTime: 0,
    durationSeconds: 0,
    isPlayerOpen: false,
  });
  const playerRef = useRef(null);
  const playerHostRef = useRef(null);
  const focusPlayerHostRef = useRef(null);
  const activePlayerHostRef = useRef(null);
  const playerVideoIdRef = useRef("");
  const initRef = useRef(false);
  const playerReadyRef = useRef(false);
  const pendingRestoreRef = useRef(null);
  const pendingSelectionPlaybackRef = useRef(null);
  const playbackIntentRef = useRef(false);
  const failedVideoIdsRef = useRef(new Set());
  const previousWorkspaceSourceRef = useRef(workspaceSource);
  const playbackListRef = useRef(playbackList);
  const selectedVideoIdRef = useRef(safeVideoId);
  const selectedChannelIdRef = useRef(selectedVideo?.channelId || null);
  const playbackResumeRef = useRef({
    videoId: playbackResumeVideoId,
    currentTime: playbackResumeTime,
  });

  const roundToTenth = useCallback((value) => Math.round(value * 10) / 10, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedListeningGoal = Number(window.localStorage.getItem(LISTENING_GOAL_STORAGE_KEY));
    const storedWorkspaceSource = window.localStorage.getItem(LISTENING_SOURCE_STORAGE_KEY);
    const storedSettingsOpen =
      window.localStorage.getItem(LISTENING_GOAL_SETTINGS_STORAGE_KEY) === "true";

    if (Number.isFinite(storedListeningGoal) && storedListeningGoal > 0) {
      setListeningGoal(storedListeningGoal);
    }

    if (storedWorkspaceSource === "audiobooks") {
      setWorkspaceSource("audiobooks");
    }

    setSettingsOpen(storedSettingsOpen);
    setIsMounted(true);
  }, []);

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

  const bankSession = useCallback(() => {
    if (!sessionRef.current) return;

    const sessionMeta = sessionMetaRef.current || lastSessionMetaRef.current || {};
    const checkpointStartedAt = sessionCheckpointRef.current || sessionRef.current;
    const gained = (Date.now() - checkpointStartedAt) / 3600000;
    if (gained > 0) {
      adjustListeningHours(gained, {
        kind: "session",
        ...sessionMeta,
      });
    }

    sessionCheckpointRef.current = Date.now();
  }, [adjustListeningHours]);

  const flushSessionProgress = useCallback(
    ({ finalize = false } = {}) => {
      if (!sessionRef.current) {
        return;
      }

      bankSession();

      if (!finalize) {
        return;
      }

      sessionRef.current = 0;
      sessionCheckpointRef.current = 0;
      sessionMetaRef.current = null;
    },
    [bankSession],
  );

  const buildCurrentYoutubeSessionMeta = useCallback(
    () => ({
      source: "youtube",
      sessionKey: `youtube:${selectedVideoIdRef.current || DEFAULT_VIDEO_ID}`,
      videoId: selectedVideoIdRef.current || DEFAULT_VIDEO_ID,
      channelId: selectedChannelIdRef.current,
    }),
    [],
  );

  const syncPlaybackSession = useCallback(
    ({ isPlaying, metadata = null, playerPlaying = null }) => {
      if (metadata) {
        lastSessionMetaRef.current = metadata;
      }

      if (typeof playerPlaying === "boolean") {
        setIsPlayerPlaying((currentValue) =>
          currentValue === playerPlaying ? currentValue : playerPlaying,
        );
      }

      if (isPlaying) {
        const nextSessionKey = metadata?.sessionKey || null;
        const currentSessionKey = sessionMetaRef.current?.sessionKey || null;

        if (
          sessionRef.current &&
          nextSessionKey &&
          currentSessionKey &&
          currentSessionKey !== nextSessionKey
        ) {
          flushSessionProgress({ finalize: true });
        }

        if (!sessionRef.current) {
          const sessionStartedAt = Date.now();
          sessionRef.current = sessionStartedAt;
          sessionCheckpointRef.current = sessionStartedAt;
        }

        if (!sessionCheckpointRef.current) {
          sessionCheckpointRef.current = Date.now();
        }

        sessionMetaRef.current = metadata || sessionMetaRef.current || lastSessionMetaRef.current;
        setStopwatchRunning((currentValue) => (currentValue ? currentValue : true));
        return;
      }

      sessionMetaRef.current = metadata || sessionMetaRef.current;
      setStopwatchRunning((currentValue) => (currentValue ? false : currentValue));
      flushSessionProgress({ finalize: true });
    },
    [flushSessionProgress],
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
    if (typeof window === "undefined") return undefined;

    const handlePersist = () => {
      flushSessionProgress({ finalize: true });
      persistCurrentPlayerState();
    };

    window.addEventListener("beforeunload", handlePersist);

    const handlePageHide = () => {
      flushSessionProgress({ finalize: true });
      persistCurrentPlayerState();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushSessionProgress({ finalize: true });
        persistCurrentPlayerState();
        return;
      }

      if (isYoutubeMode && isPlayerCurrentlyPlaying()) {
        syncPlaybackSession({
          isPlaying: true,
          playerPlaying: true,
          metadata: buildCurrentYoutubeSessionMeta(),
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
    buildCurrentYoutubeSessionMeta,
    flushSessionProgress,
    isPlayerCurrentlyPlaying,
    isYoutubeMode,
    persistCurrentPlayerState,
    syncPlaybackSession,
  ]);

  useEffect(() => {
    if (!stopwatchRunning) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      flushSessionProgress();
    }, LISTENING_PROGRESS_FLUSH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [flushSessionProgress, stopwatchRunning]);

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

    const activeHost = focusMode ? focusPlayerHostRef.current : playerHostRef.current;

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
    };

    const goNextVideo = () => {
      const currentPlaybackList = playbackListRef.current;
      const currentSelectedVideoId = selectedVideoIdRef.current;
      if (!currentPlaybackList.length) return;

      const next = currentPlaybackList.find(
        (video) =>
          video.id !== currentSelectedVideoId && !failedVideoIdsRef.current.has(video.id),
      );

      if (!next?.id) {
        playbackIntentRef.current = false;
        console.warn("[YouTube Player] No playable fallback video remains in the queue", {
          failedVideoCount: failedVideoIdsRef.current.size,
          playbackListCount: currentPlaybackList.length,
          lastFailedVideoId: currentSelectedVideoId || "",
        });
        return;
      }

      pendingSelectionPlaybackRef.current = { shouldPlay: true };
      setSelectedVideoId(next.id);
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
          metadata: buildCurrentYoutubeSessionMeta(),
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
        goNextVideo();
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
        goNextVideo();
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
    };

    const mountPlayer = () => {
      const host = focusMode ? focusPlayerHostRef.current : playerHostRef.current;
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
    applyPlaybackSnapshot,
    buildCurrentYoutubeSessionMeta,
    connectionStatus,
    focusMode,
    getPlayerCurrentTime,
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
    setSelectedVideoId,
    syncPlaybackSession,
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
    window.localStorage.setItem(LISTENING_GOAL_STORAGE_KEY, String(listeningGoal));
  }, [isMounted, listeningGoal]);

  useEffect(() => {
    if (!isMounted) return;
    window.localStorage.setItem(LISTENING_GOAL_SETTINGS_STORAGE_KEY, String(settingsOpen));
  }, [isMounted, settingsOpen]);

  useEffect(() => {
    if (!isMounted) return;
    window.localStorage.setItem(LISTENING_SOURCE_STORAGE_KEY, workspaceSource);
  }, [isMounted, workspaceSource]);

  useEffect(() => {
    if (workspaceSource === "audiobooks" && focusMode) {
      setFocusMode(false);
    }
  }, [focusMode, workspaceSource]);

  useEffect(() => {
    const activeSource = sessionMetaRef.current?.source;
    if (!activeSource || activeSource === workspaceSource) {
      return;
    }

    syncPlaybackSession({
      isPlaying: false,
      playerPlaying: activeSource === "youtube" ? false : null,
    });
  }, [syncPlaybackSession, workspaceSource]);

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

    flushSessionProgress({ finalize: true });

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

  const handleAudiobookPlaybackStateChange = useCallback(
    ({
      isPlaying,
      book,
      currentTime = 0,
      durationSeconds = 0,
      playbackState: nextPlaybackState = "idle",
      isPlayerOpen = false,
    }) => {
      const nextSnapshot = {
        bookId: book?.id || null,
        isPlaying: Boolean(isPlaying),
        currentTime: Math.round(Math.max(0, Number(currentTime || 0)) * 10) / 10,
        durationSeconds: Math.round(Math.max(0, Number(durationSeconds || 0)) * 10) / 10,
        isPlayerOpen: Boolean(isPlayerOpen),
      };
      const previousSnapshot = audiobookPlaybackSnapshotRef.current;

      if (
        previousSnapshot.bookId === nextSnapshot.bookId &&
        previousSnapshot.isPlaying === nextSnapshot.isPlaying &&
        Math.abs(previousSnapshot.currentTime - nextSnapshot.currentTime) < 0.1 &&
        Math.abs(previousSnapshot.durationSeconds - nextSnapshot.durationSeconds) < 0.1 &&
        previousSnapshot.isPlayerOpen === nextSnapshot.isPlayerOpen
      ) {
        return;
      }

      audiobookPlaybackSnapshotRef.current = nextSnapshot;
      if (book) {
        lastSessionMetaRef.current = {
          source: "audiobook",
          sessionKey: `audiobook:${book.id}`,
          audiobookId: book.id,
          title: book.title,
          author: book.author,
          durationSeconds,
          playbackState: nextPlaybackState,
        };
      }

      syncPlaybackSession({
        isPlaying,
        metadata: book
          ? {
              source: "audiobook",
              sessionKey: `audiobook:${book.id}`,
              audiobookId: book.id,
              title: book.title,
              author: book.author,
              durationSeconds,
              playbackState: nextPlaybackState,
            }
          : null,
      });
    },
    [syncPlaybackSession],
  );

  return (
    <div
      style={{
        ...styles.listeningMainGrid,
        gridTemplateColumns: isMobile ? "1fr" : "1.6fr 1fr",
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
          isMobile={isMobile}
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

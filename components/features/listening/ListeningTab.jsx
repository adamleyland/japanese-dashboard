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
const YOUTUBE_IFRAME_API_SRC = "https://www.youtube.com/iframe_api";

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
  const [listeningGoal, setListeningGoal] = useState(() => {
    if (typeof window === "undefined") {
      return 1200;
    }

    const storedValue = Number(window.localStorage.getItem(LISTENING_GOAL_STORAGE_KEY));
    return Number.isFinite(storedValue) && storedValue > 0 ? storedValue : 1200;
  });
  const [workspaceSource, setWorkspaceSource] = useState(() => {
    if (typeof window === "undefined") {
      return "youtube";
    }

    return window.localStorage.getItem(LISTENING_SOURCE_STORAGE_KEY) === "audiobooks"
      ? "audiobooks"
      : "youtube";
  });
  const [showVisualization] = useState(true);
  const [vizMode, setVizMode] = useState("bar");
  const [settingsOpen, setSettingsOpen] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem(LISTENING_GOAL_SETTINGS_STORAGE_KEY) === "true";
  });
  const [isMounted, setIsMounted] = useState(false);
  const isYoutubeMode = workspaceSource === "youtube";

  const safeVideoId = selectedVideoId || DEFAULT_VIDEO_ID;
  const playbackResumeVideoId = playbackState?.selectedVideoId || DEFAULT_VIDEO_ID;
  const playbackResumeTime = playbackState?.currentTime || 0;
  const sessionRef = useRef(0);
  const sessionMetaRef = useRef(null);
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
  const playbackListRef = useRef(playbackList);
  const selectedVideoIdRef = useRef(safeVideoId);
  const selectedChannelIdRef = useRef(selectedVideo?.channelId || null);
  const playbackResumeRef = useRef({
    videoId: playbackResumeVideoId,
    currentTime: playbackResumeTime,
  });

  const roundToTenth = useCallback((value) => Math.round(value * 10) / 10, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) {
      return;
    }
  }, [isMounted]);

  useEffect(() => {
    playbackListRef.current = playbackList;
  }, [playbackList]);

  useEffect(() => {
    selectedVideoIdRef.current = safeVideoId;
  }, [safeVideoId]);

  useEffect(() => {
    selectedChannelIdRef.current = selectedVideo?.channelId || null;
  }, [selectedVideo?.channelId]);

  useEffect(() => {
    playbackResumeRef.current = {
      videoId: playbackResumeVideoId,
      currentTime: playbackResumeTime,
    };
  }, [playbackResumeTime, playbackResumeVideoId]);

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
    [getPlayerCurrentTime, setPlaybackState],
  );

  const bankSession = useCallback(() => {
    if (!sessionRef.current) return;

    const sessionMeta = sessionMetaRef.current || {};
    const gained = (Date.now() - sessionRef.current) / 3600000;
    if (gained > 0) {
      adjustListeningHours(gained, {
        kind: "session",
        ...sessionMeta,
      });
    }

    sessionRef.current = 0;
    sessionMetaRef.current = null;
  }, [adjustListeningHours]);

  const syncPlaybackSession = useCallback(
    ({ isPlaying, metadata = null, playerPlaying = null }) => {
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
          bankSession();
        }

        if (!sessionRef.current) {
          sessionRef.current = Date.now();
        }

        sessionMetaRef.current = metadata;
        setStopwatchRunning((currentValue) => (currentValue ? currentValue : true));
        return;
      }

      sessionMetaRef.current = metadata;
      setStopwatchRunning((currentValue) => (currentValue ? false : currentValue));
      bankSession();
    },
    [bankSession],
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
      persistCurrentPlayerState();
    };

    window.addEventListener("beforeunload", handlePersist);

    return () => {
      window.removeEventListener("beforeunload", handlePersist);
    };
  }, [persistCurrentPlayerState]);

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

      const index = currentPlaybackList.findIndex((video) => video.id === currentSelectedVideoId);
      const next = currentPlaybackList[(index + 1) % currentPlaybackList.length];

      if (next?.id) {
        pendingSelectionPlaybackRef.current = { shouldPlay: true };
        setSelectedVideoId(next.id);
      }
    };

    const onPlayerState = (event) => {
      const currentPlayerState = event?.data;
      const YTRef = window.YT?.PlayerState;

      if (!YTRef) return;

      if (currentPlayerState === YTRef.PLAYING) {
        playbackIntentRef.current = false;
        syncPlaybackSession({
          isPlaying: true,
          playerPlaying: true,
          metadata: {
            source: "youtube",
            sessionKey: `youtube:${selectedVideoIdRef.current || DEFAULT_VIDEO_ID}`,
            videoId: selectedVideoIdRef.current || DEFAULT_VIDEO_ID,
            channelId: selectedChannelIdRef.current,
          },
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
    bankSession,
    focusMode,
    getPlayerCurrentTime,
    isPlayerCurrentlyPlaying,
    isYoutubeMode,
    persistCurrentPlayerState,
    setPlaybackState,
    setSelectedVideoId,
    syncPlaybackSession,
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

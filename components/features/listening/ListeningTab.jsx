"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Video,
  Link2,
  UserCircle2,
  PlayCircle,
  Maximize2,
  Minimize2,
  Save,
  SkipForward,
} from "lucide-react";
import ListeningWorkspace from "@/components/features/listening/ListeningWorkspace";
import TimerStopwatch from "@/components/features/listening/TimerStopwatch";
import ListeningVisualization from "@/components/features/listening/ListeningVisualization";

export default function ListeningTab({
  styles,
  listeningHours,
  setListeningHours,
  isMobile,
  isCompact,
  seededChannels,
  seededVideos,
  formatClock,
}) {
  const [youtubeConnected, setYoutubeConnected] = useState(false);
  const [subscribedChannels, setSubscribedChannels] = useState(seededChannels);
  const [videoFeed] = useState(seededVideos);
  const [selectedVideoId, setSelectedVideoId] = useState(seededVideos[0]?.id);
  const [workspaceTab, setWorkspaceTab] = useState("account");
  const [focusMode, setFocusMode] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const [clockMode, setClockMode] = useState("stopwatch");
  const [stopwatchSeconds, setStopwatchSeconds] = useState(0);
  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(300);
  const [timerRunning, setTimerRunning] = useState(false);

  const [listeningGoal, setListeningGoal] = useState(1200);
  const [showVisualization] = useState(true);
  const [vizMode, setVizMode] = useState("blocks");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const sessionRef = useRef(0);

  const playerRef = useRef(null);
  const playerHostRef = useRef(null);
  const initRef = useRef(false);

  const approvedChannelNames = useMemo(
    () => new Set(subscribedChannels.map((channel) => channel.name)),
    [subscribedChannels],
  );
  const approvedFeed = useMemo(
    () => videoFeed.filter((video) => approvedChannelNames.has(video.channel)),
    [videoFeed, approvedChannelNames],
  );

  const selectedVideo = useMemo(
    () => approvedFeed.find((video) => video.id === selectedVideoId) || approvedFeed[0],
    [approvedFeed, selectedVideoId],
  );
  const queueTotal = approvedFeed.length;
  const queueIndex = Math.max(0, approvedFeed.findIndex((item) => item.id === selectedVideo?.id));

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
    if (!playerHostRef.current || initRef.current) return;

    const syncVideoProgress = () => {
      const player = playerRef.current;
      if (!player || !selectedVideoId) return;
      if (typeof player.getCurrentTime !== "function") return;

      const currentTime = Math.floor(player.getCurrentTime() || 0);
      localStorage.setItem(
        "jp_dashboard_youtube_session",
        JSON.stringify({ selectedVideoId, currentTime, updatedAt: Date.now() }),
      );
    };

    const goNextVideo = () => {
      if (!approvedFeed.length || !selectedVideoId) return;
      const index = approvedFeed.findIndex((video) => video.id === selectedVideoId);
      const next = approvedFeed[(index + 1) % approvedFeed.length];
      if (next?.id) setSelectedVideoId(next.id);
    };

    const onPlayerState = (event) => {
      const state = event?.data;
      const YTRef = window.YT?.PlayerState;
      if (!YTRef) return;

      if (state === YTRef.PLAYING) {
        setStopwatchRunning(true);
        sessionRef.current = Date.now();
      }

      if (state === YTRef.PAUSED) {
        setStopwatchRunning(false);
        syncVideoProgress();
      }

      if (state === YTRef.ENDED) {
        setStopwatchRunning(false);
        if (sessionRef.current) {
          const gained = (Date.now() - sessionRef.current) / 3600000;
          if (gained > 0) setListeningHours((hours) => hours + gained);
          sessionRef.current = 0;
        }
        goNextVideo();
      }
    };

    const mountPlayer = () => {
      if (initRef.current || !window.YT?.Player || !playerHostRef.current) return;

      playerRef.current = new window.YT.Player(playerHostRef.current, {
        videoId: selectedVideoId,
        playerVars: {
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onStateChange: onPlayerState,
        },
      });

      initRef.current = true;
    };

    if (window.YT?.Player) {
      mountPlayer();
      return;
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
      mountPlayer();
    };

    return () => {
      window.onYouTubeIframeAPIReady = priorReady;
    };
  }, [approvedFeed, selectedVideoId, setListeningHours, focusMode]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !selectedVideoId) return;

    if (typeof player.loadVideoById === "function") {
      const stored =
        typeof window !== "undefined"
          ? JSON.parse(localStorage.getItem("jp_dashboard_youtube_session") || "null")
          : null;
      const resumeAt = stored?.selectedVideoId === selectedVideoId ? stored.currentTime : 0;
      player.loadVideoById({ videoId: selectedVideoId, startSeconds: resumeAt || 0 });
    }
  }, [selectedVideoId]);

  useEffect(() => {
    if (!stopwatchRunning) return;
    const timer = setInterval(() => setStopwatchSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [stopwatchRunning]);

  useEffect(() => {
    if (clockMode !== "timer" || !timerRunning) return;

    const timer = setInterval(() => {
      setTimerSeconds((seconds) => {
        if (seconds <= 1) {
          setListeningHours((hours) => hours + 300 / 3600);
          setTimerRunning(false);
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [clockMode, timerRunning, setListeningHours]);

  const bankStopwatch = () => {
    if (!stopwatchSeconds) return;
    const bankedHours = stopwatchSeconds / 3600;
    setListeningHours((hours) => hours + bankedHours);
    setStopwatchSeconds(0);
  };

  const liveSessionSeconds = clockMode === "timer" ? 300 - timerSeconds : stopwatchSeconds;

  const toggleTimerStart = () => {
    if (clockMode === "stopwatch") {
      setStopwatchRunning((running) => !running);
    } else {
      setTimerRunning((running) => !running);
    }
  };

  const skipCurrentVideo = () => {
    if (!approvedFeed.length || !selectedVideo?.id) return;
    const index = approvedFeed.findIndex((video) => video.id === selectedVideo.id);
    const next = approvedFeed[(index + 1) % approvedFeed.length];
    if (next?.id) setSelectedVideoId(next.id);
  };

  const saveCurrentSession = () => {
    const player = playerRef.current;
    const currentTime =
      player && typeof player.getCurrentTime === "function"
        ? Math.floor(player.getCurrentTime() || 0)
        : 0;

    localStorage.setItem(
      "jp_dashboard_youtube_session",
      JSON.stringify({
        selectedVideoId,
        currentTime,
        liveSessionSeconds,
        savedAt: Date.now(),
      }),
    );
  };

  const totalBlocks = Math.max(12, Math.ceil(Math.max(listeningGoal, listeningHours) / 10));
  const listeningProgress = Math.min(100, (listeningHours / Math.max(1, listeningGoal)) * 100);

  return (
    <>
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
          focusMode={focusMode}
          setFocusMode={setFocusMode}
          isMounted={isMounted}
          youtubeConnected={youtubeConnected}
          setYoutubeConnected={setYoutubeConnected}
          subscribedChannels={subscribedChannels}
          approvedFeed={approvedFeed}
          selectedVideo={selectedVideo}
          selectedVideoId={selectedVideoId}
          setSelectedVideoId={setSelectedVideoId}
          queueTotal={queueTotal}
          queueIndex={queueIndex}
          saveCurrentSession={saveCurrentSession}
          skipCurrentVideo={skipCurrentVideo}
          workspaceTab={workspaceTab}
          setWorkspaceTab={setWorkspaceTab}
          playerHostRef={playerHostRef}
          onToggleYoutubeConnection={() => {
            setYoutubeConnected((v) => !v);
            setSubscribedChannels([...seededChannels]);
          }}
        />

        <div style={styles.sideColumn}>
          <TimerStopwatch
            styles={styles}
            clockMode={clockMode}
            stopwatchSeconds={stopwatchSeconds}
            stopwatchRunning={stopwatchRunning}
            timerSeconds={timerSeconds}
            timerRunning={timerRunning}
            toggleTimerStart={toggleTimerStart}
            bankStopwatch={bankStopwatch}
            setClockMode={setClockMode}
            setStopwatchRunning={setStopwatchRunning}
            setStopwatchSeconds={setStopwatchSeconds}
            setTimerRunning={setTimerRunning}
            setTimerSeconds={setTimerSeconds}
            liveSessionDisplay={formatClock(clockMode === "timer" ? timerSeconds : stopwatchSeconds)
              .split(":")
              .slice(1)
              .join(":")}
          />

          <ListeningVisualization
            styles={styles}
            listeningHours={listeningHours}
            setListeningHours={setListeningHours}
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

      {isMounted &&
        focusMode &&
        createPortal(
          <div style={styles.focusOverlay}>
            <div style={styles.focusBackdrop} onClick={() => setFocusMode(false)} />

            <div style={styles.focusContent}>
              <div style={styles.playerShellFocus}>
                <div style={styles.playerFrameWrapFocus}>
                  <div ref={playerHostRef} style={styles.playerFrame} />
                  <button style={styles.focusModeBtn} onClick={() => setFocusMode(false)}>
                    <Minimize2 size={14} />
                  </button>
                </div>

                <div style={styles.playerControlRowFocus}>
                  <div style={styles.playerMeta}>
                    <h3 style={styles.playerTitleFocus}>{selectedVideo?.title}</h3>
                    <p style={styles.playerSub}>
                      {selectedVideo?.channel} · {selectedVideo?.duration} · Queue {queueIndex + 1}/
                      {queueTotal}
                    </p>
                  </div>

                  <div style={styles.playerControlRow}>
                    <button style={styles.miniActionButton("blue")} onClick={saveCurrentSession}>
                      <Save size={12} /> Save
                    </button>
                    <button style={styles.miniActionButton("orange")} onClick={skipCurrentVideo}>
                      <SkipForward size={12} /> Skip
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

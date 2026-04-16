"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const [youtubeAccessToken, setYoutubeAccessToken] = useState("");
  const [subscribedChannels, setSubscribedChannels] = useState(seededChannels);
  const [videoFeed] = useState(seededVideos);
  const [selectedVideoId, setSelectedVideoId] = useState("M7lc1UVf-VE");
  const DEFAULT_VIDEO_ID = "M7lc1UVf-VE";
  const AUTH_STORAGE_KEY = "jp_dashboard_youtube_auth";
  const safeVideoId = selectedVideoId || DEFAULT_VIDEO_ID;
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
  const focusPlayerHostRef = useRef(null);
  const activePlayerHostRef = useRef(null);
  const initRef = useRef(false);
  const playerReadyRef = useRef(false);

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

  const googleTokenClientRef = useRef(null);

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

    googleTokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      scope: "https://www.googleapis.com/auth/youtube.readonly",
      callback: (response) => {
        if (response?.access_token) {
          setYoutubeAccessToken(response.access_token);
          setYoutubeConnected(true);
          if (typeof window !== "undefined") {
            localStorage.setItem(
              AUTH_STORAGE_KEY,
              JSON.stringify({ youtubeAccessToken: response.access_token, youtubeConnected: true }),
            );
          }
        } else {
          console.error("Google OAuth did not return an access token", response);
        }
      },
    });

    return googleTokenClientRef.current;
  }, [setYoutubeAccessToken, setYoutubeConnected]);

  const connectYoutube = useCallback(async () => {
    if (typeof window === "undefined") return;

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
  }, [getGoogleTokenClient, loadGoogleIdentityScript]);

  const disconnectYoutube = useCallback(() => {
    if (typeof window !== "undefined" && youtubeAccessToken) {
      window.google?.accounts?.oauth2?.revoke?.(youtubeAccessToken, () => {});
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
    setYoutubeAccessToken("");
    setYoutubeConnected(false);
    googleTokenClientRef.current = null;
  }, [youtubeAccessToken]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || "null");
      if (stored?.youtubeAccessToken) {
        setYoutubeAccessToken(stored.youtubeAccessToken);
        setYoutubeConnected(!!stored.youtubeConnected);
      }
    } catch (error) {
      console.error("Failed to restore YouTube auth state", error);
    }
  }, []);

  useEffect(() => {
    if (!youtubeAccessToken || !youtubeConnected) return;

    const fetchSubscriptionVideo = async () => {
      try {
        const subsResponse = await fetch(
          "https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=5",
          {
            headers: {
              Authorization: `Bearer ${youtubeAccessToken}`,
            },
          },
        );

        if (!subsResponse.ok) {
          throw new Error(`Subscriptions fetch failed: ${subsResponse.status}`);
        }

        const subsData = await subsResponse.json();
        const channelId =
          subsData.items?.find((item) => item?.snippet?.resourceId?.channelId)?.snippet?.resourceId
            ?.channelId || subsData.items?.[0]?.snippet?.resourceId?.channelId;

        if (!channelId) {
          throw new Error("No subscribed channel found");
        }

        const videosResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&maxResults=5&order=date&type=video`,
          {
            headers: {
              Authorization: `Bearer ${youtubeAccessToken}`,
            },
          },
        );

        if (!videosResponse.ok) {
          throw new Error(`Video fetch failed: ${videosResponse.status}`);
        }

        const videosData = await videosResponse.json();
        const videoId = videosData.items?.find((item) => item?.id?.videoId)?.id?.videoId;

        if (videoId) {
          setSelectedVideoId(videoId);
        }
      } catch (error) {
        console.error("Unable to fetch YouTube subscription video", error);
      }
    };

    fetchSubscriptionVideo();
  }, [youtubeAccessToken, youtubeConnected]);

  const bankSession = useCallback(() => {
    if (!sessionRef.current) return;

    const gained = (Date.now() - sessionRef.current) / 3600000;
    if (gained > 0) {
      setListeningHours((hours) => hours + gained);
    }

    sessionRef.current = 0;
  }, [setListeningHours]);

  useEffect(() => {
    const activeHost = focusMode ? focusPlayerHostRef.current : playerHostRef.current;

    if (playerRef.current && activeHost !== activePlayerHostRef.current) {
      playerRef.current.destroy?.();
      playerRef.current = null;
      initRef.current = false;
      playerReadyRef.current = false;
    }

    const syncVideoProgress = () => {
      const player = playerRef.current;
      if (!player || !playerReadyRef.current || !safeVideoId) return;
      if (typeof player.getCurrentTime !== "function") return;

      const currentTime = Math.floor(player.getCurrentTime() || 0);
      localStorage.setItem(
        "jp_dashboard_youtube_session",
        JSON.stringify({ selectedVideoId: safeVideoId, currentTime, updatedAt: Date.now() }),
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
        bankSession();
        goNextVideo();
      }
    };

    const onPlayerReady = () => {
      playerReadyRef.current = true;

      const player = playerRef.current;
      if (!player || typeof player.loadVideoById !== "function") return;

      const stored =
        typeof window !== "undefined"
          ? JSON.parse(localStorage.getItem("jp_dashboard_youtube_session") || "null")
          : null;
      const resumeAt = stored?.selectedVideoId === safeVideoId ? stored.currentTime : 0;
      player.loadVideoById({ videoId: safeVideoId, startSeconds: resumeAt || 0 });
    };

    const mountPlayer = () => {
      const activeHost = focusMode ? focusPlayerHostRef.current : playerHostRef.current;
      if (initRef.current || !window.YT?.Player || !activeHost) return;

      playerRef.current = new window.YT.Player(activeHost, {
        videoId: safeVideoId,
        playerVars: {
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onReady: onPlayerReady,
          onStateChange: onPlayerState,
        },
      });

      initRef.current = true;
      activePlayerHostRef.current = focusMode ? focusPlayerHostRef.current : playerHostRef.current;
    };

    const mountWhenReady = () => {
      const activeHost = focusMode ? focusPlayerHostRef.current : playerHostRef.current;
      if (initRef.current) return;
      if (!window.YT?.Player || !activeHost) {
        requestAnimationFrame(mountWhenReady);
        return;
      }
      mountPlayer();
    };

    if (window.YT?.Player) {
      mountWhenReady();
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
      mountWhenReady();
    };

    return () => {
      window.onYouTubeIframeAPIReady = priorReady;
    };
  }, [approvedFeed, selectedVideoId, safeVideoId, bankSession, focusMode]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !playerReadyRef.current || !safeVideoId) return;

    if (typeof player.loadVideoById === "function") {
      bankSession();
      const stored =
        typeof window !== "undefined"
          ? JSON.parse(localStorage.getItem("jp_dashboard_youtube_session") || "null")
          : null;
      const resumeAt = stored?.selectedVideoId === safeVideoId ? stored.currentTime : 0;
      player.loadVideoById({ videoId: safeVideoId, startSeconds: resumeAt || 0 });
    }
  }, [safeVideoId, bankSession]);

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
    bankSession();
    const index = approvedFeed.findIndex((video) => video.id === selectedVideo.id);
    const next = approvedFeed[(index + 1) % approvedFeed.length];
    if (next?.id) setSelectedVideoId(next.id);
  };

  const saveCurrentSession = () => {
    const player = playerRef.current;
    const currentTime =
      player && playerReadyRef.current && typeof player.getCurrentTime === "function"
        ? Math.floor(player.getCurrentTime() || 0)
        : 0;

    localStorage.setItem(
      "jp_dashboard_youtube_session",
      JSON.stringify({
        selectedVideoId: safeVideoId,
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
          focusPlayerHostRef={focusPlayerHostRef}
          onToggleYoutubeConnection={() => {
            if (youtubeConnected) {
              disconnectYoutube();
            } else {
              connectYoutube();
            }
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

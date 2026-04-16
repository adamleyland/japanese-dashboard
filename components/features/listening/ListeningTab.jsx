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
  const DEFAULT_VIDEO_ID = "M7lc1UVf-VE";
  const ACCESS_TOKEN_STORAGE_KEY = "jp_dashboard_youtube_access_token";
  const CONNECTED_STORAGE_KEY = "jp_dashboard_youtube_connected";
  const LEGACY_AUTH_STORAGE_KEY = "jp_dashboard_youtube_auth";
  const [youtubeConnected, setYoutubeConnected] = useState(false);
  const [youtubeAccessToken, setYoutubeAccessToken] = useState("");
  const [subscribedChannels, setSubscribedChannels] = useState(seededChannels);
  const [videoFeed] = useState(seededVideos);
  const [accountVideos, setAccountVideos] = useState([]);
  const [selectedVideoId, setSelectedVideoId] = useState(DEFAULT_VIDEO_ID);
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
  const activeFeed = useMemo(
    () => (accountVideos.length ? accountVideos : approvedFeed),
    [accountVideos, approvedFeed],
  );

  const selectedVideo = useMemo(
    () => activeFeed.find((video) => video.id === selectedVideoId) || activeFeed[0],
    [activeFeed, selectedVideoId],
  );
  const queueTotal = activeFeed.length;
  const queueIndex = Math.max(0, activeFeed.findIndex((item) => item.id === selectedVideo?.id));

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
  }, []);

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
    setSubscribedChannels(seededChannels);
    setSelectedVideoId((currentVideoId) =>
      approvedFeed.some((video) => video.id === currentVideoId) ? currentVideoId : DEFAULT_VIDEO_ID,
    );
    googleTokenClientRef.current = null;
  }, [youtubeAccessToken, approvedFeed, seededChannels]);

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
        const subscriptions =
          subsData.items
            ?.map((item) => ({
              id: item?.snippet?.resourceId?.channelId,
              name: item?.snippet?.title,
              category: "Subscribed",
            }))
            .filter((channel) => channel.id && channel.name) || [];
        const channelIds = [...new Set(subscriptions.map((channel) => channel.id))].slice(0, 3);

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
              return (
                videosData.items
                  ?.filter((item) => item?.id?.videoId && item?.snippet)
                  .map((item) => ({
                    id: item.id.videoId,
                    title: item.snippet.title || "Untitled video",
                    channel: item.snippet.channelTitle || "YouTube",
                    duration: "Recent upload",
                    published: item.snippet.publishedAt || "",
                  })) || []
              );
            } catch (error) {
              console.error("Unable to fetch recent channel videos", error);
              return [];
            }
          }),
        );

        const nextAccountVideos = Array.from(
          new Map(
            channelVideoGroups
              .flat()
              .filter((video) => video?.id)
              .map((video) => [video.id, video]),
          ).values(),
        );

        if (!cancelled) {
          setAccountVideos(nextAccountVideos);
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
  }, [youtubeAccessToken, youtubeConnected]);

  useEffect(() => {
    if (!accountVideos.length) return;
    if (!selectedVideoId || selectedVideoId === DEFAULT_VIDEO_ID) {
      setSelectedVideoId(accountVideos[0].id);
    }
  }, [accountVideos, selectedVideoId]);

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
      if (!activeFeed.length) return;
      const index = activeFeed.findIndex((video) => video.id === selectedVideoId);
      const next = activeFeed[(index + 1) % activeFeed.length];
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
  }, [activeFeed, selectedVideoId, safeVideoId, bankSession, focusMode]);

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
    if (!activeFeed.length) return;
    bankSession();
    const index = activeFeed.findIndex((video) => video.id === selectedVideoId);
    const next = activeFeed[(index + 1) % activeFeed.length];
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
          approvedFeed={activeFeed}
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

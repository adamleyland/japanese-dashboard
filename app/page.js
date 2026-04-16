"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Blocks,
  Ear,
  BookOpenText,
  Gamepad2,
  Video,
  Link2,
  UserCircle2,
  PlayCircle,
  Mic2,
  PenLine,
  SkipForward,
  Maximize2,
  Minimize2,
  Save,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import NavigationBar from "@/components/layout/NavigationBar";
import MainTracker from "@/components/dashboard/MainTracker";
import DictionaryCarousel from "@/components/dashboard/DictionaryCarousel";
import ListeningWorkspace from "@/components/features/listening/ListeningWorkspace";
import TimerStopwatch from "@/components/features/listening/TimerStopwatch";
import ListeningVisualization from "@/components/features/listening/ListeningVisualization";

const MODULE_ACCENTS = {
  listening: { bg: "#eab308", soft: "rgba(234,179,8,0.18)", text: "#92400e" },
  reading: { bg: "#3b82f6", soft: "rgba(59,130,246,0.18)", text: "#1d4ed8" },
  shadowing: { bg: "#ef4444", soft: "rgba(239,68,68,0.18)", text: "#b91c1c" },
  writing: { bg: "#10b981", soft: "rgba(16,185,129,0.18)", text: "#047857" },
  gaming: { bg: "#8b5cf6", soft: "rgba(139,92,246,0.18)", text: "#6d28d9" },
};

const MODULE_TABS = [
  { key: "listening", label: "Listening", icon: Ear },
  { key: "reading", label: "Reading", icon: BookOpenText },
  { key: "shadowing", label: "Shadowing", icon: Mic2 },
  { key: "writing", label: "Writing", icon: PenLine },
  { key: "gaming", label: "Gaming", icon: Gamepad2 },
];

const SEEDED_CHANNELS = [
  { id: "c1", name: "Nihongo no Mori", category: "JLPT" },
  { id: "c2", name: "Comprehensible Japanese", category: "Immersion" },
  { id: "c3", name: "Japanese Ammo with Misa", category: "Grammar" },
  { id: "c4", name: "YUYUの日本語Podcast", category: "Podcast" },
];

const SEEDED_VIDEOS = [
  {
    id: "nBJ5dhjR3mY",
    title: "Learn Japanese with Real Conversations",
    channel: "Comprehensible Japanese",
    duration: "18:43",
    level: "N4-N3",
    published: "2 weeks ago",
  },
  {
    id: "B4fI6UC6W8A",
    title: "Shadowing Japanese: Daily Routine",
    channel: "Nihongo no Mori",
    duration: "12:08",
    level: "N3",
    published: "1 month ago",
  },
  {
    id: "M4g8QHkM4mY",
    title: "Japanese Listening Practice for Beginners",
    channel: "Japanese Ammo with Misa",
    duration: "22:31",
    level: "N5-N4",
    published: "3 days ago",
  },
  {
    id: "YfS0xvAcf3Q",
    title: "Slow Japanese Podcast - Tokyo Life",
    channel: "YUYUの日本語Podcast",
    duration: "16:19",
    level: "N4",
    published: "6 days ago",
  },
];

export default function Home() {
  const [tab, setTab] = useState("listening");
  const [listeningHours, setListeningHours] = useState(1030);
  const [shadowingHours, setShadowingHours] = useState(180);
  const [gamingHours, setGamingHours] = useState(280);
  const [wordsRead, setWordsRead] = useState(3050000);
  const [wordsWritten, setWordsWritten] = useState(260000);
  const [isAdditionalOpen, setIsAdditionalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isCompact, setIsCompact] = useState(false);

  const overallHours = useMemo(
    () => listeningHours + gamingHours + shadowingHours,
    [listeningHours, gamingHours, shadowingHours],
  );

  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth < 1000);
      setIsCompact(window.innerWidth < 640);
    };

    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <main style={styles.page}>
      <div style={styles.bgOrb1} />
      <div style={styles.bgOrb2} />

      <div style={styles.container}>
        <section
          style={{
            ...styles.heroGrid,
            gridTemplateColumns: isMobile ? "1fr" : "1.6fr 1fr",
          }}
        >
          <MainTracker
            styles={styles}
            overallHoursLabel={formatHours(overallHours)}
            listeningHoursLabel={formatHours(listeningHours)}
            wordsReadLabel={formatWords(wordsRead)}
            gamingHoursLabel={formatHours(gamingHours)}
            shadowingHoursLabel={formatHours(shadowingHours)}
            wordsWrittenLabel={formatWords(wordsWritten)}
            isCompact={isCompact}
            isAdditionalOpen={isAdditionalOpen}
            setIsAdditionalOpen={setIsAdditionalOpen}
            setListeningHours={setListeningHours}
            setWordsRead={setWordsRead}
            setGamingHours={setGamingHours}
            setShadowingHours={setShadowingHours}
            setWordsWritten={setWordsWritten}
          />

          <DictionaryCarousel styles={styles} />
        </section>

        <NavigationBar activeTab={tab} onChange={setTab} moduleTabs={MODULE_TABS} styles={styles} />

        <section style={styles.contentWrap}>
          {tab === "listening" && (
            <ListeningTab
              listeningHours={listeningHours}
              setListeningHours={setListeningHours}
              isMobile={isMobile}
              isCompact={isCompact}
            />
          )}
          {tab === "reading" && (
            <ReadingTab wordsRead={wordsRead} setWordsRead={setWordsRead} />
          )}
          {tab === "shadowing" && (
            <ShadowingTab
              shadowingHours={shadowingHours}
              setShadowingHours={setShadowingHours}
            />
          )}
          {tab === "writing" && (
            <WritingTab wordsWritten={wordsWritten} setWordsWritten={setWordsWritten} />
          )}
          {tab === "gaming" && (
            <GamingTab gamingHours={gamingHours} setGamingHours={setGamingHours} />
          )}
        </section>
      </div>
    </main>
  );
}

function MetricCard({ label, value, icon, onQuickAdd, quickAddLabel = "+1", featured = false }) {
  return (
    <div style={styles.metricCard(featured)}>
      <div style={styles.metricTopRow}>
        <div style={styles.metricIconWrap(featured)}>{icon}</div>
        {onQuickAdd && (
          <button onClick={onQuickAdd} style={styles.quickAddButton}>
            {quickAddLabel}
          </button>
        )}
      </div>

      <div style={styles.metricLabel}>{label}</div>
      <div style={styles.metricValue(featured)}>{value}</div>
    </div>
  );
}

function SubMetricCard({ label, value, onQuickAdd, quickAddLabel = "+1" }) {
  return (
    <div style={styles.metricCard(false)}>
      <div style={styles.metricTopRow}>
        <div style={styles.metricLabel}>{label}</div>
        {onQuickAdd && (
          <button onClick={onQuickAdd} style={styles.quickAddButtonSub}>
            {quickAddLabel}
          </button>
        )}
      </div>

      <div style={styles.metricValue(false)}>{value}</div>
    </div>
  );
}

function NumberField({ label, value, onChange, step = 1 }) {
  return (
    <label style={styles.inputCard}>
      <span style={styles.inputLabel}>{label}</span>
      <input
        type="number"
        min={0}
        step={step}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        style={styles.input}
      />
    </label>
  );
}

function ListeningTab({ listeningHours, setListeningHours, isMobile, isCompact }) {
  const [youtubeConnected, setYoutubeConnected] = useState(false);
  const [subscribedChannels, setSubscribedChannels] = useState(SEEDED_CHANNELS);
  const [videoFeed] = useState(SEEDED_VIDEOS);
  const [selectedVideoId, setSelectedVideoId] = useState(SEEDED_VIDEOS[0]?.id);
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
            setSubscribedChannels([...SEEDED_CHANNELS]);
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

function ReadingTab({ wordsRead, setWordsRead }) {
  return (
    <div style={styles.largeCard}>
      <h2 style={styles.sectionTitle}>Reading</h2>
      <p style={styles.sectionText}>Track total words read across books, manga, and articles.</p>
      <div style={styles.controlGridSingle}>
        <NumberField label="Words read" value={wordsRead} onChange={setWordsRead} step={100} />
      </div>
    </div>
  );
}

function ShadowingTab({ shadowingHours, setShadowingHours }) {
  return (
    <div style={styles.largeCard}>
      <h2 style={styles.sectionTitle}>Shadowing</h2>
      <p style={styles.sectionText}>Track active output practice and imitation sessions.</p>
      <div style={styles.controlGridSingle}>
        <NumberField
          label="Shadowing hours"
          value={shadowingHours}
          onChange={setShadowingHours}
          step={0.5}
        />
      </div>
    </div>
  );
}

function WritingTab({ wordsWritten, setWordsWritten }) {
  return (
    <div style={styles.largeCard}>
      <h2 style={styles.sectionTitle}>Writing</h2>
      <p style={styles.sectionText}>Track total words written from journaling and output drills.</p>
      <div style={styles.controlGridSingle}>
        <NumberField
          label="Words written"
          value={wordsWritten}
          onChange={setWordsWritten}
          step={100}
        />
      </div>
    </div>
  );
}

function GamingTab({ gamingHours, setGamingHours }) {
  return (
    <div style={styles.largeCard}>
      <h2 style={styles.sectionTitle}>Gaming</h2>
      <p style={styles.sectionText}>Track immersion hours.</p>
      <div style={styles.controlGridSingle}>
        <NumberField
          label="Gaming hours"
          value={gamingHours}
          onChange={setGamingHours}
          step={0.5}
        />
      </div>
    </div>
  );
}

function formatHours(v) {
  return `${Number(v).toLocaleString(undefined, {
    minimumFractionDigits: v % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  })}h`;
}

function formatWords(v) {
  return Number(v).toLocaleString();
}

function formatClock(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = String(Math.floor(safe / 3600)).padStart(2, "0");
  const m = String(Math.floor((safe % 3600) / 60)).padStart(2, "0");
  const s = String(safe % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}


const glass = {
  background: "rgba(255,255,255,0.6)",
  border: "1px solid rgba(255,255,255,0.7)",
  boxShadow: "0 20px 60px rgba(15,23,42,0.12)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
};

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(160deg, #eef2ff 0%, #f8fafc 45%, #ecfeff 100%)",
    fontFamily: "Inter, system-ui, -apple-system, sans-serif",
    color: "#111827",
    padding: "16px",
    position: "relative",
    overflowX: "hidden",
  },
  bgOrb1: {
    position: "absolute",
    width: "420px",
    height: "420px",
    borderRadius: "999px",
    background: "rgba(186,230,253,0.8)",
    filter: "blur(80px)",
    top: "-120px",
    left: "-80px",
    pointerEvents: "none",
  },
  bgOrb2: {
    position: "absolute",
    width: "420px",
    height: "420px",
    borderRadius: "999px",
    background: "rgba(221,214,254,0.7)",
    filter: "blur(80px)",
    top: "-120px",
    right: "-80px",
    pointerEvents: "none",
  },
  container: {
    maxWidth: "1300px",
    margin: "0 auto",
    position: "relative",
    zIndex: 1,
    display: "grid",
    gap: "14px",
  },
  heroGrid: {
    display: "grid",
    gridTemplateColumns: "1.6fr 1fr",
    gap: "14px",
  },
  heroCard: {
    ...glass,
    borderRadius: "26px",
    padding: "20px",
  },
  wordCard: {
    ...glass,
    borderRadius: "26px",
    padding: "20px",
    minHeight: "390px",
    display: "grid",
    gridTemplateRows: "auto 1fr",
    gap: "14px",
  },
  wordCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "10px",
    paddingBottom: "4px",
  },
  progressContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    width: "28px",
    height: "28px",
  },
  dictionaryIconFootprint: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    background: "#ef4444",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 8px rgba(239, 68, 68, 0.2)",
  },
  progressSeconds: {
    position: "absolute",
    fontSize: "10px",
    fontWeight: 700,
    color: "#64748b",
  },
  progressRing: { transform: "rotate(-90deg)" },
  eyebrow: {
    fontSize: "12px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#667085",
  },
  tagBase: {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 10px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 600,
    border: "1px solid",
    letterSpacing: "0.02em",
  },
  pillToggleBase: (w, h, i) => ({
    position: "relative",
    display: "flex",
    alignItems: "center",
    width: `${w}px`,
    maxWidth: "100%",
    height: `${h}px`,
    padding: `${i}px`,
    background: "rgba(255,255,255,0.45)",
    border: "1px solid rgba(0,0,0,0.05)",
    borderRadius: "999px",
    boxSizing: "border-box",
  }),
  pillToggleSlider: (idx, cnt, i) => ({
    position: "absolute",
    top: `${i}px`,
    bottom: `${i}px`,
    left: `calc(${i}px + (${idx} * (100% - ${i * 2}px) / ${cnt}))`,
    width: `calc((100% - ${i * 2}px) / ${cnt})`,
    borderRadius: "999px",
    background: "#fff",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
    zIndex: 0,
  }),
  pillToggleButton: (active, h) => ({
    flex: 1,
    position: "relative",
    zIndex: 1,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: h < 40 ? "12px" : "13px",
    fontWeight: 600,
    color: active ? "#111827" : "#64748b",
    transition: "color 0.2s ease",
  }),
  wordCarouselBody: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    height: "100%",
  },
  carouselTopSection: {
    display: "grid",
    gap: "8px",
    alignContent: "start",
  },
  wordMain: {
    fontSize: "54px",
    fontWeight: 700,
    letterSpacing: "-0.05em",
    lineHeight: 1,
  },
  wordReading: { color: "#64748b", fontSize: "18px" },
  wordMeaning: {
    marginTop: "4px",
    fontSize: "16px",
    color: "#0f172a",
    lineHeight: 1.4,
  },
  metadataRow: {
    display: "flex",
    gap: "8px",
    marginTop: "6px",
    flexWrap: "wrap",
  },
  contextSectionBox: {
    marginTop: "auto",
    borderRadius: "20px",
    border: "1px solid rgba(15, 23, 42, 0.12)",
    background: "rgba(255, 255, 255, 0.3)",
    padding: "16px",
    display: "grid",
    gap: "12px",
  },
  contextExamplesList: {
    display: "grid",
    gap: "14px",
  },
  contextExampleItem: {
    display: "grid",
    gap: "6px",
  },
  wordSentenceLabel: {
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#64748b",
  },
  wordSentence: {
    fontSize: "14px",
    lineHeight: 1.6,
    color: "#111827",
  },
  wordSentenceTranslation: {
    color: "#64748b",
    fontSize: "13px",
    lineHeight: 1.5,
  },
  textHighlight: {
    color: "#ef4444",
    fontWeight: 600,
    background: "rgba(239, 68, 68, 0.08)",
    padding: "0 2px",
    borderRadius: "4px",
  },
  dictionaryBody: {
    display: "grid",
    gap: "12px",
    height: "100%",
    gridTemplateRows: "auto 1fr",
  },
  dictionaryControls: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },
  dictionaryInputWrapTight: {
    flex: 1,
    minWidth: "220px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    borderRadius: "12px",
    border: "1px solid rgba(15, 23, 42, 0.12)",
    background: "rgba(255, 255, 255, 0.8)",
    padding: "8px 12px",
    position: "relative",
  },
  dictionaryInput: {
    width: "100%",
    background: "transparent",
    border: "none",
    outline: "none",
    fontSize: "14px",
    color: "#111827",
  },
  clearSearchBtn: {
    background: "none",
    border: "none",
    padding: 0,
    display: "flex",
    alignItems: "center",
    cursor: "pointer",
    color: "#94a3b8",
  },
  dictionaryResultsArea: {
    marginTop: "4px",
  },
  dictionaryResultsList: {
    display: "grid",
    gap: "10px",
    padding: "2px",
    maxHeight: "315px",
    overflowY: "auto",
    paddingRight: "4px",
  },
  carouselActionRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "8px",
  },
  secondaryAction: {
    border: "1px solid rgba(15,23,42,0.12)",
    background: "rgba(255,255,255,0.86)",
    borderRadius: "12px",
    padding: "8px 10px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "5px",
    fontSize: "12px",
    fontWeight: 700,
    color: "#334155",
    cursor: "pointer",
  },
  masteredAction: {
    border: "1px solid rgba(16,185,129,0.26)",
    background: "rgba(16,185,129,0.14)",
    borderRadius: "12px",
    padding: "8px 10px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "5px",
    fontSize: "12px",
    fontWeight: 700,
    color: "#047857",
    cursor: "pointer",
  },
  dictionaryPlaceholder: {
    borderRadius: "14px",
    border: "1px dashed rgba(15,23,42,0.15)",
    background: "rgba(255,255,255,0.35)",
    padding: "16px",
    color: "#64748b",
    fontSize: "13px",
    textAlign: "center",
  },
  dictionaryResultCard: {
    borderRadius: "20px",
    border: "1px solid rgba(15, 23, 42, 0.1)",
    background: "rgba(255, 255, 255, 0.65)",
    padding: "16px",
    boxShadow: "0 4px 12px rgba(15,23,42,0.03)",
    display: "grid",
    gap: "8px",
  },
  dictionaryResultTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "8px",
  },
  dictionaryResultWord: {
    fontSize: "22px",
    fontWeight: 700,
    letterSpacing: "-0.03em",
    lineHeight: 1,
  },
  dictionaryResultReading: {
    marginTop: "2px",
    fontSize: "13px",
    color: "#64748b",
  },
  dictionaryResultDefinitions: {
    fontSize: "14px",
    color: "#0f172a",
    lineHeight: 1.4,
  },
  addButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    borderRadius: "10px",
    border: "1px solid rgba(15, 23, 42, 0.1)",
    background: "#fff",
    color: "#111827",
    cursor: "pointer",
  },
  removeButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    borderRadius: "10px",
    border: "1px solid #ef4444",
    background: "rgba(239, 68, 68, 0.1)",
    color: "#ef4444",
    cursor: "pointer",
  },
  audioActionBtn: {
    background: "#fff",
    border: "1px solid rgba(15, 23, 42, 0.1)",
    borderRadius: "12px",
    width: "44px",
    height: "44px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  miniAudioBtn: {
    background: "#fff",
    border: "1px solid rgba(15, 23, 42, 0.08)",
    borderRadius: "8px",
    width: "28px",
    height: "28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  title: {
    fontSize: "44px",
    lineHeight: 1.2,
    letterSpacing: "-0.05em",
    margin: "10px 0 35px 0",
  },
  overallRow: { marginTop: "20px" },
  metricsGridThree: {
    display: "grid",
    gap: "12px",
    marginTop: "12px",
  },
  subMetricsGrid: {
    marginTop: "10px",
    display: "grid",
    gap: "12px",
  },
  metricCard: (f) => ({
    background: f ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.58)",
    border: "1px solid rgba(255,255,255,0.82)",
    boxShadow: f
      ? "0 16px 36px rgba(15,23,42,0.14)"
      : "0 12px 26px rgba(15,23,42,0.1)",
    borderRadius: f ? "24px" : "22px",
    padding: f ? "20px" : "18px",
  }),
  metricTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    marginBottom: "10px",
  },
  metricIconWrap: (f) => ({
    width: f ? "40px" : "34px",
    height: f ? "40px" : "34px",
    borderRadius: "12px",
    border: "1px solid rgba(15,23,42,0.1)",
    background: "rgba(255,255,255,0.85)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: f ? "20px" : "18px",
  }),
  quickAddButton: {
    border: "1px solid rgba(15,23,42,0.14)",
    background: "rgba(255,255,255,0.9)",
    borderRadius: "999px",
    padding: "6px 10px",
    fontSize: "12px",
    fontWeight: 700,
    color: "#111827",
    cursor: "pointer",
  },
  quickAddButtonSub: {
    border: "1px solid rgba(15,23,42,0.1)",
    background: "rgba(255,255,255,0.85)",
    borderRadius: "999px",
    padding: "5px 9px",
    fontSize: "11px",
    fontWeight: 700,
    color: "#111827",
    cursor: "pointer",
  },
  metricLabel: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#667085",
    marginBottom: "8px",
  },
  metricValue: (f) => ({
    fontSize: f ? "40px" : "30px",
    fontWeight: 700,
    letterSpacing: "-0.04em",
    lineHeight: 1,
  }),
  expandableWrap: {
    marginTop: "12px",
    borderRadius: "18px",
    background: "rgba(255,255,255,0.32)",
    border: "1px solid rgba(255,255,255,0.62)",
    padding: "12px",
  },
  expandableSummary: {
    cursor: "pointer",
    listStyle: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#667085",
  },
  expandableArrow: {
    fontSize: "20px",
    lineHeight: 1,
    color: "#cbd5e1",
  },
  tabsWrap: {
    ...glass,
    borderRadius: "999px",
    padding: "8px",
    display: "flex",
    justifyContent: "center",
  },
  contentWrap: { minWidth: 0 },
  moduleNavTrack: {
    display: "flex",
    gap: "10px",
    padding: "4px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.4)",
    border: "1px solid rgba(255,255,255,0.7)",
  },
  moduleNavButton: (active) => ({
    border: "none",
    borderRadius: "999px",
    background: active ? "#111827" : "transparent",
    color: active ? "#fff" : "#475569",
    cursor: "pointer",
    padding: active ? "10px 20px" : "10px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: "13px",
    transition: "all 300ms cubic-bezier(0.23, 1, 0.32, 1)",
    boxShadow: active ? "0 8px 20px rgba(15,23,42,0.15)" : "none",
  }),
  listeningMainGrid: {
    display: "grid",
    gap: "14px",
  },
  largeCard: {
    ...glass,
    borderRadius: "26px",
    padding: "20px",
  },
  sideColumn: {
    display: "grid",
    gap: "14px",
  },
  sideCard: {
    ...glass,
    borderRadius: "26px",
    padding: "20px",
  },
  sideTitle: {
    margin: 0,
    fontSize: "18px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-start",
    marginBottom: "14px",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "24px",
    letterSpacing: "-0.03em",
  },
  sectionText: {
    margin: "8px 0 0 0",
    color: "#667085",
    fontSize: "14px",
  },
  playerShell: {
    borderRadius: "20px",
    border: "1px solid rgba(15,23,42,0.12)",
    background: "rgba(255,255,255,0.56)",
    padding: "12px",
    display: "grid",
    gap: "12px",
    position: "relative",
    zIndex: 2,
  },
  playerShellFocus: {
    width: "min(1200px, 100%)",
    maxHeight: "100%",
    borderRadius: "24px",
    background: "rgba(255,255,255,0.96)",
    boxShadow: "0 40px 120px rgba(0,0,0,0.45)",
    padding: "16px",
    display: "grid",
    gap: "14px",
    position: "relative",
    zIndex: 10000,
  },
  playerHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "4px",
  },
  playerHeaderLeft: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
  },
  playerPlatform: {
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#64748b",
    fontWeight: 700,
  },
  playerFrameWrap: {
    position: "relative",
    width: "100%",
    paddingTop: "56.25%",
    borderRadius: "14px",
    overflow: "hidden",
    border: "1px solid rgba(15,23,42,0.12)",
    background: "#000",
  },
  playerFrameWrapFocus: {
    position: "relative",
    width: "100%",
    paddingTop: "56.25%",
    borderRadius: "18px",
    overflow: "hidden",
    background: "#000",
  },
  playerFrame: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    border: "none",
  },
  playerControlColumn: {
    display: "grid",
    gap: "12px",
  },
  playerControlRowFocus: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    padding: "8px 4px 0 4px",
    flexWrap: "wrap",
  },
  playerMeta: {
    display: "grid",
    gap: "2px",
    minWidth: 0,
    flex: 1,
  },
  playerTitle: {
    margin: 0,
    fontSize: "16px",
    fontWeight: 700,
    letterSpacing: "-0.01em",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "400px",
  },
  playerTitleFocus: {
    margin: 0,
    fontSize: "18px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    color: "#111827",
  },
  playerSub: {
    margin: 0,
    fontSize: "12px",
    color: "#64748b",
  },
  focusModeBtn: {
    position: "absolute",
    top: "12px",
    right: "12px",
    zIndex: 10,
    background: "rgba(0,0,0,0.4)",
    backdropFilter: "blur(4px)",
    color: "#fff",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "8px",
    width: "32px",
    height: "32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  playerControlRow: {
    display: "flex",
    gap: "8px",
  },
  miniActionButton: (tone) => ({
    background: tone === "blue" ? "rgba(59,130,246,0.1)" : "rgba(249,115,22,0.1)",
    color: tone === "blue" ? "#1d4ed8" : "#c2410c",
    border: "1px solid transparent",
    borderRadius: "8px",
    padding: "6px 12px",
    fontSize: "12px",
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    gap: "6px",
    cursor: "pointer",
  }),
  innerTabsWrap: {
    marginTop: "12px",
  },
  innerTabsRow: {
    display: "flex",
    gap: "8px",
    marginBottom: "10px",
  },
  innerTabButton: (active) => ({
    border: "none",
    background: active ? "rgba(234,179,8,0.15)" : "transparent",
    color: active ? "#92400e" : "#64748b",
    borderRadius: "999px",
    padding: "8px 16px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
  }),
  innerTabPanel: {
    borderRadius: "16px",
    background: "rgba(255,255,255,0.4)",
    border: "1px solid rgba(15,23,42,0.05)",
    padding: "12px",
  },
  accountIdentity: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
    fontWeight: 600,
    marginBottom: "12px",
  },
  connectButton: (connected) => ({
    background: connected ? "rgba(239,68,68,0.1)" : "#111827",
    color: connected ? "#ef4444" : "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "10px 16px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  }),
  listStack: {
    display: "grid",
    gap: "8px",
  },
  simpleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 12px",
    background: "#fff",
    borderRadius: "10px",
    border: "1px solid rgba(0,0,0,0.05)",
  },
  simpleTitle: { fontSize: "13px", fontWeight: 600 },
  videoFeedButton: (active) => ({
    padding: "10px 12px",
    background: active ? "rgba(234,179,8,1)" : "#fff",
    color: active ? "#fff" : "#111827",
    border: "1px solid rgba(0,0,0,0.05)",
    borderRadius: "10px",
    cursor: "pointer",
    textAlign: "left",
  }),
  videoFeedTop: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  videoFeedTitle: () => ({
    fontSize: "13px",
    fontWeight: 700,
  }),
  timerContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "20px",
    padding: "10px 0",
  },
  timerRingWrap: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  timerRingValue: {
    position: "absolute",
    textAlign: "center",
    fontSize: "28px",
    fontWeight: 800,
    color: "#1e293b",
  },
  timerActionRow: {
    display: "flex",
    gap: "10px",
    justifyContent: "center",
    width: "100%",
  },
  iconActionButton: (active) => ({
    background: active ? "rgba(99,102,241,0.1)" : "#fff",
    color: active ? "#6366f1" : "#475569",
    border: "1px solid rgba(0,0,0,0.08)",
    borderRadius: "12px",
    width: "44px",
    height: "44px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  }),
  visualHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "15px",
  },
  visualTools: { display: "flex", gap: "6px" },
  iconBadgeBtn: {
    background: "transparent",
    border: "none",
    color: "#64748b",
    cursor: "pointer",
    padding: "4px",
  },
  visualLargeValue: {
    fontSize: "48px",
    fontWeight: 800,
    letterSpacing: "-0.04em",
    textAlign: "center",
  },
  visualMainStats: {
    padding: "10px 0",
  },
  quickAdjustGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "8px",
    marginBottom: "15px",
  },
  adjustBtn: {
    background: "#fff",
    border: "1px solid rgba(0,0,0,0.08)",
    borderRadius: "8px",
    padding: "8px 0",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  goalGrid: {
    background: "rgba(255,255,255,0.4)",
    padding: "12px",
    borderRadius: "16px",
    border: "1px solid rgba(0,0,0,0.05)",
    display: "grid",
    gap: "12px",
  },
  blockGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(14px, 1fr))",
    gap: "5px",
  },
  progressBlockShell: {
    height: "18px",
    background: "rgba(0,0,0,0.05)",
    borderRadius: "4px",
    overflow: "hidden",
    position: "relative",
  },
  progressBlockFill: (fill) => ({
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: `${fill * 100}%`,
    background: "#eab308",
  }),
  progressBarWrap: {
    height: "24px",
    background: "rgba(0,0,0,0.05)",
    borderRadius: "999px",
    position: "relative",
    overflow: "hidden",
  },
  progressBarFill: (p) => ({
    position: "absolute",
    height: "100%",
    width: `${p}%`,
    background: "#eab308",
  }),
  progressBarLabel: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "11px",
    fontWeight: 800,
    gap: "4px",
  },
  focusOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
  },
  focusBackdrop: {
    position: "absolute",
    inset: 0,
    background: "rgba(2, 6, 23, 0.72)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
  },
  focusContent: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
  },
  clockHeader: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    alignItems: "flex-start",
  },
  controlGridSingle: { marginTop: "20px" },
  inputCard: { display: "grid", gap: "6px" },
  inputLabel: {
    fontSize: "11px",
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
  },
  input: {
    padding: "10px",
    borderRadius: "10px",
    border: "1px solid rgba(0,0,0,0.1)",
    background: "#fff",
    fontSize: "14px",
  },
};
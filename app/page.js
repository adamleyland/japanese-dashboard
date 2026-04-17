"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ear, BookOpenText, Gamepad2, Mic2, PenLine } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { addTrackingEvent, fetchTrackingTotals, reduceTrackingEvent } from "@/lib/trackingEvents";
import NavigationBar from "@/components/layout/NavigationBar";
import MagicLinkAuth from "@/components/auth/MagicLinkAuth";
import MainTracker from "@/components/dashboard/MainTracker";
import DictionaryCarousel from "@/components/dashboard/DictionaryCarousel";
import ListeningTab from "@/components/features/listening/ListeningTab";
import ReadingWorkspace from "@/components/features/reading/ReadingWorkspace";
import ShadowingWorkspace from "@/components/features/shadowing/ShadowingWorkspace";
import WritingWorkspace from "@/components/features/writing/WritingWorkspace";
import GamingWorkspace from "@/components/features/gaming/GamingWorkspace";

const MODULE_TABS = [
  { key: "listening", label: "Listening", icon: Ear },
  { key: "reading", label: "Reading", icon: BookOpenText },
  { key: "shadowing", label: "Shadowing", icon: Mic2 },
  { key: "writing", label: "Writing", icon: PenLine },
  { key: "gaming", label: "Gaming", icon: Gamepad2 },
];

const TRACKING_SOURCE_DEFAULTS = {
  listening: { positive: "manual", negative: "adjustment" },
  reading: { positive: "reading", negative: "adjustment" },
  shadowing: { positive: "manual", negative: "adjustment" },
  writing: { positive: "manual", negative: "adjustment" },
  gaming: { positive: "gaming", negative: "adjustment" },
};

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
  const [authSession, setAuthSession] = useState(null);
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const authUserId = authUser?.id || "";
  const listeningHoursRef = useRef(listeningHours);
  const shadowingHoursRef = useRef(shadowingHours);
  const gamingHoursRef = useRef(gamingHours);
  const wordsReadRef = useRef(wordsRead);
  const wordsWrittenRef = useRef(wordsWritten);

  const overallHours = useMemo(
    () => listeningHours + gamingHours + shadowingHours,
    [listeningHours, gamingHours, shadowingHours],
  );

  useEffect(() => {
    listeningHoursRef.current = listeningHours;
    shadowingHoursRef.current = shadowingHours;
    gamingHoursRef.current = gamingHours;
    wordsReadRef.current = wordsRead;
    wordsWrittenRef.current = wordsWritten;
  }, [gamingHours, listeningHours, shadowingHours, wordsRead, wordsWritten]);

  const persistMetricDelta = useCallback(
    async ({ metric, delta, metadata = {}, previousValue, nextValue, ref, setValue }) => {
      if (!authUserId || !delta) {
        return true;
      }

      const sourceDefaults = TRACKING_SOURCE_DEFAULTS[metric];
      const persistEvent = delta > 0 ? addTrackingEvent : reduceTrackingEvent;
      const success = await persistEvent(metric, Math.abs(delta), {
        ...metadata,
        userId: authUserId,
        kind: metadata.kind || "adjustment",
        source: metadata.source || (delta > 0 ? sourceDefaults.positive : sourceDefaults.negative),
      });

      if (success) {
        return true;
      }

      if (ref.current === nextValue) {
        ref.current = previousValue;
        setValue(previousValue);
      }

      return false;
    },
    [authUserId],
  );

  const updateTrackedMetric = useCallback(
    (metric, ref, setValue, nextValueOrUpdater, metadata = {}) => {
      const previousValue = ref.current;
      const resolvedValue =
        typeof nextValueOrUpdater === "function"
          ? nextValueOrUpdater(previousValue)
          : nextValueOrUpdater;
      const nextValue = Math.max(0, Number(resolvedValue) || 0);
      const delta = nextValue - previousValue;

      if (!delta) {
        return;
      }

      ref.current = nextValue;
      setValue(nextValue);

      void persistMetricDelta({
        metric,
        delta,
        metadata,
        previousValue,
        nextValue,
        ref,
        setValue,
      });
    },
    [persistMetricDelta],
  );

  const updateListeningHours = useCallback(
    (nextValueOrUpdater, metadata = {}) => {
      updateTrackedMetric("listening", listeningHoursRef, setListeningHours, nextValueOrUpdater, metadata);
    },
    [updateTrackedMetric],
  );

  const updateWordsRead = useCallback(
    (nextValueOrUpdater, metadata = {}) => {
      updateTrackedMetric("reading", wordsReadRef, setWordsRead, nextValueOrUpdater, metadata);
    },
    [updateTrackedMetric],
  );

  const updateShadowingHours = useCallback(
    (nextValueOrUpdater, metadata = {}) => {
      updateTrackedMetric("shadowing", shadowingHoursRef, setShadowingHours, nextValueOrUpdater, metadata);
    },
    [updateTrackedMetric],
  );

  const updateWordsWritten = useCallback(
    (nextValueOrUpdater, metadata = {}) => {
      updateTrackedMetric("writing", wordsWrittenRef, setWordsWritten, nextValueOrUpdater, metadata);
    },
    [updateTrackedMetric],
  );

  const updateGamingHours = useCallback(
    (nextValueOrUpdater, metadata = {}) => {
      updateTrackedMetric("gaming", gamingHoursRef, setGamingHours, nextValueOrUpdater, metadata);
    },
    [updateTrackedMetric],
  );

  const adjustMetricByDelta = useCallback(
    (metric, amount, metadata = {}) => {
      if (!Number.isFinite(amount) || !amount) {
        return;
      }

      const adjustmentMetadata = {
        kind: "adjustment",
        source: "adjustment",
        ...metadata,
      };

      if (metric === "listening") {
        updateListeningHours((currentValue) => Math.max(0, currentValue + amount), adjustmentMetadata);
        return;
      }

      if (metric === "reading") {
        updateWordsRead((currentValue) => Math.max(0, currentValue + amount), adjustmentMetadata);
        return;
      }

      if (metric === "shadowing") {
        updateShadowingHours((currentValue) => Math.max(0, currentValue + amount), adjustmentMetadata);
        return;
      }

      if (metric === "writing") {
        updateWordsWritten((currentValue) => Math.max(0, currentValue + amount), adjustmentMetadata);
        return;
      }

      if (metric === "gaming") {
        updateGamingHours((currentValue) => Math.max(0, currentValue + amount), adjustmentMetadata);
      }
    },
    [updateGamingHours, updateListeningHours, updateShadowingHours, updateWordsRead, updateWordsWritten],
  );

  const adjustListeningHours = useCallback(
    (deltaHours, metadata = {}) => {
      if (!Number.isFinite(deltaHours) || !deltaHours) return;

      updateListeningHours(
        (currentHours) => Math.max(0, currentHours + deltaHours),
        metadata,
      );
    },
    [updateListeningHours],
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

  useEffect(() => {
    let isActive = true;

    const loadSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error("Failed to load Supabase auth session", error);
      }

      if (!isActive) return;

      setAuthSession(data.session ?? null);
      setAuthUser(data.session?.user ?? null);
      setAuthLoading(false);
    };

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isActive) return;

      setAuthSession(session ?? null);
      setAuthUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const hydrateTrackingState = async () => {
      if (!authUserId) {
        return;
      }

      const totals = await fetchTrackingTotals(authUserId);
      if (cancelled || !totals) {
        return;
      }

      listeningHoursRef.current = totals.listening;
      shadowingHoursRef.current = totals.shadowing;
      gamingHoursRef.current = totals.gaming;
      wordsReadRef.current = totals.reading;
      wordsWrittenRef.current = totals.writing;

      setListeningHours(totals.listening);
      setShadowingHours(totals.shadowing);
      setGamingHours(totals.gaming);
      setWordsRead(totals.reading);
      setWordsWritten(totals.writing);
    };

    void hydrateTrackingState();

    return () => {
      cancelled = true;
    };
  }, [authUserId]);

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
            overallHoursLabel={formatHours(overallHours)}
            listeningHoursLabel={formatHours(listeningHours)}
            listeningHours={listeningHours}
            wordsReadLabel={formatWords(wordsRead)}
            wordsRead={wordsRead}
            gamingHoursLabel={formatHours(gamingHours)}
            gamingHours={gamingHours}
            shadowingHoursLabel={formatHours(shadowingHours)}
            shadowingHours={shadowingHours}
            wordsWrittenLabel={formatWords(wordsWritten)}
            wordsWritten={wordsWritten}
            authControl={
              <MagicLinkAuth
                session={authSession}
                user={authUser}
                isCompact={isCompact}
                isLoading={authLoading}
              />
            }
            onAdjustMetric={adjustMetricByDelta}
            isCompact={isCompact}
            isAdditionalOpen={isAdditionalOpen}
            setIsAdditionalOpen={setIsAdditionalOpen}
            styles={styles}
          />

          <DictionaryCarousel styles={styles} />
        </section>

        <NavigationBar activeTab={tab} onChange={setTab} moduleTabs={MODULE_TABS} styles={styles} />

        <section style={styles.contentWrap}>
          {tab === "listening" && (
            <ListeningTab
              styles={styles}
              listeningHours={listeningHours}
              adjustListeningHours={adjustListeningHours}
              isMobile={isMobile}
              isCompact={isCompact}
              seededChannels={SEEDED_CHANNELS}
              seededVideos={SEEDED_VIDEOS}
              formatClock={formatClock}
            />
          )}
          {tab === "reading" && (
            <ReadingWorkspace
              styles={styles}
              wordsRead={wordsRead}
              setWordsRead={updateWordsRead}
            />
          )}
          {tab === "shadowing" && (
            <ShadowingWorkspace
              styles={styles}
              shadowingHours={shadowingHours}
              setShadowingHours={updateShadowingHours}
            />
          )}
          {tab === "writing" && (
            <WritingWorkspace
              styles={styles}
              wordsWritten={wordsWritten}
              setWordsWritten={updateWordsWritten}
            />
          )}
          {tab === "gaming" && (
            <GamingWorkspace
              styles={styles}
              gamingHours={gamingHours}
              setGamingHours={updateGamingHours}
            />
          )}
        </section>
      </div>
    </main>
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
    boxShadow: "0 2px 8px rgba(239, 68, 68, 0.01)",
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
    background:
      tone === "blue"
        ? "rgba(59,130,246,0.1)"
        : tone === "orange"
        ? "rgba(249,115,22,0.1)"
        : tone === "grey"
        ? "rgba(148,163,184,0.12)"
        : "transparent",
    color:
      tone === "blue"
        ? "#1d4ed8"
        : tone === "orange"
        ? "#c2410c"
        : tone === "grey"
        ? "#475569"
        : "#111827",
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

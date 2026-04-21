"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ear, BookOpenText, Gamepad2, Mic2, PenLine } from "lucide-react";
import { getSafeAuthUser } from "@/lib/auth";
import { logAuthError, logAuthInfo, summarizeSupabaseSession } from "@/lib/authLogging";
import { supabase } from "@/lib/supabase";
import { addTrackingEvent, fetchTrackingTotals, reduceTrackingEvent } from "@/lib/trackingEvents";
import { ensureUserProfile } from "@/lib/profiles";
import TopNav from "@/components/layout/TopNav";
import MagicLinkAuth from "@/components/auth/MagicLinkAuth";
import MainTracker from "@/components/dashboard/MainTracker";
import DictionaryCarousel from "@/components/dashboard/DictionaryCarousel";
import ListeningTab from "@/components/features/listening/ListeningTab";
import ReadingTab from "@/components/features/reading/ReadingTab";
import ShadowingWorkspace from "@/components/features/shadowing/ShadowingWorkspace";
import WritingWorkspace from "@/components/features/writing/WritingWorkspace";
import GamingTab from "@/components/features/gaming/GamingTab";
import useGamingData from "@/hooks/useGamingData";
import useGamingTotals from "@/hooks/useGamingTotals";
import useReadingLibrary from "@/hooks/useReadingLibrary";
import useLingQStats from "@/hooks/useLingQStats";


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
const TRACKER_FOCUS_MODE_STORAGE_KEY = "jp_tracker_focus_mode";

export default function Home() {
  const [tab, setTab] = useState("listening");
  const [listeningHours, setListeningHours] = useState(1030);
  const [shadowingHours, setShadowingHours] = useState(180);
  const [gamingHours, setGamingHours] = useState(280);
  const [wordsRead, setWordsRead] = useState(3050000);
  const [wordsWritten, setWordsWritten] = useState(260000);
  const [isAdditionalOpen, setIsAdditionalOpen] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [trackerFocusMode, setTrackerFocusMode] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem(TRACKER_FOCUS_MODE_STORAGE_KEY) === "true";
  });
  const [isMobile, setIsMobile] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [trackingHydrated, setTrackingHydrated] = useState(false);
  const [audiobooksData, setAudiobooksData] = useState([]);
  const [audiobooksError, setAudiobooksError] = useState(null);
  const [audiobooksLoading, setAudiobooksLoading] = useState(true);
  const authUserId = authUser?.id || "";
  const listeningHoursRef = useRef(listeningHours);
  const shadowingHoursRef = useRef(shadowingHours);
  const gamingHoursRef = useRef(gamingHours);
  const wordsReadRef = useRef(wordsRead);
  const wordsWrittenRef = useRef(wordsWritten);
  const gamingData = useGamingData({
    authUserId,
    authResolved: !authLoading,
  });
  const readingLibrary = useReadingLibrary({
    authUserId,
    authResolved: !authLoading,
  });
  const lingqStats = useLingQStats({
    enabled: !authLoading,
  });
  const estimatedReadingHours =
    typeof lingqStats.estimatedReadingHours === "number" ? lingqStats.estimatedReadingHours : 0;
  const overallHours = useMemo(
    () => listeningHours + gamingHours + shadowingHours + estimatedReadingHours,
    [estimatedReadingHours, listeningHours, gamingHours, shadowingHours],
  );
  const { totalMinutes: gamingTotalMinutes } = useGamingTotals(gamingData.games);
  const hasGamingSourceData = gamingData.games.length > 0;

  useEffect(() => {
    listeningHoursRef.current = listeningHours;
    shadowingHoursRef.current = shadowingHours;
    gamingHoursRef.current = gamingHours;
    wordsReadRef.current = wordsRead;
    wordsWrittenRef.current = wordsWritten;
  }, [gamingHours, listeningHours, shadowingHours, wordsRead, wordsWritten]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(TRACKER_FOCUS_MODE_STORAGE_KEY, String(trackerFocusMode));
  }, [trackerFocusMode]);

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

  const handleTabChange = useCallback((nextTab) => {
    setTab((currentTab) => (currentTab === nextTab ? null : nextTab));
  }, []);

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

    const loadUser = async () => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        logAuthError("Home", "Failed to restore Supabase session on load", sessionError);
      } else {
        logAuthInfo("Home", "Supabase session restoration on app load", {
          session: summarizeSupabaseSession(sessionData?.session ?? null),
        });
      }

      const user = await getSafeAuthUser();

      if (!isActive) return;

      setAuthUser(user);
      setAuthLoading(false);
    };

    void loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isActive) return;

      logAuthInfo("Home", "Supabase auth state changed", {
        event,
        session: summarizeSupabaseSession(session),
      });

      setAuthUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authUser?.id) {
      return;
    }

    void ensureUserProfile(authUser);
  }, [authUser]);

  useEffect(() => {
    const fetchAudiobooks = async () => {
      setAudiobooksLoading(true);

      const { data, error } = await supabase.from("audiobooks").select("*");

      setAudiobooksData(data ?? []);
      setAudiobooksError(error);
      setAudiobooksLoading(false);
    };

    fetchAudiobooks();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const hydrateTrackingState = async () => {
      if (authLoading) {
        return;
      }

      if (!authUserId) {
        setTrackingHydrated(true);
        return;
      }

      setTrackingHydrated(false);
      const totals = await fetchTrackingTotals(authUserId);
      if (cancelled) {
        return;
      }

      if (!totals) {
        setTrackingHydrated(true);
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
      setTrackingHydrated(true);
    };

    void hydrateTrackingState();

    return () => {
      cancelled = true;
    };
  }, [authLoading, authUserId]);

  useEffect(() => {
    if (authLoading || !trackingHydrated || !authUserId || !hasGamingSourceData) {
      return;
    }

    const nextGamingHours = gamingTotalMinutes / 60;
    const currentGamingHours = gamingHoursRef.current;

    if (Math.abs(nextGamingHours - currentGamingHours) < 0.001) {
      return;
    }

    updateGamingHours(nextGamingHours, {
      kind: "adjustment",
      source: "gaming-library-sync",
      note: "Synced gaming total from connected gaming library sources.",
    });
  }, [
    authLoading,
    authUserId,
    gamingTotalMinutes,
    hasGamingSourceData,
    trackingHydrated,
    updateGamingHours,
  ]);

  useEffect(() => {
    if (authLoading || !trackingHydrated || !lingqStats.hasStats) {
      return;
    }

    const nextWordsRead = lingqStats.totalWordsRead;
    const currentWordsRead = wordsReadRef.current;

    if (Math.abs(nextWordsRead - currentWordsRead) < 1) {
      return;
    }

    updateWordsRead(nextWordsRead, {
      kind: "adjustment",
      source: "lingq-sync",
      note: "Synced reading total from LingQ words read.",
    });
  }, [
    authLoading,
    lingqStats.hasStats,
    lingqStats.totalWordsRead,
    trackingHydrated,
    updateWordsRead,
  ]);

  return (
    <main style={styles.page}>
      <div style={styles.bgOrb1} />
      <div style={styles.bgOrb2} />

      <div style={styles.container}>
        <TopNav
          activeTab={tab}
          authControl={
            <MagicLinkAuth
              user={authUser}
              isCompact={isCompact}
              isLoading={authLoading}
            />
          }
          authUserId={authUserId}
          isCompact={isCompact}
          moduleTabs={MODULE_TABS}
          onChange={handleTabChange}
          onToggleDashboard={() => setShowDashboard((visible) => !visible)}
          showDashboard={showDashboard}
          styles={styles}
        />

        {showDashboard && (
          <section
            style={{
              ...styles.heroGrid,
              gridTemplateColumns: isMobile
                ? "1fr"
                : trackerFocusMode
                ? "minmax(0, 1fr) 0fr"
                : "minmax(0, 1.6fr) minmax(320px, 1fr)",
              gap: isMobile ? "14px" : trackerFocusMode ? "0px" : "14px",
            }}
          >
            <div style={styles.dashboardPrimaryColumn}>
              <MainTracker
                overallHoursLabel={formatHours(overallHours)}
                listeningHoursLabel={formatHours(listeningHours)}
                listeningHours={listeningHours}
                wordsReadLabel={formatWords(wordsRead)}
                wordsRead={wordsRead}
                estimatedReadingHours={estimatedReadingHours}
                gamingHoursLabel={formatHours(gamingHours)}
                gamingHours={gamingHours}
                shadowingHoursLabel={formatHours(shadowingHours)}
                shadowingHours={shadowingHours}
                wordsWrittenLabel={formatWords(wordsWritten)}
                wordsWritten={wordsWritten}
                onAdjustMetric={adjustMetricByDelta}
                isCompact={isCompact}
                focusMode={trackerFocusMode}
                onToggleFocusMode={() => setTrackerFocusMode((currentValue) => !currentValue)}
                isAdditionalOpen={isAdditionalOpen}
                setIsAdditionalOpen={setIsAdditionalOpen}
                styles={styles}
              />
            </div>

            {!isMobile ? (
              <div style={styles.dashboardSecondaryColumn}>
                <div style={styles.dashboardSecondaryInner(trackerFocusMode)}>
                  <DictionaryCarousel styles={styles} />
                </div>
              </div>
            ) : !trackerFocusMode ? (
              <DictionaryCarousel styles={styles} />
            ) : null}
          </section>
        )}

        <section style={styles.contentWrap}>
          {tab === "listening" && (
            <ListeningTab
              styles={styles}
              listeningHours={listeningHours}
              adjustListeningHours={adjustListeningHours}
              isMobile={isMobile}
              isCompact={isCompact}
              formatClock={formatClock}
              authUserId={authUserId}
              audiobooksData={audiobooksData}
              audiobooksLoading={audiobooksLoading}
              audiobooksError={audiobooksError}
            />
          )}
          {tab === "reading" && (
            <ReadingTab
              styles={styles}
              wordsRead={wordsRead}
              readingLibrary={readingLibrary}
              lingqStats={lingqStats}
              isMobile={isMobile}
              isCompact={isCompact}
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
            <GamingTab
              styles={styles}
              gamingHours={gamingHours}
              gamingData={gamingData}
              isMobile={isMobile}
              isCompact={isCompact}
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
  background: "var(--app-glass-bg)",
  border: "var(--app-glass-border)",
  boxShadow: "var(--app-glass-shadow)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
};

const styles = {
  page: {
    minHeight: "100vh",
    background: "var(--app-page-bg)",
    fontFamily: "Inter, system-ui, -apple-system, sans-serif",
    color: "var(--app-page-text)",
    padding: "16px",
    position: "relative",
    overflowX: "hidden",
  },
  bgOrb1: {
    position: "absolute",
    width: "420px",
    height: "420px",
    borderRadius: "999px",
    background: "var(--app-orb-1)",
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
    background: "var(--app-orb-2)",
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
    alignItems: "stretch",
    transition: "grid-template-columns 280ms cubic-bezier(0.22, 1, 0.36, 1), gap 280ms ease",
  },
  dashboardPrimaryColumn: {
    minWidth: 0,
    height: "100%",
  },
  dashboardSecondaryColumn: {
    minWidth: 0,
    overflow: "hidden",
    height: "100%",
  },
  dashboardSecondaryInner: (hidden) => ({
    minWidth: 0,
    height: "100%",
    opacity: hidden ? 0 : 1,
    transform: hidden ? "translateX(18px) scale(0.985)" : "translateX(0) scale(1)",
    pointerEvents: hidden ? "none" : "auto",
    transition: "opacity 220ms ease, transform 280ms cubic-bezier(0.22, 1, 0.36, 1)",
  }),
  heroCard: {
    ...glass,
    borderRadius: "26px",
    padding: "20px",
    height: "100%",
  },
  wordCard: {
    ...glass,
    borderRadius: "26px",
    padding: "20px",
    minHeight: "390px",
    height: "100%",
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
    background: "rgba(239, 68, 68, 0.16)",
    border: "1px solid rgba(239, 68, 68, 0.18)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
  },
  progressSeconds: {
    position: "absolute",
    fontSize: "10px",
    fontWeight: 700,
    color: "var(--app-text-muted)",
  },
  progressRing: { transform: "rotate(-90deg)" },
  eyebrow: {
    fontSize: "12px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--app-text-muted)",
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
    background: "var(--app-pill-track)",
    border: "1px solid var(--app-border)",
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
    background: "var(--app-pill-slider)",
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
    color: active ? "var(--app-text)" : "var(--app-text-muted)",
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
  wordReading: { color: "var(--app-text-muted)", fontSize: "18px" },
  wordMeaning: {
    marginTop: "4px",
    fontSize: "16px",
    color: "var(--app-text)",
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
    border: "1px solid var(--app-border-strong)",
    background: "var(--app-surface-soft)",
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
    color: "var(--app-text-muted)",
  },
  wordSentence: {
    fontSize: "14px",
    lineHeight: 1.6,
    color: "var(--app-text)",
  },
  wordSentenceTranslation: {
    color: "var(--app-text-muted)",
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
    border: "1px solid var(--app-border-strong)",
    background: "var(--app-surface)",
    padding: "8px 12px",
    position: "relative",
  },
  dictionaryInput: {
    width: "100%",
    background: "transparent",
    border: "none",
    outline: "none",
    fontSize: "14px",
    color: "var(--app-text)",
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
    border: "1px solid var(--app-border-strong)",
    background: "var(--app-surface)",
    borderRadius: "12px",
    padding: "8px 10px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "5px",
    fontSize: "12px",
    fontWeight: 700,
    color: "var(--app-text-soft)",
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
    color: "#48cba6",
    cursor: "pointer",
  },
  dictionaryPlaceholder: {
    borderRadius: "14px",
    border: "1px dashed var(--app-border-strong)",
    background: "var(--app-surface-soft)",
    padding: "16px",
    color: "var(--app-text-muted)",
    fontSize: "13px",
    textAlign: "center",
  },
  dictionaryResultCard: {
    borderRadius: "20px",
    border: "1px solid var(--app-border)",
    background: "var(--app-card)",
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
    color: "var(--app-text-muted)",
  },
  dictionaryResultDefinitions: {
    fontSize: "14px",
    color: "var(--app-text)",
    lineHeight: 1.4,
  },
  addButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    borderRadius: "10px",
    border: "1px solid var(--app-border)",
    background: "var(--app-surface)",
    color: "var(--app-text)",
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
    background: "var(--app-surface)",
    border: "1px solid var(--app-border)",
    borderRadius: "12px",
    width: "44px",
    height: "44px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  miniAudioBtn: {
    background: "var(--app-surface)",
    border: "1px solid var(--app-border-soft)",
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
    background: f ? "var(--app-card)" : "var(--app-card-muted)",
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
    border: "1px solid var(--app-border)",
    background: "var(--app-surface)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: f ? "20px" : "18px",
  }),
  quickAddButton: {
    border: "1px solid var(--app-border-strong)",
    background: "var(--app-surface)",
    borderRadius: "999px",
    padding: "6px 10px",
    fontSize: "12px",
    fontWeight: 700,
    color: "var(--app-text)",
    cursor: "pointer",
  },
  quickAddButtonSub: {
    border: "1px solid var(--app-border)",
    background: "var(--app-surface)",
    borderRadius: "999px",
    padding: "5px 9px",
    fontSize: "11px",
    fontWeight: 700,
    color: "var(--app-text)",
    cursor: "pointer",
  },
  metricLabel: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "var(--app-text-muted)",
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
    background: "var(--app-surface-soft)",
    border: "1px solid var(--app-border-soft)",
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
    color: "var(--app-text-muted)",
  },
  expandableArrow: {
    fontSize: "20px",
    lineHeight: 1,
    color: "var(--app-text-faint)",
  },
  tabsWrap: {
    ...glass,
    borderRadius: "999px",
    padding: "8px",
    display: "flex",
    justifyContent: "center",
  },
  topNavShell: (isCompact) => ({
    ...glass,
    borderRadius: "26px",
    padding: isCompact ? "10px 12px" : "12px 14px",
    display: "grid",
    gridTemplateColumns: isCompact ? "minmax(0, 1fr) auto auto" : "1fr auto 1fr",
    alignItems: "center",
    gap: isCompact ? "8px" : "14px",
    position: "relative",
    zIndex: 12,
  }),
  topNavLeft: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minWidth: 0,
    justifySelf: "start",
  },
  topNavCenter: {
    display: "flex",
    justifyContent: "center",
    minWidth: 0,
    overflow: "visible",
  },
  topNavRight: {
    display: "flex",
    justifyContent: "flex-end",
    minWidth: 0,
    justifySelf: "end",
  },
  topNavIconButton: (active) => ({
    width: "38px",
    height: "38px",
    borderRadius: "999px",
    border: active ? "1px solid var(--app-selected-border)" : "1px solid var(--app-border-soft)",
    background: active ? "var(--app-selected-surface)" : "var(--app-surface-elevated)",
    color: active ? "var(--app-selected-text)" : "var(--app-text-soft)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: active ? "0 10px 24px rgba(15,23,42,0.14)" : "0 10px 24px rgba(15,23,42,0.08)",
    flexShrink: 0,
  }),
  topNavCalendarWrap: {
    position: "relative",
    minWidth: 0,
  },
  topNavDateButton: {
    border: "none",
    background: "transparent",
    color: "var(--app-text)",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
    padding: "6px 2px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  contentWrap: { minWidth: 0 },
  moduleNavTrack: {
    display: "flex",
    gap: "10px",
    padding: "4px",
    borderRadius: "999px",
    background: "var(--app-pill-track)",
    border: "1px solid var(--app-border-soft)",
    width: "fit-content",
    maxWidth: "100%",
    overflowX: "auto",
    scrollbarWidth: "none",
  },
  moduleNavButton: (active) => ({
    border: "none",
    borderRadius: "999px",
    background: active ? "var(--app-selected-surface)" : "transparent",
    color: active ? "var(--app-selected-text)" : "var(--app-text-muted)",
    cursor: "pointer",
    padding: active ? "10px 20px" : "10px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: "13px",
    transition: "all 300ms cubic-bezier(0.23, 1, 0.32, 1)",
    boxShadow: active
      ? "0 4px 12px rgba(15,23,42,0.12), inset 0 1px 0 rgba(255,255,255,0.04)"
      : "none",
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
    color: "var(--app-text-muted)",
    fontSize: "14px",
  },
  playerShell: {
    borderRadius: "20px",
    border: "1px solid var(--app-border)",
    background: "var(--app-card)",
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
    background: "var(--app-surface-strong)",
    border: "1px solid var(--app-border-soft)",
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
    color: "var(--app-text-muted)",
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
    color: "var(--app-text)",
  },
  playerSub: {
    margin: 0,
    fontSize: "12px",
    color: "var(--app-text-muted)",
  },
  focusModeBtn: {
    position: "absolute",
    top: "12px",
    right: "12px",
    zIndex: 10,
    background: "rgba(15, 23, 42, 0.54)",
    backdropFilter: "blur(4px)",
    color: "var(--app-selected-text)",
    border: "1px solid var(--app-border-soft)",
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
        ? "var(--app-surface-soft)"
        : "transparent",
    color:
      tone === "blue"
        ? "#5579d9"
        : tone === "orange"
        ? "#d05423"
        : tone === "grey"
        ? "var(--app-text-soft)"
        : "var(--app-text)",
    border: tone === "grey" ? "1px solid var(--app-border-soft)" : "1px solid transparent",
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
    background: "var(--app-card-muted)",
    border: "1px solid var(--app-border-soft)",
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
    background: "var(--app-surface)",
    borderRadius: "10px",
    border: "1px solid var(--app-border-soft)",
  },
  simpleTitle: { fontSize: "13px", fontWeight: 600 },
  videoFeedButton: (active) => ({
    padding: "10px 12px",
    background: active ? "var(--app-selected-surface)" : "var(--app-surface)",
    color: active ? "var(--app-selected-text)" : "var(--app-text)",
    border: active ? "1px solid var(--app-selected-border)" : "1px solid var(--app-border-soft)",
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
    color: "var(--app-text)",
  },
  timerActionRow: {
    display: "flex",
    gap: "10px",
    justifyContent: "center",
    width: "100%",
  },
  iconActionButton: (active) => ({
    background: active ? "rgba(99,102,241,0.16)" : "var(--app-surface)",
    color: active ? "#6366f1" : "var(--app-text-soft)",
    border: "1px solid var(--app-border-soft)",
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
    background: "var(--app-surface)",
    border: "1px solid var(--app-border-soft)",
    borderRadius: "8px",
    padding: "8px 0",
    fontSize: "12px",
    fontWeight: 700,
    color: "var(--app-text)",
    cursor: "pointer",
  },
  goalGrid: {
    background: "var(--app-card-muted)",
    padding: "12px",
    borderRadius: "16px",
    border: "1px solid var(--app-border-soft)",
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
    background: "var(--app-progress-track)",
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
    background: "var(--app-progress-track)",
    border: "1px solid var(--app-border-soft)",
    borderRadius: "999px",
    position: "relative",
    overflow: "hidden",
  },
  progressBarFill: (p) => ({
    position: "absolute",
    height: "100%",
    width: `${p}%`,
    background: "#eab208a5",
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
    color: "var(--app-text)",
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
    color: "var(--app-text-muted)",
    textTransform: "uppercase",
  },
  input: {
    padding: "10px",
    borderRadius: "10px",
    border: "1px solid var(--app-border)",
    background: "var(--app-surface)",
    color: "var(--app-text)",
    fontSize: "14px",
  },
};

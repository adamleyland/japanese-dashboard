"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Ear, BookOpenText, Gamepad2, Mic2, PenLine } from "lucide-react";
import { getSafeAuthUser } from "@/lib/auth";
import { logAuthError, logAuthInfo, summarizeSupabaseSession } from "@/lib/authLogging";
import { supabase } from "@/lib/supabase";
import {
  addTrackingEvent,
  createEmptyTrackingTotals,
  fetchTrackingTotalsWithSource,
  flushPendingTrackingEvents,
  hasTrackingTotalsValue,
  getPendingTrackingTotals,
  reduceTrackingEvent,
} from "@/lib/trackingEvents";
import { ensureUserProfile } from "@/lib/profiles";
import TopNav from "@/components/layout/TopNav";
import MagicLinkAuth from "@/components/auth/MagicLinkAuth";
import AuthGate from "@/components/auth/AuthGate";
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
import useWritingTotals from "@/hooks/useWritingTotals";
import { estimateWritingHours } from "@/components/features/writing/utils/writingStats";


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
const MOBILE_SWIPE_AXIS_LOCK_DISTANCE = 14;
const MOBILE_SWIPE_DISTANCE_RATIO = 0.18;
const MOBILE_SWIPE_VELOCITY_THRESHOLD = 540;
const MOBILE_SWIPE_EDGE_RESISTANCE = 0.18;
const MOBILE_SWIPE_PANEL_SIDE_PADDING = 16;
const MOBILE_SWIPE_PANEL_GAP = 12;
const MOBILE_SWIPE_PANEL_VERTICAL_PADDING = 0;
const MOBILE_SWIPE_TRANSITION = "left 280ms cubic-bezier(0.22, 1, 0.36, 1)";
const MOBILE_SWIPE_REDUCED_TRANSITION = "left 120ms linear";
const MOBILE_SWIPE_IGNORE_SELECTOR = [
  "button",
  "a",
  "input",
  "textarea",
  "select",
  "label",
  "summary",
  "audio",
  "video",
  "[role='button']",
  "[role='link']",
  "[role='slider']",
  "[role='switch']",
  "[role='tab']",
  "[contenteditable='true']",
  "[draggable='true']",
  "[data-swipe-ignore='true']",
].join(", ");

// Intended only for local UI work. This does not create an authenticated Supabase session.
const isLocalDevelopmentAuthBypass =
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true";
const localDevelopmentUserId = isLocalDevelopmentAuthBypass
  ? String(process.env.NEXT_PUBLIC_DEV_BYPASS_USER_ID || "").trim()
  : "";

function getMobileBottomInset(hasPinnedTracker) {
  return hasPinnedTracker ? 136 : 136;
}

function mergeTrackingTotals(baseTotals, pendingTotals) {
  return {
    listening: Number(baseTotals?.listening || 0) + Number(pendingTotals?.listening || 0),
    reading: Number(baseTotals?.reading || 0) + Number(pendingTotals?.reading || 0),
    shadowing: Number(baseTotals?.shadowing || 0) + Number(pendingTotals?.shadowing || 0),
    writing: Number(baseTotals?.writing || 0) + Number(pendingTotals?.writing || 0),
    gaming: Number(baseTotals?.gaming || 0) + Number(pendingTotals?.gaming || 0),
  };
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isMobileModuleTab(item) {
  return Boolean(item?.key);
}

function shouldIgnoreMobileSwipeTarget(target) {
  return target instanceof Element && Boolean(target.closest(MOBILE_SWIPE_IGNORE_SELECTOR));
}

function applyMobileSwipeEdgeResistance(distance) {
  return distance * MOBILE_SWIPE_EDGE_RESISTANCE;
}

export default function Home() {
  const [tab, setTab] = useState("listening");
  const [mobileSwipeCenterTabKey, setMobileSwipeCenterTabKey] = useState(
    () => MODULE_TABS.find(isMobileModuleTab)?.key || MODULE_TABS[0]?.key || "listening",
  );
  const [listeningHours, setListeningHours] = useState(1030);
  const [shadowingHours, setShadowingHours] = useState(180);
  const [gamingHours, setGamingHours] = useState(280);
  const [wordsRead, setWordsRead] = useState(3050000);
  const [wordsWritten, setWordsWritten] = useState(260000);
  const [isAdditionalOpen, setIsAdditionalOpen] = useState(false);
  const [showMobileDashboard, setShowMobileDashboard] = useState(false);
  const [showDesktopDashboard, setShowDesktopDashboard] = useState(true);
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
  const [audiobooksLoading, setAudiobooksLoading] = useState(false);
  const [audiobookPlaybackSnapshot, setAudiobookPlaybackSnapshot] = useState({
    bookId: null,
    isPlaying: false,
    isPlayerOpen: false,
    isPlayerMinimized: false,
  });
  const [audiobookLaunchRequest, setAudiobookLaunchRequest] = useState(null);
  const [audiobookLaunchStatus, setAudiobookLaunchStatus] = useState({
    state: "idle",
    title: "",
  });
  const prefersReducedMotion = useReducedMotion();
  const authUserId = authUser?.id || localDevelopmentUserId;
  const listeningHoursRef = useRef(listeningHours);
  const shadowingHoursRef = useRef(shadowingHours);
  const gamingHoursRef = useRef(gamingHours);
  const wordsReadRef = useRef(wordsRead);
  const wordsWrittenRef = useRef(wordsWritten);
  const trackingSourceRef = useRef("bootstrap-default");
  const trackingReadStrategyRef = useRef("unknown");
  const trackingReconcileRequestRef = useRef(0);
  const applyTrackingTotalsSnapshotRef = useRef(null);
  const reconcileTrackingStateFromServerRef = useRef(null);
  const mobileSwipeViewportRef = useRef(null);
  const mobileSwipeTrackRef = useRef(null);
  const mobileSwipeSessionRef = useRef(null);
  const mobileSwipeOffsetRef = useRef(0);
  const mobileSwipeAnimatingRef = useRef(false);
  const mobileSwipePendingRecenterRef = useRef(false);
  const mobileSwipeReleaseTimerRef = useRef(null);
  const audiobooksRequestedRef = useRef(false);
  const [mobileSwipeWidth, setMobileSwipeWidth] = useState(0);
  const showDashboard = isMobile ? showMobileDashboard : showDesktopDashboard;
  const gamingData = useGamingData({
    authUserId,
    authResolved: !authLoading,
  });
  const readingLibrary = useReadingLibrary({
    authUserId,
    authResolved: !authLoading,
    enabled: tab === "reading",
  });
  const writingTotals = useWritingTotals({
    authUserId,
    authResolved: !authLoading,
  });
  const lingqStats = useLingQStats({
    enabled: !authLoading,
  });
  const estimatedReadingHours =
    typeof lingqStats.estimatedReadingHours === "number" ? lingqStats.estimatedReadingHours : 0;
  const estimatedWritingHours = useMemo(
    () => estimateWritingHours(wordsWritten),
    [wordsWritten],
  );
  const overallHours = useMemo(
    () =>
      listeningHours +
      gamingHours +
      shadowingHours +
      estimatedReadingHours +
      estimatedWritingHours,
    [estimatedReadingHours, estimatedWritingHours, listeningHours, gamingHours, shadowingHours],
  );
  const { totalMinutes: gamingTotalMinutes } = useGamingTotals(gamingData.games);
  const mobileModuleTabs = useMemo(
    () => MODULE_TABS.filter(isMobileModuleTab),
    [],
  );
  const mobileSwipeIsSwipeableTab = useMemo(
    () => mobileModuleTabs.some((item) => item.key === tab),
    [mobileModuleTabs, tab],
  );
  const mobileSwipeCenterIndex = useMemo(
    () => mobileModuleTabs.findIndex((item) => item.key === mobileSwipeCenterTabKey),
    [mobileModuleTabs, mobileSwipeCenterTabKey],
  );
  const currentMobileSwipeTab =
    mobileSwipeCenterIndex >= 0 ? mobileModuleTabs[mobileSwipeCenterIndex] : null;
  const previousMobileSwipeTab =
    mobileSwipeCenterIndex > 0 ? mobileModuleTabs[mobileSwipeCenterIndex - 1] : null;
  const nextMobileSwipeTab =
    mobileSwipeCenterIndex >= 0 && mobileSwipeCenterIndex < mobileModuleTabs.length - 1
      ? mobileModuleTabs[mobileSwipeCenterIndex + 1]
      : null;
  const mobileSwipeBaseOffset =
    mobileSwipeWidth > 0 ? -(mobileSwipeWidth + MOBILE_SWIPE_PANEL_GAP) : 0;
  const mobileSwipeTransitionValue = prefersReducedMotion
    ? MOBILE_SWIPE_REDUCED_TRANSITION
    : MOBILE_SWIPE_TRANSITION;
  const mobileBottomInset = isMobile ? getMobileBottomInset(showDashboard) : 0;

  useLayoutEffect(() => {
    if (!isMobile || !mobileSwipeIsSwipeableTab || mobileSwipeAnimatingRef.current) {
      return;
    }

    setMobileSwipeCenterTabKey((currentKey) => (currentKey === tab ? currentKey : tab));
  }, [isMobile, mobileSwipeIsSwipeableTab, tab]);

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

  const resolveReadingMetricSource = useCallback(() => {
    const rawResult = {
      configured: lingqStats.configured,
      hasStats: lingqStats.hasStats,
      totalWordsRead: lingqStats.totalWordsRead,
      estimatedReadingHours: lingqStats.estimatedReadingHours,
      loading: lingqStats.loading,
      error: lingqStats.error,
      source: lingqStats.source,
      fetchedAt: lingqStats.fetchedAt,
    };

    console.info("[Dashboard Totals] Raw reading source loader result", rawResult);

    if (isFiniteNumber(lingqStats.totalWordsRead)) {
      return {
        value: lingqStats.totalWordsRead,
        source: "lingq",
        reason: "loaded-from-lingq",
        rawResult,
      };
    }

    if (lingqStats.loading) {
      return {
        value: wordsReadRef.current,
        source: "retain-current",
        reason: "lingq-loading",
        rawResult,
      };
    }

    if (lingqStats.error) {
      return {
        value: 0,
        source: "default-zero",
        reason: `lingq-error:${lingqStats.error}`,
        rawResult,
      };
    }

    if (!lingqStats.configured) {
      return {
        value: 0,
        source: "default-zero",
        reason: "lingq-not-configured",
        rawResult,
      };
    }

    return {
      value: 0,
      source: "default-zero",
      reason: "lingq-words-read-missing",
      rawResult,
    };
  }, [
    lingqStats.configured,
    lingqStats.error,
    lingqStats.estimatedReadingHours,
    lingqStats.fetchedAt,
    lingqStats.hasStats,
    lingqStats.loading,
    lingqStats.source,
    lingqStats.totalWordsRead,
  ]);

  const resolveGamingMetricSource = useCallback(() => {
    const rawResult = {
      gamesCount: gamingData.games.length,
      totalMinutes: gamingTotalMinutes,
      totalHours: gamingTotalMinutes / 60,
      loading: gamingData.loading,
      error: gamingData.error,
      steam: {
        gamesCount: gamingData.sourceStatus?.steam?.games?.length ?? 0,
        loading: gamingData.sourceStatus?.steam?.loading ?? false,
        error: gamingData.sourceStatus?.steam?.error ?? null,
      },
      xbox: {
        gamesCount: gamingData.sourceStatus?.xbox?.games?.length ?? 0,
        loading: gamingData.sourceStatus?.xbox?.loading ?? false,
        error: gamingData.sourceStatus?.xbox?.error ?? null,
      },
    };

    console.info("[Dashboard Totals] Raw gaming source loader result", rawResult);

    if (gamingData.games.length > 0 && isFiniteNumber(gamingTotalMinutes)) {
      return {
        value: gamingTotalMinutes / 60,
        source: "steam-xbox",
        reason: "computed-from-gaming-library",
        rawResult,
      };
    }

    if (gamingData.loading) {
      return {
        value: gamingHoursRef.current,
        source: "retain-current",
        reason: "gaming-sources-loading",
        rawResult,
      };
    }

    if (gamingData.error) {
      return {
        value: 0,
        source: "default-zero",
        reason: `gaming-source-error:${gamingData.error}`,
        rawResult,
      };
    }

    return {
      value: 0,
      source: "default-zero",
      reason: "no-gaming-source-data",
      rawResult,
    };
  }, [
    gamingData.error,
    gamingData.games,
    gamingData.loading,
    gamingData.sourceStatus,
    gamingTotalMinutes,
  ]);

  const resolveWritingMetricSource = useCallback(() => {
    const rawResult = {
      totalWords: writingTotals.totalWords,
      loading: writingTotals.loading,
      error: writingTotals.error,
      authUserId,
    };

    console.info("[Dashboard Totals] Raw writing source loader result", rawResult);

    if (!authUserId) {
      return {
        value: wordsWrittenRef.current,
        source: "retain-current",
        reason: "no-auth-user",
        rawResult,
      };
    }

    if (isFiniteNumber(writingTotals.totalWords)) {
      return {
        value: writingTotals.totalWords,
        source: "writing-entries",
        reason: "computed-from-writing-entries",
        rawResult,
      };
    }

    if (writingTotals.loading) {
      return {
        value: wordsWrittenRef.current,
        source: "retain-current",
        reason: "writing-entries-loading",
        rawResult,
      };
    }

    if (writingTotals.error) {
      return {
        value: wordsWrittenRef.current,
        source: "retain-current",
        reason: `writing-entries-error:${writingTotals.error}`,
        rawResult,
      };
    }

    return {
      value: 0,
      source: "default-zero",
      reason: "writing-entries-missing",
      rawResult,
    };
  }, [authUserId, writingTotals.error, writingTotals.loading, writingTotals.totalWords]);

  const applyResolvedMetricValue = useCallback((metric, nextValue, sourceDetails = {}) => {
    const metricRefs = {
      reading: wordsReadRef,
      gaming: gamingHoursRef,
      listening: listeningHoursRef,
      shadowing: shadowingHoursRef,
      writing: wordsWrittenRef,
    };
    const metricSetters = {
      reading: setWordsRead,
      gaming: setGamingHours,
      listening: setListeningHours,
      shadowing: setShadowingHours,
      writing: setWordsWritten,
    };

    const ref = metricRefs[metric];
    const setValue = metricSetters[metric];
    if (!ref || !setValue) {
      return;
    }

    const currentValue = Number(ref.current || 0);
    const normalizedNextValue = Math.max(0, Number(nextValue) || 0);
    if (Math.abs(currentValue - normalizedNextValue) < 0.000001) {
      return;
    }

    const nextTotals = {
      listening: metric === "listening" ? normalizedNextValue : listeningHoursRef.current,
      reading: metric === "reading" ? normalizedNextValue : wordsReadRef.current,
      shadowing: metric === "shadowing" ? normalizedNextValue : shadowingHoursRef.current,
      writing: metric === "writing" ? normalizedNextValue : wordsWrittenRef.current,
      gaming: metric === "gaming" ? normalizedNextValue : gamingHoursRef.current,
    };

    console.info("[Dashboard Totals] Final merged totals object before setState", {
      reason: `apply-${metric}-source`,
      metric,
      sourceDetails,
      nextTotals,
    });

    ref.current = normalizedNextValue;
    setValue(normalizedNextValue);
  }, []);

  const applyTrackingTotalsSnapshot = useCallback(
    (
      nextTotals,
      {
        reason = "unknown",
        source = "unknown",
        serverTotals = null,
        pendingTotals = null,
        flushResult = null,
      } = {},
    ) => {
      const normalizedTotals = mergeTrackingTotals(createEmptyTrackingTotals(), nextTotals);
      const readingResolution = authUserId
        ? resolveReadingMetricSource()
        : {
            value: normalizedTotals.reading,
            source,
            reason: "using-tracking-reading-total-without-auth",
          };
      const gamingResolution = authUserId
        ? resolveGamingMetricSource()
        : {
            value: normalizedTotals.gaming,
            source,
            reason: "using-tracking-gaming-total-without-auth",
          };
      const writingResolution = authUserId
        ? resolveWritingMetricSource()
        : {
            value: normalizedTotals.writing,
            source,
            reason: "using-tracking-writing-total-without-auth",
          };
      const finalTotals = {
        listening: normalizedTotals.listening,
        reading: readingResolution.value,
        shadowing: normalizedTotals.shadowing,
        writing: writingResolution.value,
        gaming: gamingResolution.value,
      };
      const previousListening = listeningHoursRef.current;
      const previousSource = trackingSourceRef.current;
      const listeningChanged = Math.abs(previousListening - finalTotals.listening) > 0.000001;
      const overwrite = listeningChanged && previousSource !== source;

      console.info("[Tracking UI] Applying tracking totals snapshot", {
        reason,
        source,
        previousSource,
        overwrite,
        listening: {
          previous: previousListening,
          next: finalTotals.listening,
        },
        serverListening: serverTotals?.listening ?? null,
        pendingListening: pendingTotals?.listening ?? null,
        flushResult,
      });
      console.info("[Dashboard Totals] Final merged totals object before setState", {
        reason,
        source,
        trackingTotals: normalizedTotals,
        readingResolution,
        writingResolution,
        gamingResolution,
        finalTotals,
      });

      if (readingResolution.source === "default-zero") {
        console.warn("[Dashboard Totals] Reading defaulted to zero", {
          reason: readingResolution.reason,
          rawResult: readingResolution.rawResult,
        });
      }

      if (gamingResolution.source === "default-zero") {
        console.warn("[Dashboard Totals] Gaming defaulted to zero", {
          reason: gamingResolution.reason,
          rawResult: gamingResolution.rawResult,
        });
      }

      if (writingResolution.source === "default-zero") {
        console.warn("[Dashboard Totals] Writing defaulted to zero", {
          reason: writingResolution.reason,
          rawResult: writingResolution.rawResult,
        });
      }

      if (Math.abs(finalTotals.listening) < 0.000001) {
        console.warn("[Dashboard Totals] Listening defaulted to zero", {
          reason,
          source,
          trackingTotals: normalizedTotals,
          serverTotals,
          pendingTotals,
        });
      }

      trackingSourceRef.current = source;
      listeningHoursRef.current = finalTotals.listening;
      shadowingHoursRef.current = finalTotals.shadowing;
      gamingHoursRef.current = finalTotals.gaming;
      wordsReadRef.current = finalTotals.reading;
      wordsWrittenRef.current = finalTotals.writing;

      setListeningHours(finalTotals.listening);
      setShadowingHours(finalTotals.shadowing);
      setGamingHours(finalTotals.gaming);
      setWordsRead(finalTotals.reading);
      setWordsWritten(finalTotals.writing);
      setTrackingHydrated(true);
    },
    [authUserId, resolveGamingMetricSource, resolveReadingMetricSource, resolveWritingMetricSource],
  );

  const reconcileTrackingStateFromServer = useCallback(
    async (reason, context = {}) => {
      if (!authUserId) {
        return null;
      }

      const requestId = ++trackingReconcileRequestRef.current;
      console.info("[Tracking UI] Reconciling tracking totals from Supabase", {
        reason,
        userId: authUserId,
        context,
        currentListening: listeningHoursRef.current,
      });

      const flushResult = await flushPendingTrackingEvents(authUserId);
      const serverSnapshot = await fetchTrackingTotalsWithSource(authUserId);
      const pendingTotals = getPendingTrackingTotals(authUserId);

      console.info("[Dashboard Totals] Raw listening source loader result", {
        reason,
        serverSnapshot,
        pendingTotals,
      });

      if (requestId !== trackingReconcileRequestRef.current) {
        console.info("[Tracking UI] Ignoring stale reconciliation result", {
          reason,
          requestId,
          latestRequestId: trackingReconcileRequestRef.current,
        });
        return null;
      }

      if (serverSnapshot?.totals) {
        trackingReadStrategyRef.current = serverSnapshot.readSource;
        const hasPendingTotals = hasTrackingTotalsValue(pendingTotals);
        const displayTotals = hasPendingTotals
          ? mergeTrackingTotals(serverSnapshot.totals, pendingTotals)
          : serverSnapshot.totals;

        if (hasPendingTotals) {
          console.warn("[Tracking UI] Keeping pending local totals layered over fresh server totals", {
            reason,
            readSource: serverSnapshot.readSource,
            pendingTotals,
          });
        }

        applyTrackingTotalsSnapshot(displayTotals, {
          reason,
          source: hasPendingTotals ? `${serverSnapshot.readSource}+pending` : serverSnapshot.readSource,
          serverTotals: serverSnapshot.totals,
          pendingTotals,
          flushResult,
        });

        return {
          ok: true,
          displayTotals,
          serverTotals: serverSnapshot.totals,
          pendingTotals,
          readSource: serverSnapshot.readSource,
        };
      }

      trackingReadStrategyRef.current = "local-pending-fallback";
      applyTrackingTotalsSnapshot(pendingTotals, {
        reason,
        source: "local-pending-fallback",
        pendingTotals,
        flushResult,
      });

      return {
        ok: false,
        displayTotals: pendingTotals,
        pendingTotals,
        readSource: "local-pending-fallback",
      };
    },
    [applyTrackingTotalsSnapshot, authUserId],
  );

  useEffect(() => {
    applyTrackingTotalsSnapshotRef.current = applyTrackingTotalsSnapshot;
  }, [applyTrackingTotalsSnapshot]);

  useEffect(() => {
    reconcileTrackingStateFromServerRef.current = reconcileTrackingStateFromServer;
  }, [reconcileTrackingStateFromServer]);

  const persistMetricDelta = useCallback(
    async ({ metric, delta, metadata = {}, previousValue, nextValue, ref, setValue }) => {
      if (!delta) {
        return true;
      }

      console.info("[Tracking UI] Persisting tracked metric delta", {
        metric,
        delta,
        previousValue,
        nextValue,
        authUserId: authUserId || null,
        uiSource: trackingSourceRef.current,
        metadata,
      });

      const sourceDefaults = TRACKING_SOURCE_DEFAULTS[metric];
      const persistEvent = delta > 0 ? addTrackingEvent : reduceTrackingEvent;
      const success = await persistEvent(metric, Math.abs(delta), {
        ...metadata,
        userId: authUserId || null,
        kind: metadata.kind || (delta > 0 ? "session" : "adjustment"),
        source: metadata.source || (delta > 0 ? sourceDefaults.positive : sourceDefaults.negative),
      });

      if (success) {
        if (authUserId) {
          const reconciliationMode =
            trackingReadStrategyRef.current === "supabase-rpc" ? "server-reload" : "confirmed-delta";
          trackingSourceRef.current = `server-confirmed:${reconciliationMode}`;
          console.info("[Tracking UI] Tracking write confirmed by Supabase", {
            metric,
            nextValue,
            reconciliationMode,
            readStrategy: trackingReadStrategyRef.current,
          });

          if (trackingReadStrategyRef.current === "supabase-rpc") {
            await reconcileTrackingStateFromServer(`${metric}-write-confirmed`, {
              metric,
              delta,
              previousValue,
              nextValue,
            });
          }
        } else {
          trackingSourceRef.current = "local-pending";
          console.info("[Tracking UI] Tracking value is currently backed by local pending storage", {
            metric,
            nextValue,
          });
        }

        return true;
      }

      if (ref.current === nextValue) {
        console.warn("[Tracking UI] Reverting optimistic tracking value after persistence failure", {
          metric,
          previousValue,
          nextValue,
        });
        ref.current = previousValue;
        setValue(previousValue);
      }

      return false;
    },
    [authUserId, reconcileTrackingStateFromServer],
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

      trackingSourceRef.current = "optimistic";
      console.info("[Tracking UI] Applying optimistic metric update", {
        metric,
        previousValue,
        nextValue,
        delta,
      });

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
  const handleAudiobookPlaybackStateChange = useCallback((snapshot) => {
    setAudiobookPlaybackSnapshot((currentSnapshot) => {
      const nextSnapshot = {
        bookId: snapshot?.bookId || snapshot?.book?.id || null,
        isPlaying: Boolean(snapshot?.isPlaying),
        isPlayerOpen: Boolean(snapshot?.isPlayerOpen),
        isPlayerMinimized: Boolean(snapshot?.isPlayerMinimized),
      };

      if (
        currentSnapshot.bookId === nextSnapshot.bookId &&
        currentSnapshot.isPlaying === nextSnapshot.isPlaying &&
        currentSnapshot.isPlayerOpen === nextSnapshot.isPlayerOpen &&
        currentSnapshot.isPlayerMinimized === nextSnapshot.isPlayerMinimized
      ) {
        return currentSnapshot;
      }

      return nextSnapshot;
    });
  }, []);
  const handleReadWithAudiobook = useCallback((book) => {
    const title = typeof book?.title === "string" ? book.title.trim() : "";
    if (!title) {
      return;
    }

    const request = {
      id: `${Date.now()}:${title}`,
      title,
      titleNormalized:
        typeof book?.titleNormalized === "string" ? book.titleNormalized.trim() : "",
      author: typeof book?.author === "string" ? book.author.trim() : "",
    };

    setAudiobookLaunchStatus({
      state: "searching",
      title,
    });
    setAudiobookLaunchRequest(request);
  }, []);
  const handleAudiobookLaunchResult = useCallback((result) => {
    const title = result?.requestedTitle || result?.book?.title || "";

    if (result?.ok && result.book?.id) {
      setAudiobookPlaybackSnapshot({
        bookId: result.book.id,
        isPlaying: false,
        isPlayerOpen: true,
        isPlayerMinimized: true,
      });
      setAudiobookLaunchStatus({
        state: "ready",
        title,
      });
    } else {
      setAudiobookLaunchStatus({
        state: "missing",
        title,
      });
    }

    setAudiobookLaunchRequest(null);
  }, []);
  useEffect(() => {
    if (!audiobookLaunchRequest) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setAudiobookLaunchStatus({
        state: "missing",
        title: audiobookLaunchRequest.title,
      });
      setAudiobookLaunchRequest(null);
    }, 8000);

    return () => window.clearTimeout(timeout);
  }, [audiobookLaunchRequest]);
  const shouldKeepListeningTabMounted =
    tab === "listening" ||
    Boolean(audiobookLaunchRequest) ||
    Boolean(audiobookPlaybackSnapshot.bookId && audiobookPlaybackSnapshot.isPlayerOpen);
  const renderModuleContent = useCallback(
    (tabKey) => {
      if (tabKey === "listening") {
        return (
          <ListeningTab
            styles={styles}
            listeningHours={listeningHours}
            adjustListeningHours={adjustListeningHours}
            isMobile={isMobile}
            isCompact={isCompact}
            formatClock={formatClock}
            authUserId={authUserId}
            authResolved={!authLoading}
            audiobooksData={audiobooksData}
            audiobooksLoading={audiobooksLoading}
            audiobooksError={audiobooksError}
            onAudiobookPlaybackStateChange={handleAudiobookPlaybackStateChange}
            audiobookLaunchRequest={audiobookLaunchRequest}
            onAudiobookLaunchResult={handleAudiobookLaunchResult}
          />
        );
      }

      if (tabKey === "reading") {
        return (
          <ReadingTab
            styles={styles}
            wordsRead={wordsRead}
            readingLibrary={readingLibrary}
            lingqStats={lingqStats}
            isMobile={isMobile}
            isCompact={isCompact}
            audiobookLaunchStatus={audiobookLaunchStatus}
            onReadWithAudiobook={handleReadWithAudiobook}
          />
        );
      }

      if (tabKey === "shadowing") {
        return (
          <ShadowingWorkspace
            styles={styles}
            shadowingHours={shadowingHours}
            setShadowingHours={updateShadowingHours}
            isCompact={isCompact}
            isMobile={isMobile}
            authUserId={authUserId}
          />
        );
      }

      if (tabKey === "writing") {
        return (
          <WritingWorkspace
            key={authUserId || "guest-writing"}
            styles={styles}
            setWordsWritten={updateWordsWritten}
            onWritingTotalsRefresh={writingTotals.refresh}
            isCompact={isCompact}
            isMobile={isMobile}
            authUserId={authUserId}
          />
        );
      }

      if (tabKey === "gaming") {
        return (
          <GamingTab
            styles={styles}
            gamingHours={gamingHours}
            gamingData={gamingData}
            isMobile={isMobile}
            isCompact={isCompact}
          />
        );
      }

      return null;
    },
    [
      adjustListeningHours,
      audiobookLaunchRequest,
      audiobookLaunchStatus,
      audiobooksData,
      audiobooksError,
      audiobooksLoading,
      authLoading,
      authUserId,
      gamingData,
      gamingHours,
      handleAudiobookLaunchResult,
      handleAudiobookPlaybackStateChange,
      handleReadWithAudiobook,
      isCompact,
      isMobile,
      lingqStats,
      listeningHours,
      readingLibrary,
      shadowingHours,
      updateShadowingHours,
      updateWordsWritten,
      writingTotals.refresh,
      wordsRead,
    ],
  );
  const mobileSwipeListeningVisible = [
    previousMobileSwipeTab?.key,
    currentMobileSwipeTab?.key,
    nextMobileSwipeTab?.key,
  ].includes("listening");
  const mobileSwipeSlots = useMemo(
    () => [
      { key: "previous", tabItem: previousMobileSwipeTab },
      { key: "current", tabItem: currentMobileSwipeTab },
      { key: "next", tabItem: nextMobileSwipeTab },
    ],
    [currentMobileSwipeTab, nextMobileSwipeTab, previousMobileSwipeTab],
  );

  const clearMobileSwipeReleaseTimer = useCallback(() => {
    if (mobileSwipeReleaseTimerRef.current !== null) {
      window.clearTimeout(mobileSwipeReleaseTimerRef.current);
      mobileSwipeReleaseTimerRef.current = null;
    }
  }, []);

  const setMobileSwipeTrackTransition = useCallback((transitionValue) => {
    if (mobileSwipeTrackRef.current) {
      mobileSwipeTrackRef.current.style.transition = transitionValue;
    }
  }, []);

  const setMobileSwipeTrackOffset = useCallback((nextOffset) => {
    mobileSwipeOffsetRef.current = nextOffset;

    if (mobileSwipeTrackRef.current) {
      mobileSwipeTrackRef.current.style.left = `${nextOffset}px`;
    }
  }, []);

  useLayoutEffect(() => {
    if (!isMobile || !mobileSwipePendingRecenterRef.current) {
      return;
    }

    setMobileSwipeTrackOffset(mobileSwipeBaseOffset);
    mobileSwipePendingRecenterRef.current = false;
  }, [isMobile, mobileSwipeBaseOffset, mobileSwipeCenterTabKey, setMobileSwipeTrackOffset]);

  const settleMobileSwipe = useCallback(
    (targetOffset, nextTabKey = null) => {
      if (!mobileSwipeTrackRef.current) {
        return;
      }

      clearMobileSwipeReleaseTimer();
      mobileSwipeAnimatingRef.current = true;
      setMobileSwipeTrackTransition(mobileSwipeTransitionValue);

      window.requestAnimationFrame(() => {
        setMobileSwipeTrackOffset(targetOffset);
      });

      const transitionDurationMs = prefersReducedMotion ? 120 : 280;

      mobileSwipeReleaseTimerRef.current = window.setTimeout(() => {
        clearMobileSwipeReleaseTimer();
        mobileSwipeAnimatingRef.current = false;
        setMobileSwipeTrackTransition("none");

        if (nextTabKey) {
          // Commit the new center first, then recenter in a layout effect so
          // the old section never snaps back into the middle before paint.
          mobileSwipePendingRecenterRef.current = true;
          setMobileSwipeCenterTabKey(nextTabKey);
          setTab(nextTabKey);
          return;
        }

        setMobileSwipeTrackOffset(mobileSwipeBaseOffset);
      }, transitionDurationMs + 40);
    },
    [
      clearMobileSwipeReleaseTimer,
      mobileSwipeBaseOffset,
      mobileSwipeTransitionValue,
      prefersReducedMotion,
      setMobileSwipeTrackOffset,
      setMobileSwipeTrackTransition,
    ],
  );

  const releaseMobileSwipePointer = useCallback((target, pointerId) => {
    if (
      target &&
      typeof target.hasPointerCapture === "function" &&
      target.hasPointerCapture(pointerId)
    ) {
      target.releasePointerCapture(pointerId);
    }
  }, []);

  const handleMobileSwipePointerDown = useCallback(
    (event) => {
      if (
        !isMobile ||
        !mobileSwipeIsSwipeableTab ||
        mobileSwipeCenterIndex < 0 ||
        mobileSwipeWidth <= 0 ||
        mobileSwipeAnimatingRef.current
      ) {
        return;
      }

      if (event.pointerType === "mouse" || shouldIgnoreMobileSwipeTarget(event.target)) {
        return;
      }

      mobileSwipeSessionRef.current = {
        axis: null,
        lastTime: performance.now(),
        lastX: event.clientX,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        velocityX: 0,
      };

      clearMobileSwipeReleaseTimer();
      setMobileSwipeTrackTransition("none");
    },
    [
      clearMobileSwipeReleaseTimer,
      isMobile,
      mobileSwipeCenterIndex,
      mobileSwipeIsSwipeableTab,
      mobileSwipeWidth,
      setMobileSwipeTrackTransition,
    ],
  );

  const handleMobileSwipePointerMove = useCallback(
    (event) => {
      const session = mobileSwipeSessionRef.current;

      if (!session || session.pointerId !== event.pointerId) {
        return;
      }

      const deltaX = event.clientX - session.startX;
      const deltaY = event.clientY - session.startY;

      if (session.axis === null) {
        if (
          Math.abs(deltaX) < MOBILE_SWIPE_AXIS_LOCK_DISTANCE &&
          Math.abs(deltaY) < MOBILE_SWIPE_AXIS_LOCK_DISTANCE
        ) {
          return;
        }

        if (Math.abs(deltaY) > Math.abs(deltaX) * 1.15) {
          session.axis = "y";
          return;
        }

        if (Math.abs(deltaX) > Math.abs(deltaY) * 1.15) {
          session.axis = "x";

          if (typeof event.currentTarget.setPointerCapture === "function") {
            event.currentTarget.setPointerCapture(event.pointerId);
          }
        } else {
          return;
        }
      }

      if (session.axis !== "x") {
        return;
      }

      event.preventDefault();

      const now = performance.now();
      const elapsed = now - session.lastTime;

      if (elapsed > 0) {
        session.velocityX = ((event.clientX - session.lastX) / elapsed) * 1000;
      }

      session.lastX = event.clientX;
      session.lastTime = now;

      const minOffset = nextMobileSwipeTab
        ? -(mobileSwipeWidth * 2 + MOBILE_SWIPE_PANEL_GAP * 2)
        : mobileSwipeBaseOffset;
      const maxOffset = previousMobileSwipeTab ? 0 : mobileSwipeBaseOffset;
      let nextOffset = mobileSwipeBaseOffset + deltaX;

      if (nextOffset > maxOffset) {
        nextOffset = maxOffset + applyMobileSwipeEdgeResistance(nextOffset - maxOffset);
      }

      if (nextOffset < minOffset) {
        nextOffset = minOffset - applyMobileSwipeEdgeResistance(minOffset - nextOffset);
      }

      setMobileSwipeTrackOffset(nextOffset);
    },
    [
      mobileSwipeBaseOffset,
      mobileSwipeWidth,
      nextMobileSwipeTab,
      previousMobileSwipeTab,
      setMobileSwipeTrackOffset,
    ],
  );

  const handleMobileSwipePointerEnd = useCallback(
    (event) => {
      const session = mobileSwipeSessionRef.current;

      if (!session || session.pointerId !== event.pointerId) {
        return;
      }

      releaseMobileSwipePointer(event.currentTarget, event.pointerId);

      if (session.axis === "x") {
        event.preventDefault();

        const offsetFromCenter = mobileSwipeOffsetRef.current - mobileSwipeBaseOffset;
        const distanceThreshold = mobileSwipeWidth * MOBILE_SWIPE_DISTANCE_RATIO;
        let nextTabKey = null;
        let targetOffset = mobileSwipeBaseOffset;

        if (
          offsetFromCenter > 0 &&
          previousMobileSwipeTab &&
          (offsetFromCenter >= distanceThreshold || session.velocityX >= MOBILE_SWIPE_VELOCITY_THRESHOLD)
        ) {
          nextTabKey = previousMobileSwipeTab.key;
          targetOffset = 0;
        } else if (
          offsetFromCenter < 0 &&
          nextMobileSwipeTab &&
          (Math.abs(offsetFromCenter) >= distanceThreshold ||
            session.velocityX <= -MOBILE_SWIPE_VELOCITY_THRESHOLD)
        ) {
          nextTabKey = nextMobileSwipeTab.key;
          targetOffset = -(mobileSwipeWidth * 2 + MOBILE_SWIPE_PANEL_GAP * 2);
        }

        settleMobileSwipe(targetOffset, nextTabKey);
      }

      mobileSwipeSessionRef.current = null;
    },
    [
      mobileSwipeBaseOffset,
      mobileSwipeWidth,
      nextMobileSwipeTab,
      previousMobileSwipeTab,
      releaseMobileSwipePointer,
      settleMobileSwipe,
    ],
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
    if (!isMobile || !mobileSwipeViewportRef.current) {
      return undefined;
    }

    const viewportNode = mobileSwipeViewportRef.current;
    const updateWidth = () => {
      const nextWidth = viewportNode.getBoundingClientRect().width;
      setMobileSwipeWidth((currentWidth) =>
        Math.abs(currentWidth - nextWidth) > 0.5 ? nextWidth : currentWidth,
      );
    };

    updateWidth();

    if (typeof ResizeObserver === "function") {
      const resizeObserver = new ResizeObserver(() => {
        updateWidth();
      });

      resizeObserver.observe(viewportNode);
      return () => resizeObserver.disconnect();
    }

    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile || mobileSwipeWidth <= 0 || mobileSwipeCenterIndex < 0) {
      return;
    }

    mobileSwipeAnimatingRef.current = false;
    mobileSwipePendingRecenterRef.current = false;
    mobileSwipeSessionRef.current = null;
    clearMobileSwipeReleaseTimer();
    setMobileSwipeTrackTransition("none");
    setMobileSwipeTrackOffset(mobileSwipeBaseOffset);
  }, [
    clearMobileSwipeReleaseTimer,
    isMobile,
    mobileSwipeBaseOffset,
    mobileSwipeCenterIndex,
    mobileSwipeWidth,
    setMobileSwipeTrackOffset,
    setMobileSwipeTrackTransition,
  ]);

  useEffect(
    () => () => {
      clearMobileSwipeReleaseTimer();
    },
    [clearMobileSwipeReleaseTimer],
  );

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
    if (!shouldKeepListeningTabMounted || audiobooksRequestedRef.current) {
      return;
    }

    const fetchAudiobooks = async () => {
      audiobooksRequestedRef.current = true;
      setAudiobooksLoading(true);
      try {
        const response = await fetch("/api/audiobooks", {
          method: "GET",
          cache: "no-store",
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.error || "Failed to load audiobooks.");
        }

        setAudiobooksData(Array.isArray(payload?.audiobooks) ? payload.audiobooks : []);
        setAudiobooksError(null);
      } catch (error) {
        console.error("Failed to load audiobooks", error);
        setAudiobooksData([]);
        setAudiobooksError(error);
      } finally {
        setAudiobooksLoading(false);
      }
    };

    void fetchAudiobooks();
  }, [shouldKeepListeningTabMounted]);

  useEffect(() => {
    let cancelled = false;

    const hydrateTrackingState = async () => {
      if (authLoading) {
        return;
      }

      if (!authUserId) {
        const pendingTotals = getPendingTrackingTotals("");
        trackingReadStrategyRef.current = "local-pending";

        if (hasTrackingTotalsValue(pendingTotals)) {
          applyTrackingTotalsSnapshotRef.current?.(pendingTotals, {
            reason: "initial-load-no-auth",
            source: "local-pending",
            pendingTotals,
          });
        } else {
          console.info("[Tracking UI] No auth session and no pending local totals; retaining bootstrap values", {
            reason: "initial-load-no-auth",
          });
          setTrackingHydrated(true);
        }
        return;
      }

      setTrackingHydrated(false);
      await reconcileTrackingStateFromServerRef.current?.("initial-load-authenticated");
      if (cancelled) {
        return;
      }
    };

    void hydrateTrackingState();

    return () => {
      cancelled = true;
    };
  }, [authLoading, authUserId]);

  useEffect(() => {
    if (authLoading) {
      return undefined;
    }

    let cancelled = false;

    const flushQueuedTracking = async () => {
      const result = await flushPendingTrackingEvents(authUserId);
      if (!result?.ok || cancelled || !trackingHydrated) {
        return;
      }

      if (authUserId && result.flushedCount > 0) {
        await reconcileTrackingStateFromServerRef.current?.("pending-flush");
      }
    };

    void flushQueuedTracking();

    const handleOnline = () => {
      void flushQueuedTracking();
    };

    const handleWindowFocus = () => {
      void flushQueuedTracking();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void flushQueuedTracking();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [authLoading, authUserId, trackingHydrated]);

  useEffect(() => {
    if (authLoading || !trackingHydrated) {
      return;
    }

    const gamingResolution = resolveGamingMetricSource();
    applyResolvedMetricValue("gaming", gamingResolution.value, gamingResolution);
  }, [
    applyResolvedMetricValue,
    authLoading,
    authUserId,
    gamingTotalMinutes,
    resolveGamingMetricSource,
    trackingHydrated,
  ]);

  useEffect(() => {
    if (authLoading || !trackingHydrated) {
      return;
    }

    const readingResolution = resolveReadingMetricSource();
    applyResolvedMetricValue("reading", readingResolution.value, readingResolution);
  }, [
    applyResolvedMetricValue,
    authLoading,
    lingqStats.configured,
    lingqStats.error,
    lingqStats.fetchedAt,
    lingqStats.hasStats,
    lingqStats.loading,
    lingqStats.totalWordsRead,
    resolveReadingMetricSource,
    trackingHydrated,
  ]);

  useEffect(() => {
    if (authLoading || !trackingHydrated) {
      return;
    }

    const writingResolution = resolveWritingMetricSource();
    applyResolvedMetricValue("writing", writingResolution.value, writingResolution);
  }, [
    applyResolvedMetricValue,
    authLoading,
    resolveWritingMetricSource,
    trackingHydrated,
    writingTotals.error,
    writingTotals.loading,
    writingTotals.totalWords,
  ]);

  if (!authUserId && !isLocalDevelopmentAuthBypass) {
    return <AuthGate isLoading={authLoading} />;
  }

  return (
    <main
      className="app-shell"
      style={{
        ...styles.page,
        ...(isMobile ? styles.mobilePageSafeArea(showDashboard) : null),
      }}
    >
      <div style={{ ...styles.bgOrb1, ...(isMobile ? styles.mobileBgOrb1 : null) }} />
      <div style={{ ...styles.bgOrb2, ...(isMobile ? styles.mobileBgOrb2 : null) }} />
      {isMobile && <div style={styles.mobileTopWash} />}

      <div style={styles.container}>
        <TopNav
          activeTab={tab}
          authControl={
            <MagicLinkAuth
              user={authUser}
              isCompact={isCompact}
              isMobile={isMobile}
              isLoading={authLoading}
            />
          }
          authUserId={authUserId}
          isCompact={isCompact}
          isMobile={isMobile}
          moduleTabs={MODULE_TABS}
          onChange={handleTabChange}
          onToggleDashboard={() => {
            if (isMobile) {
              setShowMobileDashboard((visible) => !visible);
              return;
            }

            setShowDesktopDashboard((visible) => !visible);
          }}
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
              ...(isMobile ? styles.mobileTrackerSection : null),
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
                estimatedWritingHours={estimatedWritingHours}
                gamingHoursLabel={formatHours(gamingHours)}
                gamingHours={gamingHours}
                shadowingHoursLabel={formatHours(shadowingHours)}
                shadowingHours={shadowingHours}
                writingHoursLabel={formatHours(estimatedWritingHours)}
                wordsWrittenLabel={formatWords(wordsWritten)}
                wordsWritten={wordsWritten}
                onAdjustMetric={adjustMetricByDelta}
                authUserId={authUserId}
                isMobile={isMobile}
                isCompact={isCompact}
                isVisible={showDashboard}
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
            ) : null}
          </section>
        )}

        {!showDashboard || !isMobile ? (
          <section
            style={isMobile ? styles.contentWrapMobile(mobileBottomInset) : styles.contentWrap}
          >
            {isMobile && mobileSwipeIsSwipeableTab && currentMobileSwipeTab ? (
              <>
                <div
                  ref={mobileSwipeViewportRef}
                  style={styles.mobileSwipeViewport}
                  onPointerCancel={handleMobileSwipePointerEnd}
                  onPointerDown={handleMobileSwipePointerDown}
                  onPointerMove={handleMobileSwipePointerMove}
                  onPointerUp={handleMobileSwipePointerEnd}
                >
                  {mobileSwipeWidth > 0 ? (
                    <div
                      ref={mobileSwipeTrackRef}
                      style={styles.mobileSwipeTrack(mobileSwipeWidth, mobileSwipeBaseOffset)}
                    >
                      {mobileSwipeSlots.map(({ key, tabItem }) => (
                        <div
                          key={`mobile-swipe-slot-${key}`}
                          aria-hidden={tabItem?.key !== currentMobileSwipeTab.key}
                          style={styles.mobileSwipePanel(
                            mobileSwipeWidth,
                            tabItem?.key === currentMobileSwipeTab.key,
                            mobileBottomInset,
                          )}
                        >
                          {tabItem ? (
                            <div key={tabItem.key}>
                              {renderModuleContent(tabItem.key)}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={styles.mobileSwipeFallbackPanel(mobileBottomInset)}>
                      {renderModuleContent(currentMobileSwipeTab.key)}
                    </div>
                  )}
                </div>

                {shouldKeepListeningTabMounted && !mobileSwipeListeningVisible ? (
                  <div style={styles.hiddenKeepAlive}>{renderModuleContent("listening")}</div>
                ) : null}
              </>
            ) : (
              <>
                {shouldKeepListeningTabMounted && (
                  <div
                    style={{
                      ...(tab === "listening" ? styles.mobileSwipeFallbackPanel(mobileBottomInset) : styles.hiddenKeepAlive),
                    }}
                  >
                    {renderModuleContent("listening")}
                  </div>
                )}
                {tab === "reading" ? (
                  <div style={styles.mobileSwipeFallbackPanel(mobileBottomInset)}>
                    {renderModuleContent("reading")}
                  </div>
                ) : null}
                {tab === "shadowing" ? (
                  <div style={styles.mobileSwipeFallbackPanel(mobileBottomInset)}>
                    {renderModuleContent("shadowing")}
                  </div>
                ) : null}
                {tab === "writing" ? (
                  <div style={styles.mobileSwipeFallbackPanel(mobileBottomInset)}>
                    {renderModuleContent("writing")}
                  </div>
                ) : null}
                {tab === "gaming" ? (
                  <div style={styles.mobileSwipeFallbackPanel(mobileBottomInset)}>
                    {renderModuleContent("gaming")}
                  </div>
                ) : null}
              </>
            )}
          </section>
        ) : null}
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
    width: "100%",
    background: "var(--app-page-bg)",
    fontFamily: "Inter, system-ui, -apple-system, sans-serif",
    color: "var(--app-page-text)",
    paddingTop: "16px",
    paddingRight: "16px",
    paddingBottom: "16px",
    paddingLeft: "16px",
    position: "relative",
    overflowX: "hidden",
    boxSizing: "border-box",
  },
  mobilePageSafeArea: (hasPinnedTracker) => ({
    paddingTop: "16px",
    paddingBottom: hasPinnedTracker ? "16px" : "136px",
    height: hasPinnedTracker ? "100dvh" : "auto",
    overflowY: hasPinnedTracker ? "hidden" : "visible",
  }),
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
  mobileBgOrb1: {
    top: "92px",
    left: "-150px",
    opacity: 0.42,
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
  mobileBgOrb2: {
    top: "110px",
    right: "-170px",
    opacity: 0.34,
  },
  mobileTopWash: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "150px",
    background: "var(--app-mobile-top-wash)",
    pointerEvents: "none",
    zIndex: 0,
  },
  container: {
    maxWidth: "1300px",
    width: "100%",
    margin: "0 auto",
    position: "relative",
    zIndex: 1,
    display: "grid",
    gap: "14px",
    minWidth: 0,
  },
  heroGrid: {
    display: "grid",
    gridTemplateColumns: "1.6fr 1fr",
    gap: "14px",
    alignItems: "stretch",
    transition: "grid-template-columns 280ms cubic-bezier(0.22, 1, 0.36, 1), gap 280ms ease",
  },
  mobileTrackerSection: {
    minHeight: "calc(100dvh - 112px)",
    maxHeight: "calc(100dvh - 112px)",
    alignItems: "stretch",
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
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
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
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
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
  topNavShell: (isCompact, isMobile) => ({
    ...glass,
    borderRadius: isMobile ? "0px" : "26px",
    padding: isMobile
      ? "10px 12px 25px 12px"
      : isCompact
      ? "10px 12px"
      : "12px 14px",
    display: "grid",
    gridTemplateColumns: isMobile ? "repeat(5, minmax(0, 1fr))" : "1fr auto 1fr",
    alignItems: "center",
    gap: isMobile ? "0" : isCompact ? "8px" : "14px",
    position: isMobile ? "fixed" : "relative",
    left: isMobile ? "0" : "auto",
    right: isMobile ? "0" : "auto",
    bottom: isMobile ? "0" : "auto",
    width: isMobile ? "100%" : "auto",
    maxWidth: isMobile ? "100%" : "none",
    margin: isMobile ? "0 auto" : 0,
    borderTop: isMobile ? "1px solid rgba(255,255,255,0.64)" : undefined,
    boxShadow: isMobile
      ? "0 -18px 36px rgba(15,23,42,0.12)"
      : "var(--app-glass-shadow)",
    zIndex: isMobile ? 100 : 12,
  }),
  topNavLeft: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    minWidth: 0,
    justifySelf: "start",
  },
  topNavCenter: {
    display: "flex",
    justifyContent: "center",
    minWidth: 0,
    overflow: "visible",
  },
  mobileNavItemWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
  },
  topNavRight: {
    display: "flex",
    justifyContent: "flex-end",
    minWidth: 0,
    justifySelf: "end",
  },
  topNavIconButton: (active, isMobile) => ({
    width: isMobile ? "44px" : "38px",
    height: isMobile ? "44px" : "38px",
    minHeight: isMobile ? "44px" : "38px",
    borderRadius: isMobile ? "12px" : "999px",
    border: isMobile
      ? "none"
      : active
      ? "1px solid var(--app-selected-border)"
      : "1px solid var(--app-border-soft)",
    background: isMobile
      ? "transparent"
      : active
      ? "var(--app-selected-surface)"
      : "var(--app-surface-elevated)",
    color: active
      ? isMobile
        ? "var(--app-text)"
        : "var(--app-selected-text)"
      : "var(--app-text-muted)",
    display: "inline-flex",
    flexDirection: isMobile ? "column" : "row",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: isMobile
      ? "none"
      : active
      ? "0 10px 24px rgba(15,23,42,0.14)"
      : "0 10px 24px rgba(15,23,42,0.08)",
    flexShrink: 0,
    gap: "0",
    padding: "0",
    opacity: active || !isMobile ? 1 : 0.58,
    transition: "color 180ms ease, opacity 180ms ease",
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
  contentWrap: { minWidth: 0, width: "100%" },
  contentWrapMobile: (bottomInset) => ({
    minWidth: 0,
    width: "100%",
    marginBottom: `-${bottomInset}px`,
  }),
  mobileSwipeViewport: {
    width: `calc(100% + ${MOBILE_SWIPE_PANEL_SIDE_PADDING * 2}px)`,
    minWidth: 0,
    overflowX: "hidden",
    overflowY: "visible",
    position: "relative",
    touchAction: "pan-y",
    marginLeft: `-${MOBILE_SWIPE_PANEL_SIDE_PADDING}px`,
    marginRight: `-${MOBILE_SWIPE_PANEL_SIDE_PADDING}px`,
    background: "transparent",
    boxSizing: "border-box",
  },
  mobileSwipeTrack: (width, baseOffset) => ({
    display: "flex",
    alignItems: "flex-start",
    gap: `${MOBILE_SWIPE_PANEL_GAP}px`,
    width:
      width > 0
        ? `${width * 3 + MOBILE_SWIPE_PANEL_GAP * 2}px`
        : `calc(300% + ${MOBILE_SWIPE_PANEL_GAP * 2}px)`,
    minWidth: 0,
    position: "relative",
    left: width > 0 ? `${baseOffset}px` : "0px",
    transition: "none",
    willChange: "left",
  }),
  mobileSwipePanel: (width, active, bottomInset) => ({
    flex: width > 0 ? `0 0 ${width}px` : "0 0 100%",
    width: width > 0 ? `${width}px` : "100%",
    minWidth: 0,
    boxSizing: "border-box",
    paddingLeft: `${MOBILE_SWIPE_PANEL_SIDE_PADDING}px`,
    paddingRight: `${MOBILE_SWIPE_PANEL_SIDE_PADDING}px`,
    paddingTop: `${MOBILE_SWIPE_PANEL_VERTICAL_PADDING}px`,
    paddingBottom: `${bottomInset + MOBILE_SWIPE_PANEL_VERTICAL_PADDING}px`,
    background: "transparent",
    pointerEvents: active ? "auto" : "none",
    overflow: "visible",
  }),
  mobileSwipeFallbackPanel: (bottomInset) => ({
    minWidth: 0,
    width: "100%",
    boxSizing: "border-box",
    paddingLeft: `${MOBILE_SWIPE_PANEL_SIDE_PADDING}px`,
    paddingRight: `${MOBILE_SWIPE_PANEL_SIDE_PADDING}px`,
    paddingTop: `${MOBILE_SWIPE_PANEL_VERTICAL_PADDING}px`,
    paddingBottom: `${bottomInset + MOBILE_SWIPE_PANEL_VERTICAL_PADDING}px`,
    background: "transparent",
  }),
  hiddenKeepAlive: {
    display: "none",
  },
  moduleNavTrack: {
    display: "flex",
    gap: "6px",
    padding: "0",
    borderRadius: "999px",
    background: "transparent",
    border: "none",
    width: "fit-content",
    maxWidth: "100%",
    overflowX: "auto",
    scrollbarWidth: "none",
  },
  moduleNavButton: (active, isMobile) => ({
    border: "none",
    borderRadius: isMobile ? "12px" : "999px",
    background: isMobile ? "transparent" : active ? "var(--app-selected-surface)" : "transparent",
    color: active
      ? isMobile
        ? "var(--app-text)"
        : "var(--app-selected-text)"
      : "var(--app-text-muted)",
    cursor: "pointer",
    padding: isMobile ? "0" : active ? "10px 20px" : "10px",
    display: "inline-flex",
    flexDirection: isMobile ? "column" : "row",
    alignItems: "center",
    justifyContent: "center",
    gap: isMobile ? "6px" : "0",
    fontWeight: 700,
    fontSize: isMobile ? "11px" : "13px",
    width: isMobile ? "44px" : "auto",
    height: isMobile ? "44px" : "auto",
    minHeight: isMobile ? "44px" : "0",
    transition: "all 300ms cubic-bezier(0.23, 1, 0.32, 1)",
    boxShadow: isMobile
      ? "none"
      : active
      ? "0 4px 12px rgba(15,23,42,0.12), inset 0 1px 0 rgba(255,255,255,0.04)"
      : "none",
    opacity: active || !isMobile ? 1 : 0.58,
  }),
  listeningMainGrid: {
    display: "grid",
    gap: "14px",
    minWidth: 0,
    width: "100%",
  },
  largeCard: {
    ...glass,
    borderRadius: "26px",
    padding: "20px",
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
  },
  sideColumn: {
    display: "grid",
    gap: "14px",
    minWidth: 0,
  },
  sideCard: {
    ...glass,
    borderRadius: "26px",
    padding: "20px",
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
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
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
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
  playerProgressTrack: {
    position: "relative",
    height: "4px",
    borderRadius: "999px",
    overflow: "hidden",
    background: "var(--app-progress-track)",
  },
  playerProgressFill: (progress) => ({
    position: "absolute",
    inset: 0,
    width: `${Math.max(0, Math.min(100, progress * 100))}%`,
    borderRadius: "999px",
    background: "rgba(234, 179, 8, 0.9)",
    transition: "width 180ms linear",
  }),
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
    minWidth: 0,
    width: "100%",
    boxSizing: "border-box",
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
    minWidth: 0,
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
  controlGridSingle: { marginTop: "20px", minWidth: 0 },
  inputCard: { display: "grid", gap: "6px", minWidth: 0 },
  inputLabel: {
    fontSize: "11px",
    fontWeight: 700,
    color: "var(--app-text-muted)",
    textTransform: "uppercase",
  },
  input: {
    width: "100%",
    padding: "10px",
    borderRadius: "10px",
    border: "1px solid var(--app-border)",
    background: "var(--app-surface)",
    color: "var(--app-text)",
    fontSize: "14px",
    boxSizing: "border-box",
  },
};

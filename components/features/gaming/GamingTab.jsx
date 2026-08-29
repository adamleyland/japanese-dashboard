"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LibraryBig, RefreshCcw, X } from "lucide-react";
import GamingLibraryPanel from "@/components/features/gaming/components/GamingLibraryPanel";
import CurrentlyPlayingCard from "@/components/features/gaming/components/CurrentlyPlayingCard";
import GamingVisualizationCard from "@/components/features/gaming/components/GamingVisualizationCard";
import GameAchievementsModal from "@/components/features/gaming/components/GameAchievementsModal";
import useGamingTotals from "@/hooks/useGamingTotals";
import {
  DEFAULT_GAMING_LIBRARY_VIEW,
  DEFAULT_GAMING_LAYOUT_MODE,
  DEFAULT_GAMING_SORT,
  DEFAULT_GAMING_SOURCE_FILTER,
} from "@/lib/gaming/gaming-utils";
import {
  getCurrentlyPlayingGame,
  getVisibleLibraryGames,
  selectIncludedGames,
} from "@/lib/gaming/selectors";
import { fetchProfileGamingGoal, persistProfileGamingGoal } from "@/lib/profiles";

const GAMING_SORT_STORAGE_KEY = "jp_gaming_sort";
const GAMING_SOURCE_STORAGE_KEY = "jp_gaming_source_filter";
const GAMING_LIBRARY_VIEW_STORAGE_KEY = "jp_gaming_library_view";
const GAMING_LAYOUT_MODE_STORAGE_KEY = "jp_gaming_layout_mode";
const GAMING_GOAL_STORAGE_KEY = "jp_gaming_playtime_goal_hours";
const GAMING_GOAL_SETTINGS_STORAGE_KEY = "jp_gaming_goal_settings_open";
const DEFAULT_GAMING_GOAL_HOURS = 500;

function normalizeGamingGoal(value, fallback = DEFAULT_GAMING_GOAL_HOURS) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : fallback;
}

function getGamingGoalStorageKey(userId = "") {
  return userId ? `${GAMING_GOAL_STORAGE_KEY}:${userId}` : GAMING_GOAL_STORAGE_KEY;
}

function readCachedGamingGoal(userId = "") {
  if (typeof window === "undefined") {
    return null;
  }

  const storedValue = window.localStorage.getItem(getGamingGoalStorageKey(userId));
  const numericValue = Number(storedValue);
  return storedValue !== null && Number.isFinite(numericValue) && numericValue > 0
    ? numericValue
    : null;
}

function writeCachedGamingGoal(value, userId = "") {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    getGamingGoalStorageKey(userId),
    String(normalizeGamingGoal(value)),
  );
}

export default function GamingTab({
  styles,
  gamingHours,
  gamingData,
  isMobile,
  isCompact,
  authUserId,
  authResolved,
}) {
  const { games, loading, error, toggleGameIncluded, refreshAll, sourceStatus, achievementSummaries } = gamingData;
  const rightColumnRef = useRef(null);
  const [libraryHeight, setLibraryHeight] = useState(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [achievementGame, setAchievementGame] = useState(null);
  const goalHoursRef = useRef(DEFAULT_GAMING_GOAL_HOURS);
  const goalRequestRef = useRef(0);
  const goalEditVersionRef = useRef(0);
  const resolvedGoalUserRef = useRef(null);
  const [sortKey, setSortKey] = useState(() => {
    if (typeof window === "undefined") {
      return DEFAULT_GAMING_SORT;
    }

    return window.localStorage.getItem(GAMING_SORT_STORAGE_KEY) || DEFAULT_GAMING_SORT;
  });
  const [sourceFilter, setSourceFilter] = useState(() => {
    if (typeof window === "undefined") {
      return DEFAULT_GAMING_SOURCE_FILTER;
    }

    const storedSourceFilter = window.localStorage.getItem(GAMING_SOURCE_STORAGE_KEY);

    // The local-games integration is temporarily hidden from the UI. Reset any
    // previously saved selection so the library does not open to an empty view.
    return storedSourceFilter === "local"
      ? DEFAULT_GAMING_SOURCE_FILTER
      : storedSourceFilter || DEFAULT_GAMING_SOURCE_FILTER;
  });
  const [libraryView, setLibraryView] = useState(() => {
    if (typeof window === "undefined") {
      return DEFAULT_GAMING_LIBRARY_VIEW;
    }

    return (
      window.localStorage.getItem(GAMING_LIBRARY_VIEW_STORAGE_KEY) ||
      DEFAULT_GAMING_LIBRARY_VIEW
    );
  });
  const [layoutMode, setLayoutMode] = useState(() => {
    if (typeof window === "undefined") {
      return DEFAULT_GAMING_LAYOUT_MODE;
    }

    return (
      window.localStorage.getItem(GAMING_LAYOUT_MODE_STORAGE_KEY) ||
      DEFAULT_GAMING_LAYOUT_MODE
    );
  });
  const [goalHours, setGoalHours] = useState(() => {
    if (typeof window === "undefined") {
      return DEFAULT_GAMING_GOAL_HOURS;
    }

    return readCachedGamingGoal("") ?? DEFAULT_GAMING_GOAL_HOURS;
  });
  const [goalSettingsOpen, setGoalSettingsOpen] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem(GAMING_GOAL_SETTINGS_STORAGE_KEY) === "true";
  });
  const { totalMinutes, topGames } = useGamingTotals(games);

  const setGamingGoal = useCallback(
    (nextValueOrUpdater, { source = "user", userIdOverride } = {}) => {
      const previousGoal = goalHoursRef.current;
      const rawNextGoal =
        typeof nextValueOrUpdater === "function"
          ? nextValueOrUpdater(previousGoal)
          : nextValueOrUpdater;
      const nextGoal = normalizeGamingGoal(rawNextGoal, previousGoal);
      const targetUserId =
        typeof userIdOverride === "string" ? userIdOverride : authUserId || "";

      if (Math.abs(previousGoal - nextGoal) >= 0.000001) {
        goalHoursRef.current = nextGoal;
        setGoalHours(nextGoal);
      }

      writeCachedGamingGoal(nextGoal, targetUserId);

      if (source !== "hydrate") {
        goalEditVersionRef.current += 1;
      }

      if (source === "user" && authResolved && targetUserId) {
        void persistProfileGamingGoal(targetUserId, nextGoal);
      }
    },
    [authResolved, authUserId],
  );

  useEffect(() => {
    const animationFrameId = window.requestAnimationFrame(() => {
      setHasMounted(true);
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(GAMING_SORT_STORAGE_KEY, sortKey);
  }, [sortKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(GAMING_SOURCE_STORAGE_KEY, sourceFilter);
  }, [sourceFilter]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(GAMING_LIBRARY_VIEW_STORAGE_KEY, libraryView);
  }, [libraryView]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(GAMING_LAYOUT_MODE_STORAGE_KEY, layoutMode);
  }, [layoutMode]);

  useEffect(() => {
    goalHoursRef.current = goalHours;
  }, [goalHours]);

  useEffect(() => {
    if (!authResolved) {
      return undefined;
    }

    let isActive = true;
    const requestId = ++goalRequestRef.current;
    const startingEditVersion = goalEditVersionRef.current;
    const previousResolvedUserId = resolvedGoalUserRef.current;
    resolvedGoalUserRef.current = authUserId || null;

    if (!authUserId) {
      setGamingGoal(readCachedGamingGoal("") ?? DEFAULT_GAMING_GOAL_HOURS, {
        source: "hydrate",
        userIdOverride: "",
      });
      return () => {
        isActive = false;
      };
    }

    const scopedGoal = readCachedGamingGoal(authUserId);
    const legacyGoal = readCachedGamingGoal("");
    const cachedGoal = scopedGoal ?? legacyGoal;
    const isUserSwitch =
      Boolean(previousResolvedUserId) && previousResolvedUserId !== authUserId;

    if (cachedGoal !== null) {
      setGamingGoal(cachedGoal, {
        source: "hydrate",
        userIdOverride: authUserId,
      });
    } else if (isUserSwitch) {
      setGamingGoal(DEFAULT_GAMING_GOAL_HOURS, {
        source: "hydrate",
        userIdOverride: authUserId,
      });
    }

    const hydrateGamingGoal = async () => {
      const profileGoal = await fetchProfileGamingGoal(authUserId);

      if (!isActive || goalRequestRef.current !== requestId) {
        return;
      }

      if (goalEditVersionRef.current !== startingEditVersion) {
        return;
      }

      if (profileGoal !== null) {
        setGamingGoal(profileGoal, {
          source: "hydrate",
          userIdOverride: authUserId,
        });
        return;
      }

      const goalToMigrate = cachedGoal ?? goalHoursRef.current;
      writeCachedGamingGoal(goalToMigrate, authUserId);
      await persistProfileGamingGoal(authUserId, goalToMigrate);
    };

    void hydrateGamingGoal();

    return () => {
      isActive = false;
    };
  }, [authResolved, authUserId, setGamingGoal]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      GAMING_GOAL_SETTINGS_STORAGE_KEY,
      String(goalSettingsOpen),
    );
  }, [goalSettingsOpen]);

  useEffect(() => {
    if (!isMobile || !isLibraryOpen || typeof document === "undefined") {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isLibraryOpen, isMobile]);

  useEffect(() => {
    if (typeof window === "undefined" || isMobile) {
      return;
    }

    const rightColumnNode = rightColumnRef.current;
    if (!rightColumnNode) {
      return;
    }

    const updateLibraryHeight = () => {
      const nextHeight = Math.round(rightColumnNode.getBoundingClientRect().height);
      setLibraryHeight((currentHeight) =>
        currentHeight === nextHeight ? currentHeight : nextHeight,
      );
    };

    updateLibraryHeight();

    const resizeObserver = new ResizeObserver(() => {
      updateLibraryHeight();
    });

    resizeObserver.observe(rightColumnNode);
    window.addEventListener("resize", updateLibraryHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateLibraryHeight);
    };
  }, [isMobile]);

  const includedGames = useMemo(() => selectIncludedGames(games), [games]);

  const visibleGames = useMemo(
    () => getVisibleLibraryGames(games, { sortKey, sourceFilter, viewMode: libraryView }),
    [games, libraryView, sortKey, sourceFilter],
  );

  const currentGame = useMemo(
    () => getCurrentlyPlayingGame(includedGames),
    [includedGames],
  );
  const hasSourceData = games.length > 0;

  const handleRefresh = useCallback(() => {
    refreshAll();
  }, [refreshAll]);

  const handleSourceFilterChange = useCallback((nextSourceFilter) => {
    setSourceFilter(nextSourceFilter);
    setLibraryView("included");
  }, []);

  const handleExcludedViewToggle = useCallback((showExcludedOnly) => {
    setLibraryView(showExcludedOnly ? "excluded" : "included");
  }, []);

  const visualizationMinutes = hasSourceData ? totalMinutes : Math.round(gamingHours * 60);
  const constrainedLibraryHeight = isMobile ? null : libraryHeight;
  const gamingLibraryPanelProps = {
    styles,
    games: visibleGames,
    loading,
    error,
    sourceFilter,
    onSourceFilterChange: handleSourceFilterChange,
    showExcludedOnly: libraryView === "excluded",
    onToggleExcludedView: handleExcludedViewToggle,
    layoutMode,
    onLayoutModeChange: setLayoutMode,
    sortKey,
    onSortKeyChange: setSortKey,
    onToggleInclude: toggleGameIncluded,
    onRefresh: handleRefresh,
    sourceStatus,
    isCompact,
    achievementSummaries,
    onOpenAchievements: setAchievementGame,
  };

  return (
    <div
      style={{
        ...styles.listeningMainGrid,
        gridTemplateColumns: isMobile ? "1fr" : "1.6fr 1fr",
        alignItems: "start",
        minHeight: 0,
      }}
    >
      {isMobile ? (
        <CurrentlyPlayingCard
          styles={styles}
          currentGame={currentGame}
          loading={loading}
          isMobile={isMobile}
          onOpenDetails={setAchievementGame}
        />
      ) : (
        <GamingLibraryPanel
          {...gamingLibraryPanelProps}
          isMobile={false}
          targetHeight={constrainedLibraryHeight}
        />
      )}

      {isMobile ? (
        <button
          type="button"
          onClick={() => setIsLibraryOpen(true)}
          style={mobileStyles.libraryLauncher}
        >
          <span style={mobileStyles.libraryLauncherLabel}>Library</span>
          <div style={mobileStyles.libraryLauncherMeta}>
            <span style={mobileStyles.libraryLauncherCount}>{includedGames.length} games</span>
            <span style={mobileStyles.libraryLauncherIconWrap}>
              <LibraryBig size={18} />
            </span>
          </div>
        </button>
      ) : null}

      <div ref={isMobile ? null : rightColumnRef} style={{ ...styles.sideColumn, minHeight: 0 }}>
        {!isMobile ? (
          <CurrentlyPlayingCard
            styles={styles}
            currentGame={currentGame}
            loading={loading}
            onOpenDetails={setAchievementGame}
          />
        ) : null}
        <GamingVisualizationCard
          styles={styles}
          totalMinutes={visualizationMinutes}
          goalHours={goalHours}
          setGoalHours={setGamingGoal}
          settingsOpen={goalSettingsOpen}
          setSettingsOpen={setGoalSettingsOpen}
          topGames={topGames}
          isMobile={isMobile}
          isCompact={isCompact}
        />
      </div>

      {hasMounted && isMobile && isLibraryOpen
        ? createPortal(
            <div style={mobileStyles.libraryOverlay}>
              <div style={mobileStyles.librarySheet}>
                <div style={mobileStyles.librarySheetHeader}>
                  <div style={mobileStyles.librarySheetHeaderCopy}>
                    <h3 style={mobileStyles.librarySheetTitle}>Gaming Library</h3>
                  </div>

                  <div style={mobileStyles.libraryHeaderActions}>
                    <button
                      type="button"
                      onClick={handleRefresh}
                      style={mobileStyles.libraryHeaderIconButton}
                      aria-label="Refresh gaming library"
                      title="Refresh gaming library"
                    >
                      <RefreshCcw size={16} />
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsLibraryOpen(false)}
                      style={mobileStyles.libraryHeaderIconButton}
                      aria-label="Close gaming library"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                <GamingLibraryPanel
                  {...gamingLibraryPanelProps}
                  isMobile
                  isOverlay
                  showRefreshButton={false}
                  targetHeight={null}
                />
              </div>
            </div>,
            document.body,
          )
        : null}
      {achievementGame ? <GameAchievementsModal game={achievementGame} onClose={() => setAchievementGame(null)} onUpdateLocalArtwork={gamingData.updateLocalArtwork} onDeleteLocalGame={gamingData.deleteLocalGame} /> : null}
    </div>
  );
}

const mobileStyles = {
  libraryLauncher: {
    border: "1px solid var(--app-border-soft)",
    background: "var(--app-card)",
    borderRadius: "18px",
    padding: "12px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    textAlign: "left",
    boxShadow: "0 16px 36px rgba(15,23,42,0.08)",
    cursor: "pointer",
  },
  libraryLauncherLabel: {
    fontSize: "14px",
    fontWeight: 700,
    lineHeight: 1.2,
    color: "var(--app-text)",
    minWidth: 0,
  },
  libraryLauncherMeta: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexShrink: 0,
  },
  libraryLauncherCount: {
    fontSize: "12px",
    color: "var(--app-text-muted)",
  },
  libraryLauncherIconWrap: {
    width: "34px",
    height: "34px",
    borderRadius: "12px",
    border: "1px solid var(--app-border)",
    background: "var(--app-surface)",
    color: "var(--app-text-soft)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  libraryOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 10001,
    width: "100%",
    height: "100dvh",
    background: "#ffffff",
  },
  librarySheet: {
    position: "absolute",
    inset: 0,
    display: "grid",
    gridTemplateRows: "auto minmax(0, 1fr)",
    gap: "10px",
    border: "none",
    background: "#ffffff",
    borderRadius: 0,
    padding: "calc(12px + env(safe-area-inset-top, 0px)) 14px calc(12px + env(safe-area-inset-bottom, 0px))",
    boxShadow: "none",
    color: "#0f172a",
    "--app-surface": "#ffffff",
    "--app-surface-strong": "#ffffff",
    "--app-surface-soft": "#f8fafc",
    "--app-surface-elevated": "#ffffff",
    "--app-card": "#ffffff",
    "--app-card-muted": "#f8fafc",
    "--app-border": "rgba(15, 23, 42, 0.12)",
    "--app-border-soft": "rgba(15, 23, 42, 0.07)",
    "--app-text": "#0f172a",
    "--app-text-soft": "#334155",
    "--app-text-muted": "#64748b",
    "--app-pill-track": "#f1f5f9",
    "--app-pill-slider": "#ffffff",
    "--app-selected-surface": "#111827",
    "--app-selected-border": "#111827",
    "--app-selected-text": "#ffffff",
  },
  librarySheetHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    minHeight: "42px",
  },
  librarySheetHeaderCopy: {
    minWidth: 0,
  },
  libraryHeaderActions: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexShrink: 0,
  },
  librarySheetTitle: {
    margin: 0,
    fontSize: "22px",
    fontWeight: 800,
    lineHeight: 1.15,
    letterSpacing: "-0.03em",
    color: "var(--app-text)",
  },
  libraryHeaderIconButton: {
    width: "38px",
    height: "38px",
    border: "1px solid var(--app-border)",
    background: "var(--app-surface)",
    color: "var(--app-text-soft)",
    borderRadius: "999px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: "none",
    flexShrink: 0,
  },
};

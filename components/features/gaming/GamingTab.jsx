"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LibraryBig, RefreshCcw, X } from "lucide-react";
import GamingLibraryPanel from "@/components/features/gaming/components/GamingLibraryPanel";
import CurrentlyPlayingCard from "@/components/features/gaming/components/CurrentlyPlayingCard";
import GamingVisualizationCard from "@/components/features/gaming/components/GamingVisualizationCard";
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

const GAMING_SORT_STORAGE_KEY = "jp_gaming_sort";
const GAMING_SOURCE_STORAGE_KEY = "jp_gaming_source_filter";
const GAMING_LIBRARY_VIEW_STORAGE_KEY = "jp_gaming_library_view";
const GAMING_LAYOUT_MODE_STORAGE_KEY = "jp_gaming_layout_mode";

export default function GamingTab({
  styles,
  gamingHours,
  gamingData,
  isMobile,
  isCompact,
}) {
  const { games, loading, error, toggleGameIncluded, refreshAll, sourceStatus } = gamingData;
  const rightColumnRef = useRef(null);
  const [libraryHeight, setLibraryHeight] = useState(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
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

    return (
      window.localStorage.getItem(GAMING_SOURCE_STORAGE_KEY) || DEFAULT_GAMING_SOURCE_FILTER
    );
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
  const { totalMinutes, includedCount, excludedCount, topGames } = useGamingTotals(games);

  useEffect(() => {
    setHasMounted(true);
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
        <CurrentlyPlayingCard styles={styles} currentGame={currentGame} loading={loading} />
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
            <span style={mobileStyles.libraryLauncherCount}>{visibleGames.length} games</span>
            <span style={mobileStyles.libraryLauncherIconWrap}>
              <LibraryBig size={18} />
            </span>
          </div>
        </button>
      ) : null}

      <div ref={isMobile ? null : rightColumnRef} style={{ ...styles.sideColumn, minHeight: 0 }}>
        {!isMobile ? (
          <CurrentlyPlayingCard styles={styles} currentGame={currentGame} loading={loading} />
        ) : null}
        <GamingVisualizationCard
          styles={styles}
          totalMinutes={visualizationMinutes}
          includedCount={hasSourceData ? includedCount : 0}
          excludedCount={hasSourceData ? excludedCount : 0}
          topGames={topGames}
          isMobile={isMobile}
        />
      </div>

      {hasMounted && isMobile && isLibraryOpen
        ? createPortal(
            <div style={mobileStyles.libraryOverlay}>
              <div
                style={mobileStyles.libraryBackdrop}
                onClick={() => setIsLibraryOpen(false)}
              />
              <div style={mobileStyles.librarySheet}>
                <div style={mobileStyles.librarySheetHeader}>
                  <div style={mobileStyles.librarySheetHeaderCopy}>
                    <div style={mobileStyles.librarySheetEyebrow}>Library</div>
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
  },
  libraryBackdrop: {
    position: "absolute",
    inset: 0,
    background: "rgba(2, 6, 23, 0.72)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
  },
  librarySheet: {
    position: "absolute",
    inset: "max(env(safe-area-inset-top), 10px) 10px max(env(safe-area-inset-bottom), 10px) 10px",
    display: "grid",
    gridTemplateRows: "auto minmax(0, 1fr)",
    gap: "14px",
    border: "1px solid var(--app-border-soft)",
    background: "var(--app-card)",
    borderRadius: "24px",
    padding: "16px",
    boxShadow: "0 24px 60px rgba(2, 6, 23, 0.32)",
  },
  librarySheetHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
  },
  librarySheetHeaderCopy: {
    display: "grid",
    gap: "6px",
    minWidth: 0,
  },
  libraryHeaderActions: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexShrink: 0,
  },
  librarySheetEyebrow: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--app-text-muted)",
  },
  librarySheetTitle: {
    margin: 0,
    fontSize: "24px",
    fontWeight: 700,
    lineHeight: 1.15,
    letterSpacing: "-0.03em",
    color: "var(--app-text)",
  },
  libraryHeaderIconButton: {
    width: "42px",
    height: "42px",
    border: "1px solid var(--app-border)",
    background: "var(--app-surface)",
    color: "var(--app-text-soft)",
    borderRadius: "14px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
    flexShrink: 0,
  },
};

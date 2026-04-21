"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

  return (
    <div
      style={{
        ...styles.listeningMainGrid,
        gridTemplateColumns: isMobile ? "1fr" : "1.6fr 1fr",
        alignItems: "start",
        minHeight: 0,
      }}
    >
      <GamingLibraryPanel
        styles={styles}
        games={visibleGames}
        loading={loading}
        error={error}
        isMobile={isMobile}
        sourceFilter={sourceFilter}
        onSourceFilterChange={handleSourceFilterChange}
        showExcludedOnly={libraryView === "excluded"}
        onToggleExcludedView={handleExcludedViewToggle}
        layoutMode={layoutMode}
        onLayoutModeChange={setLayoutMode}
        sortKey={sortKey}
        onSortKeyChange={setSortKey}
        onToggleInclude={toggleGameIncluded}
        onRefresh={handleRefresh}
        sourceStatus={sourceStatus}
        isCompact={isCompact}
        targetHeight={constrainedLibraryHeight}
      />

      <div ref={rightColumnRef} style={{ ...styles.sideColumn, minHeight: 0 }}>
        <CurrentlyPlayingCard styles={styles} currentGame={currentGame} loading={loading} />
        <GamingVisualizationCard
          styles={styles}
          totalMinutes={visualizationMinutes}
          includedCount={hasSourceData ? includedCount : 0}
          excludedCount={hasSourceData ? excludedCount : 0}
          topGames={topGames}
        />
      </div>
    </div>
  );
}

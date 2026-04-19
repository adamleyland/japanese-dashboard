"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import GamingLibraryPanel from "@/components/features/gaming/components/GamingLibraryPanel";
import CurrentlyPlayingCard from "@/components/features/gaming/components/CurrentlyPlayingCard";
import GamingVisualizationCard from "@/components/features/gaming/components/GamingVisualizationCard";
import useGamingData from "@/hooks/useGamingData";
import useGamingTotals from "@/hooks/useGamingTotals";
import {
  DEFAULT_GAMING_SORT,
  DEFAULT_GAMING_SOURCE_FILTER,
} from "@/lib/gaming/gaming-utils";
import { selectCurrentlyPlayingGame, selectVisibleGames } from "@/lib/gaming/selectors";

const GAMING_SORT_STORAGE_KEY = "jp_gaming_sort";
const GAMING_SOURCE_STORAGE_KEY = "jp_gaming_source_filter";

export default function GamingTab({
  styles,
  gamingHours,
  adjustGamingHours,
  isMobile,
  isCompact,
}) {
  const { games, loading, error, toggleGameIncluded, refreshAll, sourceStatus } = useGamingData();
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

  const visibleGames = useMemo(
    () => selectVisibleGames(games, { sortKey, sourceFilter }),
    [games, sortKey, sourceFilter],
  );

  const currentGame = useMemo(() => selectCurrentlyPlayingGame(games), [games]);
  const hasSourceData = games.length > 0;

  useEffect(() => {
    if (!hasSourceData) {
      return;
    }

    const nextGamingHours = totalMinutes / 60;
    const deltaHours = nextGamingHours - gamingHours;

    if (Math.abs(deltaHours) < 0.001) {
      return;
    }

    adjustGamingHours(deltaHours, {
      kind: "adjustment",
      source: "gaming-library-sync",
      note: "Synced gaming total from connected gaming library sources.",
    });
  }, [adjustGamingHours, gamingHours, hasSourceData, totalMinutes]);

  const handleRefresh = useCallback(() => {
    refreshAll();
  }, [refreshAll]);

  const visualizationMinutes = hasSourceData ? totalMinutes : Math.round(gamingHours * 60);

  return (
    <div
      style={{
        ...styles.listeningMainGrid,
        gridTemplateColumns: isMobile ? "1fr" : "1.6fr 1fr",
      }}
    >
      <GamingLibraryPanel
        styles={styles}
        games={visibleGames}
        loading={loading}
        error={error}
        sourceFilter={sourceFilter}
        onSourceFilterChange={setSourceFilter}
        sortKey={sortKey}
        onSortKeyChange={setSortKey}
        onToggleInclude={toggleGameIncluded}
        onRefresh={handleRefresh}
        sourceStatus={sourceStatus}
        isCompact={isCompact}
      />

      <div style={styles.sideColumn}>
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

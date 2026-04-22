"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CurrentlyReadingCard from "@/components/features/reading/components/CurrentlyReadingCard";
import ReadingLibraryPanel from "@/components/features/reading/components/ReadingLibraryPanel";
import ReadingProgressCard from "@/components/features/reading/components/ReadingProgressCard";
import {
  DEFAULT_READING_FILTER,
  DEFAULT_READING_LAYOUT_MODE,
  DEFAULT_READING_GOAL,
  READING_GOAL_STORAGE_KEY,
  READING_FILTER_STORAGE_KEY,
  READING_FILTERS,
  READING_LAYOUT_MODE_STORAGE_KEY,
} from "@/lib/reading/constants";
import { getCurrentlyReadingItem, getReadingCounts, getVisibleReadingItems } from "@/lib/reading/selectors";

const FILTER_KEYS = new Set(READING_FILTERS.map((filter) => filter.key));
const LAYOUT_KEYS = new Set(["list", "artwork"]);
const READING_GOAL_SETTINGS_STORAGE_KEY = "jp_reading_goal_settings_open";

export default function ReadingTab({
  styles,
  wordsRead,
  readingLibrary,
  lingqStats,
  isMobile,
  isCompact,
}) {
  const rightColumnRef = useRef(null);
  const [libraryHeight, setLibraryHeight] = useState(null);
  const [filterKey, setFilterKey] = useState(() => {
    if (typeof window === "undefined") {
      return DEFAULT_READING_FILTER;
    }

    const storedValue = window.localStorage.getItem(READING_FILTER_STORAGE_KEY);
    return FILTER_KEYS.has(storedValue) ? storedValue : DEFAULT_READING_FILTER;
  });
  const [layoutMode, setLayoutMode] = useState(() => {
    if (typeof window === "undefined") {
      return DEFAULT_READING_LAYOUT_MODE;
    }

    const storedValue = window.localStorage.getItem(READING_LAYOUT_MODE_STORAGE_KEY);
    return LAYOUT_KEYS.has(storedValue) ? storedValue : DEFAULT_READING_LAYOUT_MODE;
  });
  const [goalWords, setGoalWords] = useState(() => {
    if (typeof window === "undefined") {
      return DEFAULT_READING_GOAL;
    }

    const storedValue = Number(window.localStorage.getItem(READING_GOAL_STORAGE_KEY));
    return Number.isFinite(storedValue) && storedValue > 0 ? storedValue : DEFAULT_READING_GOAL;
  });
  const [settingsOpen, setSettingsOpen] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem(READING_GOAL_SETTINGS_STORAGE_KEY) === "true";
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(READING_FILTER_STORAGE_KEY, filterKey);
  }, [filterKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(READING_LAYOUT_MODE_STORAGE_KEY, layoutMode);
  }, [layoutMode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(READING_GOAL_STORAGE_KEY, String(goalWords));
  }, [goalWords]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(READING_GOAL_SETTINGS_STORAGE_KEY, String(settingsOpen));
  }, [settingsOpen]);

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

  const readingItems = readingLibrary.items;
  const libraryCurrentBook = useMemo(() => getCurrentlyReadingItem(readingItems), [readingItems]);
  const currentBook = useMemo(() => {
    const bookProgress =
      typeof lingqStats.bookProgress === "number"
        ? lingqStats.bookProgress <= 1
          ? lingqStats.bookProgress * 100
          : lingqStats.bookProgress
        : null;

    if (lingqStats.bookTitle || lingqStats.chapterTitle || lingqStats.bookImage) {
      return {
        id: "lingq-current",
        title: lingqStats.bookTitle || "Untitled",
        author: lingqStats.chapterTitle || "",
        subtitle: lingqStats.chapterTitle || "",
        coverUrl: lingqStats.bookImage || null,
        coverCandidates: lingqStats.bookImage ? [lingqStats.bookImage] : [],
        progressPercent: bookProgress,
        progressLabel:
          bookProgress !== null ? `${Math.round(bookProgress)}% complete` : null,
        lessonId: lingqStats.lessonId,
        lessonUrl: lingqStats.lessonUrl,
      };
    }

    return libraryCurrentBook;
  }, [
    libraryCurrentBook,
    lingqStats.bookTitle,
    lingqStats.chapterTitle,
    lingqStats.bookImage,
    lingqStats.bookProgress,
    lingqStats.lessonId,
    lingqStats.lessonUrl,
  ]);
  const visibleItems = useMemo(
    () => getVisibleReadingItems(readingItems, filterKey),
    [filterKey, readingItems],
  );
  const counts = useMemo(() => getReadingCounts(readingItems), [readingItems]);
  const effectiveWordsRead =
    typeof lingqStats.totalWordsRead === "number" ? lingqStats.totalWordsRead : wordsRead;

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
        <CurrentlyReadingCard
          styles={styles}
          item={currentBook}
          loading={readingLibrary.loading}
          isMobile={isMobile}
        />
      ) : null}

      <ReadingLibraryPanel
        styles={styles}
        items={visibleItems}
        loading={readingLibrary.loading}
        error={readingLibrary.error}
        filterKey={filterKey}
        onFilterChange={setFilterKey}
        layoutMode={layoutMode}
        onLayoutModeChange={setLayoutMode}
        counts={counts}
        onRefresh={readingLibrary.refresh}
        onStatusChange={readingLibrary.updateStatus}
        statusUpdatingIds={readingLibrary.statusUpdatingIds}
        isMobile={isMobile}
        isCompact={isCompact}
        targetHeight={isMobile ? null : libraryHeight}
      />

      <div ref={rightColumnRef} style={{ ...styles.sideColumn, minHeight: 0 }}>
        {!isMobile ? (
          <CurrentlyReadingCard
            styles={styles}
            item={currentBook}
            loading={readingLibrary.loading}
            isMobile={isMobile}
          />
        ) : null}
        <ReadingProgressCard
          styles={styles}
          isMobile={isMobile}
          isCompact={isCompact}
          totalWordsRead={effectiveWordsRead}
          goalWords={goalWords}
          setGoalWords={setGoalWords}
          loading={lingqStats.loading}
          error={lingqStats.error}
          configured={lingqStats.configured}
          currentBook={currentBook}
          onRefresh={lingqStats.refresh}
          settingsOpen={settingsOpen}
          setSettingsOpen={setSettingsOpen}
        />
      </div>
    </div>
  );
}

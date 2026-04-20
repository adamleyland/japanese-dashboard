"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CurrentlyReadingCard from "@/components/features/reading/components/CurrentlyReadingCard";
import ReadingListCard from "@/components/features/reading/components/ReadingListCard";
import ReadingProgressCard from "@/components/features/reading/components/ReadingProgressCard";
import {
  DEFAULT_READING_FILTER,
  DEFAULT_READING_GOAL,
  READING_GOAL_STORAGE_KEY,
} from "@/lib/reading/constants";
import { getCurrentlyReadingItem, getReadingCounts, getVisibleReadingItems } from "@/lib/reading/selectors";

export default function ReadingTab({
  styles,
  wordsRead,
  readingLibrary,
  lingqStats,
  isMobile,
}) {
  const rightColumnRef = useRef(null);
  const [libraryHeight, setLibraryHeight] = useState(null);
  const [filterKey, setFilterKey] = useState(DEFAULT_READING_FILTER);
  const [goalWords, setGoalWords] = useState(() => {
    if (typeof window === "undefined") {
      return DEFAULT_READING_GOAL;
    }

    const storedValue = Number(window.localStorage.getItem(READING_GOAL_STORAGE_KEY));
    return Number.isFinite(storedValue) && storedValue > 0 ? storedValue : DEFAULT_READING_GOAL;
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(READING_GOAL_STORAGE_KEY, String(goalWords));
  }, [goalWords]);

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
      };
    }

    return libraryCurrentBook;
  }, [
    libraryCurrentBook,
    lingqStats.bookTitle,
    lingqStats.chapterTitle,
    lingqStats.bookImage,
    lingqStats.bookProgress,
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
      <ReadingListCard
        styles={styles}
        items={visibleItems}
        loading={readingLibrary.loading}
        error={readingLibrary.error}
        filterKey={filterKey}
        onFilterChange={setFilterKey}
        counts={counts}
        onRefresh={readingLibrary.refresh}
        targetHeight={isMobile ? null : libraryHeight}
      />

      <div ref={rightColumnRef} style={{ ...styles.sideColumn, minHeight: 0 }}>
        <CurrentlyReadingCard styles={styles} item={currentBook} loading={readingLibrary.loading} />
        <ReadingProgressCard
          styles={styles}
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

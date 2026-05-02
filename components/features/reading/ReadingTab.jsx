"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LibraryBig, RefreshCcw, X } from "lucide-react";
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
  audiobookLaunchStatus,
  onReadWithAudiobook,
}) {
  const rightColumnRef = useRef(null);
  const [libraryHeight, setLibraryHeight] = useState(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
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
    const animationFrameId = window.requestAnimationFrame(() => {
      setHasMounted(true);
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, []);

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
  const currentBookAudiobookStatus =
    currentBook?.title && audiobookLaunchStatus?.title === currentBook.title
      ? audiobookLaunchStatus.state
      : "idle";
  const handleReadWithAudiobook = useCallback(() => {
    if (!currentBook) {
      return;
    }

    onReadWithAudiobook?.(currentBook);
  }, [currentBook, onReadWithAudiobook]);
  const readingLibraryPanelProps = {
    styles,
    items: visibleItems,
    loading: readingLibrary.loading,
    error: readingLibrary.error,
    filterKey,
    onFilterChange: setFilterKey,
    layoutMode,
    onLayoutModeChange: setLayoutMode,
    counts,
    onRefresh: readingLibrary.refresh,
    onStatusChange: readingLibrary.updateStatus,
    statusUpdatingIds: readingLibrary.statusUpdatingIds,
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
        <CurrentlyReadingCard
          styles={styles}
          item={currentBook}
          loading={readingLibrary.loading}
          isMobile={isMobile}
          audiobookStatus={currentBookAudiobookStatus}
          onReadWithAudiobook={onReadWithAudiobook ? handleReadWithAudiobook : null}
        />
      ) : null}

      {isMobile ? (
        <button
          type="button"
          onClick={() => setIsLibraryOpen(true)}
          style={mobileStyles.libraryLauncher}
        >
          <span style={mobileStyles.libraryLauncherLabel}>Library</span>
          <div style={mobileStyles.libraryLauncherMeta}>
            <span style={mobileStyles.libraryLauncherCount}>{visibleItems.length} books</span>
            <span style={mobileStyles.libraryLauncherIconWrap}>
              <LibraryBig size={18} />
            </span>
          </div>
        </button>
      ) : (
        <ReadingLibraryPanel
          {...readingLibraryPanelProps}
          isMobile={false}
          targetHeight={libraryHeight}
        />
      )}

      <div ref={rightColumnRef} style={{ ...styles.sideColumn, minHeight: 0 }}>
        {!isMobile ? (
          <CurrentlyReadingCard
            styles={styles}
            item={currentBook}
            loading={readingLibrary.loading}
            isMobile={isMobile}
            audiobookStatus={currentBookAudiobookStatus}
            onReadWithAudiobook={onReadWithAudiobook ? handleReadWithAudiobook : null}
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
                    <h3 style={mobileStyles.librarySheetTitle}>Reading Library</h3>
                  </div>

                  <div style={mobileStyles.libraryHeaderActions}>
                    <button
                      type="button"
                      onClick={readingLibrary.refresh}
                      style={mobileStyles.libraryHeaderIconButton}
                      aria-label="Refresh reading library"
                      title="Refresh reading library"
                    >
                      <RefreshCcw size={16} />
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsLibraryOpen(false)}
                      style={mobileStyles.libraryHeaderIconButton}
                      aria-label="Close reading library"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                <ReadingLibraryPanel
                  {...readingLibraryPanelProps}
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
    inset: "10px",
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

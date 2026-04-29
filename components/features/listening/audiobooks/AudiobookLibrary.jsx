"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { CheckCircle2, Headphones, PlayCircle } from "lucide-react";
import AudiobookCard from "@/components/features/listening/audiobooks/AudiobookCard";
import { matchesJapaneseSearch } from "@/lib/japaneseSearch";

const DEFAULT_LIBRARY_HINT = "Browse your audiobook library";
const AUDIOBOOK_FILTERS = [
  { key: "all", label: "All audiobooks", icon: Headphones },
  { key: "in_progress", label: "In progress", icon: PlayCircle },
  { key: "finished", label: "Finished", icon: CheckCircle2 },
];

export default function AudiobookLibrary({
  books,
  onSelect,
  hint = DEFAULT_LIBRARY_HINT,
  isMobile = false,
  isOverlay = false,
}) {
  const shelfRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterKey, setFilterKey] = useState("all");

  const handleWheel = useCallback((event) => {
    const shelf = shelfRef.current;
    if (!shelf) {
      return;
    }

    const horizontalDelta =
      Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;

    if (!horizontalDelta) {
      return;
    }

    event.preventDefault();
    shelf.scrollLeft += horizontalDelta;
  }, []);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const counts = useMemo(
    () => ({
      all: books.length,
      in_progress: books.filter((book) => isAudiobookInProgress(book)).length,
      finished: books.filter((book) => isAudiobookFinished(book)).length,
    }),
    [books],
  );
  const filteredBooks = useMemo(() => {
    return books.filter((book) => {
      if (!matchesAudiobookFilter(book, filterKey)) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return matchesJapaneseSearch(normalizedQuery, book.searchIndex || []);
    });
  }, [books, filterKey, normalizedQuery]);

  const showHelperText = hint && hint !== DEFAULT_LIBRARY_HINT;
  const useIconOnlyFilters = isMobile;
  const emptyStateLabel = normalizedQuery
    ? "No audiobooks match your search."
    : filterKey === "finished"
      ? "No finished audiobooks yet."
      : filterKey === "in_progress"
        ? "No audiobooks are currently in progress."
        : "No audiobooks are available right now.";

  return (
    <section style={isOverlay ? styles.overlaySection : styles.section}>
      <div style={isOverlay ? styles.overlaySectionHeader : styles.sectionHeader}>
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search Audiobooks"
          aria-label="Search audiobooks"
          style={isOverlay ? styles.overlaySearchInput : styles.searchInput}
        />
        <div
          style={{
            ...styles.filterTrack,
            ...(isOverlay ? styles.overlayFilterTrack : null),
          }}
        >
          {AUDIOBOOK_FILTERS.map((filter) => {
            const isActive = filterKey === filter.key;
            const Icon = filter.icon;
            const count = typeof counts?.[filter.key] === "number" ? counts[filter.key] : 0;

            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => setFilterKey(filter.key)}
                aria-label={`${filter.label} (${count})`}
                title={`${filter.label} (${count})`}
                style={styles.filterButton({
                  active: isActive,
                  iconOnly: useIconOnlyFilters,
                  overlay: isOverlay,
                })}
              >
                <Icon size={15} />
                {useIconOnlyFilters ? null : (
                  <>
                    <span>{filter.label}</span>
                    <span style={{ opacity: 0.78 }}>{count}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {showHelperText ? (
        <div style={isOverlay ? styles.overlaySectionHint : styles.sectionHint}>{hint}</div>
      ) : null}

      {filteredBooks.length ? (
        <div
          ref={shelfRef}
          style={isOverlay ? styles.overlayList : styles.shelf}
          onWheel={isOverlay ? undefined : handleWheel}
        >
          {filteredBooks.map((book) => (
            <AudiobookCard
              key={book.id}
              book={book}
              isMobile={isMobile}
              onSelect={onSelect}
              compact={isOverlay}
              fullWidth={isOverlay}
            />
          ))}
        </div>
      ) : (
        <div style={isOverlay ? styles.overlayEmptyState : styles.emptyState}>
          {emptyStateLabel}
        </div>
      )}
    </section>
  );
}

function isAudiobookFinished(book) {
  if (book?.isFinished) {
    return true;
  }

  return Math.max(0, Math.min(100, Number(book?.progressPercent) || 0)) >= 100;
}

function isAudiobookInProgress(book) {
  return !isAudiobookFinished(book) && Math.max(0, Number(book?.progressSeconds) || 0) > 0;
}

function matchesAudiobookFilter(book, filterKey) {
  if (filterKey === "finished") {
    return isAudiobookFinished(book);
  }

  if (filterKey === "in_progress") {
    return isAudiobookInProgress(book);
  }

  return true;
}

const styles = {
  section: {
    display: "grid",
    gap: "12px",
  },
  overlaySection: {
    display: "grid",
    gridTemplateRows: "auto auto minmax(0, 1fr)",
    gap: "14px",
    minHeight: 0,
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    flexWrap: "nowrap",
  },
  overlaySectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    flexWrap: "nowrap",
  },
  sectionHint: {
    fontSize: "12px",
    color: "var(--app-text-faint)",
  },
  overlaySectionHint: {
    fontSize: "12px",
    color: "rgba(226,232,240,0.68)",
  },
  filterTrack: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px",
    borderRadius: "999px",
    background: "var(--app-pill-track)",
    border: "1px solid var(--app-border-soft)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
    flexWrap: "nowrap",
    minWidth: 0,
    overflowX: "auto",
    scrollbarWidth: "none",
  },
  overlayFilterTrack: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
  },
  filterButton: ({ active, iconOnly, overlay }) => ({
    border: "none",
    background: active
      ? overlay
        ? "rgba(248,250,252,0.18)"
        : "var(--app-selected-surface)"
      : "transparent",
    color: active
      ? overlay
        ? "#f8fafc"
        : "var(--app-selected-text)"
      : overlay
        ? "rgba(226,232,240,0.72)"
        : "var(--app-text-muted)",
    borderRadius: "999px",
    padding: iconOnly ? "8px" : "8px 14px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
    transition: "all 160ms ease",
    boxShadow: active && !overlay ? "0 6px 18px rgba(15,23,42,0.08)" : "none",
    width: iconOnly ? "36px" : "auto",
    height: iconOnly ? "36px" : "auto",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: iconOnly ? "0" : "6px",
    flexShrink: 0,
  }),
  searchInput: {
    width: "100%",
    maxWidth: "280px",
    flex: "1 1 280px",
    border: "1px solid var(--app-border)",
    background: "var(--app-surface)",
    color: "var(--app-text)",
    borderRadius: "14px",
    padding: "11px 14px",
    fontSize: "13px",
    lineHeight: 1.2,
    boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
  },
  shelf: {
    display: "flex",
    gap: "14px",
    overflowX: "auto",
    paddingBottom: "8px",
    scrollbarWidth: "thin",
  },
  overlayList: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "14px",
    overflowY: "auto",
    paddingRight: "4px",
    minHeight: 0,
  },
  emptyState: {
    border: "1px solid var(--app-border-soft)",
    background: "var(--app-surface-soft)",
    borderRadius: "18px",
    padding: "18px",
    fontSize: "13px",
    color: "var(--app-text-muted)",
  },
  overlaySearchInput: {
    width: "100%",
    flex: "1 1 auto",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "#f8fafc",
    borderRadius: "14px",
    padding: "12px 14px",
    fontSize: "13px",
    lineHeight: 1.2,
    boxShadow: "none",
  },
  overlayEmptyState: {
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(248,250,252,0.82)",
    borderRadius: "18px",
    padding: "18px",
    fontSize: "13px",
    lineHeight: 1.5,
  },
};

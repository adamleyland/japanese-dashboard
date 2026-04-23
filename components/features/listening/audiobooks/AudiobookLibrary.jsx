"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import AudiobookCard from "@/components/features/listening/audiobooks/AudiobookCard";
import { matchesJapaneseSearch } from "@/lib/japaneseSearch";

const DEFAULT_LIBRARY_HINT = "Browse your audiobook library";

export default function AudiobookLibrary({
  books,
  onSelect,
  hint = DEFAULT_LIBRARY_HINT,
  isOverlay = false,
}) {
  const shelfRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState("");

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
  const filteredBooks = useMemo(() => {
    if (!normalizedQuery) {
      return books;
    }

    return books.filter((book) =>
      matchesJapaneseSearch(normalizedQuery, book.searchIndex || []),
    );
  }, [books, normalizedQuery]);

  const showHelperText = hint && hint !== DEFAULT_LIBRARY_HINT;

  return (
    <section style={isOverlay ? styles.overlaySection : styles.section}>
      <div style={isOverlay ? styles.overlaySectionHeader : styles.sectionHeader}>
        <div style={styles.sectionEyebrow}>Library</div>
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search Audiobooks"
          aria-label="Search audiobooks"
          style={isOverlay ? styles.overlaySearchInput : styles.searchInput}
        />
      </div>

      {showHelperText ? <div style={styles.sectionHint}>{hint}</div> : null}

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
              onSelect={onSelect}
              compact={isOverlay}
              fullWidth={isOverlay}
            />
          ))}
        </div>
      ) : (
        <div style={styles.emptyState}>No audiobooks match your search.</div>
      )}
    </section>
  );
}

const styles = {
  section: {
    display: "grid",
    gap: "12px",
  },
  overlaySection: {
    display: "grid",
    gridTemplateRows: "auto auto minmax(0, 1fr)",
    gap: "12px",
    minHeight: 0,
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },
  overlaySectionHeader: {
    display: "grid",
    gap: "10px",
  },
  sectionEyebrow: {
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--app-text-muted)",
  },
  sectionHint: {
    fontSize: "12px",
    color: "var(--app-text-faint)",
  },
  searchInput: {
    width: "100%",
    maxWidth: "280px",
    flex: "1 1 220px",
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
    gap: "12px",
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
    border: "1px solid var(--app-border)",
    background: "var(--app-surface)",
    color: "var(--app-text)",
    borderRadius: "14px",
    padding: "12px 14px",
    fontSize: "13px",
    lineHeight: 1.2,
    boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
  },
};

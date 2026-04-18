"use client";

import { useCallback, useRef } from "react";
import AudiobookCard from "@/components/features/listening/audiobooks/AudiobookCard";

export default function AudiobookLibrary({
  books,
  onSelect,
  hint = "Mock shelf ready for real sources later",
}) {
  const shelfRef = useRef(null);

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

  return (
    <section style={styles.section}>
      <div style={styles.sectionHeader}>
        <div style={styles.sectionEyebrow}>Library</div>
        <div style={styles.sectionHint}>{hint}</div>
      </div>

      <div ref={shelfRef} style={styles.shelf} onWheel={handleWheel}>
        {books.map((book) => (
          <AudiobookCard key={book.id} book={book} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}

const styles = {
  section: {
    display: "grid",
    gap: "12px",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
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
  shelf: {
    display: "flex",
    gap: "14px",
    overflowX: "auto",
    paddingBottom: "8px",
    scrollbarWidth: "thin",
  },
};

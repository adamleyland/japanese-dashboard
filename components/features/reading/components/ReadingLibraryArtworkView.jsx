"use client";

import { useMemo, useState } from "react";
import ReadingBookModal from "@/components/features/reading/components/ReadingBookModal";
import ReadingCoverArtwork from "@/components/features/reading/components/ReadingCoverArtwork";

export default function ReadingLibraryArtworkView({
  styles,
  items,
  isMobile = false,
  isCompact,
  onStatusChange,
  statusUpdatingIds,
}) {
  const [selectedBookId, setSelectedBookId] = useState(null);
  const columns = useMemo(() => {
    if (isMobile) {
      return "repeat(2, minmax(0, 1fr))";
    }

    if (isCompact) {
      return "repeat(2, minmax(0, 1fr))";
    }

    return "repeat(4, minmax(0, 1fr))";
  }, [isCompact, isMobile]);
  const selectedBook = items.find((item) => item.id === selectedBookId) || null;

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: columns,
          gap: "12px",
        }}
      >
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSelectedBookId(item.id)}
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "2 / 3",
              border: "1px solid var(--app-border-soft)",
              borderRadius: "20px",
              overflow: "hidden",
              background: "var(--app-surface-soft)",
              cursor: "pointer",
              padding: 0,
              boxShadow: "0 8px 22px rgba(15,23,42,0.1)",
            }}
            aria-label={`Open details for ${item.title}`}
          >
            <ReadingCoverArtwork item={item} width="100%" borderRadius={20} />
            <span style={artworkStyles.statusBadge}>
              {typeof item.progressPercent === "number"
                ? `${Math.round(item.progressPercent)}%`
                : item.statusLabel}
            </span>
          </button>
        ))}
      </div>

      <ReadingBookModal
        book={selectedBook}
        onClose={() => setSelectedBookId(null)}
        styles={styles}
        isMobile={isMobile}
        isCompact={isCompact}
        onStatusChange={onStatusChange}
        statusUpdatingIds={statusUpdatingIds}
      />
    </>
  );
}

const artworkStyles = {
  statusBadge: {
    position: "absolute",
    left: "10px",
    bottom: "10px",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: "999px",
    background: "rgba(15,23,42,0.64)",
    color: "#fff",
    padding: "6px 9px",
    fontSize: "10px",
    fontWeight: 800,
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
  },
};

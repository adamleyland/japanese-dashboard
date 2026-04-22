"use client";

import { useMemo, useState } from "react";
import ReadingBookModal from "@/components/features/reading/components/ReadingBookModal";
import ReadingCoverArtwork from "@/components/features/reading/components/ReadingCoverArtwork";

export default function ReadingLibraryArtworkView({
  styles,
  items,
  isCompact,
  onStatusChange,
  statusUpdatingIds,
}) {
  const [selectedBookId, setSelectedBookId] = useState(null);
  const columns = useMemo(() => {
    if (isCompact) {
      return "repeat(2, minmax(0, 1fr))";
    }

    return "repeat(4, minmax(0, 1fr))";
  }, [isCompact]);
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
              width: "100%",
              border: "none",
              borderRadius: "20px",
              overflow: "hidden",
              background: "transparent",
              cursor: "pointer",
              padding: 0,
              boxShadow: "none",
            }}
            aria-label={`Open details for ${item.title}`}
          >
            <ReadingCoverArtwork item={item} width="100%" borderRadius={20} />
          </button>
        ))}
      </div>

      <ReadingBookModal
        book={selectedBook}
        onClose={() => setSelectedBookId(null)}
        styles={styles}
        isCompact={isCompact}
        onStatusChange={onStatusChange}
        statusUpdatingIds={statusUpdatingIds}
      />
    </>
  );
}

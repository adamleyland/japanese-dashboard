"use client";

import { useMemo, useState } from "react";
import ReadingBookModal from "@/components/features/reading/components/ReadingBookModal";
import ReadingCoverArtwork from "@/components/features/reading/components/ReadingCoverArtwork";
import ReadingStatusBadge from "@/components/features/reading/components/ReadingStatusBadge";

export default function ReadingLibraryArtworkView({
  styles,
  items,
  isCompact,
}) {
  const [selectedBookId, setSelectedBookId] = useState(null);
  const columns = useMemo(() => {
    if (isCompact) {
      return "repeat(2, minmax(0, 1fr))";
    }

    return "repeat(auto-fill, minmax(150px, 1fr))";
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
              position: "relative",
              width: "100%",
              border: "1px solid var(--app-border-soft)",
              borderRadius: "20px",
              overflow: "hidden",
              background: "transparent",
              cursor: "pointer",
              padding: 0,
              boxShadow: "0 8px 22px rgba(15,23,42,0.1)",
              textAlign: "left",
            }}
            aria-label={`Open details for ${item.title}`}
          >
            <ReadingCoverArtwork item={item} width="100%" borderRadius={20} />

            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(180deg, rgba(15,23,42,0.02) 35%, rgba(15,23,42,0.72) 100%)",
                pointerEvents: "none",
              }}
            />

            <div
              style={{
                position: "absolute",
                top: "10px",
                left: "10px",
                pointerEvents: "none",
              }}
            >
              <ReadingStatusBadge status={item.status} />
            </div>

            <div
              style={{
                position: "absolute",
                left: "12px",
                right: "12px",
                bottom: "12px",
                display: "grid",
                gap: "4px",
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 800,
                  lineHeight: 1.25,
                  color: "#f8fafc",
                  textShadow: "0 4px 18px rgba(15,23,42,0.4)",
                }}
              >
                {item.title}
              </div>
            </div>
          </button>
        ))}
      </div>

      <ReadingBookModal
        book={selectedBook}
        onClose={() => setSelectedBookId(null)}
        styles={styles}
        isCompact={isCompact}
      />
    </>
  );
}

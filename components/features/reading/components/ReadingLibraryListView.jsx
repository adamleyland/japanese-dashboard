"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import ReadingBookModal from "@/components/features/reading/components/ReadingBookModal";
import ReadingCoverArtwork from "@/components/features/reading/components/ReadingCoverArtwork";
import ReadingStatusControl from "@/components/features/reading/components/ReadingStatusControl";

export default function ReadingLibraryListView({
  styles,
  items,
  isMobile = false,
  isCompact,
  onStatusChange,
  statusUpdatingIds,
}) {
  const [selectedBookId, setSelectedBookId] = useState(null);
  const selectedBook = items.find((item) => item.id === selectedBookId) || null;

  return (
    <>
      <div style={{ display: "grid", gap: "10px" }}>
      {items.map((item) => {
        return (
          <article
            key={item.id}
            style={{
              borderRadius: "20px",
              border: "1px solid var(--app-border-soft)",
              background: "var(--app-card)",
              boxShadow: "0 10px 24px rgba(15,23,42,0.05)",
              overflow: "hidden",
              transition: "border-color 160ms ease, box-shadow 160ms ease",
            }}
          >
            <div
              role="button"
              tabIndex={0}
              onClick={() => setSelectedBookId(item.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedBookId(item.id);
                }
              }}
              aria-label={`Open details for ${item.title}`}
              style={{
                width: "100%",
                outline: "none",
                background: "transparent",
                cursor: "pointer",
                padding: "12px",
                display: "grid",
                gridTemplateColumns: isCompact ? "72px minmax(0, 1fr)" : "84px minmax(0, 1fr)",
                gap: "12px",
                textAlign: "left",
              }}
            >
              <ReadingCoverArtwork
                item={item}
                width={isCompact ? 72 : 84}
                borderRadius={16}
              />

              <div style={{ display: "grid", gap: "10px", minWidth: 0, alignContent: "start" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: "10px",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: isCompact ? "15px" : "16px",
                        fontWeight: 800,
                        letterSpacing: "-0.02em",
                        lineHeight: 1.25,
                      }}
                    >
                      {item.title}
                    </h3>
                    {item.author ? (
                      <p style={{ ...styles.playerSub, margin: "5px 0 0 0" }}>{item.author}</p>
                    ) : null}
                  </div>

                  {!isCompact ? (
                    <ReadingStatusControl
                      bookId={item.id}
                      status={item.status}
                      onChange={onStatusChange}
                      disabled={Boolean(statusUpdatingIds?.[item.id])}
                    />
                  ) : null}
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "10px",
                    flexWrap: "wrap",
                  }}
                >
                  {isCompact ? (
                    <ReadingStatusControl
                      bookId={item.id}
                      status={item.status}
                      onChange={onStatusChange}
                      disabled={Boolean(statusUpdatingIds?.[item.id])}
                    />
                  ) : null}
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      color: "var(--app-text-muted)",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    View details
                    <ChevronRight size={14} />
                  </span>
                </div>
              </div>
            </div>

          </article>
        );
      })}
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

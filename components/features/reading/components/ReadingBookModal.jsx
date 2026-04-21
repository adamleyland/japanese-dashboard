"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import ReadingBookDetails from "@/components/features/reading/components/ReadingBookDetails";
import ReadingCoverArtwork from "@/components/features/reading/components/ReadingCoverArtwork";
import ReadingStatusControl from "@/components/features/reading/components/ReadingStatusControl";

export default function ReadingBookModal({
  book,
  onClose,
  styles,
  isCompact,
  onStatusChange,
  statusUpdatingIds,
}) {
  useEffect(() => {
    if (!book) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [book, onClose]);

  if (!book || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "var(--app-overlay)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: isCompact ? "16px" : "20px",
      }}
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={book.title}
        onMouseDown={(event) => event.stopPropagation()}
        style={{
          width: "min(760px, 100%)",
          maxHeight: "min(720px, calc(100vh - 32px))",
          overflowY: "auto",
          borderRadius: "24px",
          border: "1px solid var(--app-border-soft)",
          background: "var(--app-surface-strong)",
          boxShadow: "0 28px 70px rgba(15,23,42,0.2)",
          padding: isCompact ? "16px" : "18px",
          display: "grid",
          gap: "16px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div style={{ display: "grid", gap: "8px", minWidth: 0 }}>
            <ReadingStatusControl
              bookId={book.id}
              status={book.status}
              onChange={onStatusChange}
              disabled={Boolean(statusUpdatingIds?.[book.id])}
            />
            <div style={{ minWidth: 0 }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: isCompact ? "24px" : "30px",
                  fontWeight: 800,
                  letterSpacing: "-0.04em",
                  lineHeight: 1.1,
                }}
              >
                {book.title}
              </h3>
              {book.author ? (
                <p style={{ ...styles.playerSub, margin: "6px 0 0 0", fontSize: "13px" }}>
                  {book.author}
                </p>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close book details"
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "999px",
              border: "1px solid var(--app-border-soft)",
              background: "var(--app-surface-elevated)",
              color: "var(--app-text-muted)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isCompact ? "1fr" : "200px minmax(0, 1fr)",
            gap: "18px",
            alignItems: "start",
          }}
        >
          <ReadingCoverArtwork
            item={book}
            width={isCompact ? "100%" : 200}
            borderRadius={20}
          />

          <ReadingBookDetails
            book={book}
            styles={styles}
            includeStatus
            compact={isCompact}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

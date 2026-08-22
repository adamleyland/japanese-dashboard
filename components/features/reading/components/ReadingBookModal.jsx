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
  isMobile = false,
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
        zIndex: 10020,
        background: "var(--app-overlay)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: isMobile ? 0 : isCompact ? "16px" : "20px",
      }}
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={book.title}
        onMouseDown={(event) => event.stopPropagation()}
        style={{
          width: isMobile ? "100%" : "min(760px, 100%)",
          height: isMobile ? "100dvh" : "auto",
          maxHeight: isMobile ? "100dvh" : "min(720px, calc(100dvh - 32px))",
          overflowY: "auto",
          borderRadius: isMobile ? 0 : "24px",
          border: isMobile ? "none" : "1px solid var(--app-border-soft)",
          background: isMobile ? "#ffffff" : "var(--app-surface-strong)",
          boxShadow: isMobile ? "none" : "0 28px 70px rgba(15,23,42,0.2)",
          padding: isMobile
            ? "calc(16px + env(safe-area-inset-top, 0px)) 16px calc(18px + env(safe-area-inset-bottom, 0px))"
            : isCompact ? "16px" : "18px",
          display: "grid",
          gap: "16px",
          ...(isMobile ? {
            color: "#0f172a",
            "--app-surface": "#ffffff",
            "--app-surface-strong": "#ffffff",
            "--app-surface-soft": "#f8fafc",
            "--app-surface-elevated": "#ffffff",
            "--app-card": "#ffffff",
            "--app-border": "rgba(15, 23, 42, 0.12)",
            "--app-border-soft": "rgba(15, 23, 42, 0.07)",
            "--app-text": "#0f172a",
            "--app-text-soft": "#334155",
            "--app-text-muted": "#64748b",
            "--app-pill-track": "#f1f5f9",
            "--app-selected-surface": "#111827",
            "--app-selected-text": "#ffffff",
            "--app-progress-track": "#e2e8f0",
          } : null),
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
            gridTemplateColumns: isMobile || isCompact ? "1fr" : "200px minmax(0, 1fr)",
            gap: "18px",
            alignItems: "start",
          }}
        >
          <ReadingCoverArtwork
            item={book}
            width={isMobile || isCompact ? "min(220px, 62vw)" : 200}
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

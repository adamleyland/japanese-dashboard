"use client";

import { Play } from "lucide-react";
import { clampWords, stripHtml } from "@/lib/stripHtml";

const FALLBACK_COVER_URL =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 400">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#334155"/>
        </linearGradient>
      </defs>
      <rect width="320" height="400" fill="url(#g)"/>
      <circle cx="160" cy="144" r="54" fill="rgba(255,255,255,0.14)"/>
      <rect x="88" y="232" width="144" height="14" rx="7" fill="rgba(255,255,255,0.2)"/>
      <rect x="110" y="260" width="100" height="12" rx="6" fill="rgba(255,255,255,0.14)"/>
    </svg>
  `);

export default function AudiobookCurrentlyListening({ book, onOpenPlayer, onPlayNow }) {
  if (!book) {
    return null;
  }

  const plainDescription = clampWords(stripHtml(book.description), 50);
  const coverUrl = book.cover_url || FALLBACK_COVER_URL;

  return (
    <section style={styles.section}>
      <div style={styles.sectionHeader}>
        <div style={styles.sectionEyebrow}>Currently Listening</div>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={onOpenPlayer}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpenPlayer?.();
          }
        }}
        style={styles.cardButton}
        aria-label={`Open player for ${book.title}`}
      >
        <div style={styles.card}>
          <div style={styles.cover(book.coverGradient)} aria-hidden="true">
            <img
              key={`${book.id}-${coverUrl}`}
              src={coverUrl}
              alt=""
              style={styles.coverImage}
              onError={(event) => {
                event.currentTarget.src = FALLBACK_COVER_URL;
              }}
            />
          </div>

          <div style={styles.meta}>
            <div style={styles.metaTopRow}>
              <div style={styles.title}>{book.title}</div>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onPlayNow?.();
                }}
                style={styles.iconButton}
                aria-label={`Play ${book.title}`}
              >
                <Play size={18} />
              </button>
            </div>
            <div style={styles.author}>{book.author}</div>
            <div style={styles.description}>{plainDescription}</div>

            <div style={styles.progressMeta}>
              <span style={styles.progressLabel}>{book.progressPercent.toFixed(0)}% complete</span>
              <span style={styles.progressLabel}>
                {formatClock(book.progressSeconds)} / {formatClock(book.durationSeconds)}
              </span>
            </div>

            <div style={styles.progressTrack}>
              <div style={styles.progressFill(book.progressPercent, book.accentColor)} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function formatClock(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (!hours) {
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(
    seconds,
  ).padStart(2, "0")}`;
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
  iconButton: {
    width: "40px",
    height: "40px",
    borderRadius: "14px",
    border: "1px solid var(--app-border)",
    background: "var(--app-surface)",
    color: "var(--app-text-soft)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
    flexShrink: 0,
    cursor: "pointer",
  },
  cardButton: {
    border: "none",
    background: "transparent",
    padding: 0,
    display: "block",
    width: "100%",
    textAlign: "left",
    cursor: "pointer",
  },
  card: {
    border: "1px solid var(--app-border-soft)",
    background: "var(--app-card)",
    borderRadius: "20px",
    padding: "16px",
    display: "grid",
    gridTemplateColumns: "160px minmax(0, 1fr)",
    gap: "16px",
    textAlign: "left",
    boxShadow: "0 16px 36px rgba(15,23,42,0.08)",
  },
  cover: (coverGradient) => ({
    position: "relative",
    borderRadius: "18px",
    background: coverGradient,
    overflow: "hidden",
    minHeight: "200px",
    boxShadow: "0 12px 28px rgba(15,23,42,0.12)",
  }),
  coverImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
    minHeight: "200px",
  },
  meta: {
    display: "grid",
    gap: "10px",
    alignContent: "center",
    minWidth: 0,
  },
  metaTopRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
  },
  title: {
    fontSize: "22px",
    fontWeight: 700,
    lineHeight: 1.1,
    letterSpacing: "-0.03em",
    color: "var(--app-text)",
    minWidth: 0,
    flex: 1,
  },
  author: {
    fontSize: "14px",
    color: "var(--app-text-soft)",
  },
  description: {
    fontSize: "13px",
    lineHeight: 1.6,
    color: "var(--app-text-muted)",
    display: "-webkit-box",
    WebkitLineClamp: 4,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  progressMeta: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    flexWrap: "wrap",
    fontSize: "12px",
    color: "var(--app-text-muted)",
  },
  progressLabel: {
    fontWeight: 700,
  },
  progressTrack: {
    height: "8px",
    borderRadius: "999px",
    background: "var(--app-progress-track)",
    border: "1px solid var(--app-border-soft)",
    overflow: "hidden",
  },
  progressFill: (progressPercent, accentColor) => ({
    width: `${progressPercent}%`,
    height: "100%",
    borderRadius: "inherit",
    background: accentColor,
  }),
};

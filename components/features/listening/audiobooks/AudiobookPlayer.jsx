"use client";

import { Headphones, Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";

export default function AudiobookPlayer({
  book,
  currentProgressSeconds,
  durationSeconds,
  playbackState,
  progressPercent,
  onReturnToLibrary,
  onSeekTo,
  onSkipBy,
  onTogglePlayback,
}) {
  if (!book) {
    return null;
  }

  const isPlaying = playbackState === "playing";

  return (
    <section style={styles.shell}>
      <div style={styles.playerHeader}>
        <div>
          <div style={styles.eyebrow}>Audiobook Player</div>
          <h3 style={styles.title}>{book.title}</h3>
          <p style={styles.meta}>
            {book.author}
            {book.narrator ? ` • Narrated by ${book.narrator}` : ""}
          </p>
        </div>

        <button type="button" onClick={onReturnToLibrary} style={styles.backButton}>
          <RotateCcw size={14} />
          Back to library
        </button>
      </div>

      <div style={styles.playerGrid}>
        <div style={styles.cover(book.coverGradient)}>
          <div style={styles.coverInner}>
            <Headphones size={18} />
            <span style={styles.coverTitle}>{book.title}</span>
          </div>
        </div>

        <div style={styles.controlsColumn}>
          <div style={styles.description}>{book.description}</div>

          <div style={styles.timelineWrap}>
            <input
              type="range"
              min={0}
              max={durationSeconds}
              value={currentProgressSeconds}
              onChange={(event) => onSeekTo(Number(event.target.value))}
              style={styles.timeline}
            />

            <div style={styles.timelineMeta}>
              <span>{formatClock(currentProgressSeconds)}</span>
              <span>{progressPercent.toFixed(1)}%</span>
              <span>{formatClock(durationSeconds)}</span>
            </div>
          </div>

          <div style={styles.actionRow}>
            <button type="button" onClick={() => onSkipBy(-10)} style={styles.secondaryButton}>
              <SkipBack size={16} />
              -10s
            </button>

            <button type="button" onClick={onTogglePlayback} style={styles.primaryButton}>
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              {isPlaying ? "Pause" : "Play"}
            </button>

            <button type="button" onClick={() => onSkipBy(10)} style={styles.secondaryButton}>
              <SkipForward size={16} />
              +10s
            </button>
          </div>

          <div style={styles.chapterBlock}>
            <div style={styles.chapterEyebrow}>Chapter placeholders</div>
            <div style={styles.chapterList}>
              {(book.chapters || []).map((chapter) => (
                <button
                  key={chapter.id}
                  type="button"
                  onClick={() => onSeekTo(chapter.startSeconds)}
                  style={styles.chapterButton}
                >
                  <span>{chapter.title}</span>
                  <span>{formatClock(chapter.startSeconds)}</span>
                </button>
              ))}
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
  shell: {
    display: "grid",
    gap: "16px",
    border: "1px solid var(--app-border-soft)",
    background: "var(--app-card)",
    borderRadius: "22px",
    padding: "16px",
    boxShadow: "0 18px 40px rgba(15,23,42,0.08)",
  },
  playerHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    flexWrap: "wrap",
  },
  eyebrow: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--app-text-muted)",
  },
  title: {
    margin: "4px 0 0 0",
    fontSize: "28px",
    fontWeight: 700,
    lineHeight: 1.1,
    letterSpacing: "-0.04em",
    color: "var(--app-text)",
  },
  meta: {
    margin: "6px 0 0 0",
    fontSize: "13px",
    color: "var(--app-text-muted)",
  },
  backButton: {
    border: "1px solid var(--app-border)",
    background: "var(--app-surface)",
    color: "var(--app-text-soft)",
    borderRadius: "12px",
    padding: "10px 12px",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 700,
  },
  playerGrid: {
    display: "grid",
    gridTemplateColumns: "220px minmax(0, 1fr)",
    gap: "18px",
  },
  cover: (coverGradient) => ({
    borderRadius: "20px",
    background: coverGradient,
    minHeight: "280px",
    display: "flex",
    alignItems: "flex-end",
    padding: "18px",
    boxShadow: "inset 0 -40px 80px rgba(15,23,42,0.2)",
  }),
  coverInner: {
    display: "grid",
    gap: "8px",
    color: "#fff",
  },
  coverTitle: {
    fontSize: "24px",
    fontWeight: 700,
    lineHeight: 1.05,
    letterSpacing: "-0.04em",
  },
  controlsColumn: {
    display: "grid",
    gap: "16px",
    alignContent: "start",
  },
  description: {
    fontSize: "14px",
    lineHeight: 1.65,
    color: "var(--app-text-soft)",
  },
  timelineWrap: {
    display: "grid",
    gap: "10px",
    border: "1px solid var(--app-border-soft)",
    background: "var(--app-surface-soft)",
    borderRadius: "16px",
    padding: "14px",
  },
  timeline: {
    width: "100%",
    accentColor: "#38bdf8",
    cursor: "pointer",
  },
  timelineMeta: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    fontSize: "12px",
    color: "var(--app-text-muted)",
  },
  actionRow: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  primaryButton: {
    border: "none",
    background: "var(--app-selected-surface)",
    color: "var(--app-selected-text)",
    borderRadius: "14px",
    padding: "12px 18px",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 700,
  },
  secondaryButton: {
    border: "1px solid var(--app-border)",
    background: "var(--app-surface)",
    color: "var(--app-text-soft)",
    borderRadius: "14px",
    padding: "12px 16px",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 700,
  },
  chapterBlock: {
    display: "grid",
    gap: "10px",
    border: "1px solid var(--app-border-soft)",
    background: "var(--app-surface-soft)",
    borderRadius: "16px",
    padding: "14px",
  },
  chapterEyebrow: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--app-text-muted)",
  },
  chapterList: {
    display: "grid",
    gap: "8px",
  },
  chapterButton: {
    border: "1px solid var(--app-border-soft)",
    background: "var(--app-surface)",
    color: "var(--app-text)",
    borderRadius: "12px",
    padding: "10px 12px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 600,
  },
};

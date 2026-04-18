"use client";

import { Pause, Play, RotateCcw, SkipBack, SkipForward, X } from "lucide-react";
import { clampWords, stripHtml } from "@/lib/stripHtml";

export default function AudiobookPlayer({
  book,
  currentProgressSeconds,
  durationSeconds,
  hasPlayableAudio,
  isPlaying,
  playbackState,
  progressPercent,
  onClosePlayer,
  onPlayFromStart,
  onSeekTo,
  onSkipBy,
  onTogglePlayback,
}) {
  if (!book) {
    return null;
  }

  const playing = isPlaying ?? playbackState === "playing";
  const chapterCount = (book.chapters || []).length;
  const remainingSeconds = Math.max(0, durationSeconds - currentProgressSeconds);
  const plainDescription = clampWords(stripHtml(book.description), 50);

  return (
    <section style={styles.shell}>
      <div style={styles.playerHeader}>
        <div style={styles.headerCopy}>
          <div style={styles.eyebrow}>Audiobook Player</div>
          <h3 style={styles.title}>{book.title}</h3>
          <p style={styles.meta}>{buildMetadataLine(book, durationSeconds)}</p>
          <p style={styles.description}>{plainDescription}</p>
        </div>

        <div style={styles.headerActions}>
          <button type="button" onClick={onClosePlayer} style={styles.iconButton(false)} aria-label="Close player">
            <X size={18} />
          </button>
        </div>
      </div>

      <div style={styles.playerGrid}>
        <div style={styles.cover(book.coverImage, book.coverGradient)} aria-hidden="true" />

        <div style={styles.controlsColumn}>
          <div style={styles.timelineWrap}>
            <div style={styles.progressSummary}>
              <span style={styles.progressBadge}>{progressPercent.toFixed(0)}% complete</span>
              <span style={styles.progressRemaining}>{formatRemaining(remainingSeconds)} left</span>
            </div>

            <input
              type="range"
              min={0}
              max={durationSeconds}
              value={currentProgressSeconds}
              onChange={(event) => onSeekTo(Number(event.target.value))}
              disabled={!hasPlayableAudio}
              style={styles.timeline}
            />

            <div style={styles.timelineMeta}>
              <span>{formatClock(currentProgressSeconds)}</span>
              <span>{progressPercent.toFixed(1)}%</span>
              <span>{formatClock(durationSeconds)}</span>
            </div>

            {!hasPlayableAudio && (
              <div style={styles.audioHint}>Audio source unavailable for this audiobook.</div>
            )}
          </div>

          <div style={styles.actionRow}>
            <button
              type="button"
              onClick={onTogglePlayback}
              disabled={!hasPlayableAudio}
              style={styles.primaryButton(!hasPlayableAudio)}
            >
              {playing ? <Pause size={18} /> : <Play size={18} />}
              {playing ? "Pause" : "Play"}
            </button>

            <button
              type="button"
              onClick={onPlayFromStart}
              disabled={!hasPlayableAudio}
              style={styles.iconControlButton(!hasPlayableAudio)}
              aria-label="Play from start"
              title="Play from start"
            >
              <RotateCcw size={16} />
            </button>

            <button
              type="button"
              onClick={() => onSkipBy(-10)}
              disabled={!hasPlayableAudio}
              style={styles.iconControlButton(!hasPlayableAudio)}
              aria-label="Skip back 10 seconds"
              title="Skip back 10 seconds"
            >
              <SkipBack size={16} />
            </button>

            <button
              type="button"
              onClick={() => onSkipBy(10)}
              disabled={!hasPlayableAudio}
              style={styles.iconControlButton(!hasPlayableAudio)}
              aria-label="Skip forward 10 seconds"
              title="Skip forward 10 seconds"
            >
              <SkipForward size={16} />
            </button>
          </div>

          <div style={styles.chapterBlock}>
            <div style={styles.chapterHeader}>
              <div style={styles.chapterEyebrow}>Chapters</div>
              <div style={styles.chapterCount}>
                {chapterCount ? `${chapterCount} items` : "No chapter markers yet"}
              </div>
            </div>

            <div style={styles.chapterList}>
              {(book.chapters || []).map((chapter) => (
                <button
                  key={chapter.id}
                  type="button"
                  onClick={() => onSeekTo(chapter.startSeconds)}
                  style={styles.chapterButton}
                >
                  <span style={styles.chapterTitle}>{chapter.title}</span>
                  <span style={styles.chapterTime}>{formatClock(chapter.startSeconds)}</span>
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

function formatDurationCompact(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);

  if (!hours) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
}

function formatRemaining(totalSeconds) {
  return formatDurationCompact(totalSeconds);
}

function buildMetadataLine(book, durationSeconds) {
  return [
    book.author,
    book.narrator ? `Narrated by ${book.narrator}` : "",
    durationSeconds ? formatDurationCompact(durationSeconds) : "",
  ]
    .filter(Boolean)
    .join(" • ");
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
  headerCopy: {
    minWidth: 0,
    display: "grid",
    gap: "8px",
    flex: "1 1 320px",
  },
  eyebrow: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--app-text-muted)",
  },
  title: {
    margin: 0,
    fontSize: "28px",
    fontWeight: 700,
    lineHeight: 1.1,
    letterSpacing: "-0.04em",
    color: "var(--app-text)",
  },
  meta: {
    margin: 0,
    fontSize: "13px",
    color: "var(--app-text-soft)",
  },
  description: {
    margin: 0,
    fontSize: "13px",
    lineHeight: 1.65,
    color: "var(--app-text-muted)",
    display: "-webkit-box",
    WebkitLineClamp: 4,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    maxWidth: "68ch",
  },
  headerActions: {
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    flexShrink: 0,
  },
  iconButton: (disabled) => ({
    width: "40px",
    height: "40px",
    border: "1px solid var(--app-border)",
    background: "var(--app-surface)",
    color: "var(--app-text-soft)",
    borderRadius: "14px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
    flexShrink: 0,
  }),
  playerGrid: {
    display: "grid",
    gridTemplateColumns: "220px minmax(0, 1fr)",
    gap: "18px",
  },
  cover: (coverImage, coverGradient) => ({
    position: "relative",
    borderRadius: "20px",
    background: coverGradient,
    backgroundImage: coverImage ? `url("${coverImage}")` : undefined,
    backgroundSize: "cover",
    backgroundPosition: "center",
    minHeight: "280px",
    boxShadow: "0 12px 28px rgba(15,23,42,0.12)",
  }),
  controlsColumn: {
    display: "grid",
    gap: "16px",
    alignContent: "start",
  },
  timelineWrap: {
    display: "grid",
    gap: "10px",
    border: "1px solid var(--app-border-soft)",
    background: "var(--app-surface-soft)",
    borderRadius: "16px",
    padding: "14px",
  },
  progressSummary: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  progressBadge: {
    fontSize: "12px",
    fontWeight: 700,
    color: "var(--app-text)",
  },
  progressRemaining: {
    fontSize: "12px",
    color: "var(--app-text-muted)",
  },
  timeline: {
    width: "100%",
    accentColor: "#38bdf8",
    cursor: "pointer",
  },
  audioHint: {
    fontSize: "12px",
    color: "var(--app-text-faint)",
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
  primaryButton: (disabled) => ({
    border: "1px solid var(--app-border)",
    background: "var(--app-selected-surface)",
    color: "var(--app-selected-text)",
    borderRadius: "14px",
    padding: "12px 18px",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    fontSize: "13px",
    fontWeight: 700,
  }),
  iconControlButton: (disabled) => ({
    border: "1px solid var(--app-border)",
    background: "var(--app-surface)",
    color: "var(--app-text-soft)",
    borderRadius: "14px",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    width: "44px",
    height: "44px",
    justifyContent: "center",
    boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
  }),
  chapterBlock: {
    display: "grid",
    gap: "10px",
    border: "1px solid var(--app-border-soft)",
    background: "var(--app-surface-soft)",
    borderRadius: "16px",
    padding: "14px",
  },
  chapterHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },
  chapterEyebrow: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--app-text-muted)",
  },
  chapterCount: {
    fontSize: "11px",
    color: "var(--app-text-faint)",
  },
  chapterList: {
    display: "grid",
    gap: "8px",
    maxHeight: "240px",
    overflowY: "auto",
    paddingRight: "4px",
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
    textAlign: "left",
  },
  chapterTitle: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  chapterTime: {
    color: "var(--app-text-muted)",
    flexShrink: 0,
  },
};

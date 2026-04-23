"use client";

import { Pause, Play, RotateCcw, SkipBack, SkipForward, X } from "lucide-react";
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

export default function AudiobookPlayer({
  activeChapterIndex = -1,
  book,
  chapters = [],
  currentProgressSeconds,
  durationSeconds,
  hasPlayableAudio,
  isMobile = false,
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
  const chapterCount = Array.isArray(chapters) ? chapters.length : 0;
  const shouldRenderChapters = chapterCount > 0;
  const remainingSeconds = Math.max(0, durationSeconds - currentProgressSeconds);
  const plainDescription = clampWords(stripHtml(book.description), 50);
  const coverUrl = book.coverImage || book.cover_url || FALLBACK_COVER_URL;
  const shellStyle = isMobile
    ? {
        ...styles.shell,
        gap: "30px",
        padding: "14px",
        borderRadius: "24px",
        width: "100%",
        maxWidth: "560px",
        minHeight: "auto",
        alignContent: "start",
        boxSizing: "border-box",
      }
    : styles.shell;
  const playerHeaderStyle = isMobile
    ? {
        ...styles.playerHeader,
        alignItems: "flex-start",
        gap: "20px",
        flexWrap: "nowrap",
      }
    : styles.playerHeader;
  const headerCopyStyle = isMobile
    ? {
        ...styles.headerCopy,
        gap: "6px",
        flex: "1 1 auto",
      }
    : styles.headerCopy;
  const titleStyle = isMobile
    ? {
        ...styles.title,
        fontSize: "20px",
        lineHeight: 1.15,
      }
    : styles.title;
  const metaStyle = isMobile
    ? {
        ...styles.meta,
        fontSize: "12px",
        lineHeight: 1.5,
      }
    : styles.meta;
  const descriptionStyle = isMobile
    ? {
        ...styles.description,
        fontSize: "13px",
        lineHeight: 1.6,
        WebkitLineClamp: 4,
        maxWidth: "100%",
        display: "none",
      }
    : styles.description;
  const iconButtonStyle = isMobile
    ? {
        ...styles.iconButton(false),
        width: "42px",
        height: "42px",
        borderRadius: "12px",
      }
    : styles.iconButton(false);
  const playerGridStyle = isMobile
    ? {
        ...styles.playerGrid,
        gridTemplateColumns: "1fr",
        gap: "40px",
      }
    : styles.playerGrid;
  const coverWrapStyle = styles.coverWrap;
  const controlsColumnStyle = isMobile
    ? {
        ...styles.controlsColumn,
        gap: "14px",
      }
    : styles.controlsColumn;
  const timelineWrapStyle = isMobile
    ? {
        ...styles.timelineWrap,
        padding: "12px",
      }
    : styles.timelineWrap;
  const actionRowStyle = isMobile
    ? {
        ...styles.actionRow,
        gap: "8px",
        flexWrap: "nowrap",
      }
    : styles.actionRow;
  const primaryButtonStyle = isMobile
    ? {
        ...styles.iconControlButton(!hasPlayableAudio),
        flex: "1 1 0",
        width: "auto",
        height: "44px",
        justifyContent: "center",
        padding: 0,
      }
    : styles.primaryButton(!hasPlayableAudio);
  const iconControlButtonStyle = isMobile
    ? {
        ...styles.iconControlButton(!hasPlayableAudio),
        flex: "1 1 0",
        width: "auto",
      }
    : styles.iconControlButton(!hasPlayableAudio);
  const chapterBlockStyle = isMobile
    ? {
        ...styles.chapterBlock,
        padding: "12px",
      }
    : styles.chapterBlock;
  const chapterListStyle = isMobile
    ? {
        ...styles.chapterList,
        maxHeight: "min(220px, 32svh)",
      }
    : styles.chapterList;

  return (
    <section style={shellStyle}>
      <div style={playerHeaderStyle}>
        <div style={headerCopyStyle}>
          <div style={styles.eyebrow}>Audiobook Player</div>
          <h3 style={titleStyle}>{book.title}</h3>
          <p style={metaStyle}>{buildMetadataLine(book, durationSeconds)}</p>
          {!isMobile ? <p style={descriptionStyle}>{plainDescription}</p> : null}
        </div>

        <div
          style={{
            ...styles.headerActions,
            alignSelf: "flex-start",
            marginLeft: "auto",
          }}
        >
          <button type="button" onClick={onClosePlayer} style={iconButtonStyle} aria-label="Close player">
            <X size={18} />
          </button>
        </div>
      </div>

      <div style={playerGridStyle}>
        {isMobile ? (
          <div style={styles.mobileCoverCard}>
            <img
              key={`${book.id}-${coverUrl}`}
              src={coverUrl}
              alt={`Cover artwork for ${book.title}`}
              style={styles.mobileCoverImage}
              onError={(event) => {
                event.currentTarget.src = FALLBACK_COVER_URL;
              }}
            />
          </div>
        ) : (
          <div style={coverWrapStyle}>
            <div style={styles.cover(book.coverGradient)}>
              <img
                key={`${book.id}-${coverUrl}`}
                src={coverUrl}
                alt={`Cover artwork for ${book.title}`}
                style={styles.coverImage}
                onError={(event) => {
                  event.currentTarget.src = FALLBACK_COVER_URL;
                }}
              />
            </div>
          </div>
        )}

        <div style={controlsColumnStyle}>
          <div style={timelineWrapStyle}>
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

          <div style={actionRowStyle}>
            <button
              type="button"
              onClick={onTogglePlayback}
              disabled={!hasPlayableAudio}
              style={primaryButtonStyle}
              aria-label={playing ? "Pause audiobook" : "Play audiobook"}
              title={playing ? "Pause audiobook" : "Play audiobook"}
            >
              {playing ? <Pause size={18} /> : <Play size={18} />}
              {!isMobile ? (playing ? "Pause" : "Play") : null}
            </button>

            <button
              type="button"
              onClick={onPlayFromStart}
              disabled={!hasPlayableAudio}
              style={iconControlButtonStyle}
              aria-label="Play from start"
              title="Play from start"
            >
              <RotateCcw size={16} />
            </button>

            <button
              type="button"
              onClick={() => onSkipBy(-10)}
              disabled={!hasPlayableAudio}
              style={iconControlButtonStyle}
              aria-label="Skip back 10 seconds"
              title="Skip back 10 seconds"
            >
              <SkipBack size={16} />
            </button>

            <button
              type="button"
              onClick={() => onSkipBy(10)}
              disabled={!hasPlayableAudio}
              style={iconControlButtonStyle}
              aria-label="Skip forward 10 seconds"
              title="Skip forward 10 seconds"
            >
              <SkipForward size={16} />
            </button>
          </div>

          <div style={chapterBlockStyle}>
            <div style={styles.chapterHeader}>
              <div style={styles.chapterEyebrow}>Chapters</div>
              <div style={styles.chapterCount}>
                {shouldRenderChapters ? `${chapterCount} items` : "Unavailable"}
              </div>
            </div>

            {shouldRenderChapters ? (
              <div style={chapterListStyle}>
                {chapters.map((chapter, index) => {
                  const isActiveChapter = index === activeChapterIndex;

                  return (
                    <button
                      key={chapter.id}
                      type="button"
                      onClick={() => onSeekTo(chapter.startSeconds)}
                      style={styles.chapterButton(isActiveChapter)}
                    >
                      <span style={styles.chapterTitle}>{chapter.title}</span>
                      <span style={styles.chapterTime(isActiveChapter)}>
                        {formatClock(chapter.startSeconds)}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div style={styles.chapterEmptyState}>
                Chapter markers are not available in the player yet.
              </div>
            )}
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
  mobileCoverCard: {
    width: "min(100%, 244px)",
    aspectRatio: "1 / 1",
    margin: "0 auto",
    borderRadius: "20px",
    overflow: "hidden",
    background: "var(--app-surface)",
    boxShadow: "0 12px 28px rgba(15,23,42,0.12)",
    lineHeight: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  mobileCoverImage: {
    width: "100%",
    height: "100%",
    display: "block",
    objectFit: "cover",
    objectPosition: "center",
  },
  coverWrap: {
    width: "220px",
  },
  cover: (coverGradient) => ({
    position: "relative",
    borderRadius: "20px",
    background: coverGradient,
    overflow: "hidden",
    aspectRatio: "4 / 5",
    minHeight: "280px",
    boxShadow: "0 12px 28px rgba(15,23,42,0.12)",
  }),
  coverImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
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
  chapterEmptyState: {
    border: "1px dashed var(--app-border-soft)",
    background: "rgba(255, 255, 255, 0.58)",
    color: "var(--app-text-muted)",
    borderRadius: "14px",
    padding: "14px 12px",
    fontSize: "13px",
    lineHeight: 1.5,
  },
  chapterButton: (active) => ({
    border: active ? "1px solid var(--app-selected-border)" : "1px solid var(--app-border-soft)",
    background: active ? "var(--app-selected-surface)" : "var(--app-surface)",
    color: active ? "var(--app-selected-text)" : "var(--app-text)",
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
    transition: "background 160ms ease, border-color 160ms ease, color 160ms ease",
  }),
  chapterTitle: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  chapterTime: (active) => ({
    color: active ? "rgba(248, 250, 252, 0.82)" : "var(--app-text-muted)",
    flexShrink: 0,
  }),
};

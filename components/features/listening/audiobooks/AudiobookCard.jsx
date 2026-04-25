"use client";

export default function AudiobookCard({ book, onSelect, compact = false, fullWidth = false }) {
  const progressPercent = Math.max(0, Math.min(100, book.progressPercent || 0));
  const useBareArtwork = compact && fullWidth;
  const isOverlayCard = compact && fullWidth;

  return (
    <button type="button" onClick={() => onSelect(book)} style={styles.card(compact, fullWidth)}>
      <div style={styles.cover(book.coverImage, book.coverGradient, useBareArtwork)}>
        {!useBareArtwork ? <div style={styles.coverGlow(book.accentColor)} /> : null}
        {!useBareArtwork ? (
          <div style={styles.coverTextWrap}>
            <span style={styles.coverEyebrow}>Audiobook</span>
            <span style={styles.coverTitle}>{book.title}</span>
          </div>
        ) : null}
      </div>

      <div style={styles.meta}>
        <div style={styles.title(isOverlayCard)}>{book.title}</div>
        <div style={styles.author(isOverlayCard)}>{book.author}</div>
      </div>

      <div style={styles.progressMeta(isOverlayCard)}>
        <span style={styles.progressLabel}>{progressPercent.toFixed(0)}% complete</span>
        <span style={styles.progressTime}>{formatDuration(book.remainingSeconds)} left</span>
      </div>

      <div style={styles.progressTrack(isOverlayCard)}>
        <div style={styles.progressFill(progressPercent, book.accentColor)} />
      </div>
    </button>
  );
}

function formatDuration(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds || 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  if (!hours) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
}

const styles = {
  card: (compact, fullWidth) => ({
    border:
      compact && fullWidth
        ? "1px solid rgba(255,255,255,0.1)"
        : "1px solid var(--app-border-soft)",
    background:
      compact && fullWidth
        ? "linear-gradient(180deg, rgba(30,41,59,0.94) 0%, rgba(30,41,59,0.9) 100%)"
        : "var(--app-card)",
    borderRadius: compact && fullWidth ? "20px" : "18px",
    padding: compact ? "12px" : "14px",
    display: "grid",
    gap: "12px",
    cursor: "pointer",
    textAlign: "left",
    minWidth: fullWidth ? "100%" : compact ? "190px" : "220px",
    width: fullWidth ? "100%" : "auto",
    boxShadow:
      compact && fullWidth
        ? "0 16px 34px rgba(15,23,42,0.16)"
        : "0 12px 28px rgba(15,23,42,0.08)",
  }),
  cover: (coverImage, coverGradient, useBareArtwork) => ({
    position: "relative",
    aspectRatio: "1 / 1",
    borderRadius: "16px",
    overflow: "hidden",
    background: coverGradient,
    backgroundImage: coverImage
      ? useBareArtwork
        ? `url("${coverImage}")`
        : `linear-gradient(180deg, rgba(15,23,42,0.08) 0%, rgba(15,23,42,0.28) 52%, rgba(15,23,42,0.8) 100%), url("${coverImage}")`
      : undefined,
    backgroundSize: "cover",
    backgroundPosition: "center",
    padding: useBareArtwork ? 0 : "14px",
    display: "flex",
    alignItems: useBareArtwork ? "stretch" : "flex-end",
  }),
  coverGlow: () => ({
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.02) 0%, rgba(15,23,42,0.12) 42%, rgba(15,23,42,0.4) 100%)",
  }),
  coverTextWrap: {
    position: "relative",
    display: "grid",
    gap: "6px",
    color: "#fff",
  },
  coverEyebrow: {
    fontSize: "10px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    opacity: 0.82,
  },
  coverTitle: {
    fontSize: "18px",
    fontWeight: 700,
    lineHeight: 1.15,
    letterSpacing: "-0.03em",
    textShadow: "0 2px 12px rgba(15,23,42,0.18)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "100%",
  },
  meta: {
    display: "grid",
    gap: "4px",
  },
  title: (overlay) => ({
    fontSize: "14px",
    fontWeight: 700,
    color: overlay ? "#f8fafc" : "var(--app-text)",
    lineHeight: 1.3,
  }),
  author: (overlay) => ({
    fontSize: "12px",
    color: overlay ? "rgba(226,232,240,0.72)" : "var(--app-text-muted)",
  }),
  progressMeta: (overlay) => ({
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    alignItems: "center",
    fontSize: "11px",
    color: overlay ? "rgba(226,232,240,0.72)" : "var(--app-text-muted)",
  }),
  progressLabel: {
    fontWeight: 700,
  },
  progressTime: {
    whiteSpace: "nowrap",
  },
  progressTrack: (overlay) => ({
    height: "6px",
    borderRadius: "999px",
    background: overlay ? "rgba(255,255,255,0.08)" : "var(--app-progress-track)",
    border: overlay ? "1px solid rgba(255,255,255,0.08)" : "1px solid var(--app-border-soft)",
    overflow: "hidden",
  }),
  progressFill: (progressPercent, accentColor) => ({
    width: `${progressPercent}%`,
    height: "100%",
    borderRadius: "inherit",
    background: accentColor,
  }),
};

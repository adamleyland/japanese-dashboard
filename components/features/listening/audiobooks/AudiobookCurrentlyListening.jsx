"use client";

export default function AudiobookCurrentlyListening({ book, onOpen }) {
  if (!book) {
    return null;
  }

  return (
    <section style={styles.section}>
      <div style={styles.sectionHeader}>
        <div style={styles.sectionEyebrow}>Currently Listening</div>
        <div style={styles.sectionHint}>Resume where you left off</div>
      </div>

      <button type="button" onClick={onOpen} style={styles.card}>
        <div style={styles.cover(book.coverGradient)}>
          <div style={styles.coverTitle}>{book.title}</div>
        </div>

        <div style={styles.meta}>
          <div style={styles.title}>{book.title}</div>
          <div style={styles.author}>{book.author}</div>
          <div style={styles.description}>{book.description}</div>

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
      </button>
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
  card: {
    border: "1px solid var(--app-border-soft)",
    background: "var(--app-card)",
    borderRadius: "20px",
    padding: "16px",
    display: "grid",
    gridTemplateColumns: "160px minmax(0, 1fr)",
    gap: "16px",
    textAlign: "left",
    cursor: "pointer",
    boxShadow: "0 16px 36px rgba(15,23,42,0.08)",
  },
  cover: (coverGradient) => ({
    borderRadius: "18px",
    background: coverGradient,
    minHeight: "200px",
    padding: "18px",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "flex-start",
  }),
  coverTitle: {
    color: "#fff",
    fontSize: "22px",
    fontWeight: 700,
    lineHeight: 1.1,
    letterSpacing: "-0.04em",
    textShadow: "0 2px 16px rgba(15,23,42,0.18)",
  },
  meta: {
    display: "grid",
    gap: "10px",
    alignContent: "center",
    minWidth: 0,
  },
  title: {
    fontSize: "22px",
    fontWeight: 700,
    lineHeight: 1.1,
    letterSpacing: "-0.03em",
    color: "var(--app-text)",
  },
  author: {
    fontSize: "14px",
    color: "var(--app-text-soft)",
  },
  description: {
    fontSize: "13px",
    lineHeight: 1.6,
    color: "var(--app-text-muted)",
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

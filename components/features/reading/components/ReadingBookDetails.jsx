"use client";

import { ExternalLink } from "lucide-react";

export default function ReadingBookDetails({
  book,
  styles,
  includeStatus = false,
  compact = false,
}) {
  const detailItems = [
    { key: "author", label: "Author", value: book.author },
    { key: "isbn", label: "ISBN", value: book.isbn },
    { key: "published", label: "Published", value: book.salesDateLabel },
    { key: "added", label: "Added", value: formatBookDate(book.createdAt) },
    ...(includeStatus ? [{ key: "status", label: "Status", value: book.statusLabel }] : []),
  ].filter((item) => item.value);

  const hasProgress = typeof book.progressPercent === "number";
  const hasDetails = Boolean(hasProgress || book.caption || detailItems.length || book.rakutenUrl);

  if (!hasDetails) {
    return (
      <div style={{ ...styles.playerSub, margin: 0 }}>
        No additional book details available yet.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "12px" }}>
      {hasProgress ? (
        <div style={detailStyles.progressCard}>
          <div style={detailStyles.progressHeader}>
            <span>Reading progress</span>
            <strong>{Math.round(book.progressPercent)}%</strong>
          </div>
          <div
            role="progressbar"
            aria-label={`Reading progress ${Math.round(book.progressPercent)}%`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(book.progressPercent)}
            style={detailStyles.progressTrack}
          >
            <span style={detailStyles.progressFill(book.progressPercent)} />
          </div>
          <span style={detailStyles.progressNote}>Synced from your current LingQ book.</span>
        </div>
      ) : null}

      {book.caption ? (
        <p
          style={{
            margin: 0,
            fontSize: compact ? "13px" : "14px",
            lineHeight: 1.6,
            color: "var(--app-text-soft)",
          }}
        >
          {book.caption}
        </p>
      ) : null}

      {detailItems.length ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: compact
              ? "repeat(2, minmax(0, 1fr))"
              : "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "8px",
          }}
        >
          {detailItems.map((item) => (
            <div
              key={item.key}
              style={{
                borderRadius: "14px",
                border: "1px solid var(--app-border-soft)",
                background: "var(--app-surface-elevated)",
                padding: "10px 12px",
                display: "grid",
                gap: "4px",
                minWidth: 0,
              }}
            >
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--app-text-muted)",
                }}
              >
                {item.label}
              </div>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "var(--app-text)",
                  overflowWrap: "anywhere",
                }}
              >
                {item.value}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {book.rakutenUrl ? (
        <a
          href={book.rakutenUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            color: "#2563eb",
            fontSize: "13px",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Open on Rakuten
          <ExternalLink size={14} />
        </a>
      ) : null}
    </div>
  );
}

function formatBookDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

const detailStyles = {
  progressCard: {
    display: "grid",
    gap: "9px",
    padding: "13px",
    borderRadius: "16px",
    border: "1px solid rgba(59,130,246,0.16)",
    background: "rgba(59,130,246,0.07)",
  },
  progressHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    color: "var(--app-text)",
    fontSize: "12px",
    fontWeight: 750,
  },
  progressTrack: {
    height: "7px",
    overflow: "hidden",
    borderRadius: "999px",
    background: "var(--app-progress-track, #e2e8f0)",
  },
  progressFill: (value) => ({
    display: "block",
    width: `${Math.max(0, Math.min(100, value))}%`,
    height: "100%",
    borderRadius: "inherit",
    background: "linear-gradient(90deg, #3b82f6, #6366f1)",
  }),
  progressNote: {
    color: "var(--app-text-muted)",
    fontSize: "10px",
    lineHeight: 1.4,
  },
};

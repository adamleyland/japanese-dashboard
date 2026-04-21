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
    { key: "sales-date", label: "Sales date", value: book.salesDateLabel || book.salesDate },
    {
      key: "match-status",
      label: "Match status",
      value: book.matchStatusLabel || book.matchStatus,
    },
    {
      key: "match-confidence",
      label: "Match confidence",
      value: book.matchConfidenceLabel,
    },
    ...(includeStatus ? [{ key: "status", label: "Status", value: book.statusLabel }] : []),
  ].filter((item) => item.value);

  const hasDetails = Boolean(book.caption || detailItems.length || book.rakutenUrl);

  if (!hasDetails) {
    return (
      <div style={{ ...styles.playerSub, margin: 0 }}>
        No additional book details available yet.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "12px" }}>
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

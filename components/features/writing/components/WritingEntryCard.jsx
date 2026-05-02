"use client";

import {
  formatWritingLongDate,
  getEntryDisplayTitle,
} from "@/components/features/writing/utils/writingStats";

export default function WritingEntryCard({ entry, active = false, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(entry)}
      style={localStyles.card(active)}
    >
      <div style={localStyles.topRow}>
        <div style={{ minWidth: 0 }}>
          <div style={localStyles.title}>{getEntryDisplayTitle(entry)}</div>
          <div style={localStyles.date}>{formatWritingLongDate(entry.createdAt)}</div>
        </div>
      </div>

      <div style={localStyles.preview}>{entry.preview}</div>
    </button>
  );
}

const localStyles = {
  card: (active) => ({
    width: "100%",
    textAlign: "left",
    padding: "10px 12px",
    borderRadius: "16px",
    border: active
      ? "1px solid rgba(16,185,129,0.22)"
      : "1px solid var(--app-border-soft)",
    background: active
      ? "linear-gradient(180deg, rgba(16,185,129,0.12) 0%, var(--app-surface-elevated) 100%)"
      : "var(--app-surface-elevated)",
    display: "grid",
    gap: "6px",
    cursor: "pointer",
    minWidth: 0,
    boxShadow: active ? "0 10px 20px rgba(5,150,105,0.1)" : "none",
  }),
  topRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    alignItems: "flex-start",
  },
  title: {
    fontSize: "14px",
    fontWeight: 700,
    color: "var(--app-text)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  date: {
    marginTop: "2px",
    fontSize: "11px",
    color: "var(--app-text-muted)",
  },
  preview: {
    fontSize: "12px",
    color: "var(--app-text-soft)",
    lineHeight: 1.45,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
};

"use client";

import {
  formatWritingLongDate,
  getEntryDisplayTitle,
} from "@/components/features/writing/utils/writingStats";

export default function WritingEntryCard({ entry, active = false, isDense = false, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(entry)}
      style={localStyles.card(active, isDense)}
    >
      <div style={localStyles.topRow}>
        <div style={{ minWidth: 0 }}>
          <div style={localStyles.title(isDense)}>{getEntryDisplayTitle(entry)}</div>
          <div style={localStyles.date(isDense)}>{formatWritingLongDate(entry.createdAt)}</div>
        </div>
      </div>

      <div style={localStyles.preview(isDense)}>{entry.preview}</div>
    </button>
  );
}

const localStyles = {
  card: (active, isDense) => ({
    width: "100%",
    textAlign: "left",
    padding: isDense ? "8px 10px" : "10px 12px",
    borderRadius: isDense ? "14px" : "16px",
    border: active
      ? "1px solid rgba(16,185,129,0.22)"
      : "1px solid var(--app-border-soft)",
    background: active
      ? "linear-gradient(180deg, rgba(16,185,129,0.12) 0%, var(--app-surface-elevated) 100%)"
      : "var(--app-surface-elevated)",
    display: "grid",
    gap: isDense ? "4px" : "6px",
    cursor: "pointer",
    minWidth: 0,
    boxShadow: active ? "0 8px 16px rgba(5,150,105,0.1)" : "none",
  }),
  topRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    alignItems: "flex-start",
  },
  title: (isDense) => ({
    fontSize: isDense ? "13px" : "14px",
    fontWeight: 700,
    color: "var(--app-text)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  }),
  date: (isDense) => ({
    marginTop: isDense ? "1px" : "2px",
    fontSize: isDense ? "10px" : "11px",
    color: "var(--app-text-muted)",
  }),
  preview: (isDense) => ({
    fontSize: isDense ? "11px" : "12px",
    color: "var(--app-text-soft)",
    lineHeight: isDense ? 1.35 : 1.45,
    display: "-webkit-box",
    WebkitLineClamp: isDense ? 1 : 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  }),
};

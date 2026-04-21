"use client";

import { getReadingStatusLabel } from "@/lib/reading/normalizers";

const TONE_MAP = {
  in_progress: {
    background: "rgba(59,130,246,0.14)",
    color: "#2563eb",
    border: "1px solid rgba(59,130,246,0.18)",
  },
  reading_list: {
    background: "var(--app-surface-elevated)",
    color: "var(--app-text-muted)",
    border: "1px solid var(--app-border-soft)",
  },
  finished: {
    background: "rgba(16,185,129,0.14)",
    color: "#059669",
    border: "1px solid rgba(16,185,129,0.18)",
  },
};

export default function ReadingStatusBadge({ status }) {
  const tone = TONE_MAP[status] || TONE_MAP.reading_list;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "7px 10px",
        borderRadius: "999px",
        fontSize: "11px",
        fontWeight: 800,
        whiteSpace: "nowrap",
        ...tone,
      }}
    >
      {getReadingStatusLabel(status)}
    </span>
  );
}

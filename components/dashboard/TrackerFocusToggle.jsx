"use client";

import { Focus } from "lucide-react";

export default function TrackerFocusToggle({ active, onToggle, compact = false }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      aria-label={active ? "Disable expanded tracker mode" : "Enable expanded tracker mode"}
      title={active ? "Return to the default tracker layout" : "Expand the tracker layout"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "10px",
        minHeight: "38px",
        padding: compact ? "8px 10px" : "8px 12px",
        borderRadius: "999px",
        border: active
          ? "1px solid var(--app-selected-border)"
          : "1px solid var(--app-border-soft)",
        background: active ? "var(--app-selected-surface)" : "var(--app-surface-elevated)",
        color: active ? "var(--app-selected-text)" : "var(--app-text-soft)",
        cursor: "pointer",
        boxShadow: active
          ? "0 10px 24px rgba(15,23,42,0.16)"
          : "0 10px 24px rgba(15,23,42,0.08)",
        transition:
          "background 180ms ease, color 180ms ease, border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      }}
      >
      {compact ? (
        <Focus size={14} />
      ) : (
        <span
          aria-hidden="true"
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "999px",
            background: active ? "currentColor" : "rgba(148,163,184,0.8)",
            boxShadow: active ? "0 0 0 6px rgba(255,255,255,0.08)" : "none",
            transition: "all 180ms ease",
          }}
        />
      )}

      {!compact ? (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            fontSize: "12px",
            fontWeight: 800,
            letterSpacing: "0.03em",
            whiteSpace: "nowrap",
          }}
        >
          {active ? "Expanded tracker" : "Focus tracker"}
        </span>
      ) : null}
    </button>
  );
}

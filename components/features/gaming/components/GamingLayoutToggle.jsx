"use client";

import { LayoutGrid, List } from "lucide-react";

const OPTIONS = [
  { value: "list", label: "List view", icon: List },
  { value: "artwork", label: "Artwork view", icon: LayoutGrid },
];

export default function GamingLayoutToggle({ value, onChange, compact = false }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: compact ? "4px" : "6px",
        borderRadius: "999px",
        background: "var(--app-pill-track)",
        border: "1px solid var(--app-border-soft)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
        flexShrink: 0,
      }}
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-label={option.label}
            title={option.label}
            style={{
              width: compact ? "32px" : "36px",
              height: compact ? "32px" : "36px",
              borderRadius: "999px",
              border: "none",
              background: active ? "var(--app-selected-surface)" : "transparent",
              color: active ? "var(--app-selected-text)" : "var(--app-text-muted)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: active ? "0 6px 18px rgba(15,23,42,0.08)" : "none",
              transition: "all 160ms ease",
            }}
          >
            <Icon size={15} />
          </button>
        );
      })}
    </div>
  );
}

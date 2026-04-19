"use client";

import { PillSliderToggle } from "@/components/dashboard/DictionaryCarousel";

export default function GamingSourceToggle({
  value,
  onChange,
  isCompact,
  showExcludedOnly,
  onToggleExcludedView,
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: isCompact ? "flex-start" : "flex-end",
        flexShrink: 0,
        gap: "10px",
        flexWrap: "wrap",
      }}
    >
      <PillSliderToggle
        value={value}
        onChange={onChange}
        options={[
          { value: "all", label: "All" },
          { value: "steam", label: "Steam" },
          { value: "xbox", label: "Xbox" },
        ]}
        width={isCompact ? 220 : 260}
        size="sm"
      />

      <button
        type="button"
        onClick={() => onToggleExcludedView(!showExcludedOnly)}
        style={{
          border: showExcludedOnly
            ? "1px solid var(--app-selected-border)"
            : "1px solid var(--app-border-soft)",
          background: showExcludedOnly
            ? "var(--app-selected-surface)"
            : "var(--app-pill-track)",
          color: showExcludedOnly ? "var(--app-selected-text)" : "var(--app-text-muted)",
          borderRadius: "999px",
          padding: "10px 16px",
          fontSize: "12px",
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: showExcludedOnly ? "0 6px 18px rgba(15,23,42,0.08)" : "none",
          whiteSpace: "nowrap",
        }}
      >
        Excluded games
      </button>
    </div>
  );
}

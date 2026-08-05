"use client";

import { EyeOff, Library, Monitor } from "lucide-react";
import { PillSliderToggle } from "@/components/dashboard/DictionaryCarousel";
import { SteamGlyph, XboxGlyph } from "@/components/features/gaming/components/GamingSourceIcons";

export default function GamingSourceToggle({
  value,
  onChange,
  isCompact,
  isMobile = false,
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
        overflow: "visible",
        padding: isMobile ? "1px 0 0 1px" : 0,
      }}
    >
      <PillSliderToggle
        value={value}
        onChange={onChange}
        options={[
          { value: "all", label: "All", icon: Library, ariaLabel: "All games" },
          {
            value: "steam",
            label: "Steam",
            icon: function SteamFilterIcon() {
              return <SteamGlyph color="currentColor" size={14} />;
            },
            ariaLabel: "Steam games",
          },
          {
            value: "xbox",
            label: "Xbox",
            icon: function XboxFilterIcon() {
              return <XboxGlyph color="currentColor" size={14} />;
            },
            ariaLabel: "Xbox games",
          },
          {
            value: "local",
            label: "Local",
            icon: Monitor,
            ariaLabel: "Local games",
          },
        ]}
        width={isMobile ? 160 : isCompact ? 372 : 420}
        size="sm"
        iconOnly={isMobile}
      />

      <button
        type="button"
        onClick={() => onToggleExcludedView(!showExcludedOnly)}
        aria-label={showExcludedOnly ? "Show included games" : "Show excluded games"}
        title={showExcludedOnly ? "Show included games" : "Show excluded games"}
        style={{
          border: showExcludedOnly
            ? "1px solid var(--app-selected-border)"
            : "1px solid var(--app-border-soft)",
          background: showExcludedOnly
            ? "var(--app-selected-surface)"
            : "var(--app-pill-track)",
          color: showExcludedOnly ? "var(--app-selected-text)" : "var(--app-text-muted)",
          borderRadius: "999px",
          padding: isMobile ? "10px" : "10px 16px",
          fontSize: "12px",
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: showExcludedOnly ? "0 6px 18px rgba(15,23,42,0.08)" : "none",
          whiteSpace: "nowrap",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
        }}
      >
        <EyeOff size={14} />
        {!isMobile ? "Excluded games" : null}
      </button>
    </div>
  );
}

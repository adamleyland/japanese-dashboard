"use client";

import { Check, ChevronDown, RefreshCcw, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import GamingLayoutToggle from "@/components/features/gaming/components/GamingLayoutToggle";
import GamingLibraryArtworkView from "@/components/features/gaming/components/GamingLibraryArtworkView";
import GamingLibraryListView from "@/components/features/gaming/components/GamingLibraryListView";
import GamingSourceToggle from "@/components/features/gaming/components/GamingSourceToggle";
import { GAMING_SORT_OPTIONS } from "@/lib/gaming/gaming-utils";

export default function GamingLibraryPanel({
  styles,
  games,
  loading,
  error,
  isMobile,
  sourceFilter,
  onSourceFilterChange,
  showExcludedOnly,
  onToggleExcludedView,
  layoutMode,
  onLayoutModeChange,
  sortKey,
  onSortKeyChange,
  onToggleInclude,
  onRefresh,
  sourceStatus,
  isCompact,
  targetHeight,
  isOverlay = false,
  showRefreshButton = true,
  achievementSummaries = {},
  onOpenAchievements,
}) {
  const renderBody = () => {
    if (loading) {
      return <EmptyState label="Loading your gaming library..." />;
    }

    if (error && !games.length) {
      return <EmptyState label={error} tone="error" />;
    }

    if (!games.length) {
      return (
        <EmptyState
          label={
            showExcludedOnly
              ? "No excluded games right now. Toggle a game out of the total to move it here."
              : "No games found yet. Connect Steam or Xbox, or send a game from a Local Games companion client."
          }
        />
      );
    }

    if (layoutMode === "artwork") {
      return (
        <GamingLibraryArtworkView
          games={games}
          isCompact={isCompact}
          onOpenAchievements={onOpenAchievements}
        />
      );
    }

    return (
      <GamingLibraryListView
        styles={styles}
        games={games}
        isCompact={isCompact}
        onToggleInclude={onToggleInclude}
        achievementSummaries={achievementSummaries}
        onOpenAchievements={onOpenAchievements}
      />
    );
  };

  return (
    <div
      style={{
        ...styles.largeCard,
        padding: isOverlay ? 0 : isCompact ? "16px" : styles.largeCard.padding,
        display: "grid",
        gridTemplateRows: "auto 1fr",
        minHeight: 0,
        height: isOverlay ? "100%" : targetHeight ? `${targetHeight}px` : "auto",
        maxHeight: isOverlay ? "100%" : targetHeight ? `${targetHeight}px` : "none",
        overflow: "hidden",
        border: isOverlay ? "none" : styles.largeCard.border,
        background: isOverlay ? "transparent" : styles.largeCard.background,
        boxShadow: isOverlay ? "none" : styles.largeCard.boxShadow,
      }}
    >
      <div
        style={{
          ...styles.sectionHeader,
          flexDirection: "column",
          alignItems: "stretch",
          gap: "10px",
          marginBottom: "10px",
        }}
      >
        {!isOverlay ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <h2 style={{ ...styles.sectionTitle, margin: 0 }}>Gaming Library</h2>
          </div>
        ) : null}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", width: "100%", padding: isMobile && isOverlay ? "1px 3px" : 0, boxSizing: "border-box" }}>
          <GamingSourceToggle
            value={sourceFilter}
            onChange={onSourceFilterChange}
            isCompact={isCompact}
            isMobile={isMobile}
            sourceStatus={sourceStatus}
            showExcludedOnly={showExcludedOnly}
            onToggleExcludedView={onToggleExcludedView}
            fillWidth={isMobile && isOverlay}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: isMobile && !isOverlay ? "wrap" : "nowrap", width: "100%" }}>
          <GamingSortMenu value={sortKey} onChange={onSortKeyChange} fullWidth={isMobile && !isOverlay} flexFill={isMobile && isOverlay} />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, flexShrink: 0, marginLeft: "auto" }}>
            {showRefreshButton ? (
              <button
                type="button"
                onClick={onRefresh}
                aria-label="Refresh gaming library"
                title="Refresh gaming library"
                style={{ width: 42, height: 42, border: "1px solid var(--app-border-soft)", background: "var(--app-pill-track)", color: "var(--app-text-soft)", borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              >
                <RefreshCcw size={15}/>
              </button>
            ) : null}
            <GamingLayoutToggle value={layoutMode} onChange={onLayoutModeChange} compact />
          </div>
        </div>

        {showExcludedOnly ? (
          <div style={{ ...styles.playerSub, margin: 0 }}>
            Showing excluded games across all connected sources.
          </div>
        ) : null}
      </div>

      <div
        className="gaming-library-scroll"
        style={{
          minHeight: 0,
          height: "100%",
          overflowY: "auto",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          paddingRight: "4px",
          paddingBottom: "2px",
          overscrollBehavior: "contain",
        }}
      >
        {renderBody()}
      </div>
    </div>
  );
}

function GamingSortMenu({ value, onChange, fullWidth = false, flexFill = false }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const selected = GAMING_SORT_OPTIONS.find((option) => option.value === value) || GAMING_SORT_OPTIONS[0];

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <div ref={menuRef} style={{ position: "relative", width: fullWidth ? "100%" : flexFill ? "auto" : "210px", flex: flexFill ? "1 1 auto" : "0 0 auto", minWidth: 0, zIndex: 20 }}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          width: "100%",
          minHeight: "42px",
          display: "grid",
          gridTemplateColumns: "28px minmax(0,1fr) 18px",
          alignItems: "center",
          gap: "8px",
          padding: "6px 10px 6px 7px",
          border: open ? "1px solid var(--app-selected-border)" : "1px solid var(--app-border-soft)",
          borderRadius: "999px",
          background: "var(--app-pill-track)",
          color: "var(--app-text)",
          boxShadow: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{ width: 28, height: 28, borderRadius: 999, display: "grid", placeItems: "center", color: "var(--app-text-muted)" }}><SlidersHorizontal size={13}/></span>
        <span style={{ minWidth: 0, fontSize: 12, lineHeight: 1.2, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Sort by {selected.label}</span>
        <ChevronDown size={14} style={{ color: "var(--app-text-muted)", transform: open ? "rotate(180deg)" : "none", transition: "transform .16s ease" }}/>
      </button>

      {open ? (
        <div role="listbox" style={{ position: "absolute", top: "calc(100% + 7px)", right: 0, width: "100%", minWidth: 220, padding: 7, border: "1px solid var(--app-border-soft)", borderRadius: 18, background: "color-mix(in srgb,var(--app-card) 94%,transparent)", backdropFilter: "blur(18px)", boxShadow: "0 18px 42px rgba(15,23,42,.16)", overflow: "hidden" }}>
          {GAMING_SORT_OPTIONS.map((option) => {
            const active = option.value === value;
            return <button key={option.value} type="button" role="option" aria-selected={active} onClick={() => { onChange(option.value); setOpen(false); }} style={{ width: "100%", display: "grid", gridTemplateColumns: "minmax(0,1fr) 18px", alignItems: "center", gap: 8, padding: "9px 10px", border: 0, borderRadius: 10, background: active ? "var(--app-selected-surface)" : "transparent", color: active ? "var(--app-selected-text)" : "var(--app-text-soft)", cursor: "pointer", textAlign: "left", fontSize: 12, fontWeight: active ? 700 : 600 }}><span>{option.label}</span>{active ? <Check size={14}/> : null}</button>;
          })}
        </div>
      ) : null}
    </div>
  );
}

function EmptyState({ label, tone = "default" }) {
  return (
    <div
      style={{
        borderRadius: "18px",
        border:
          tone === "error"
            ? "1px solid rgba(239,68,68,0.22)"
            : "1px dashed var(--app-border-soft)",
        background: tone === "error" ? "rgba(239,68,68,0.06)" : "var(--app-surface-soft)",
        color: tone === "error" ? "#dc2626" : "var(--app-text-muted)",
        padding: "16px",
        fontSize: "13px",
      }}
    >
      {label}
    </div>
  );
}

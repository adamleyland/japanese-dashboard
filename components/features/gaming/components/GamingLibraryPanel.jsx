"use client";

import { RefreshCcw, Search } from "lucide-react";
import GamingLayoutToggle from "@/components/features/gaming/components/GamingLayoutToggle";
import { SteamGlyph, XboxGlyph } from "@/components/features/gaming/components/GamingSourceIcons";
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
}) {
  const renderBody = () => {
    if (loading) {
      return <EmptyState label="Loading your gaming library..." />;
    }

    if (error) {
      return <EmptyState label={error} tone="error" />;
    }

    if (!games.length) {
      return (
        <EmptyState
          label={
            showExcludedOnly
              ? "No excluded games right now. Toggle a game out of the total to move it here."
              : "No games found yet. Add Steam config or an Xbox endpoint to populate this library."
          }
        />
      );
    }

    if (layoutMode === "artwork") {
      return (
        <GamingLibraryArtworkView
          games={games}
          isCompact={isCompact}
          onToggleInclude={onToggleInclude}
        />
      );
    }

    return (
      <GamingLibraryListView
        styles={styles}
        games={games}
        isCompact={isCompact}
        onToggleInclude={onToggleInclude}
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
          gap: "14px",
          marginBottom: isOverlay ? "10px" : "14px",
        }}
      >
        {!isOverlay ? (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <h2 style={styles.sectionTitle}>Gaming Library</h2>
              <p style={styles.sectionText}>
                Unified Steam and Xbox library data, playtime, and artwork in one dashboard.
              </p>
            </div>

            {showRefreshButton ? (
              <button
                type="button"
                onClick={onRefresh}
                style={{
                  border: "1px solid var(--app-border-soft)",
                  background: "var(--app-surface-elevated)",
                  color: "var(--app-text-soft)",
                  borderRadius: "12px",
                  padding: "8px 12px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <RefreshCcw size={13} />
                Refresh
              </button>
            ) : null}
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <GamingSourceToggle
            value={sourceFilter}
            onChange={onSourceFilterChange}
            isCompact={isCompact}
            isMobile={isMobile}
            showExcludedOnly={showExcludedOnly}
            onToggleExcludedView={onToggleExcludedView}
          />

          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 12px",
              borderRadius: "14px",
              background: "var(--app-surface-elevated)",
              border: "1px solid var(--app-border-soft)",
              minWidth: isCompact ? "100%" : "220px",
            }}
          >
            <Search size={14} color="var(--app-text-muted)" />
            <select
              value={sortKey}
              onChange={(event) => onSortKeyChange(event.target.value)}
              style={{
                width: "100%",
                border: "none",
                outline: "none",
                background: "transparent",
                color: "var(--app-text)",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              {GAMING_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  Sort by {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <SourceStatusPill label="Steam" status={sourceStatus.steam} />
            <SourceStatusPill label="Xbox" status={sourceStatus.xbox} />
          </div>

          <GamingLayoutToggle value={layoutMode} onChange={onLayoutModeChange} />
        </div>

        {showExcludedOnly ? (
          <div style={{ ...styles.playerSub, margin: 0 }}>
            Showing excluded games across all connected sources.
          </div>
        ) : null}
      </div>

      <div
        style={{
          minHeight: 0,
          height: "100%",
          overflowY: "auto",
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

function SourceStatusPill({ label, status }) {
  const tone = status.configured
    ? status.error
      ? {
          background: "rgba(239,68,68,0.1)",
          color: "#dc2626",
          border: "1px solid rgba(239,68,68,0.16)",
        }
      : {
          background: "rgba(16,185,129,0.12)",
          color: "#059669",
          border: "1px solid rgba(16,185,129,0.18)",
        }
    : {
        background: "var(--app-surface-soft)",
        color: "var(--app-text-muted)",
        border: "1px solid var(--app-border-soft)",
      };

  const statusLabel = status.loading
    ? "Loading"
    : status.configured
      ? status.error
        ? "Issue"
        : "Connected"
      : "Not configured";

  return (
    <div
      title={`${label}: ${statusLabel}`}
      aria-label={`${label}: ${statusLabel}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "34px",
        height: "34px",
        borderRadius: "999px",
        ...tone,
      }}
    >
      {label === "Steam" ? (
        <SteamGlyph color={tone.color} />
      ) : (
        <XboxGlyph color={tone.color} />
      )}
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

"use client";

import { RefreshCcw } from "lucide-react";
import GamingLayoutToggle from "@/components/features/gaming/components/GamingLayoutToggle";
import ReadingEmptyState from "@/components/features/reading/components/ReadingEmptyState";
import ReadingLibraryArtworkView from "@/components/features/reading/components/ReadingLibraryArtworkView";
import ReadingLibraryListView from "@/components/features/reading/components/ReadingLibraryListView";
import { READING_FILTERS } from "@/lib/reading/constants";

export default function ReadingLibraryPanel({
  styles,
  items,
  loading,
  error,
  filterKey,
  onFilterChange,
  layoutMode,
  onLayoutModeChange,
  counts,
  onRefresh,
  isCompact,
  targetHeight,
}) {
  const renderBody = () => {
    if (loading) {
      return <ReadingLibraryLoadingState layoutMode={layoutMode} isCompact={isCompact} />;
    }

    if (error) {
      return <ReadingEmptyState label={error} tone="error" align="left" />;
    }

    if (!items.length) {
      return <ReadingEmptyState label={getEmptyLabel(filterKey)} align="left" />;
    }

    if (layoutMode === "artwork") {
      return <ReadingLibraryArtworkView styles={styles} items={items} isCompact={isCompact} />;
    }

    return <ReadingLibraryListView styles={styles} items={items} isCompact={isCompact} />;
  };

  return (
    <div
      style={{
        ...styles.largeCard,
        display: "grid",
        gridTemplateRows: "auto 1fr",
        minHeight: 0,
        height: targetHeight ? `${targetHeight}px` : "auto",
        maxHeight: targetHeight ? `${targetHeight}px` : "none",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          ...styles.sectionHeader,
          flexDirection: "column",
          alignItems: "stretch",
          gap: "14px",
          marginBottom: "14px",
        }}
      >
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
            <h2 style={styles.sectionTitle}>Reading Library</h2>
            <p style={styles.sectionText}>
              Supabase-backed book tracking with status filters, cover-first browsing, and quick detail access.
            </p>
          </div>

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
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px",
              borderRadius: "999px",
              background: "var(--app-pill-track)",
              border: "1px solid var(--app-border-soft)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
              flexWrap: "wrap",
            }}
          >
            {READING_FILTERS.map((filter) => {
              const isActive = filterKey === filter.key;

              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => onFilterChange(filter.key)}
                  style={{
                    border: "none",
                    background: isActive ? "var(--app-selected-surface)" : "transparent",
                    color: isActive ? "var(--app-selected-text)" : "var(--app-text-muted)",
                    borderRadius: "999px",
                    padding: "8px 14px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 160ms ease",
                    boxShadow: isActive ? "0 6px 18px rgba(15,23,42,0.08)" : "none",
                  }}
                >
                  {filter.label}{" "}
                  <span style={{ opacity: 0.78 }}>
                    {typeof counts?.[filter.key] === "number" ? counts[filter.key] : 0}
                  </span>
                </button>
              );
            })}
          </div>

          <GamingLayoutToggle value={layoutMode} onChange={onLayoutModeChange} />
        </div>
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

function ReadingLibraryLoadingState({ layoutMode, isCompact }) {
  if (layoutMode === "artwork") {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isCompact
            ? "repeat(2, minmax(0, 1fr))"
            : "repeat(auto-fill, minmax(150px, 1fr))",
          gap: "12px",
        }}
      >
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={`reading-artwork-skeleton-${index}`}
            style={{
              aspectRatio: "2 / 3",
              borderRadius: "20px",
              border: "1px solid var(--app-border-soft)",
              background: "var(--app-surface-soft)",
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "10px" }}>
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={`reading-list-skeleton-${index}`}
          style={{
            borderRadius: "20px",
            border: "1px solid var(--app-border-soft)",
            background: "var(--app-card)",
            padding: "12px",
            display: "grid",
            gridTemplateColumns: "72px minmax(0, 1fr)",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "72px",
              aspectRatio: "2 / 3",
              borderRadius: "16px",
              background: "var(--app-surface-soft)",
            }}
          />
          <div style={{ display: "grid", gap: "8px", alignContent: "center" }}>
            <div
              style={{
                height: "16px",
                width: "58%",
                borderRadius: "999px",
                background: "var(--app-surface-soft)",
              }}
            />
            <div
              style={{
                height: "12px",
                width: "34%",
                borderRadius: "999px",
                background: "var(--app-surface-soft)",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function getEmptyLabel(filterKey) {
  if (filterKey === "in_progress") {
    return "No books are marked as in progress right now.";
  }

  if (filterKey === "reading_list") {
    return "Your reading list is empty right now.";
  }

  if (filterKey === "finished") {
    return "No finished books yet.";
  }

  return "No books were found in the books table yet.";
}

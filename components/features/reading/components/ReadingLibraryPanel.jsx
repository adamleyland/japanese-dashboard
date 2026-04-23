"use client";

import { BookOpen, BookCheck, BookMarked, LibraryBig, RefreshCcw } from "lucide-react";
import GamingLayoutToggle from "@/components/features/gaming/components/GamingLayoutToggle";
import ReadingEmptyState from "@/components/features/reading/components/ReadingEmptyState";
import ReadingLibraryArtworkView from "@/components/features/reading/components/ReadingLibraryArtworkView";
import ReadingLibraryListView from "@/components/features/reading/components/ReadingLibraryListView";
import { READING_FILTERS } from "@/lib/reading/constants";

const FILTER_ICONS = {
  all: LibraryBig,
  in_progress: BookOpen,
  reading_list: BookMarked,
  finished: BookCheck,
};

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
  onStatusChange,
  statusUpdatingIds,
  isMobile,
  isCompact,
  isOverlay = false,
  showRefreshButton = true,
  targetHeight,
}) {
  const renderBody = () => {
    if (loading) {
      return (
        <ReadingLibraryLoadingState
          layoutMode={layoutMode}
          isCompact={isCompact}
          isMobile={isMobile}
        />
      );
    }

    if (error) {
      return <ReadingEmptyState label={error} tone="error" align="left" />;
    }

    if (!items.length) {
      return <ReadingEmptyState label={getEmptyLabel(filterKey)} align="left" />;
    }

    if (layoutMode === "artwork") {
      return (
        <ReadingLibraryArtworkView
          styles={styles}
          items={items}
          isMobile={isMobile}
          isCompact={isCompact}
          onStatusChange={onStatusChange}
          statusUpdatingIds={statusUpdatingIds}
        />
      );
    }

    return (
      <ReadingLibraryListView
        styles={styles}
        items={items}
        isCompact={isCompact}
        onStatusChange={onStatusChange}
        statusUpdatingIds={statusUpdatingIds}
      />
    );
  };

  return (
    <div
      style={{
        ...styles.largeCard,
        padding: isOverlay ? "0" : isMobile ? "14px" : isCompact ? "16px" : styles.largeCard.padding,
        display: "grid",
        gridTemplateRows: "auto 1fr",
        minHeight: 0,
        height: isOverlay
          ? "100%"
          : isMobile
            ? "clamp(420px, 68vh, 620px)"
            : targetHeight
              ? `${targetHeight}px`
              : "auto",
        maxHeight: isOverlay
          ? "none"
          : isMobile
            ? "clamp(420px, 68vh, 620px)"
            : targetHeight
              ? `${targetHeight}px`
              : "none",
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
          gap: isMobile ? "10px" : "14px",
          marginBottom: isOverlay ? "12px" : isMobile ? "10px" : "14px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: isMobile ? "nowrap" : "wrap",
          }}
        >
          <div style={{ minWidth: 0 }}>
            {!isOverlay ? <h2 style={styles.sectionTitle}>Reading Library</h2> : null}
            {!isMobile && !isOverlay ? (
              <p style={styles.sectionText}>
                Supabase-backed book tracking with status filters, cover-first browsing, and quick detail access.
              </p>
            ) : null}
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
                padding: isMobile ? "8px" : "8px 12px",
                display: "inline-flex",
                alignItems: "center",
                gap: isMobile ? "0" : "8px",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                width: isMobile ? "36px" : "auto",
                height: isMobile ? "36px" : "auto",
                justifyContent: "center",
                flexShrink: 0,
              }}
              aria-label="Refresh reading library"
              title="Refresh reading library"
            >
              <RefreshCcw size={13} />
              {!isMobile ? "Refresh" : null}
            </button>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: isMobile ? "8px" : "12px",
            flexWrap: "nowrap",
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: isMobile ? "4px" : "6px",
              borderRadius: "999px",
              background: "var(--app-pill-track)",
              border: "1px solid var(--app-border-soft)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
              flexWrap: "nowrap",
              minWidth: 0,
              flex: isMobile ? "0 0 auto" : "1 1 auto",
              overflowX: isMobile ? "visible" : "auto",
              scrollbarWidth: "none",
            }}
          >
            {READING_FILTERS.map((filter) => {
              const isActive = filterKey === filter.key;
              const Icon = FILTER_ICONS[filter.key];

              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => onFilterChange(filter.key)}
                  aria-label={`${filter.label} (${typeof counts?.[filter.key] === "number" ? counts[filter.key] : 0})`}
                  title={`${filter.label} (${typeof counts?.[filter.key] === "number" ? counts[filter.key] : 0})`}
                  style={{
                    border: "none",
                    background: isActive ? "var(--app-selected-surface)" : "transparent",
                    color: isActive ? "var(--app-selected-text)" : "var(--app-text-muted)",
                    borderRadius: "999px",
                    padding: isMobile ? "8px" : "8px 14px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 160ms ease",
                    boxShadow: isActive ? "0 6px 18px rgba(15,23,42,0.08)" : "none",
                    width: isMobile ? "36px" : "auto",
                    height: isMobile ? "36px" : "auto",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: isMobile ? "0" : "6px",
                    flexShrink: 0,
                  }}
                >
                  {isMobile ? (
                    <Icon size={15} />
                  ) : (
                    <>
                      {filter.label}{" "}
                      <span style={{ opacity: 0.78 }}>
                        {typeof counts?.[filter.key] === "number" ? counts[filter.key] : 0}
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>

          <GamingLayoutToggle value={layoutMode} onChange={onLayoutModeChange} compact={isMobile} />
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

function ReadingLibraryLoadingState({ layoutMode, isCompact, isMobile }) {
  if (layoutMode === "artwork") {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile
            ? "repeat(3, minmax(0, 1fr))"
            : isCompact
            ? "repeat(2, minmax(0, 1fr))"
            : "repeat(auto-fill, minmax(100px, 1fr))",
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

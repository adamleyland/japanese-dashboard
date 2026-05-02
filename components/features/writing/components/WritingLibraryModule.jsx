"use client";

import { LibraryBig } from "lucide-react";
import WritingEntryCard from "@/components/features/writing/components/WritingEntryCard";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
];

export default function WritingLibraryModule({
  styles,
  isCompact = false,
  isMobile = false,
  entries,
  loading = false,
  error = "",
  selectedEntryId,
  activeFilter,
  onFilterChange,
  onSelectEntry,
}) {
  return (
    <div
      style={{
        ...styles.largeCard,
        padding: isMobile ? "16px" : isCompact ? "16px" : styles.largeCard.padding,
        display: "grid",
        gridTemplateRows: "auto minmax(0, 1fr)",
        gap: "14px",
        minHeight: isMobile ? "auto" : "360px",
      }}
    >
      <div style={styles.sectionHeader}>
        <div style={{ minWidth: 0 }}>
          <div style={localStyles.headerEyebrowRow}>
            <div style={styles.progressContainer}>
              <div
                style={{
                  ...styles.dictionaryIconFootprint,
                  background: "rgba(20,184,166,0.14)",
                  border: "1px solid rgba(20,184,166,0.18)",
                }}
              >
                <LibraryBig size={14} color="#14b8a6" strokeWidth={2.4} />
              </div>
            </div>
            <div style={styles.eyebrow}>Previous entries</div>
          </div>
        </div>

        <div style={localStyles.filterRow}>
          {FILTERS.map((filter) => {
            const active = filter.key === activeFilter;

            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => onFilterChange(filter.key)}
                style={localStyles.filterButton(active)}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={localStyles.listBody}>
        {loading ? (
          <div style={localStyles.emptyState}>
            <div style={localStyles.emptyTitle}>Loading entries...</div>
            <div style={localStyles.emptyCopy}>
              Pulling your saved writing from Supabase.
            </div>
          </div>
        ) : error && !entries.length ? (
          <div style={localStyles.emptyState}>
            <div style={localStyles.emptyTitle}>Couldn’t load entries</div>
            <div style={localStyles.emptyCopy}>{error}</div>
          </div>
        ) : entries.length ? (
          <div style={localStyles.entryStack}>
            {entries.map((entry) => (
              <WritingEntryCard
                key={entry.id}
                entry={entry}
                active={entry.id === selectedEntryId}
                onSelect={onSelectEntry}
              />
            ))}
          </div>
        ) : (
          <div style={localStyles.emptyState}>
            <div style={localStyles.emptyTitle}>No entries yet</div>
            <div style={localStyles.emptyCopy}>
              Saved writing will appear here so you can revisit drafts, reflections, and journal streaks.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const localStyles = {
  headerEyebrowRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "8px",
  },
  filterRow: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px",
    borderRadius: "999px",
    background: "var(--app-pill-track)",
    border: "1px solid var(--app-border-soft)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
    width: "fit-content",
    maxWidth: "100%",
    flexWrap: "wrap",
  },
  filterButton: (active) => ({
    border: "none",
    background: active ? "var(--app-selected-surface)" : "transparent",
    color: active ? "var(--app-selected-text)" : "var(--app-text-muted)",
    borderRadius: "999px",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: active ? "0 6px 18px rgba(15,23,42,0.08)" : "none",
  }),
  listBody: {
    minHeight: 0,
    overflowY: "auto",
    paddingRight: "4px",
    overscrollBehavior: "contain",
  },
  entryStack: {
    display: "grid",
    gap: "10px",
  },
  emptyState: {
    borderRadius: "20px",
    border: "1px dashed var(--app-border)",
    background: "var(--app-surface-elevated)",
    padding: "20px",
    display: "grid",
    gap: "8px",
  },
  emptyTitle: {
    fontSize: "16px",
    fontWeight: 700,
    color: "var(--app-text)",
  },
  emptyCopy: {
    fontSize: "13px",
    lineHeight: 1.6,
    color: "var(--app-text-muted)",
  },
};

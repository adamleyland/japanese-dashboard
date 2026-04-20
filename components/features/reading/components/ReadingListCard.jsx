"use client";

import { RefreshCcw } from "lucide-react";
import ReadingCoverArtwork from "@/components/features/reading/components/ReadingCoverArtwork";
import ReadingEmptyState from "@/components/features/reading/components/ReadingEmptyState";
import { READING_FILTERS } from "@/lib/reading/constants";
import { formatReadingPercent } from "@/lib/reading/normalizers";

export default function ReadingListCard({
  styles,
  items,
  loading,
  error,
  filterKey,
  onFilterChange,
  counts,
  onRefresh,
  targetHeight,
}) {
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
            <h2 style={styles.sectionTitle}>Reading List</h2>
            <p style={styles.sectionText}>
              Supabase-backed library rows, polished for CSV imports and cover-heavy browsing.
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
        {loading ? (
          <div style={{ display: "grid", gap: "10px" }}>
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`reading-skeleton-${index}`}
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
                  <div
                    style={{
                      height: "10px",
                      width: "72%",
                      borderRadius: "999px",
                      background: "var(--app-surface-soft)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <ReadingEmptyState label={error} tone="error" align="left" />
        ) : !items.length ? (
          <ReadingEmptyState
            label={
              filterKey === "current"
                ? "No active book yet. Mark a row as currently reading to surface it here."
                : filterKey === "completed"
                  ? "Nothing marked as read yet."
                  : "Your reading list is empty right now. Import your CSV-backed rows into Supabase to populate it."
            }
            align="left"
          />
        ) : (
          <div style={{ display: "grid", gap: "10px" }}>
            {items.map((item) => (
              <article
                key={item.id}
                style={{
                  borderRadius: "20px",
                  border: "1px solid var(--app-border-soft)",
                  background: "var(--app-card)",
                  padding: "12px",
                  display: "grid",
                  gridTemplateColumns: "72px minmax(0, 1fr)",
                  gap: "12px",
                  boxShadow: "0 10px 24px rgba(15,23,42,0.05)",
                }}
              >
                <ReadingCoverArtwork item={item} />

                <div style={{ display: "grid", gap: "10px", minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "10px",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: "16px",
                          fontWeight: 800,
                          letterSpacing: "-0.02em",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {item.title}
                      </h3>
                      <p
                        style={{
                          ...styles.playerSub,
                          margin: "4px 0 0 0",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {item.author}
                      </p>
                    </div>

                    <StatusBadge status={item.status} label={item.statusLabel} />
                  </div>

                  <div style={{ display: "grid", gap: "8px" }}>
                    <div style={{ ...styles.playerSub, margin: 0 }}>{item.progressLabel}</div>

                    {item.progressPercent !== null ? (
                      <div style={{ display: "grid", gap: "6px" }}>
                        <div style={styles.progressBarWrap}>
                          <div
                            style={{
                              ...styles.progressBarFill(item.progressPercent),
                              background: "#3b82f6",
                            }}
                          />
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "10px",
                            fontSize: "11px",
                            color: "var(--app-text-muted)",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            fontWeight: 700,
                          }}
                        >
                          <span>{item.statusLabel}</span>
                          <span>{formatReadingPercent(item.progressPercent)}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status, label }) {
  const tone =
    status === "current"
      ? {
          background: "rgba(59,130,246,0.14)",
          color: "#2563eb",
          border: "1px solid rgba(59,130,246,0.18)",
        }
      : status === "completed"
        ? {
            background: "rgba(16,185,129,0.14)",
            color: "#059669",
            border: "1px solid rgba(16,185,129,0.18)",
          }
        : {
            background: "var(--app-surface-elevated)",
            color: "var(--app-text-muted)",
            border: "1px solid var(--app-border-soft)",
          };

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
      {label}
    </span>
  );
}


"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import ReadingBookDetails from "@/components/features/reading/components/ReadingBookDetails";
import ReadingCoverArtwork from "@/components/features/reading/components/ReadingCoverArtwork";
import ReadingStatusBadge from "@/components/features/reading/components/ReadingStatusBadge";

export default function ReadingLibraryListView({ styles, items, isCompact }) {
  const [expandedBookId, setExpandedBookId] = useState(null);
  const resolvedExpandedBookId = items.some((item) => item.id === expandedBookId)
    ? expandedBookId
    : null;

  return (
    <div style={{ display: "grid", gap: "10px" }}>
      {items.map((item) => {
        const isExpanded = resolvedExpandedBookId === item.id;

        return (
          <article
            key={item.id}
            style={{
              borderRadius: "20px",
              border: isExpanded
                ? "1px solid rgba(59,130,246,0.24)"
                : "1px solid var(--app-border-soft)",
              background: "var(--app-card)",
              boxShadow: isExpanded
                ? "0 16px 32px rgba(59,130,246,0.08)"
                : "0 10px 24px rgba(15,23,42,0.05)",
              overflow: "hidden",
              transition: "border-color 160ms ease, box-shadow 160ms ease",
            }}
          >
            <button
              type="button"
              onClick={() =>
                setExpandedBookId((currentValue) =>
                  (resolvedExpandedBookId ?? currentValue) === item.id ? null : item.id,
                )
              }
              aria-expanded={isExpanded}
              style={{
                width: "100%",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: "12px",
                display: "grid",
                gridTemplateColumns: isCompact ? "72px minmax(0, 1fr)" : "84px minmax(0, 1fr)",
                gap: "12px",
                textAlign: "left",
              }}
            >
              <ReadingCoverArtwork
                item={item}
                width={isCompact ? 72 : 84}
                borderRadius={16}
              />

              <div style={{ display: "grid", gap: "10px", minWidth: 0, alignContent: "start" }}>
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
                        fontSize: isCompact ? "15px" : "16px",
                        fontWeight: 800,
                        letterSpacing: "-0.02em",
                        lineHeight: 1.25,
                      }}
                    >
                      {item.title}
                    </h3>
                    {item.author ? (
                      <p style={{ ...styles.playerSub, margin: "5px 0 0 0" }}>{item.author}</p>
                    ) : null}
                  </div>

                  {!isCompact ? <ReadingStatusBadge status={item.status} /> : null}
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "10px",
                    flexWrap: "wrap",
                  }}
                >
                  {isCompact ? <ReadingStatusBadge status={item.status} /> : null}
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      color: "var(--app-text-muted)",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    {isExpanded ? "Hide details" : "Show details"}
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </span>
                </div>
              </div>
            </button>

            {isExpanded ? (
              <div
                style={{
                  borderTop: "1px solid var(--app-border-soft)",
                  padding: "0 12px 12px 12px",
                }}
              >
                <div
                  style={{
                    borderRadius: "16px",
                    background: "var(--app-surface-elevated)",
                    border: "1px solid var(--app-border-soft)",
                    padding: "14px",
                  }}
                >
                  <ReadingBookDetails book={item} styles={styles} compact={isCompact} />
                </div>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

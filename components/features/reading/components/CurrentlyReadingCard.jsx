"use client";

import { BookOpenText, BookmarkCheck } from "lucide-react";
import ReadingCoverArtwork from "@/components/features/reading/components/ReadingCoverArtwork";
import ReadingEmptyState from "@/components/features/reading/components/ReadingEmptyState";
import { formatReadingPercent } from "@/lib/reading/normalizers";

export default function CurrentlyReadingCard({ styles, item, loading }) {
  if (!item && !loading) {
    return (
      <div style={styles.sideCard}>
        <CardHeader styles={styles} icon={BookOpenText} iconColor="#3b82f6" label="Currently Reading" />
        <ReadingEmptyState
          label="No book is marked as currently reading yet. Your active title will be highlighted here."
        />
      </div>
    );
  }

  return (
    <div style={styles.sideCard}>
      <CardHeader styles={styles} icon={BookmarkCheck} iconColor="#3b82f6" label="Currently Reading" />

      {loading && !item ? (
        <div style={{ ...styles.playerSub, padding: "8px 0" }}>Loading your active book...</div>
      ) : null}

      {item ? (
        <div style={{ display: "grid", gap: "14px" }}>
          <div
            style={{
              borderRadius: "20px",
              border: "1px solid var(--app-border-soft)",
              background: "linear-gradient(145deg, rgba(59,130,246,0.14), rgba(15,23,42,0.04))",
              padding: "14px",
              display: "grid",
              gridTemplateColumns: "94px minmax(0, 1fr)",
              gap: "14px",
              alignItems: "center",
            }}
          >
            <ReadingCoverArtwork item={item} width={94} borderRadius={18} />

            <div style={{ display: "grid", gap: "8px", minWidth: 0 }}>
              <div style={{ minWidth: 0 }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "22px",
                    letterSpacing: "-0.03em",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {item.title}
                </h3>
                {item.subtitle || item.author ? (
                  <p style={{ ...styles.playerSub, margin: "4px 0 0 0" }}>
                    {item.subtitle || item.author}
                  </p>
                ) : null}
              </div>

              {item.progressLabel ? (
                <div style={{ ...styles.playerSub, margin: 0 }}>{item.progressLabel}</div>
              ) : null}

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
                      fontSize: "11px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "var(--app-text-muted)",
                    }}
                  >
                    {formatReadingPercent(item.progressPercent)} complete
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CardHeader({ styles, icon: Icon, iconColor, label }) {
  return (
    <div
      style={{
        ...styles.wordCardHeader,
        marginBottom: "10px",
        alignItems: "flex-start",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
        <div style={styles.progressContainer}>
          <div
            style={{
              ...styles.dictionaryIconFootprint,
              background: "rgba(59,130,246,0.16)",
              border: "1px solid rgba(59,130,246,0.18)",
            }}
          >
            <Icon size={14} color={iconColor} strokeWidth={2.5} />
          </div>
        </div>

        <div style={{ display: "grid", gap: "3px", minWidth: 0 }}>
          <div style={styles.eyebrow}>{label}</div>
        </div>
      </div>
    </div>
  );
}


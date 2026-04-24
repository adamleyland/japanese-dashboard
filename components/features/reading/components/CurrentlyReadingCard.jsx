"use client";

import { useState } from "react";
import { BookOpenText, BookmarkCheck, Headphones } from "lucide-react";
import ReadingCoverArtwork from "@/components/features/reading/components/ReadingCoverArtwork";
import ReadingEmptyState from "@/components/features/reading/components/ReadingEmptyState";
import { formatReadingPercent } from "@/lib/reading/normalizers";

export default function CurrentlyReadingCard({
  styles,
  item,
  loading,
  isMobile = false,
  audiobookStatus = "idle",
  onReadWithAudiobook,
}) {
  const [coverHovered, setCoverHovered] = useState(false);

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

  const lessonUrl =
    typeof item?.lessonUrl === "string" && item.lessonUrl.trim() ? item.lessonUrl.trim() : null;
  const coverLabel = item?.title
    ? `Open ${item.title} in LingQ`
    : "Open current LingQ lesson";
  const coverContent = (
    <ReadingCoverArtwork item={item} width={94} borderRadius={18} />
  );
  const canOpenAudiobook = Boolean(item && onReadWithAudiobook);
  const audiobookButtonLabel = getAudiobookButtonLabel(audiobookStatus);

  return (
    <div style={styles.sideCard}>
      <CardHeader
        styles={styles}
        icon={BookmarkCheck}
        iconColor="#3b82f6"
        label="Currently Reading"
        action={
          canOpenAudiobook ? (
            <button
              type="button"
              onClick={onReadWithAudiobook}
              disabled={audiobookStatus === "searching"}
              style={audiobookButtonStyle(audiobookStatus)}
              aria-label={audiobookButtonLabel}
              title={audiobookButtonLabel}
            >
              <Headphones size={15} />
            </button>
          ) : null
        }
      />

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
            {lessonUrl ? (
              <a
                href={lessonUrl}
                target={isMobile ? undefined : "_blank"}
                rel={isMobile ? undefined : "noopener noreferrer"}
                aria-label={coverLabel}
                title={coverLabel}
                onMouseEnter={() => setCoverHovered(true)}
                onMouseLeave={() => setCoverHovered(false)}
                onFocus={() => setCoverHovered(true)}
                onBlur={() => setCoverHovered(false)}
                style={{
                  display: "inline-flex",
                  width: "fit-content",
                  borderRadius: "18px",
                  overflow: "hidden",
                  textDecoration: "none",
                  cursor: "pointer",
                  boxShadow: coverHovered
                    ? "0 10px 24px rgba(59,130,246,0.24)"
                    : "0 0 0 rgba(59,130,246,0)",
                  transform: coverHovered ? "translateY(-1px)" : "translateY(0)",
                  transition: "transform 160ms ease, box-shadow 160ms ease",
                }}
              >
                {coverContent}
              </a>
            ) : (
              coverContent
            )}

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

function getAudiobookButtonLabel(status) {
  if (status === "searching") {
    return "Finding...";
  }

  if (status === "ready") {
    return "Audiobook ready";
  }

  if (status === "missing") {
    return "No audiobook found";
  }

  return "Read with audiobook";
}

function audiobookButtonStyle(status) {
  const searching = status === "searching";
  const ready = status === "ready";
  const missing = status === "missing";

  return {
    border: ready
      ? "1px solid rgba(16,185,129,0.28)"
      : missing
        ? "1px solid rgba(239,68,68,0.22)"
        : "1px solid var(--app-border)",
    background: ready
      ? "rgba(16,185,129,0.12)"
      : missing
        ? "rgba(239,68,68,0.1)"
        : "var(--app-surface)",
    color: ready ? "#059669" : missing ? "#dc2626" : "var(--app-text-soft)",
    borderRadius: "999px",
    width: "34px",
    height: "34px",
    padding: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: searching ? "wait" : "pointer",
    opacity: searching ? 0.72 : 1,
    boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
    flexShrink: 0,
  };
}

function CardHeader({ styles, icon: Icon, iconColor, label, action = null }) {
  return (
    <div
      style={{
        ...styles.wordCardHeader,
        marginBottom: "10px",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "12px",
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

      {action}
    </div>
  );
}


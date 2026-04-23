"use client";

import { Gamepad2 } from "lucide-react";
import {
  formatPercentage,
  formatPlaytimeCompact,
  formatPlaytimeHours,
} from "@/lib/gaming/gaming-utils";

export default function GamingVisualizationCard({
  styles,
  totalMinutes,
  includedCount,
  excludedCount,
  topGames,
  isMobile = false,
}) {
  const totalGames = Math.max(0, includedCount + excludedCount);
  const includedShare = totalGames ? Math.max(0, Math.min(100, (includedCount / totalGames) * 100)) : 0;

  if (isMobile) {
    return (
      <div
        style={{
          ...styles.sideCard,
          padding: "12px 14px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            fontSize: "18px",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "var(--app-text)",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
          title={formatPlaytimeCompact(totalMinutes)}
          aria-label={`Tracked gaming total ${formatPlaytimeCompact(totalMinutes)}`}
        >
          {formatPlaytimeCompact(totalMinutes)}
        </div>

        <div
          style={{
            flex: "1 1 auto",
            minWidth: 0,
          }}
        >
          <div
            style={{
              ...styles.progressBarWrap,
              height: "10px",
              borderRadius: "999px",
            }}
            aria-hidden="true"
          >
            <div
              style={{
                ...styles.progressBarFill(includedShare),
                background: "#8b5cf6",
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.sideCard}>
      <div
        style={{
          ...styles.wordCardHeader,
          marginBottom: "8px",
          alignItems: "flex-start",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
          <div style={styles.progressContainer}>
            <div
              style={{
                ...styles.dictionaryIconFootprint,
                background: "rgba(139, 92, 246, 0.16)",
                border: "1px solid rgba(139, 92, 246, 0.18)",
              }}
            >
              <Gamepad2 size={14} color="#8b5cf6" strokeWidth={2.5} />
            </div>
          </div>

          <div style={{ display: "grid", gap: "3px", minWidth: 0 }}>
            <div style={styles.eyebrow}>Progress</div>
          </div>
        </div>
      </div>

      <div style={styles.visualMainStats}>
        <div style={styles.visualLargeValue}>{formatPlaytimeCompact(totalMinutes)}</div>
        <p
          style={{
            textAlign: "center",
            fontSize: "11px",
            textTransform: "uppercase",
            color: "var(--app-text-muted)",
            margin: "-5px 0 10px 0",
            letterSpacing: "0.05em",
          }}
        >
          Tracked Gaming Total
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "8px",
          marginBottom: "16px",
        }}
      >
        <SummaryPill label="Included" value={String(includedCount)} />
        <SummaryPill label="Excluded" value={String(excludedCount)} />
      </div>

      <div style={{ display: "grid", gap: "10px" }}>
        {topGames.length ? (
          topGames.map((game) => {
            const percentage = formatPercentage(game.minutesPlayedTotal, totalMinutes);
            const width = totalMinutes
              ? Math.max(6, (game.minutesPlayedTotal / totalMinutes) * 100)
              : 0;

            return (
              <div
                key={`${game.source}:${game.sourceGameId}`}
                style={{
                  display: "grid",
                  gap: "8px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "10px",
                    fontSize: "12px",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {game.title}
                    </div>
                  </div>

                  <div
                    style={{
                      fontWeight: 700,
                      color: "var(--app-text-soft)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatPlaytimeHours(game.minutesPlayedTotal)} • {percentage}
                  </div>
                </div>

                <div style={styles.progressBarWrap}>
                  <div
                    style={{
                      ...styles.progressBarFill(width),
                      background: "#8b5cf6",
                    }}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ ...styles.playerSub, padding: "8px 0" }}>
            Your top included games with tracked hours will appear here once source data is available.
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryPill({ label, value }) {
  return (
    <div
      style={{
        borderRadius: "14px",
        border: "1px solid var(--app-border-soft)",
        background: "var(--app-surface-elevated)",
        padding: "10px 12px",
        display: "grid",
        gap: "3px",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          color: "var(--app-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: "18px", fontWeight: 800 }}>{value}</div>
    </div>
  );
}

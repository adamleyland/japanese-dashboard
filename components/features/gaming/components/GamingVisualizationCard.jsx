"use client";

import { BarChart3, Gamepad2 } from "lucide-react";
import { formatPlaytimeCompact, getSourceLabel } from "@/lib/gaming/gaming-utils";

export default function GamingVisualizationCard({
  styles,
  totalMinutes,
  includedCount,
  excludedCount,
  topGames,
}) {
  const maxMinutes = Math.max(1, ...topGames.map((game) => game.minutesPlayedTotal || 0));

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
            <div style={{ fontSize: "12px", color: "var(--app-text-muted)" }}>
              Included playtime total
            </div>
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
          Overall Gaming Total
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
            const width = Math.max(10, (game.minutesPlayedTotal / maxMinutes) * 100);

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
                    <div style={{ color: "var(--app-text-muted)" }}>{getSourceLabel(game.source)}</div>
                  </div>

                  <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <BarChart3 size={12} />
                    <span style={{ fontWeight: 700 }}>{formatPlaytimeCompact(game.minutesPlayedTotal)}</span>
                  </div>
                </div>

                <div style={styles.progressBarWrap}>
                  <div
                    style={{
                      ...styles.progressBarFill(width),
                      background: game.includeInOverallTotal === false ? "#94a3b8" : "#8b5cf6",
                    }}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ ...styles.playerSub, padding: "8px 0" }}>
            Your top games will appear here once source data is available.
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

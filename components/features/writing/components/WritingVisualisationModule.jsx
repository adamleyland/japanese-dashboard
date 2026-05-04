"use client";

import { BarChart3 } from "lucide-react";
import { formatWritingCount } from "@/components/features/writing/utils/writingStats";

export default function WritingVisualisationModule({ styles, isMobile = false, summary }) {
  const maxBarValue = Math.max(1, ...summary.weeklyActivity.map((item) => item.estimatedWords));
  const activeDaysThisWeek = summary.weeklyActivity.filter((item) => item.estimatedWords > 0).length;
  const weeklyConsistencyProgress = Math.round((activeDaysThisWeek / Math.max(1, summary.weeklyActivity.length)) * 100);

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
          title={`${formatWritingCount(summary.totalEstimatedWords)} total words written`}
          aria-label={`Writing total ${formatWritingCount(summary.totalEstimatedWords)} words written`}
        >
          {formatWritingCount(summary.totalEstimatedWords)}
        </div>

        <div
          style={{
            flex: "1 1 auto",
            minWidth: 0,
          }}
          title={`${activeDaysThisWeek} active writing days in the last 7 days`}
          aria-label={`${activeDaysThisWeek} active writing days in the last 7 days`}
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
                ...styles.progressBarFill(weeklyConsistencyProgress),
                background: "#10b981",
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
                background: "rgba(16,185,129,0.14)",
                border: "1px solid rgba(16,185,129,0.18)",
              }}
            >
              <BarChart3 size={14} color="#10b981" strokeWidth={2.5} />
            </div>
          </div>

          <div style={{ display: "grid", gap: "3px", minWidth: 0 }}>
            <div style={styles.eyebrow}>Writing stats</div>
          </div>
        </div>
      </div>

      <div style={styles.visualMainStats}>
        <div style={styles.visualLargeValue}>{formatWritingCount(summary.totalEstimatedWords)}</div>
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
          Total words written
        </p>
      </div>

      <div style={localStyles.chartCard}>
        <div style={localStyles.chartHeader}>
          <div style={localStyles.chartTitle}>Last 7 days</div>
          <div style={localStyles.chartSub}>{formatWritingCount(summary.weekEstimatedWords)} words this week</div>
        </div>

        <div style={localStyles.barGrid(isMobile)}>
          {summary.weeklyActivity.map((item) => {
            const height = Math.max(10, Math.round((item.estimatedWords / maxBarValue) * 100));

            return (
              <div key={item.dayKey} style={localStyles.barColumn}>
                <div style={localStyles.barValue}>{item.estimatedWords ? formatWritingCount(item.estimatedWords) : "-"}</div>
                <div style={localStyles.barTrack}>
                  <div style={localStyles.barFill(height)} />
                </div>
                <div style={localStyles.barLabel}>{item.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const localStyles = {
  chartCard: {
    display: "grid",
    gap: "14px",
    borderRadius: "20px",
    border: "1px solid var(--app-border-soft)",
    background: "linear-gradient(180deg, var(--app-surface-elevated) 0%, var(--app-card) 100%)",
    padding: "14px",
  },
  chartHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "baseline",
    flexWrap: "wrap",
  },
  chartTitle: {
    fontSize: "13px",
    fontWeight: 700,
    color: "var(--app-text)",
  },
  chartSub: {
    fontSize: "12px",
    color: "var(--app-text-muted)",
  },
  barGrid: (isMobile) => ({
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    gap: isMobile ? "8px" : "10px",
    alignItems: "end",
    minHeight: "180px",
  }),
  barColumn: {
    display: "grid",
    gap: "8px",
    justifyItems: "center",
    minWidth: 0,
  },
  barValue: {
    fontSize: "10px",
    color: "var(--app-text-muted)",
    minHeight: "12px",
    whiteSpace: "nowrap",
  },
  barTrack: {
    width: "100%",
    height: "110px",
    borderRadius: "16px",
    background: "var(--app-progress-track)",
    display: "flex",
    alignItems: "flex-end",
    overflow: "hidden",
  },
  barFill: (height) => ({
    width: "100%",
    height: `${height}%`,
    borderRadius: "16px",
    background: "linear-gradient(180deg, #34d399 0%, #059669 100%)",
  }),
  barLabel: {
    fontSize: "11px",
    fontWeight: 700,
    color: "var(--app-text-soft)",
  },
};

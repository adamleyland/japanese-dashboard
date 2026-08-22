"use client";

import { useEffect, useState } from "react";
import { BarChart3, Settings } from "lucide-react";
import { formatWritingCount } from "@/components/features/writing/utils/writingStats";

export default function WritingVisualisationModule({
  styles,
  isMobile = false,
  summary,
  goalWords = 10000,
  setGoalWords,
  settingsOpen = false,
  setSettingsOpen,
}) {
  const maxBarValue = Math.max(1, ...summary.weeklyActivity.map((item) => item.estimatedWords));
  const safeTotalWords = Math.max(0, Number(summary.totalEstimatedWords) || 0);
  const safeGoalWords = Math.max(1, Math.round(Number(goalWords) || 1));
  const goalProgress = Math.min(100, (safeTotalWords / safeGoalWords) * 100);
  const remainingWords = Math.max(0, safeGoalWords - safeTotalWords);

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
          title={`${formatWritingCount(safeTotalWords)} of ${formatWritingCount(safeGoalWords)} words`}
          aria-label={`Writing goal progress ${formatWritingCount(safeTotalWords)} of ${formatWritingCount(safeGoalWords)} words`}
        >
          {formatWritingCount(safeTotalWords)}
        </div>

        <div
          style={{
            flex: "1 1 auto",
            minWidth: 0,
          }}
          title={`${Math.round(goalProgress)}% of writing goal`}
          aria-label={`${Math.round(goalProgress)}% of writing goal`}
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
                ...styles.progressBarFill(goalProgress),
                background: "#10b981",
              }}
            />
          </div>
        </div>

        <div style={localStyles.mobilePercentage}>{Math.round(goalProgress)}%</div>
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

        <button
          type="button"
          onClick={() => setSettingsOpen?.((currentValue) => !currentValue)}
          style={styles.iconBadgeBtn}
          aria-label={settingsOpen ? "Hide writing goal settings" : "Edit writing goal"}
          title="Edit writing goal"
        >
          <Settings size={16} />
        </button>
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

      <div style={localStyles.goalBlock}>
        <div style={styles.progressBarWrap}>
          <div
            style={{
              ...styles.progressBarFill(goalProgress),
              background: "#10b981",
            }}
          />
          <div style={styles.progressBarLabel}>
            <span>{Math.round(goalProgress)}%</span>
            <span>{goalProgress >= 100 ? "goal reached" : "to goal"}</span>
          </div>
        </div>

        <div style={localStyles.goalPills}>
          <SummaryPill label="Goal" value={`${formatWritingCount(safeGoalWords)} words`} />
          <SummaryPill label="Remaining" value={`${formatWritingCount(remainingWords)} words`} />
        </div>
      </div>

      {settingsOpen ? (
        <div style={{ ...styles.goalGrid, marginBottom: "16px" }}>
          <label style={localStyles.goalLabel}>
            <span style={localStyles.goalLabelText}>Goal (words)</span>
            <GoalWordsInput value={safeGoalWords} onChange={setGoalWords} />
          </label>

          <div style={localStyles.goalPresets}>
            {[5000, 10000, 25000].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setGoalWords?.(preset)}
                style={styles.adjustBtn}
              >
                {formatWritingCount(preset)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

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

function GoalWordsInput({ value, onChange }) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commitDraft = () => {
    const nextGoal = Math.round(Number(draft));
    if (Number.isFinite(nextGoal) && nextGoal > 0) {
      onChange?.(nextGoal);
      setDraft(String(nextGoal));
      return;
    }
    setDraft(String(value));
  };

  return (
    <input
      type="number"
      min="1"
      step="500"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commitDraft}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      style={localStyles.goalInput}
    />
  );
}

function SummaryPill({ label, value }) {
  return (
    <div style={localStyles.summaryPill}>
      <div style={localStyles.summaryPillLabel}>{label}</div>
      <div style={localStyles.summaryPillValue}>{value}</div>
    </div>
  );
}

const localStyles = {
  mobilePercentage: {
    flexShrink: 0,
    color: "var(--app-text-muted)",
    fontSize: "11px",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  goalBlock: {
    display: "grid",
    gap: "10px",
    marginBottom: "16px",
  },
  goalPills: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "8px",
  },
  goalLabel: { display: "grid", gap: "6px", minWidth: 0 },
  goalLabelText: {
    color: "var(--app-text-muted)",
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  goalInput: {
    width: "100%",
    minWidth: 0,
    padding: "10px",
    borderRadius: "12px",
    border: "1px solid var(--app-border)",
    background: "var(--app-surface-strong)",
    color: "var(--app-text)",
    fontSize: "14px",
    boxSizing: "border-box",
    outline: "none",
  },
  goalPresets: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "8px",
  },
  summaryPill: {
    display: "grid",
    gap: "3px",
    padding: "10px 12px",
    borderRadius: "14px",
    border: "1px solid var(--app-border-soft)",
    background: "var(--app-surface-elevated)",
  },
  summaryPillLabel: {
    color: "var(--app-text-muted)",
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  summaryPillValue: { color: "var(--app-text)", fontSize: "16px", fontWeight: 800 },
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

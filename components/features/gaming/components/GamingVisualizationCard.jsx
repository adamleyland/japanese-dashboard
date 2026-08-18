"use client";

import { useEffect, useState } from "react";
import { Gamepad2, SlidersHorizontal } from "lucide-react";
import {
  formatPercentage,
  formatPlaytimeCompact,
  formatPlaytimeHours,
} from "@/lib/gaming/gaming-utils";

export default function GamingVisualizationCard({
  styles,
  totalMinutes,
  goalHours,
  setGoalHours,
  settingsOpen,
  setSettingsOpen,
  topGames,
  isMobile = false,
  isCompact = false,
}) {
  const safeTotalMinutes = Math.max(0, Number(totalMinutes) || 0);
  const safeGoalHours = Math.max(1, Number(goalHours) || 1);
  const goalMinutes = safeGoalHours * 60;
  const progress = Math.min(100, (safeTotalMinutes / goalMinutes) * 100);
  const remainingMinutes = Math.max(0, goalMinutes - safeTotalMinutes);

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
            fontSize: isCompact ? "16px" : "18px",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "var(--app-text)",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
          title={`${formatPlaytimeCompact(safeTotalMinutes)} of ${formatPlaytimeHours(goalMinutes)}`}
          aria-label={`Playtime goal progress ${formatPlaytimeCompact(safeTotalMinutes)} of ${formatPlaytimeHours(goalMinutes)}`}
        >
          {formatPlaytimeCompact(safeTotalMinutes)}
        </div>

        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
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
                ...styles.progressBarFill(progress),
                background: "#8b5cf6",
              }}
            />
          </div>
        </div>

        <div
          style={{
            fontSize: "11px",
            fontWeight: 700,
            color: "var(--app-text-muted)",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {Math.round(progress)}%
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
          <div style={styles.eyebrow}>Playtime goal</div>
        </div>

        <button
          type="button"
          onClick={() => setSettingsOpen((currentValue) => !currentValue)}
          style={styles.iconBadgeBtn}
          aria-label={settingsOpen ? "Hide playtime goal settings" : "Edit playtime goal"}
          title="Edit playtime goal"
        >
          <SlidersHorizontal size={16} />
        </button>
      </div>

      <div style={styles.visualMainStats}>
        <div style={styles.visualLargeValue}>{formatPlaytimeCompact(safeTotalMinutes)}</div>
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
          Total tracked playtime
        </p>
      </div>

      <div style={{ display: "grid", gap: "10px", marginBottom: "16px" }}>
        <div style={styles.progressBarWrap}>
          <div
            style={{
              ...styles.progressBarFill(progress),
              background: "#8b5cf6",
            }}
          />
          <div style={styles.progressBarLabel}>
            <span>{Math.round(progress)}%</span>
            <span>{progress >= 100 ? "goal reached" : "to goal"}</span>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: "8px",
          }}
        >
          <SummaryPill label="Goal" value={formatPlaytimeHours(goalMinutes)} />
          <SummaryPill label="Remaining" value={formatPlaytimeHours(remainingMinutes)} />
        </div>
      </div>

      {settingsOpen ? (
        <div style={{ ...styles.goalGrid, marginBottom: "16px" }}>
          <label style={{ display: "grid", gap: "6px", minWidth: 0 }}>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "var(--app-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Goal (hours)
            </span>
            <GoalHoursInput value={safeGoalHours} onChange={setGoalHours} />
          </label>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: "8px",
            }}
          >
            {[250, 500, 1000].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setGoalHours(preset)}
                style={styles.adjustBtn}
              >
                {preset}h
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div
        style={{
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--app-text-muted)",
          marginBottom: "8px",
        }}
      >
        Top played games
      </div>

      <div style={{ display: "grid", gap: "2px" }}>
        {topGames.length ? (
          topGames.map((game, index) => {
            const percentage = formatPercentage(game.minutesPlayedTotal, safeTotalMinutes);

            return (
              <div
                key={`${game.source}:${game.sourceGameId}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "24px minmax(0, 1fr) auto",
                  alignItems: "center",
                  gap: "10px",
                  padding: "9px 0",
                  borderBottom:
                    index === topGames.length - 1
                      ? "none"
                      : "1px solid var(--app-border-soft)",
                  fontSize: "12px",
                }}
              >
                <div
                  style={{
                    color: "var(--app-text-muted)",
                    fontWeight: 800,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {String(index + 1).padStart(2, "0")}
                </div>

                <div
                  style={{
                    minWidth: 0,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {game.title}
                </div>

                <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <div style={{ fontWeight: 800, color: "var(--app-text-soft)" }}>
                    {formatPlaytimeHours(game.minutesPlayedTotal)}
                  </div>
                  <div
                    style={{
                      marginTop: "1px",
                      fontSize: "10px",
                      color: "var(--app-text-muted)",
                    }}
                  >
                    {percentage} of total
                  </div>
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

function GoalHoursInput({ value, onChange }) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commitDraft = () => {
    const nextGoal = Number(draft);

    if (Number.isFinite(nextGoal) && nextGoal > 0) {
      onChange(nextGoal);
      setDraft(String(nextGoal));
      return;
    }

    setDraft(String(value));
  };

  return (
    <input
      type="number"
      min="1"
      step="50"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commitDraft}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      style={{
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
      }}
    />
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

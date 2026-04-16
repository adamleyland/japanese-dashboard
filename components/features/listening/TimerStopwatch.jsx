"use client";

import { Pause, Play, RotateCcw, Check } from "lucide-react";
import { PillSliderToggle, ProgressRing } from "@/components/dashboard/DictionaryCarousel";

export default function TimerStopwatch({
  styles,
  clockMode,
  stopwatchSeconds,
  stopwatchRunning,
  timerSeconds,
  timerRunning,
  toggleTimerStart,
  bankStopwatch,
  setClockMode,
  setStopwatchRunning,
  setStopwatchSeconds,
  setTimerRunning,
  setTimerSeconds,
  liveSessionDisplay,
}) {
  return (
    <div style={styles.sideCard}>
      <div style={styles.clockHeader}>
        <h3 style={styles.sideTitle}>Live Session Timer</h3>
        <PillSliderToggle
          value={clockMode}
          options={[
            { value: "stopwatch", label: "Stopwatch" },
            { value: "timer", label: "Timer" },
          ]}
          onChange={setClockMode}
          width={200}
          size="sm"
        />
      </div>

      <div style={styles.timerContainer}>
        <div style={styles.timerRingWrap}>
          <ProgressRing
            radius={70}
            stroke={6}
            progress={
              ((((clockMode === "timer" ? 300 - timerSeconds : stopwatchSeconds) % 60) /
                60) *
                100)
            }
            color="#6366f1"
          />
          <div style={styles.timerRingValue}>
            {liveSessionDisplay}
            <div
              style={{
                fontSize: "11px",
                fontWeight: 500,
                color: "#64748b",
                opacity: 0.8,
              }}
            >
              MIN:SEC
            </div>
          </div>
        </div>

        <div style={styles.timerActionRow}>
          <button
            style={styles.iconActionButton(
              clockMode === "stopwatch" ? stopwatchRunning : timerRunning,
            )}
            onClick={toggleTimerStart}
          >
            {clockMode === "stopwatch" ? stopwatchRunning : timerRunning ? (
              <Pause size={14} />
            ) : (
              <Play size={14} />
            )}
          </button>
          <button
            style={styles.iconActionButton(false)}
            onClick={() => {
              if (clockMode === "stopwatch") {
                setStopwatchRunning(false);
                setStopwatchSeconds(0);
              } else {
                setTimerRunning(false);
                setTimerSeconds(300);
              }
            }}
          >
            <RotateCcw size={14} />
          </button>
          <button
            style={styles.iconActionButton(false)}
            onClick={clockMode === "stopwatch" ? bankStopwatch : () => {}}
          >
            <Check size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
